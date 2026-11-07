"""Motor de política del SOC de Tarvia (determinista).

    hits, severity = evaluate_policy(ctx, store)      # lo llama build_context automáticamente
    suggestion = suggest_verdict(hits)                 # pista para el prefiltro y el LLM
"""

from __future__ import annotations

from soc.policy.rules import evaluate_rules
from soc.policy.severity import compute_severity, max_criticality


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
    crit, src, _why = max_criticality(ctx)
    sev = compute_severity(
        (ctx.get("alert") or {}).get("severity"), crit, plus, minus,
        authorized=sug["decisive"] and sug["verdict"] == "benign_true_positive",
        false_positive=sug["decisive"] and sug["verdict"] == "false_positive",
        criticality_source=src)
    sev["suggestion"] = sug
    return hits, sev
