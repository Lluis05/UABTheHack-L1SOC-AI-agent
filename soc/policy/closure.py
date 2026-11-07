"""Cuándo se cierra y cuándo se escala un ticket (politica_soc.md §5 y runbooks RB-01..RB-10).

    reasons = mandatory_escalation(verdict, hits, rule_id)   # [] si la política no obliga a escalar
    status = ticket_status(verdict, severity, escalate, actions, confidence, decided_by, executed)
    status = status_for(ticket)                              # lo mismo leyendo un ticket ya montado

Las acciones de contención NUNCA las ejecuta el sistema (Deloitte: «siempre con aprobación humana»; el LLM no
tiene acceso a la API). Por eso un ticket que el runbook manda cerrar pero tiene acciones de la API sin ejecutar
(purgar, bloquear IOC) queda «triaged»: el N1 las ejecuta desde el dashboard y entonces se cierra solo.

Lo decide el código, no el LLM: el LLM propone veredicto y acciones, y aquí se aplican los criterios
obligatorios. Todo lo que no encaja en un criterio claro queda «triaged» para que lo mire una persona.
"""

from __future__ import annotations

from soc.policy.approvals import API_ACTIONS

STATUS_CLOSED, STATUS_TRIAGED = "closed", "triaged"
STATUS_ESCALATED, STATUS_AWAITING = "escalated", "awaiting_approval"

BENIGN_VERDICTS = ("false_positive", "benign_true_positive")
# Severidades que la política no escala (§3 SLA: low e informational → «Escalado: No»)
NON_ESCALATED_SEVERITIES = ("informational", "low")

# La documentación de Deloitte no fija umbral de confianza (solo 0-1). Criterio propio: el SOC quiere que la
# persona decida lo dudoso, así que la IA solo cierra sola cuando está razonablemente segura. Por debajo, el
# ticket queda «triaged» con la recomendación de cierre para que la confirme el analista.
LLM_CLOSE_MIN_CONFIDENCE = 0.7

# Criterios de escalado obligatorio de §5, con las señales deterministas que los demuestran.
# hits: reglas de soc/policy/rules.py · rules: casos de uso del SIEM cuyo true_positive ya implica el criterio.
MANDATORY = [
    ("ejecución confirmada de código malicioso", {"AV_EXECUTED"}, set()),
    ("robo de credenciales", {"ADM_OUTSIDE_JUMP01", "LOGISOFT_UNUSUAL_SOURCE", "CONFIRMED_ACCESS"},
     {"UC-EDR-004", "UC-IDP-006"}),
    ("persistencia", {"PRIV_GROUP_NO_CHANGE"}, {"UC-IDP-005", "UC-IDP-007", "UC-CLD-002"}),
    ("datos personales que han podido salir (implica DPO)", {"VELA_CROSS_CUSTOMER"},
     {"UC-DLP-001", "UC-DLP-002", "UC-CLD-004"}),
    ("fraude económico (pagos, IBAN, tarjetas regalo)", set(), {"UC-EML-004", "UC-WEB-003"}),
]
# Criterios que dejan de aplicar si un control lo bloqueó (no salió nada)
BLOCKABLE = {"datos personales que han podido salir (implica DPO)"}
# Una cadena de suministro solo es robo de credenciales si el paquete leyó secretos (el hit lleva «plus»)
SECRETS_HIT = "TARVIA_PKG_PUBLIC_REGISTRY"


def mandatory_escalation(verdict: str, hits: list[dict], rule_id: str = "") -> list[str]:
    """Motivos de escalado obligatorio (§5) para un true_positive, sin depender de la severidad."""
    if verdict != "true_positive":
        return []
    names = {h.get("rule") for h in hits or []}
    blocked = any(h.get("minus") for h in hits or [])
    if any(h.get("rule") == SECRETS_HIT and h.get("plus") for h in hits or []):
        names.add("ADM_OUTSIDE_JUMP01")  # mismo criterio: credenciales expuestas
    reasons = []
    for criterion, by_hit, by_rule in MANDATORY:
        if criterion in BLOCKABLE and blocked:
            continue
        evidence = sorted(names & by_hit) or ([rule_id] if rule_id in by_rule else [])
        if evidence:
            reasons.append(f"Obligatorio (política §5): {criterion} ({', '.join(evidence)})")
    return reasons


def pending_actions(actions: list[dict], executed: list[dict] | None = None) -> list[dict]:
    """Acciones de la API recomendadas que aún no se han ejecutado (las que son solo del analista no cuentan)."""
    done = {(e.get("action"), e.get("target")) for e in executed or []}
    return [a for a in actions or [] if a.get("action") in API_ACTIONS and (a.get("action"), a.get("target")) not in done]


def ticket_status(verdict: str, severity: str, escalate: bool, actions: list[dict],
                  confidence: float = 1.0, decided_by: str = "policy", executed: list[dict] | None = None) -> str:
    """Estado del ticket. Cierra lo que cierran los runbooks, y solo cuando no queda nada por ejecutar."""
    if escalate:
        return STATUS_ESCALATED
    pending = pending_actions(actions, executed)
    if any(a.get("requires_approval") for a in pending):
        return STATUS_AWAITING
    if decided_by == "llm" and confidence < LLM_CLOSE_MIN_CONFIDENCE:
        return STATUS_TRIAGED
    # Runbooks: true_positive sin efecto (bloqueado, sin interacción) → «cerrar (low)», si el propio ticket
    # recomienda cerrar y la severidad no se escala.
    closable = verdict in BENIGN_VERDICTS or (
        verdict == "true_positive" and severity in NON_ESCALATED_SEVERITIES
        and any(a.get("action") == "close" for a in actions or []))
    return STATUS_CLOSED if closable and not pending else STATUS_TRIAGED


def status_for(ticket: dict) -> str:
    """ticket_status() con los campos de un ticket (también los executed_actions que añade el dashboard)."""
    return ticket_status(ticket.get("verdict", ""), ticket.get("severity", ""),
                         bool((ticket.get("escalation") or {}).get("escalate")), ticket.get("recommended_actions") or [],
                         ticket.get("confidence", 0.0), (ticket.get("x_decided_by") or {}).get("verdict", ""),
                         ticket.get("executed_actions") or [])


def closes_after_actions(ticket: dict) -> bool:
    """¿Solo le faltan las acciones de la API para cerrarse? (cola «listas para cerrar» del dashboard)."""
    pending = pending_actions(ticket.get("recommended_actions") or [], ticket.get("executed_actions") or [])
    if not pending or status_for(ticket) == STATUS_CLOSED:
        return False
    done = {**ticket, "executed_actions": [*(ticket.get("executed_actions") or []), *pending]}
    return status_for(done) == STATUS_CLOSED
