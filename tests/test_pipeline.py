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
    assert len(tickets) == 2 and {"context", "policy", "ticket"} <= set(steps)


def test_dedup_groups_same_rule_and_entities():
    s = get_store()
    a = s.alert("ALR-20261005-000301")
    b = {**a, "alert_id": "DUP-1", "created_at": "2026-10-05T08:10:00.000Z"}
    c = {**a, "alert_id": "DUP-2", "created_at": "2026-10-06T08:10:00.000Z"}
    groups = dedup_groups([build_context(x, s) for x in (a, b, c)])
    assert sorted(len(g) for g in groups) == [1, 2]


def test_triage_live_contract_with_dashboard(monkeypatch, tmp_path):
    """Contrato docs/04: triage_live emite trace_entry y un ticket por alerta (IA simulada: no gasta cuota)."""
    import soc.pipeline as p
    import soc.triage.agent as agent
    from soc import config

    monkeypatch.setattr(config, "OUTPUT_DIR", tmp_path)
    monkeypatch.setattr(agent, "cached_complete", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("sin IA")))
    events = []
    tickets = p.triage_live(ids=["ALR-20261005-000301"], on_step=lambda a, s, d: events.append((a, s, d)))
    assert len(tickets) == 1 and tickets[0]["x_mode"] == "no_ai_fallback"
    assert any(d.get("trace_entry") for _, _, d in events)
    assert [s for _, s, d in events if d.get("ticket")] == ["ticket"]
    assert (tmp_path / "tickets.jsonl").exists()


# ------------------------------------------------------------- correlación (x_incident_id)
def _truth(inc_id):
    from pathlib import Path
    f = Path(__file__).resolve().parents[1] / "eval" / "incidents_truth.jsonl"
    return next(t for t in map(json.loads, f.read_text(encoding="utf-8").splitlines()) if t["incident_id"] == inc_id)


def test_link_incident_joins_known_incident_but_not_closed_tickets():
    import copy
    from soc.correlate.incidents import correlate
    from soc.pipeline import link_incident

    s = get_store()
    incs = correlate([s.alert(i) for i in _truth("INC-02")["alert_ids"]], s)
    new = copy.deepcopy(s.alert("ALR-20261008-011789"))
    new["alert_id"] = "ALR-NUEVA-0001"
    ctx = {"alert": new, "trace": []}
    t = {"verdict": "true_positive", "x_incident_id": None}
    assert link_incident(ctx, t, s, incs) == incs[0]["incident_id"] == t["x_incident_id"]
    assert ctx["trace"][-1]["step"] == "correlate"
    closed = {"verdict": "false_positive", "x_incident_id": None}
    assert link_incident({"alert": new}, closed, s, incs) is None and closed["x_incident_id"] is None


def test_correlate_batch_builds_incident_from_new_alerts_only():
    """Simula el JSON de la defensa: alertas con ids que no existen en el dataset y sin incidentes conocidos."""
    import copy
    from soc.pipeline import correlate_batch

    s = get_store()
    alerts = []
    for n, aid in enumerate(_truth("INC-01")["alert_ids"], 1):
        a = copy.deepcopy(s.alert(aid))
        a["alert_id"] = f"ALR-DEMO-{n:04d}"
        alerts.append(a)
    contexts = [{"alert": a} for a in alerts]
    tickets = [{"ticket_id": f"T-{a['alert_id']}", "alert_ids": [a["alert_id"]], "verdict": "true_positive",
                "severity": "high", "x_incident_id": None} for a in alerts]
    known = [{"incident_id": "INC-0007"}]
    new = correlate_batch(contexts, tickets, s, known)
    assert [i["incident_id"] for i in new] == ["INC-0008"] and new[0]["x_live"]
    assert {t["x_incident_id"] for t in tickets} == {"INC-0008"}


def test_load_incidents_missing_file_is_empty(tmp_path):
    from soc.pipeline import load_incidents, save_incidents

    f = tmp_path / "incidents.jsonl"
    assert load_incidents(f) == []
    save_incidents([{"incident_id": "INC-0001", "alert_ids": ["A"]}], f)
    assert [i["incident_id"] for i in load_incidents(f)] == ["INC-0001"]
