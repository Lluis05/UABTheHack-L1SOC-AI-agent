"""Prefiltro determinista (Persona A): decide sin IA cuando la política es inequívoca.

    hint = prefilter(ctx)                      # None si la política no es concluyente
    ticket = deterministic_ticket(ctx, store)  # ticket completo decidido por la política (o pendiente de IA)

- Modo batch: si `hint["decisive"]`, el ticket se cierra con la política (x_decided_by.verdict = "policy") y
  no se gasta LLM. Es el 87 % del dataset.
- Modo en vivo: el hint se pasa al agente LLM como pista; la IA confirma o discrepa (x_prefilter_agreement).
"""

from __future__ import annotations

from soc.enrich.osint import describe as osint_describe
from soc.policy import suggest_verdict

VERDICT_ES = {"true_positive": "verdadero positivo", "benign_true_positive": "actividad autorizada",
              "false_positive": "falso positivo", "needs_more_info": "requiere análisis"}

# Título por regla de política (lo que pasa, no qué regla saltó)
TITLES = {
    "SCCM_INVENTORY": "Inventario de software de SCCM en {host}: PowerShell codificado legítimo",
    "PENTEST_WINDOW": "Pentest contratado contra la tienda online desde {ip} (dentro de su ventana)",
    "NESSUS_SCAN": "Escaneo semanal de vulnerabilidades de NESSUS01 (autorizado)",
    "PSEXEC_DEPLOY": "Despliegue aprobado del agente de monitorización vía PsExec desde JUMP01",
    "OT_ALLOWED_SOURCE": "Tráfico de {host} hacia OT: origen autorizado, regla mal afinada",
    "OT_MAINTENANCE": "Mantenimiento aprobado del clasificador vía JUMP01",
    "LOGISOFT_UPDATE": "Actualización aprobada del WMS por Logisoft fuera de horario",
    "LOGISOFT_IN_CONTRACT": "Acceso VPN de Logisoft en su horario contractual",
    "BACKUP_OPERATORS_CHANGE": "Alta aprobada en Backup Operators desde JUMP01",
    "EDR_UPGRADE": "Parada breve del EDR en {host} por la actualización aprobada a 7.15",
    "PAYROLL_FLOW": "Envío de nóminas a la gestoría Pons (flujo aprobado)",
    "KNOWN_COMPLIANT_DEVICE": "Falso viaje imposible de {user}: móvil corporativo conocido y conforme",
    "TRAVEL_EXPLAINS_LOGIN": "Login de {user} desde el extranjero explicado por un viaje registrado en RRHH",
    "LEGIT_BULK_SENDER": "Correo legítimo de {email_dom} reportado por error como phishing",
    "SIGNED_BUSINESS_APP": "Aplicación de negocio firmada lanzada desde Office en {host}",
    "CDN_RANDOM_SUBDOMAIN": "Subdominio aleatorio de un CDN legítimo consultado por {host}",
    "KNOWN_SERVICE_BEACON": "Telemetría periódica legítima desde {host}",
    "VELA_CONVERSATIONAL_CORRECTION": "Cliente corrigiendo su propia petición a Vela (no es prompt injection)",
    "KNOWN_PACKAGE_POSTINSTALL": "Script postinstall estándar de un paquete público conocido en CI",
    "TERRAFORM_PIPELINE": "Cambio en un bucket aplicado por el pipeline de Terraform conocido",
    "WAF_BLOCKED": "Ataque web oportunista contra la tienda bloqueado por el WAF ({ip})",
    "AV_BLOCKED": "Malware/PUA bloqueado por el antivirus en {host} antes de ejecutarse",
    "PROMPT_INJECTION_TEXT": "Intento de manipular el triaje con instrucciones ocultas ({rule_name})",
    "ADM_OUTSIDE_JUMP01": "Cuenta administrativa {user} usada fuera de JUMP01",
    "PRIV_GROUP_NO_CHANGE": "Alta en grupo de administradores de dominio sin cambio aprobado",
    "EDR_TAMPERING": "Agente EDR detenido en {host} fuera de mantenimiento",
    "OT_UNAUTHORIZED_SRC": "Acceso a la red OT desde un origen no autorizado ({host})",
    "LOGISOFT_UNUSUAL_SOURCE": "Credenciales del proveedor Logisoft usadas desde un origen anómalo ({ip})",
    "TARVIA_PKG_PUBLIC_REGISTRY": "Dependency confusion en CI: paquete Tarvia descargado del registro público",
    "VELA_CROSS_CUSTOMER": "Vela intentó acceder a datos de otro cliente",
    "SANDBOX_MALICIOUS": "Fichero malicioso confirmado por sandbox en {host}",
    "TI_MALICIOUS": "Contacto con indicador malicioso conocido ({ioc})",
    "AV_EXECUTED": "Malware ejecutado en {host}",
}

# Prioridad para elegir la regla "principal" que da título al ticket
PRIORITY = ["PROMPT_INJECTION_TEXT", "OT_UNAUTHORIZED_SRC", "PRIV_GROUP_NO_CHANGE", "EDR_TAMPERING",
            "ADM_OUTSIDE_JUMP01", "TARVIA_PKG_PUBLIC_REGISTRY", "LOGISOFT_UNUSUAL_SOURCE", "VELA_CROSS_CUSTOMER",
            "AV_EXECUTED", "SANDBOX_MALICIOUS", "TI_MALICIOUS"]


def _fmt_vals(ctx: dict) -> dict:
    ents = ctx.get("entities") or {}
    alert = ctx.get("alert") or {}
    assets = ctx.get("assets") or []
    host = (assets[0]["hostname"] if assets else (ents.get("hosts") or ["?"])[0].upper())
    ext_ips = [i["indicator"] for i in ctx.get("intel") or [] if i["type"] == "ip"]
    ev = alert.get("evidence") if isinstance(alert.get("evidence"), dict) else {}
    sender = str(ev.get("sender") or "")
    tip = next((i["indicator"] for i in ctx.get("intel") or []
                if (i.get("tip") or {}).get("reputation") == "malicious"), "?")
    return {"host": host, "user": (ents.get("users") or ["?"])[0], "ip": (ext_ips or ents.get("ips") or ["?"])[0],
            "email_dom": sender.split("@", 1)[-1] if sender else "un remitente habitual",
            "rule_name": alert.get("rule_name") or alert.get("rule_id") or "alerta", "ioc": tip}


def _main_hit(hits: list[dict], because: list[str]) -> dict | None:
    deciding = [h for h in hits if h["rule"] in because]
    for r in PRIORITY:
        h = next((h for h in deciding if h["rule"] == r), None)
        if h:
            return h
    return next((h for h in deciding if h["rule"] in TITLES), deciding[0] if deciding else None)


# Acciones que los runbooks piden al cerrar, además de «close»
EXCLUSION_HITS = {"NESSUS_SCAN", "KNOWN_SERVICE_BEACON", "CDN_RANDOM_SUBDOMAIN", "KNOWN_PACKAGE_POSTINSTALL"}  # RB-09, RB-10
FULL_SCAN_HITS = {"AV_BLOCKED"}  # RB-02: «cerrar con escaneo completo»


def closing_actions(hits: list[dict], actions: list[dict], host: str, rule_id: str) -> list[dict]:
    """Acciones de cierre de los runbooks (solo si el ticket se va a cerrar)."""
    if not any(a["action"] == "close" for a in actions):
        return []
    names = {h["rule"] for h in hits}
    out = []
    if names & FULL_SCAN_HITS:
        out.append({"action": "full_scan", "target": host, "justification": "RB-02: escaneo completo antes de cerrar"})
    if names & EXCLUSION_HITS:
        out.append({"action": "propose_rule_exclusion", "target": rule_id or "regla",
                    "justification": "RB-09/RB-10: actividad conocida, proponer exclusión en la regla"})
    return out


def _monitor_target(vals: dict) -> str:
    """Entidad a vigilar: el equipo, si no el usuario, si no la IP (nunca «?»)."""
    return next((v for v in (vals["host"], vals["user"], vals["ip"]) if v and v != "?"), "entidad afectada")


def phishing_actions(ctx: dict, hits: list[dict], vals: dict) -> list[dict]:
    """Árbol de decisión de RB-01 para un correo malicioso confirmado (sin credenciales enviadas)."""
    ev = (ctx.get("alert") or {}).get("evidence")
    ev = ev if isinstance(ev, dict) else {}
    names = {h["rule"] for h in hits}
    sender = str(ev.get("sender") or "")
    dom = sender.split("@", 1)[1] if "@" in sender else ""
    mass = "EMAIL_MASS_DELIVERY" in names
    actions = [{"action": "purge_email", "target": ev.get("message_id") or sender or "correo reportado",
                "justification": "RB-01: purgar el correo de todos los buzones" + (" (envío masivo)" if mass else "")}]
    if dom and not dom.endswith("tarvia.example"):
        actions.append({"action": "block_ioc", "target": dom, "justification": "RB-01: bloquear el remitente"})
    clicked = next((h for h in hits if h["rule"] == "EMAIL_CLICKED"), None)
    if clicked:
        for u in clicked.get("users") or [vals["user"] if vals["user"] != "?" else _monitor_target(vals)]:
            actions.append({"action": "monitor", "target": u,
                            "justification": "RB-01: clic sin envío de credenciales → vigilar la cuenta 24 h"})
    elif not mass:
        actions.append({"action": "close", "target": "ticket",
                        "justification": "RB-01: sin interacción y sin entrega masiva → purgar, bloquear y cerrar"})
    return actions


def prefilter(ctx: dict) -> dict | None:
    """Pista determinista (formato compatible con soc.triage.agent: verdict, title, summary, ...)."""
    hits = ctx.get("policy_hits") or []
    sev = ctx.get("severity") or {}
    sug = sev.get("suggestion") or suggest_verdict(hits)
    if not sug.get("verdict") or sug["verdict"] == "needs_more_info":
        return None
    main = _main_hit(hits, sug.get("because") or [])
    vals = _fmt_vals(ctx)
    try:
        title = TITLES.get(main["rule"], "").format(**vals) if main else ""
    except (KeyError, IndexError):
        title = ""
    alert = ctx.get("alert") or {}
    title = title or f"{alert.get('rule_name') or 'Alerta'}: {VERDICT_ES.get(sug['verdict'], sug['verdict'])}"

    deciding = [h for h in hits if h["rule"] in (sug.get("because") or [])]
    summary = " ".join(h["detail"].rstrip(".") + "." for h in deciding[:3])
    summary += f" Severidad: {sev.get('rationale', '')}" if sev.get("rationale") else ""

    rel = ctx.get("related_events") or []
    evidence = [{"source": e.get("_source"), "event_id": e.get("event_id"),
                 "finding": (main or {}).get("detail", "")[:300]} for e in rel[:3]]
    enrichment = []
    for i in ctx.get("intel") or []:
        tip, geo = i.get("tip"), i.get("geo")
        res = []
        if tip:
            res.append(f"{tip.get('reputation')} ({tip.get('confidence')}) {tip.get('malware_family') or ''}".strip())
        if geo:
            res.append(f"{geo.get('country')} · {geo.get('as_org')}")
        enrichment.append({"indicator": i["indicator"], "type": i["type"],
                           "source": "ti_feed+geoip_asn", "result": "; ".join(res) or "sin datos (desconocido ≠ limpio)"})
        if i.get("osint"):
            enrichment.append({"indicator": i["indicator"], "type": i["type"], "source": "osint",
                               "result": osint_describe(i["osint"])})

    final = sev.get("final", "medium")
    if sug["verdict"] in ("false_positive", "benign_true_positive"):
        actions = [{"action": "close", "target": "ticket", "justification": (main or {}).get("detail", "")[:200]}]
    elif final in ("high", "critical"):
        actions = [{"action": "escalate", "target": "N2", "justification": "true_positive de severidad " + final}]
    elif str(alert.get("rule_id") or "").startswith("UC-EML"):
        actions = phishing_actions(ctx, hits, vals)
    elif final in ("informational", "low") and sev.get("minus_reasons"):
        actions = [{"action": "close", "target": "ticket", "justification": "Bloqueado por un control, sin impacto"}]
    else:
        actions = [{"action": "monitor", "target": _monitor_target(vals),
                    "justification": "Vigilar 24 h la entidad afectada"}]
    actions += closing_actions(hits, actions, vals["host"], alert.get("rule_id") or "")
    for i in ctx.get("intel") or []:
        if sug["verdict"] == "true_positive" and (i.get("tip") or {}).get("reputation") == "malicious" \
                and not any(a["action"] == "block_ioc" and a["target"] == i["indicator"] for a in actions):
            actions.append({"action": "block_ioc", "target": i["indicator"],
                            "justification": "Indicador malicioso en el TIP"})

    return {"verdict": sug["verdict"], "decisive": bool(sug.get("decisive")),
            "confidence": sug.get("confidence", 0.5), "title": title, "summary": summary.strip(),
            "severity": final, "evidence": evidence, "enrichment": enrichment,
            "recommended_actions": actions, "escalate": final in ("high", "critical") and sug["verdict"] == "true_positive",
            "escalation_reason": "Severidad " + final if final in ("high", "critical") else "",
            "injection_detected": any(h["rule"] == "PROMPT_INJECTION_TEXT" for h in hits),
            "injection_notes": next((h["detail"] for h in hits if h["rule"] == "PROMPT_INJECTION_TEXT"), ""),
            "x_policy_hits": [h["rule"] for h in deciding]}


def deterministic_ticket(ctx: dict, store=None, hint: dict | None = None) -> dict:
    """Ticket sin IA. Si la política es concluyente → decidido por la política; si no → pendiente de IA."""
    from soc.triage.agent import assemble_ticket

    hint = hint if hint is not None else prefilter(ctx)
    if hint and hint.get("decisive"):
        t = assemble_ticket(ctx, hint, None, decided_by_verdict="policy", store=store)
        t["x_mode"] = "policy"
        return t
    alert = ctx.get("alert") or {}
    pending = {"verdict": "needs_more_info", "confidence": 0.0,
               "title": f"[Pendiente de IA] {alert.get('rule_name') or alert.get('rule_id') or 'Alerta'}",
               "summary": "La política no es concluyente para esta alerta: requiere análisis del agente IA o de una "
                          "persona." + (f" Indicios: {', '.join(hint.get('x_policy_hits') or [])}." if hint else ""),
               "evidence": [], "recommended_actions": [], "open_questions": ["Pendiente de triaje con IA"]}
    t = assemble_ticket(ctx, pending, None, decided_by_verdict="none", store=store)
    t["x_mode"] = "pending_ai"
    t["x_status"] = "pending_ai"
    if t["severity"] in ("high", "critical"):
        # Nunca dejar en silencio algo potencialmente grave: sin IA, lo mira una persona ya
        t["escalation"] = {"escalate": True, "to": "Analista humano (N1/N2)",
                           "reason": f"Severidad potencial {t['severity']} y la política no es concluyente: "
                                     "requiere revisión humana o del agente IA"}
    return t
