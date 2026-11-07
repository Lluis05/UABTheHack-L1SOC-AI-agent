"""Métricas de un batch de triaje (Persona A) → output/metrics.json, que lee el dashboard (C).

Mismas claves que dashboard.results.compute_metrics (total, auto_closed, llm, escalated, by_*) más las propias
del batch: alertas vs tickets (deduplicación), decididas por la política, pendientes de IA, rendimiento y las
reglas con más alertas pendientes (dónde afinar la política).
"""

from __future__ import annotations

import collections
import json
from datetime import datetime, timezone
from pathlib import Path

from soc import config

HUMAN_MINUTES_PER_ALERT = 15  # diapositiva 3 de Deloitte: un N1 tarda ~15 min por alerta
TOP_RULES = 10


def _pct(part: int, total: int) -> float:
    return round(100 * part / total, 1) if total else 0.0


def _count(tickets: list[dict], key) -> dict[str, int]:
    return dict(collections.Counter(str(key(t)) for t in tickets).most_common())


def batch_metrics(tickets: list[dict], *, n_alerts: int | None = None, wall_seconds: float | None = None,
                  mode: str = "") -> dict:
    n_tickets = len(tickets)
    n_alerts = n_alerts if n_alerts is not None else sum(len(t.get("alert_ids") or [1]) for t in tickets)
    decider = lambda t: (t.get("x_decided_by") or {}).get("verdict")  # noqa: E731
    policy = sum(1 for t in tickets if decider(t) == "policy")
    auto_closed = sum(1 for t in tickets if t.get("x_status") == "closed" and decider(t) == "policy")
    llm = sum(1 for t in tickets if t.get("x_llm_provider"))
    pending = [t for t in tickets if t.get("x_mode") == "pending_ai"]
    escalated = sum(1 for t in tickets if (t.get("escalation") or {}).get("escalate"))
    awaiting = sum(1 for t in tickets if t.get("x_status") == "awaiting_approval")
    injections = sum(1 for t in tickets if (t.get("x_injection") or {}).get("detected")
                     or any((h.get("rule") if isinstance(h, dict) else h) == "PROMPT_INJECTION_TEXT"
                            for h in t.get("x_policy_hits") or []))
    secs = [float(t["triage_seconds"]) for t in tickets if isinstance(t.get("triage_seconds"), (int, float))]
    manual_s = n_alerts * HUMAN_MINUTES_PER_ALERT * 60
    spent_s = wall_seconds if wall_seconds is not None else sum(secs)
    rule = lambda t: (t.get("x_rule") or {}).get("rule_id")  # noqa: E731
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mode": mode,
        # mismas claves que el dashboard
        "total": n_alerts,
        "tickets": n_tickets,
        "auto_closed": auto_closed, "auto_closed_pct": _pct(auto_closed, n_tickets),
        "llm": llm, "llm_pct": _pct(llm, n_tickets),
        "escalated": escalated, "escalated_pct": _pct(escalated, n_tickets),
        "awaiting_approval": awaiting,
        "avg_triage_seconds": round(sum(secs) / len(secs), 3) if secs else None,
        "time_saved_hours": round(max(0.0, manual_s - spent_s) / 3600, 1),
        "manual_minutes_per_alert": HUMAN_MINUTES_PER_ALERT,
        "by_verdict": _count(tickets, lambda t: t.get("verdict")),
        "by_severity": _count(tickets, lambda t: t.get("severity")),
        "by_status": _count(tickets, lambda t: t.get("x_status")),
        "by_decider": _count(tickets, decider),
        # propias del batch
        "dedup_merged_alerts": n_alerts - n_tickets,
        "decided_by_policy": policy, "decided_by_policy_pct": _pct(policy, n_tickets),
        "pending_ai": len(pending), "pending_ai_pct": _pct(len(pending), n_tickets),
        "pending_ai_high_or_critical": sum(1 for t in pending if t.get("severity") in ("high", "critical")),
        "injection_attempts": injections,
        "no_ai_fallback": sum(1 for t in tickets if t.get("x_no_ai")),
        "wall_seconds": round(wall_seconds, 1) if wall_seconds is not None else None,
        "alerts_per_second": round(n_alerts / wall_seconds, 1) if wall_seconds else None,
        "manual_hours_equivalent": round(manual_s / 3600, 1),
        "by_mode": _count(tickets, lambda t: t.get("x_mode")),
        "top_rules_pending_ai": dict(collections.Counter(rule(t) for t in pending).most_common(TOP_RULES)),
        "top_rules_true_positive": dict(collections.Counter(
            rule(t) for t in tickets if t.get("verdict") == "true_positive").most_common(TOP_RULES)),
    }


def write_metrics(metrics: dict, path: Path | None = None) -> Path:
    path = path or config.OUTPUT_DIR / "metrics.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    return path
