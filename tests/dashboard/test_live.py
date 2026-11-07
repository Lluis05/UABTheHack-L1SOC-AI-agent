"""Tests de dashboard/live.py: cómo se aplican los eventos de progreso del pipeline."""
from dashboard import settings as s
from dashboard.live import apply_step, new_alert_state


def make_job():
    return {"alerts": {"A": new_alert_state("A")}, "log": [], "tickets": []}


def test_trace_entries_accumulate_and_step_advances():
    job = make_job()
    apply_step(job, "A", "context", {"trace_entry": {"step": "asset_lookup"}})
    apply_step(job, "A", "policy", {"trace_entry": {"step": "severity_matrix"}})
    st = job["alerts"]["A"]
    assert st["step"] == "policy"
    assert [t["step"] for t in st["trace"]] == ["asset_lookup", "severity_matrix"]
    assert st["started_at"] is not None


def test_ticket_event_finishes_alert_and_keeps_trace():
    job = make_job()
    apply_step(job, "A", "context", {"trace_entry": {"step": "x"}})
    apply_step(job, "A", s.STEP_TICKET, {"ticket": {"ticket_id": "T-A"}})
    st = job["alerts"]["A"]
    assert st["step"] == s.STEP_TICKET and st["ticket_id"] == "T-A" and st["finished_at"]
    assert job["tickets"][0]["x_live_trace"] == [{"step": "x"}]


def test_error_event_and_unknown_alert():
    job = make_job()
    apply_step(job, "NEW", "llm", {"error": "timeout", "message": "fallback"})
    st = job["alerts"]["NEW"]
    assert st["step"] == s.STEP_ERROR and st["error"] == "timeout"
    assert job["log"] == ["[NEW] fallback"]


def test_unknown_step_name_does_not_change_step():
    job = make_job()
    apply_step(job, "A", "algo_raro", {})
    assert job["alerts"]["A"]["step"] == s.STEP_QUEUED
