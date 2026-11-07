"""Reglas deterministas: cambios aprobados, reglas internas de Tarvia, RRHH, inteligencia y patrones
conocidos de falso positivo. Cada regla devuelve PolicyHits trazables (contrato en docs/04):

    {"rule": "SCCM_INVENTORY", "effect": "benign|suspicious|malicious|context",
     "detail": "explicación en castellano", "reference": "CHG-2026-1031",
     "verdict_hint": "false_positive|benign_true_positive|true_positive" (opcional),
     "plus": "motivo +1" (opcional), "minus": "motivo −1" (opcional)}

Principio: un cambio aprobado NO blanquea cualquier cosa parecida. Se comprueba origen, cuenta,
ventana horaria (en hora local, que es como está el calendario) y alcance. Si algo no cuadra, el
hit es `suspicious` y lo decide el LLM o la persona.

El texto de las alertas puede venir del atacante: aquí solo se compara con patrones, nunca se obedece.
"""

from __future__ import annotations

import ipaddress
import json
import re
from datetime import datetime
from typing import Callable

from soc.enrich.entities import base_domain
from soc.timeutil import local_to_utc, to_local

PENTEST_IPS = {"192.0.2.10", "192.0.2.11", "192.0.2.12"}
OT_NET = ipaddress.ip_network("10.40.16.0/20")
OT_ALLOWED_SRC = {"eng-ws01", "wms01", "10.40.2.20", "10.40.2.10"}
PAYROLL_DEST = "asesoria@gestoria-pons.example"
TRUSTED_SIGNERS = ("sap se", "microsoft", "adobe", "google", "oracle", "cisco", "zoom")
SUSPICIOUS_CHILDREN = ("powershell", "cmd.exe", "wscript", "cscript", "mshta", "rundll32", "regsvr32",
                       "certutil", "bitsadmin", "curl", "wget")
KNOWN_CDN_PARENTS = ("akamaized.net", "blob.core.windows.net", "cloudfront.net", "amazonaws.com",
                     "googleapis.com", "azureedge.net", "fastly.net", "gstatic.com", "windows.net")

# Instrucciones dirigidas al SOC / a la IA de triaje escondidas en datos (prompt injection indirecta)
INJECTION_PATTERNS = [
    r"ignor(a|e|ad)\s+(todas\s+)?(las\s+|all\s+|the\s+)?(instrucciones|instructions|previous|anteriores)",
    r"(cierra|cerrar|close|descarta|archiva)\s+(esta|la|this|the)?\s*(alerta|alert|ticket|incidente)",
    r"(marca|marcar|mark|clasifica|classify)\w*\s.{0,40}(falso positivo|false.?positive|benign|leg[ií]tim)",
    r"(nota|note|mensaje|instrucci[oó]n)\s+(para|to|for)\s+(el\s+|the\s+)?(analista|analyst|soc|ia|ai|agente|agent|llm|modelo)",
    r"(system\s*prompt|prompt\s+de\s+sistema|you are (now )?an? (ai|assistant)|eres un (asistente|modelo))",
    r"(no\s+escal|do\s+not\s+escalat|sin\s+necesidad\s+de\s+escalar)",
]
RE_INJECTION = re.compile("|".join(INJECTION_PATTERNS), re.I)
SOC_DIRECTED = re.compile(r"(analista|analyst|soc\b|sistema automati|clasificaci[oó]n de seguridad|triaje|"
                          r"no requiere revisi[oó]n|no escalar|actividad autorizada)", re.I)

# Indicios de ataque en prompts al asistente Vela (UC-AI-001)
VELA_ATTACK = re.compile(
    r"(system|sistema|instrucciones|prompt|developer|desarrollador|admin|modo\s+\w+|act[uú]a como|"
    r"eres ahora|otro cliente|otra cuenta|C7\d{5}|todos los (pedidos|clientes)|reembols|descuento|c[oó]digo|"
    r"tool|herramienta|api|json|base de datos|sql|ignore (all|previous)|jailbreak|DAN)", re.I)


def hit(rule: str, effect: str, detail: str, reference: str = "", verdict_hint: str | None = None,
        plus: str | None = None, minus: str | None = None) -> dict:
    h = {"rule": rule, "effect": effect, "detail": detail, "reference": reference}
    if verdict_hint:
        h["verdict_hint"] = verdict_hint
    if plus:
        h["plus"] = plus
    if minus:
        h["minus"] = minus
    return h


# ------------------------------------------------------------------ helpers
def _ev(ctx: dict) -> dict:
    ev = (ctx.get("alert") or {}).get("evidence")
    return ev if isinstance(ev, dict) else {}


def _rule(ctx: dict) -> str:
    return (ctx.get("alert") or {}).get("rule_id") or ""


def _ts(ctx: dict) -> str:
    return (ctx.get("alert") or {}).get("created_at") or ""


def _local(ctx: dict) -> datetime | None:
    try:
        return to_local(_ts(ctx)) if _ts(ctx) else None
    except ValueError:
        return None


def _text(obj) -> str:
    return json.dumps(obj, ensure_ascii=False).lower() if obj is not None else ""


def _true(v) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v > 0
    return str(v).strip().lower() in ("true", "sí", "si", "yes", "1")


def _num(v) -> float | None:
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _change(ctx: dict, cid: str) -> dict | None:
    return next((c for c in ctx.get("changes") or [] if c.get("id") == cid), None)


def _in_change(ctx: dict, cid: str, store=None, margin_min: int = 0) -> bool:
    """¿La alerta cae dentro de la ventana del cambio (convertida de hora local a UTC)?"""
    c = _change(ctx, cid)
    if c is None and store is not None:
        c = next((x for x in store.changes() if x.get("id") == cid), None)
        if c:
            c = {**c, "inicio_utc": local_to_utc(c["inicio"]), "fin_utc": local_to_utc(c["fin"])}
    if not c or not _ts(ctx):
        return False
    from soc.timeutil import shift
    return shift(c["inicio_utc"], hours=-margin_min / 60) <= _ts(ctx) <= shift(c["fin_utc"], hours=margin_min / 60)


def _hosts(ctx: dict) -> set[str]:
    return {h.lower() for h in (ctx.get("entities") or {}).get("hosts", [])}


def _users(ctx: dict) -> set[str]:
    return set((ctx.get("entities") or {}).get("users", []))


def _ips(ctx: dict) -> set[str]:
    return set((ctx.get("entities") or {}).get("ips", []))


def _user_recs(ctx: dict, via_alert_only: bool = True) -> list[dict]:
    return [u for u in ctx.get("users") or [] if not via_alert_only or u.get("_via") in (None, "alert")]


# ------------------------------------------------------- cambios aprobados
def r_pentest(ctx, store):
    pent = _ips(ctx) & PENTEST_IPS
    if not pent:
        return []
    if _in_change(ctx, "CHG-2026-1042", store):
        return [hit("PENTEST_WINDOW", "benign", f"Origen {', '.join(sorted(pent))} es la auditora del pentest "
                    "contratado y la alerta cae dentro de su ventana (08/10 08:00 – 10/10 18:00 local)",
                    "CHG-2026-1042", "benign_true_positive")]
    return [hit("PENTEST_OUTSIDE_WINDOW", "suspicious", f"Origen {', '.join(sorted(pent))} pertenece al pentest "
                "pero la alerta está FUERA de la ventana autorizada", "CHG-2026-1042")]


def r_nessus(ctx, store):
    if not ({"nessus01", "10.20.6.62"} & (_hosts(ctx) | _ips(ctx))) and "svc_scanner" not in _text(ctx.get("alert")):
        return []
    loc = _local(ctx)
    ot = "logistics-ot" in _text(_ev(ctx)) or any(ipaddress.ip_address(i) in OT_NET for i in _ips(ctx)
                                                  if _valid_ip(i))
    in_window = loc is not None and loc.weekday() == 2 and 1 <= loc.hour < 5
    if ot:
        return [hit("NESSUS_TOUCHING_OT", "suspicious", "Actividad del escáner contra la red OT, que está "
                    "EXCLUIDA del escaneo semanal", "CHG-2026-1049")]
    if in_window:
        return [hit("NESSUS_SCAN", "benign", f"Escaneo semanal de NESSUS01 (miércoles 01-05 h local; "
                    f"alerta a las {loc:%a %H:%M} local)", "CHG-2026-1049/1050/1051/1052", "benign_true_positive")]
    return [hit("NESSUS_OUTSIDE_WINDOW", "suspicious", f"Actividad de NESSUS01 fuera de su ventana "
                f"(miércoles 01-05 h); alerta {loc:%a %H:%M} local" if loc else "Actividad de NESSUS01 sin hora",
                "CHG-2026-1049")]


def r_sccm(ctx, store):
    if _rule(ctx) != "UC-EDR-002":
        return []
    ev = _ev(ctx)
    parent = str(ev.get("parent") or "").lower()
    procs = _text((ctx.get("alert") or {}).get("entities", {}).get("processes"))
    user = str(ev.get("user") or "").lower()
    loc = _local(ctx)
    is_sccm = "ccmexec" in parent or ("ccmexec" in procs and not parent)
    if not is_sccm:
        return [hit("ENCODED_PS_NON_SCCM", "suspicious", f"PowerShell codificado lanzado por «{ev.get('parent') or '?'}», "
                    "no por el agente SCCM: no lo cubre CHG-2026-1031", "CHG-2026-1031")]
    in_window = loc is not None and 8 <= loc.hour < 10 or (loc is not None and loc.hour == 10 and loc.minute <= 30)
    user_ok = user in ("system", "svc_sccm", "nt authority\\system") or not user
    preview = str(ev.get("decoded_preview") or "").lower()
    inventory_like = not preview or any(k in preview for k in ("win32_product", "inventory", "get-ciminstance",
                                                               "ccm\\inventory"))
    if in_window and user_ok and inventory_like:
        return [hit("SCCM_INVENTORY", "benign", f"PowerShell codificado lanzado por CcmExec.exe (agente SCCM) como "
                    f"{ev.get('user') or 'SYSTEM'} a las {loc:%H:%M} local, dentro de la ventana diaria 08-10 h del "
                    "inventario de software; el contenido decodificado es inventario", "CHG-2026-1031",
                    "false_positive")]
    why = []
    if not in_window:
        why.append(f"fuera de la ventana 08-10 h ({loc:%H:%M} local)" if loc else "sin hora")
    if not user_ok:
        why.append(f"usuario «{ev.get('user')}» distinto de SYSTEM/svc_sccm")
    if not inventory_like:
        why.append("el contenido decodificado no es inventario")
    return [hit("SCCM_ANOMALY", "suspicious", "Lanzado por CcmExec pero " + "; ".join(why), "CHG-2026-1031")]


def r_psexec_deploy(ctx, store):
    if _rule(ctx) != "UC-NET-004":
        return []
    ev = _ev(ctx)
    src = str(ev.get("src") or "").lower()
    dst = str(ev.get("dst") or "").upper()
    acct = str(ev.get("account") or "").lower()
    scope = {"ERP-APP01", "HR-APP01", "PRINT01", "CRM-APP01"}
    if src == "jump01" and acct.startswith("adm.") and dst in scope and _in_change(ctx, "CHG-2026-1057", store):
        return [hit("PSEXEC_DEPLOY", "benign", f"PsExec desde JUMP01 con {acct} hacia {dst}: despliegue del agente "
                    "de monitorización 3.4 dentro de su ventana y alcance", "CHG-2026-1057", "benign_true_positive")]
    return []


def r_ot(ctx, store):
    if _rule(ctx) != "UC-OT-001" and "logistics-ot" not in _text(_ev(ctx)):
        return []
    src = str(_ev(ctx).get("src") or "").lower()
    srcs = ({src} if src else set()) | _hosts(ctx)
    if srcs & OT_ALLOWED_SRC and not (srcs - OT_ALLOWED_SRC - {"plc-sort01", "hmi-sort01"}):
        return [hit("OT_ALLOWED_SOURCE", "benign", f"El origen {', '.join(sorted(srcs & OT_ALLOWED_SRC)).upper()} es "
                    "uno de los dos equipos autorizados a hablar con OT (ENG-WS01, WMS01): la regla está mal afinada",
                    "Regla interna OT", "false_positive")]
    if _in_change(ctx, "CHG-2026-1063", store) and "jump01" in srcs:
        return [hit("OT_MAINTENANCE", "benign", "Mantenimiento remoto del fabricante vía JUMP01 dentro de la "
                    "ventana aprobada", "CHG-2026-1063", "benign_true_positive")]
    return [hit("OT_UNAUTHORIZED_SRC", "malicious", f"Acceso a red OT desde {', '.join(sorted(srcs)).upper() or '?'}, "
                "que NO está autorizado (solo ENG-WS01 y WMS01). Nunca actuar sobre OT: escalar a Operaciones",
                "Regla interna OT", "true_positive", plus="acceso a la red OT de un origen no autorizado")]


def r_logisoft(ctx, store):
    if "ext.logisoft@tarvia.example" not in _users(ctx) and "ext.logisoft" not in _text(_ev(ctx)):
        return []
    ev = _ev(ctx)
    loc = _local(ctx)
    asn = str(ev.get("src_asn") or "")
    usual = "logisoft" in asn.lower() or "198.18.240.10" in _ips(ctx)
    if _in_change(ctx, "CHG-2026-1071", store) and usual:
        return [hit("LOGISOFT_UPDATE", "benign", "Acceso VPN de Logisoft fuera de horario pero dentro de la "
                    "actualización aprobada del WMS y desde su IP corporativa", "CHG-2026-1071", "benign_true_positive")]
    in_contract = loc is not None and loc.weekday() < 5 and 8 <= loc.hour < 18
    if not usual:
        return [hit("LOGISOFT_UNUSUAL_SOURCE", "malicious",
                    f"Cuenta de proveedor ext.logisoft conectada desde un origen NO habitual ({asn or 'ASN desconocido'};"
                    f" lo habitual es {ev.get('usual_src') or 'Logisoft'})" + (f" a las {loc:%a %H:%M} local" if loc else "")
                    + ": posible credencial de tercero comprometida", "Regla interna Logisoft", "true_positive",
                    plus="acceso confirmado con credenciales de tercero desde origen anómalo")]
    if not in_contract:
        mins = (loc.hour - 18) * 60 + loc.minute if loc and loc.hour >= 18 else None
        detail = f"Desde la IP habitual de Logisoft, {'%d min ' % mins if mins is not None and mins < 120 else ''}" \
                 f"fuera de su ventana contractual (L-V 8-18 h; {loc:%a %H:%M} local)" if loc else "Fuera de ventana"
        return [hit("LOGISOFT_OUTSIDE_HOURS", "context", detail + ". Riesgo bajo si no hay más actividad anómala",
                    "Regla interna Logisoft")]
    return [hit("LOGISOFT_IN_CONTRACT", "benign", "Acceso de Logisoft dentro de su ventana contractual y desde su IP "
                "habitual", "Regla interna Logisoft", "false_positive")]


def r_ad_groups(ctx, store):
    if _rule(ctx) != "UC-IDP-008":
        return []
    ev = _ev(ctx)
    group = str(ev.get("group") or "")
    src = str(ev.get("from_host") or "").lower()
    if group.lower() == "backup operators" and src == "jump01" and _in_change(ctx, "CHG-2026-1078", store):
        return [hit("BACKUP_OPERATORS_CHANGE", "benign", "Alta en Backup Operators desde JUMP01 dentro del cambio "
                    "aprobado (nuevo miembro de sistemas)", "CHG-2026-1078", "benign_true_positive")]
    if group.lower() in ("domain admins", "enterprise admins"):
        return [hit("PRIV_GROUP_NO_CHANGE", "malicious", f"Alta en «{group}» de {ev.get('member_added') or '?'} sin "
                    f"cambio aprobado, desde {src.upper() or '?'}" + (f" ({ev.get('local_time')})" if ev.get('local_time') else "")
                    + ": persistencia con privilegios de dominio", "Política §5", "true_positive",
                    plus="cuenta privilegiada y persistencia")]
    return []


def r_edr_tamper(ctx, store):
    if _rule(ctx) != "UC-EDR-011":
        return []
    ev = _ev(ctx)
    restarted = bool(ev.get("restarted_after_s"))
    unsigned = "sin firma" in _text(ev) or "stop edragentsvc" in _text((ctx.get("alert") or {}).get("entities"))
    if _in_change(ctx, "CHG-2026-1080", store) and restarted and not unsigned:
        return [hit("EDR_UPGRADE", "benign", "Parada breve del agente EDR en servidor durante la actualización "
                    "aprobada a 7.15 y reinicio posterior", "CHG-2026-1080", "benign_true_positive")]
    return [hit("EDR_TAMPERING", "malicious", "Agente EDR detenido fuera de mantenimiento" +
                (" por un proceso sin firma" if unsigned else "") + ": evasión de defensas", "Política §5",
                "true_positive", plus="manipulación de controles de seguridad")]


def r_payroll(ctx, store):
    t = _text(ctx.get("alert"))
    if PAYROLL_DEST in t:
        return [hit("PAYROLL_FLOW", "benign", "Envío de variables de nómina a la gestoría Pons: flujo aprobado con "
                    "contrato de encargado de tratamiento vigente", "FLUJO-0007", "benign_true_positive")]
    return []


# ---------------------------------------------------------- reglas internas
def r_adm_outside_jump(ctx, store):
    adms = sorted(u for u in _users(ctx) if u.startswith("adm."))
    if not adms:
        return []
    ev = _ev(ctx)
    origins = {str(ev.get(k)).lower() for k in ("src", "from_host", "src_host") if ev.get(k)}
    if not origins:
        origins = _hosts(ctx)
    bad = sorted(o for o in origins if o and o != "jump01")
    if bad and "jump01" not in origins:
        return [hit("ADM_OUTSIDE_JUMP01", "malicious", f"Cuenta administrativa {', '.join(adms)} usada desde "
                    f"{', '.join(b.upper() for b in bad)}; las cuentas adm.* solo pueden usarse desde JUMP01 "
                    "(posible robo de credenciales privilegiadas)", "Regla interna Tarvia", "true_positive",
                    plus="cuenta privilegiada usada fuera de JUMP01")]
    return []


def r_anydesk(ctx, store):
    t = _text(ctx.get("alert"))
    if "anydesk" not in t:
        return []
    return [hit("ANYDESK_UNAPPROVED", "suspicious", "AnyDesk NO es una herramienta de acceso remoto aprobada (solo "
                "TeamViewer Corporate). No bloquear globalmente sin N2 (uso dual)", "Regla interna Tarvia")]


def r_svc_backup(ctx, store):
    if "svc_backup@tarvia.example" in _users(ctx) or "svc_backup" in _text(_ev(ctx)):
        return [hit("SVC_BACKUP_NO_MFA", "context", "svc_backup está excluida de MFA por compatibilidad (riesgo "
                    "aceptado en 2024): la ausencia de MFA no es anómala por sí sola, pero la cuenta es de alto valor",
                    "Regla interna Tarvia")]
    return []


def r_supply_chain(ctx, store):
    if _rule(ctx) != "UC-DEV-001":
        return []
    ev = _ev(ctx)
    pkg = str(ev.get("package") or "").lower()
    secrets = [v for v in (ev.get("env_vars_read") or []) if any(k in str(v).upper()
                                                                for k in ("AWS", "TOKEN", "SECRET", "KEY", "PASS"))]
    if "tarvia" in pkg and not pkg.startswith("@tarvia/") and ("público" in pkg or "public" in _text(ev)
                                                               or "@tarvia" in str(ev.get("expected_package"))):
        return [hit("TARVIA_PKG_PUBLIC_REGISTRY", "malicious", f"Paquete «{ev.get('package')}» resuelto desde el "
                    f"registro PÚBLICO en lugar de {ev.get('expected_package') or '@tarvia/* (interno)'}: dependency "
                    "confusion" + (f"; leyó {', '.join(secrets)}" if secrets else ""), "Regla interna CI/CD",
                    "true_positive", plus="robo de secretos del pipeline" if secrets else None)]
    if not secrets and "registro público (paquete conocido)" in _text(ev):
        return [hit("KNOWN_PACKAGE_POSTINSTALL", "benign", f"Paquete público conocido ({ev.get('package')}) con "
                    "postinstall estándar y sin leer secretos", "Regla interna CI/CD", "false_positive")]
    return []


# ------------------------------------------------------------------- RRHH
def r_hr(ctx, store):
    out = []
    ts = _ts(ctx)
    for u in _user_recs(ctx):
        for h in u.get("hr_events") or []:
            tipo, eff = h.get("tipo", ""), h.get("fecha_efectiva", "")
            det = h.get("detalle", "")
            if tipo.startswith("baja") and eff:
                if ts and ts[:10] > eff:
                    out.append(hit("ACTIVITY_AFTER_LEAVE", "suspicious", f"{u['upn']} ya no debería estar activo "
                                   f"(último día {eff}) y genera actividad el {ts[:10]}", "eventos_rrhh"))
                else:
                    comp = "competidor" in det.lower()
                    out.append(hit("USER_LEAVING", "suspicious" if comp else "context",
                                   f"{u['upn']}: {det}" + (" Riesgo de fuga de información." if comp else ""),
                                   "eventos_rrhh", plus="usuario saliente hacia un competidor" if comp and
                                   _rule(ctx).startswith(("UC-DLP", "UC-CLD")) else None))
            elif tipo in ("viaje", "teletrabajo_temporal", "vacaciones"):
                out.append(hit("USER_" + tipo.upper(), "context", f"{u['upn']}: {tipo} — {det} (desde {eff})",
                               "eventos_rrhh"))
    if _rule(ctx) == "UC-IDP-001":
        out += _travel_explains(ctx)
    return out


def _travel_explains(ctx):
    ev = _ev(ctx)
    city = str((ev.get("current_login") or {}).get("city") or "").lower() if isinstance(ev.get("current_login"), dict) else ""
    for u in _user_recs(ctx):
        for h in u.get("hr_events") or []:
            if h.get("tipo") in ("viaje", "teletrabajo_temporal") and city:
                det = (h.get("detalle") or "").lower()
                aliases = {"nueva york": ["new york", "nueva york", "nyc"], "parís": ["parís", "paris"],
                           "milán": ["milán", "milan"], "valencia": ["valencia"]}
                names = [city] + aliases.get(city, [])
                if any(n in det for n in names):
                    return [hit("TRAVEL_EXPLAINS_LOGIN", "benign", f"El login desde {city.title()} encaja con el "
                                f"evento de RRHH de {u['upn']}: {h.get('detalle')}", "eventos_rrhh",
                                "benign_true_positive")]
    dev = str(ev.get("device") or "").lower()
    if "conocido" in dev and "conforme" in dev:
        return [hit("KNOWN_COMPLIANT_DEVICE", "benign", f"Mismo usuario con {ev.get('device')}: el salto de ciudad "
                    "se explica por la salida a Internet del operador móvil (geolocalización de IP poco fiable), no "
                    "por un segundo actor", "Patrón de FP de UC-IDP-001", "false_positive")]
    return []


# ----------------------------------------------------------- inteligencia
def r_intel(ctx, store):
    out = []
    for i in ctx.get("intel") or []:
        tip, geo = i.get("tip"), i.get("geo")
        if tip and str(tip.get("reputation", "")).lower() == "malicious":
            out.append(hit("TI_MALICIOUS", "malicious", f"{i['indicator']} está en el TIP como malicioso "
                           f"(confianza {tip.get('confidence')}, {tip.get('malware_family') or 's/familia'}, "
                           f"{tip.get('tags') or ''})", tip.get("source") or "TIP", "true_positive"))
        elif tip and str(tip.get("reputation", "")).lower() in ("suspicious", "sospechoso"):
            out.append(hit("TI_SUSPICIOUS", "suspicious", f"{i['indicator']} marcado como sospechoso en el TIP",
                           tip.get("source") or "TIP"))
        if geo:
            flags = [n.replace("is_", "") for n in ("is_tor", "is_vpn_provider", "is_hosting", "is_residential_proxy")
                     if _true(geo.get(n))]
            if flags:
                out.append(hit("ANON_INFRA", "suspicious" if "tor" in flags or "residential_proxy" in flags
                               else "context", f"{i['indicator']}: {', '.join(flags)} ({geo.get('country')}, "
                               f"{geo.get('as_org')})", "geoip_asn"))
    unknown = [i["indicator"] for i in ctx.get("intel") or [] if not i.get("tip") and i["type"] in ("ip", "domain", "sha256")
               and not (i["type"] == "domain" and base_domain(i["indicator"]).endswith(("tarvia.example",)))]
    if unknown and not any(h["rule"] == "TI_MALICIOUS" for h in out):
        out.append(hit("TI_UNKNOWN", "context", f"Sin datos en el TIP para {', '.join(unknown[:5])}"
                       f"{'…' if len(unknown) > 5 else ''}: desconocido NO significa limpio", "TIP"))
    for sbx in ctx.get("sandbox") or []:
        verdict = str(sbx.get("verdict", "")).lower()
        if verdict in ("malicious", "malicioso"):
            out.append(hit("SANDBOX_MALICIOUS", "malicious", f"Sandbox: {sbx.get('file_name')} malicioso "
                           f"({sbx.get('malware_family') or 's/familia'}, score {sbx.get('score')})", "sandbox",
                           "true_positive"))
        elif verdict in ("clean", "limpio", "benign"):
            out.append(hit("SANDBOX_CLEAN", "context", f"Sandbox: {sbx.get('file_name')} limpio (score "
                           f"{sbx.get('score')}). Un adjunto limpio puede ser fraude por su contenido", "sandbox"))
    return out


# --------------------------------------------- patrones conocidos de FP / TP
def r_known_patterns(ctx, store):
    rule, ev = _rule(ctx), _ev(ctx)
    out = []
    if rule == "UC-WEB-001" and str(ev.get("action", "")).lower() == "blocked":
        out.append(hit("WAF_BLOCKED", "context", f"El WAF bloqueó la petición ({ev.get('rule_msg')}, {ev.get('hits')} "
                       "intentos): ataque real pero sin efecto", "UC-WEB-001", "true_positive",
                       minus="bloqueado por el WAF antes de producir efecto"))
    if rule == "UC-EDR-003":
        act = str(ev.get("action", "")).lower()
        if act in ("quarantined", "blocked", "deleted", "cuarentena") and not _true(ev.get("executed")):
            out.append(hit("AV_BLOCKED", "context", f"{ev.get('detection_name')}: {act}, no llegó a ejecutarse",
                           "UC-EDR-003", "true_positive", minus="bloqueado por el antivirus sin ejecución"))
        elif _true(ev.get("executed")) or act in ("detected_only", "allowed"):
            out.append(hit("AV_EXECUTED", "malicious", f"{ev.get('detection_name')}: acción «{act}», ejecutado="
                           f"{ev.get('executed')}", "UC-EDR-003", "true_positive", plus="ejecución confirmada"))
    if rule == "UC-EDR-001":
        tree = str(ev.get("process_tree") or "").lower()
        signer = str(ev.get("signer") or "").lower()
        child = tree.split(">")[-1].strip() if ">" in tree else ""
        if any(s in child for s in SUSPICIOUS_CHILDREN):
            out.append(hit("OFFICE_SPAWNS_SHELL", "suspicious", f"Árbol de procesos: {ev.get('process_tree')}",
                           "UC-EDR-001"))
        elif signer and any(s in signer for s in TRUSTED_SIGNERS):
            out.append(hit("SIGNED_BUSINESS_APP", "benign", f"{ev.get('process_tree')}: aplicación de negocio firmada "
                           f"por {ev.get('signer')}", "UC-EDR-001", "false_positive"))
    if rule == "UC-NET-005":
        parent = str(ev.get("parent_domain") or "").lower()
        if parent.endswith(KNOWN_CDN_PARENTS):
            out.append(hit("CDN_RANDOM_SUBDOMAIN", "benign", f"Subdominio aleatorio de {parent}, un CDN/servicio cloud "
                           "legítimo que usa nombres generados", "UC-NET-005", "false_positive"))
    if rule == "UC-NET-001":
        age = _num(ev.get("domain_age_days"))
        dom = str(ev.get("domain") or "")
        tip = next((i.get("tip") for i in ctx.get("intel") or [] if i["indicator"] == dom), None)
        bd_events = store.entity_count(base_domain(dom)) if store and dom else 0
        if age is not None and age > 365 and not tip and bd_events > 1000:
            out.append(hit("KNOWN_SERVICE_BEACON", "benign", f"{dom}: dominio de {int(age)} días de antigüedad y muy "
                           f"usado en la organización ({bd_events} eventos): telemetría o sincronización legítima",
                           "UC-NET-001", "false_positive"))
        elif age is not None and age < 60:
            out.append(hit("YOUNG_DOMAIN_BEACON", "suspicious", f"{dom}: dominio de solo {int(age)} días con beaconing "
                           f"(intervalo medio {ev.get('mean_interval_s')} s)", "UC-NET-001"))
    if rule == "UC-EML-001":
        out += _reported_phish(ctx, store)
    if rule == "UC-AI-001":
        prompt = str(ev.get("prompt_excerpt") or "")
        if prompt and not VELA_ATTACK.search(prompt):
            out.append(hit("VELA_CONVERSATIONAL_CORRECTION", "benign", f"El cliente corrige su propia petición "
                           f"(«{prompt[:80]}»); no intenta cambiar el comportamiento del asistente ni acceder a "
                           "datos ajenos", "UC-AI-001", "false_positive"))
        elif prompt:
            out.append(hit("VELA_INJECTION_ATTEMPT", "suspicious", f"El prompt contiene indicios de ataque al "
                           f"asistente: «{prompt[:100]}»", "UC-AI-001"))
    if rule == "UC-AI-002":
        out.append(hit("VELA_CROSS_CUSTOMER", "malicious", "El asistente intentó acceder a datos de un cliente "
                       f"distinto del autenticado ({ev.get('requested_customer_id')} ≠ "
                       f"{ev.get('authenticated_customer_id')})", "UC-AI-002", "true_positive",
                       plus="datos personales de clientes"))
    # Datos personales / pagos (+1 de la política)
    pd = _num(ev.get("personal_data_matches")) or 0
    matches = ev.get("matches") if isinstance(ev.get("matches"), dict) else {}
    if pd > 0 or any((_num(v) or 0) > 0 for v in matches.values()) or rule in ("UC-EML-004", "UC-WEB-003",
                                                                                "UC-EDR-012"):
        out.append(hit("PERSONAL_DATA_OR_PAYMENTS", "context", "Hay datos personales o pagos implicados",
                       "Política §2", plus="datos personales o pagos implicados"))
    # Acceso o ejecución confirmados (+1)
    for k in ("successes", "success_count", "credentials_submitted"):
        if k in ev and _true(ev.get(k)):
            out.append(hit("CONFIRMED_ACCESS", "suspicious", f"Evidencia de éxito: {k}={ev.get(k)}", "Política §2",
                           plus="acceso confirmado (no solo intento)"))
            break
    # Bloqueos genéricos (−1)
    for k in ("dlp_action", "edr_action"):
        if str(ev.get(k, "")).lower() in ("block", "blocked", "quarantined"):
            out.append(hit("CONTROL_BLOCKED", "context", f"{k}={ev.get(k)}", "Política §2",
                           minus="bloqueado por un control antes de producir efecto"))
    # Pistas que la propia regla del SIEM deja en la evidencia
    if str(ev.get("change_ticket", "")).lower() in ("ninguno", "none") or \
            str(ev.get("maintenance_window", "")).lower() in ("ninguna", "none"):
        out.append(hit("NO_CHANGE_TICKET", "suspicious", "La actividad no está asociada a ningún cambio aprobado",
                       "calendario_cambios"))
    return out


def _reported_phish(ctx, store):
    ev = _ev(ctx)
    sender = str(ev.get("sender") or "").lower()
    dom = sender.split("@", 1)[1] if "@" in sender else ""
    emails = [e for e in ctx.get("related_events") or [] if e.get("_source") == "email"]
    auth_ok = any(all(str(e.get(k, "")).lower() == "pass" for k in ("spf", "dkim", "dmarc")) for e in emails)
    volume = store.entity_count(dom) if store and dom else 0
    clicks = [e for evs in (ctx.get("entity_activity") or {}).values() for e in evs.get("email_clicks", [])]
    if auth_ok and volume > 500:
        return [hit("LEGIT_BULK_SENDER", "benign", f"Remitente {sender}: SPF/DKIM/DMARC correctos y {volume} eventos "
                    f"de correo de ese dominio en el mes (newsletter o comunicación recurrente que el usuario "
                    "reportó por error)", "RB-01", "false_positive")]
    if emails and not auth_ok:
        bad = [k for k in ("spf", "dkim", "dmarc") if any(str(e.get(k, "")).lower() != "pass" for e in emails)]
        return [hit("EMAIL_AUTH_FAIL", "suspicious", f"Autenticación de correo fallida ({', '.join(bad)}) para "
                    f"{sender or 'remitente'}", "RB-01")] + \
               ([hit("EMAIL_CLICKED", "suspicious", f"{len(clicks)} clics registrados relacionados", "RB-01")]
                if clicks else [])
    return []


# --------------------------------------------------------- prompt injection
def r_prompt_injection(ctx, store):
    """Instrucciones dirigidas al SOC/IA escondidas en campos que controla el atacante."""
    alert = ctx.get("alert") or {}
    # `description` y `rule_name` los escribe el SIEM (no el atacante): no se analizan.
    vela = alert.get("source_product") == "AI_GATEWAY"
    fields = {"evidence": alert.get("evidence")}
    for e in ctx.get("related_events") or []:
        for k in ("subject", "command_line", "details", "prompt", "user_agent", "body_excerpt", "file_name"):
            if e.get(k):
                fields[f"{e.get('event_id')}.{k}"] = e[k]
    found = []
    for name, val in fields.items():
        s = json.dumps(val, ensure_ascii=False) if not isinstance(val, str) else val
        if not s:
            continue
        if vela:   # prompt de cliente: solo cuenta si va dirigido al SOC / al triaje
            m = SOC_DIRECTED.search(s)
        else:
            m = RE_INJECTION.search(s) or SOC_DIRECTED.search(s)
        if m:
            found.append((name, m.group(0)))
    if not found:
        return []
    where = "; ".join(f"{n}: «{t}»" for n, t in found[:3])
    return [hit("PROMPT_INJECTION_TEXT", "malicious", "Datos de la alerta contienen instrucciones dirigidas al SOC o "
                f"a la IA de triaje ({where}). Se tratan como DATOS y como indicio de ataque; no se obedecen",
                "Defensa anti-inyección")]


def _valid_ip(v: str) -> bool:
    try:
        ipaddress.ip_address(v)
        return True
    except ValueError:
        return False


RULES: list[Callable] = [
    r_pentest, r_nessus, r_sccm, r_psexec_deploy, r_ot, r_logisoft, r_ad_groups, r_edr_tamper, r_payroll,
    r_adm_outside_jump, r_anydesk, r_svc_backup, r_supply_chain, r_hr, r_intel, r_known_patterns,
    r_prompt_injection,
]


def evaluate_rules(ctx: dict, store=None) -> list[dict]:
    hits: list[dict] = []
    for fn in RULES:
        try:
            hits += fn(ctx, store)
        except Exception as e:  # noqa: BLE001 - una regla rota no puede tumbar el triaje
            hits.append(hit("RULE_ERROR", "context", f"{fn.__name__}: {type(e).__name__}: {e}", "interno"))
    return hits
