"""Tests de A5 (sin gastar LLM): prefiltro, pipeline en modo no_llm, alertas nuevas y deduplicación."""
import json

from soc.data.store import get_store
from soc.enrich.context import build_context
from soc.pipeline import dedup_groups, load_alert_file, run
from soc.triage.prefilter import deterministic_ticket, prefilter

REQUIRED = {"ticket_id", "alert_ids", "title", "verdict", "confidence", "severity", "summary", "evidence",
            "recommended_actions", "escalation"}


def test_prefilter_sccm_closes_as_fp():
    s = get_store()
    ctx = build_context(s.alert("ALR-20261005-000301"), s)
    h = prefilter(ctx)
    assert h["decisive"] and h["verdict"] == "false_positive" and "SCCM" in h["title"]
    t = deterministic_ticket(ctx, s, h)
    assert REQUIRED <= set(t) and t["x_decided_by"]["verdict"] == "policy" and t["severity"] == "informational"
    assert t["evidence"][0]["event_id"] == "EDR-0005329"


def test_pending_high_is_escalated_to_human():
    s = get_store()
    a = next(x for x in s.alerts(sample=True) if x["rule_id"] == "UC-WEB-003")
    t = deterministic_ticket(build_context(a, s), s)
    assert t["x_mode"] == "pending_ai" and t["escalation"]["escalate"]


def test_run_no_llm_on_sample_never_breaks(tmp_path):
    s = get_store()
    tickets = run(s.alerts(sample=True), mode="no_llm", store=s, save_traces=False)
    assert tickets and all(REQUIRED <= set(t) for t in tickets)
    assert sum(len(t["alert_ids"]) for t in tickets) == 150
    json.dumps(tickets, ensure_ascii=False, default=str)


def test_new_alerts_from_file(tmp_path):
    f = tmp_path / "defensa.jsonl"
    f.write_text(json.dumps({"created_at": "2026-11-08T09:00:00.000Z", "rule_id": "UC-EDR-004", "severity": "critical",
                             "source_product": "EDR", "entities": {"hosts": [{"hostname": "WS-BCN-1770"}]},
                             "evidence": {}}) + "\n" + json.dumps({"rule_id": "UC-WEB-001"}), encoding="utf-8")
    alerts = load_alert_file(f)
    assert [a["alert_id"] for a in alerts] == ["ALR-NUEVA-0001", "ALR-NUEVA-0002"]
    steps = []
    tickets = run(alerts, mode="no_llm", save_traces=False, on_step=lambda a, s, i: steps.append(s))
    assert len(tickets) == 2 and {"contexto", "politica", "prefiltro", "ticket"} <= set(steps)


def test_dedup_groups_same_rule_and_entities():
    s = get_store()
    a = s.alert("ALR-20261005-000301")
    b = {**a, "alert_id": "DUP-1", "created_at": "2026-10-05T08:10:00.000Z"}
    c = {**a, "alert_id": "DUP-2", "created_at": "2026-10-06T08:10:00.000Z"}
    groups = dedup_groups([build_context(x, s) for x in (a, b, c)])
    assert sorted(len(g) for g in groups) == [1, 2]
