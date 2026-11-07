"""Tests de dashboard/results.py: decisiones humanas, métricas y rutas seguras."""
import json

from dashboard import settings as s
from dashboard.results import ResultsStore, apply_decisions, compute_metrics, percent, resolve_inside

ACTION = {"action": "revoke_sessions", "target": "u@x", "requires_approval": True, "justification": "j"}


def make_ticket(**over):
    base = {"ticket_id": "T1", "verdict": "true_positive", "x_status": s.STATUS_AWAITING,
            "recommended_actions": [ACTION], "executed_actions": [], "escalation": {"escalate": True},
            "x_decided_by": {"verdict": "llm", "severity": "policy", "actions": "llm"}}
    return {**base, **over}


def containment_decision(ok=True):
    return {"ticket_id": "T1", "type": s.DECISION_CONTAINMENT, "action": "revoke_sessions", "target": "u@x",
            "approver": "Ana", "approval_token": "APR-1", "timestamp": "2026-11-07T10:00:00Z", "ok": ok}


def test_containment_ok_marks_action_executed_and_human():
    [t] = apply_decisions([make_ticket()], [containment_decision()])
    assert t["executed_actions"][0]["approval_token"] == "APR-1"
    assert t["x_decided_by"]["actions"] == s.DECIDER_HUMAN
    assert t["x_status"] == s.STATUS_ESCALATED  # ya no queda nada pendiente y el ticket se escalaba


def test_failed_containment_is_history_only():
    [t] = apply_decisions([make_ticket(escalation={"escalate": False})], [containment_decision(ok=False)])
    assert t["executed_actions"] == []
    assert t["x_status"] == s.STATUS_AWAITING
    assert len(t["x_human_decisions"]) == 1


def test_close_with_verdict_override():
    d = {"ticket_id": "T1", "type": "close", "approver": "Ana", "verdict": "false_positive"}
    [t] = apply_decisions([make_ticket()], [d])
    assert t["x_status"] == s.STATUS_CLOSED
    assert t["verdict"] == "false_positive"
    assert t["x_decided_by"]["verdict"] == s.DECIDER_HUMAN


def test_apply_decisions_does_not_mutate_input():
    original = make_ticket()
    apply_decisions([original], [containment_decision()])
    assert original["executed_actions"] == []
    assert original["x_decided_by"]["actions"] == "llm"


def test_blocked_attack_closes_once_n1_executes_the_block():
    # Runbook: TP bloqueado → bloquear IOC (N1, sin aprobación) y cerrar. Cerrado solo cuando ya está bloqueado.
    block = {"action": "block_ioc", "target": "1.2.3.4", "requires_approval": False}
    t = make_ticket(severity="low", x_status=s.STATUS_TRIAGED, escalation={"escalate": False}, confidence=0.9,
                    recommended_actions=[block, {"action": "close", "target": "ticket", "requires_approval": False}])
    d = {**containment_decision(), "action": "block_ioc", "target": "1.2.3.4", "approval_token": None}
    assert apply_decisions([t], [])[0]["x_status"] == s.STATUS_TRIAGED
    assert apply_decisions([t], [d])[0]["x_status"] == s.STATUS_CLOSED


def test_human_reopen_is_not_overridden_by_policy():
    t = make_ticket(verdict="false_positive", x_status=s.STATUS_CLOSED, escalation={"escalate": False},
                    recommended_actions=[])
    [r] = apply_decisions([t], [{"ticket_id": "T1", "type": "reopen", "approver": "Ana"}])
    assert r["x_status"] == s.STATUS_TRIAGED


def test_compute_metrics():
    tickets = [
        make_ticket(ticket_id="A", x_status=s.STATUS_CLOSED, x_decided_by={"verdict": "policy"},
                    escalation={"escalate": False}, triage_seconds=1.0),
        make_ticket(ticket_id="B", x_llm_provider="claude_code", triage_seconds=19.0),
    ]
    m = compute_metrics(tickets)
    assert m["total"] == 2
    assert m["auto_closed"] == 1 and m["auto_closed_pct"] == 50.0
    assert m["llm"] == 1 and m["escalated"] == 1 and m["awaiting_approval"] == 1
    assert m["avg_triage_seconds"] == 10.0
    assert m["time_saved_hours"] == round((2 * s.MINUTES_PER_ALERT_MANUAL * 60 - 20) / 3600, 1)


def test_percent_with_zero_total():
    assert percent(3, 0) == 0.0


def test_resolve_inside_blocks_traversal(tmp_path):
    allowed = tmp_path / "out"
    (allowed / s.TRACES_DIR).mkdir(parents=True)
    (allowed / s.TRACES_DIR / "A.json").write_text("{}")
    (tmp_path / "secret.json").write_text("{}")
    assert resolve_inside("traces/A.json", [allowed], [allowed]) is not None
    assert resolve_inside("../secret.json", [allowed], [allowed]) is None


def test_store_falls_back_to_sample_and_applies_decisions(tmp_path):
    sample, out = tmp_path / "sample", tmp_path / "out"
    sample.mkdir()
    (sample / s.TICKETS_FILE).write_text(json.dumps(make_ticket()) + "\n" + "{línea rota\n", encoding="utf-8")
    store = ResultsStore(output_dir=out, sample_dir=sample, decisions_file=out / "d.jsonl")
    assert store.source == "sample"
    store.record_decision({"ticket_id": "T1", "type": "close", "approver": "Ana"})
    assert store.ticket("T1")["x_status"] == s.STATUS_CLOSED
    live = make_ticket(ticket_id="LIVE")
    assert store.ticket("LIVE", extra=[live]) is not None
