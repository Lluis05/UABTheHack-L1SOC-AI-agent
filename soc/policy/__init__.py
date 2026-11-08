"""Motor de política del SOC de Tarvia (determinista).

    hits, severity = evaluate_policy(ctx, store)      # lo llama build_context automáticamente
    suggestion = suggest_verdict(hits)                 # pista para el prefiltro y el LLM
"""

from __future__ import annotations

import ipaddress
import re
from datetime import datetime, timedelta, timezone

from soc.policy.rules import evaluate_rules
from soc.policy.severity import compute_severity, max_criticality

# Política §2: «−1 si un control lo bloqueó antes de producir efecto Y no hay actividad posterior».
LATER_WINDOW_H = 24
_STOPPED = re.compile(r"^(blocked?|denied|deny|drop(ped)?|quarantined|rate_limited|failure|failed|reset)$")
_EFFECT = re.compile(r"^(success|succeeded|allowed|allow|ok|approved|delivered|accepted|permit)$")


def _effective(e: dict) -> bool:
    """¿El evento tuvo efecto (no lo paró un control)?"""
    det = e.get("details") if isinstance(e.get("details"), dict) else {}
    act, res = str(e.get("action") or det.get("action") or "").lower(), str(e.get("result") or "").lower()
    if _STOPPED.match(act) or _STOPPED.match(res):
        return False
    st = str(e.get("status") or "")
    return bool(_EFFECT.match(res) or _EFFECT.match(act) or (st.isdigit() and 200 <= int(st) < 400))


def _executed_on(e: dict, hosts: set[str]) -> bool:
    """Evento EDR que muestra el fichero ejecutándose en uno de los equipos de la alerta (no una detección parada)."""
    if str(e.get("hostname") or "").lower() not in hosts:
        return False
    det = e.get("details") if isinstance(e.get("details"), dict) else {}
    if e.get("event_type") == "detection":
        return not _STOPPED.match(str(det.get("action") or "").lower())
    return True


# Redes internas (RFC 1918). No vale ip.is_private: el dataset usa 198.18.0.0/15 (rango de pruebas, que Python
# considera privado) para las IPs de Internet.
INTERNAL_NETS = [ipaddress.ip_network(n) for n in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8")]


def _external_ips(ctx: dict) -> list[str]:
    out = []
    for ip in (ctx.get("entities") or {}).get("ips") or []:
        try:
            if not any(ipaddress.ip_address(ip) in n for n in INTERNAL_NETS):
                out.append(ip)
        except ValueError:
            pass
    return out


def later_activity(ctx: dict, store) -> list[str] | None:
    """Actividad CON EFECTO del ataque en las 24 h siguientes: el origen externo consigue algo (login correcto,
    petición que pasa el WAF…) o el fichero bloqueado llega a ejecutarse en el mismo equipo.
    Otras alertas de las mismas entidades NO cuentan (un usuario o un hash común tienen ruido sin relación).
    [] = verificado que no hay; None = no se puede verificar (sin datos)."""
    from soc.correlate.incidents import HUB_STATIC

    ts = (ctx.get("alert") or {}).get("created_at") or ""
    if not ts or store is None or not hasattr(store, "search"):
        return None
    try:
        t = datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None
    iso = lambda d: d.strftime("%Y-%m-%dT%H:%M:%S.000Z")  # noqa: E731
    related = ctx.get("related_events") or []
    first = min([e.get("timestamp") or ts for e in related] + [ts])
    # Solo el canal del ataque (las fuentes de sus eventos: waf, ecom_auth…). Una IP de Internet puede aparecer
    # en otras fuentes por motivos ajenos (en el dataset, IPs de escáneres coinciden con la conexión de casa de
    # algún empleado): eso no es actividad posterior del ataque.
    channel = sorted({e.get("_source") for e in related if e.get("_source")})
    out, checked = [], False
    for ip in _external_ips(ctx) if channel else []:
        if ip in HUB_STATIC:          # infraestructura propia (salida corporativa, pentest…), no el atacante
            continue
        checked = True
        evs = [e for lst in store.search(ip, first, iso(t + timedelta(hours=LATER_WINDOW_H)), sources=channel,
                                         limit_per_source=500).values() for e in lst]
        ok = [e for e in evs if _effective(e)]
        if ok:
            out.append(f"{ip}: {len(ok)} evento(s) con efecto ({', '.join(e['event_id'] for e in ok[:3])})")
    ents = ctx.get("entities") or {}
    hosts = {str(h).lower() for h in ents.get("hosts") or []}
    for h in (ents.get("hashes") or []) if hosts else []:
        checked = True
        evs = [e for lst in store.search(h, ts, iso(t + timedelta(hours=LATER_WINDOW_H)),
                                         sources=["edr_events"], limit_per_source=500).values() for e in lst]
        ran = [e for e in evs if e.get("timestamp", "") > ts and _executed_on(e, hosts)]
        if ran:
            out.append(f"{h[:12]}…: ejecutado después en {ran[0].get('hostname')} "
                       f"({', '.join(e['event_id'] for e in ran[:3])})")
    return out if checked else None


def check_minus(minus: list[str], later: list[str] | None) -> tuple[list[str], str]:
    """Aplica la condición de §2 al −1: se anula si hay actividad posterior; si se verificó que no la hay,
    se dice en la justificación. Devuelve (motivos −1 válidos, nota para la justificación)."""
    if not minus:
        return [], ""
    if later:
        return [], "sin −1: hay actividad posterior (" + "; ".join(later[:2]) + ")"
    if later is not None:
        return [m + f" (verificado: sin actividad posterior en {LATER_WINDOW_H} h)" for m in minus], ""
    return list(minus), ""


def suggest_verdict(hits: list[dict]) -> dict:
    """Veredicto que sugiere la política y si es lo bastante claro para decidir sin IA.

    decisive=True solo cuando hay una explicación benigna/FP inequívoca y NINGÚN indicio en contra,
    o un indicio malicioso fuerte. En cualquier otro caso decide el LLM (o la persona).
    """
    mal = [h for h in hits if h["effect"] == "malicious"]
    sus = [h for h in hits if h["effect"] == "suspicious"]
    ben = [h for h in hits if h["effect"] == "benign"]
    tp_ctx = [h for h in hits if h.get("verdict_hint") == "true_positive" and h["effect"] == "context"]
    if mal:
        return {"verdict": "true_positive", "decisive": True, "confidence": 0.85,
                "because": [h["rule"] for h in mal]}
    if ben and not sus:
        hint = "benign_true_positive" if any(h.get("verdict_hint") == "benign_true_positive" for h in ben) \
            else "false_positive"
        return {"verdict": hint, "decisive": True, "confidence": 0.9, "because": [h["rule"] for h in ben]}
    if tp_ctx and not sus and not ben:
        return {"verdict": "true_positive", "decisive": True, "confidence": 0.85,
                "because": [h["rule"] for h in tp_ctx]}
    if sus:
        return {"verdict": "needs_more_info", "decisive": False, "confidence": 0.5,
                "because": [h["rule"] for h in sus] + ([f"(en contra: {h['rule']})" for h in ben] if ben else [])}
    return {"verdict": None, "decisive": False, "confidence": 0.0, "because": []}


def evaluate_policy(ctx: dict, store=None,
                    extra_plus: list[str] | None = None, extra_minus: list[str] | None = None) -> tuple[list[dict], dict]:
    """(policy_hits, SeverityResult). extra_plus/extra_minus: ajustes que propone el LLM (se validan aquí)."""
    hits = evaluate_rules(ctx, store)
    sug = suggest_verdict(hits)
    plus = sorted({h["plus"] for h in hits if h.get("plus")} | set(extra_plus or []))
    minus = sorted({h["minus"] for h in hits if h.get("minus")} | set(extra_minus or []))
    users = [u for u in ctx.get("users") or [] if u.get("_via") in (None, "alert")]
    if any(str(u.get("vip")) == "True" or str(u.get("privileged")) == "True" for u in users):
        plus.append("identidad VIP o privilegiada")
    # Siempre (no solo con −1 de la política): el −1 que proponga el LLM se valida con este mismo dato
    try:
        later = later_activity(ctx, store)
    except Exception:  # noqa: BLE001 - sin el dato el −1 se aplica como antes, nunca se rompe el triaje
        later = None
    minus, note = check_minus(minus, later)
    crit, src, _why = max_criticality(ctx)
    sev = compute_severity(
        (ctx.get("alert") or {}).get("severity"), crit, plus, minus,
        authorized=sug["decisive"] and sug["verdict"] == "benign_true_positive",
        false_positive=sug["decisive"] and sug["verdict"] == "false_positive",
        criticality_source=src)
    if note:
        sev["rationale"] = sev["rationale"].rstrip(".") + f"; {note}."
    sev["later_activity"] = later
    sev["minus_note"] = note
    sev["suggestion"] = sug
    return hits, sev
