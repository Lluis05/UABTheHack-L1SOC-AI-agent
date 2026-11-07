"""Tests de D4 (informe de nivel 3) sin gastar LLM: validación en código y alternativa sin IA."""
import json
from pathlib import Path

from soc.correlate.incidents import correlate
from soc.correlate.investigate import evidence_event_ids, finalize_report, gather_evidence, investigate
from soc.data.store import get_store

TRUTH = Path(__file__).resolve().parents[1] / "eval" / "incidents_truth.jsonl"


def incident(truth_id: str) -> dict:
    t = next(json.loads(l) for l in TRUTH.read_text(encoding="utf-8").splitlines() if truth_id in l)
    s = get_store()
    return correlate([s.alert(a) for a in t["alert_ids"]], s)[0]


def test_evidence_always_has_alert_related_events():
    s = get_store()
    inc = incident("INC-01")
    ev = gather_evidence(inc, s)
    ids = evidence_event_ids(ev)
    assert "EDR-0123412" in ids                                  # LSASS (related_event de la alerta)
    assert set(inc["alert_ids"]) <= ids


def test_finalize_report_drops_invented_ids_and_sets_approvers():
    s = get_store()
    inc = incident("INC-02")
    ev = gather_evidence(inc, s)
    real = sorted(evidence_event_ids(ev) - set(inc["alert_ids"]))[0]
    raw = {"title": "t", "confidence": 0.9, "open_questions": [],
           "timeline": [{"timestamp": "2026-10-07T07:44:00Z", "event_id": real, "description": "ok", "mitre": "T1078"},
                        {"timestamp": "2026-10-07T08:00:00Z", "event_id": "EVT-INVENTADO", "description": "x",
                         "mitre": ""}],
           "containment_plan": [{"action": "revoke_sessions", "target": "laura.ferrer2@tarvia.example",
                                 "business_impact": "cierra su sesión"},
                                {"action": "isolate_host", "target": "PLC-SORT01", "business_impact": "OT"}]}
    rep = finalize_report(raw, {**inc, "incident_id": "INC-X"}, ev, s)
    assert rep["incident_id"] == "INC-X" and rep["alert_ids"] == inc["alert_ids"]
    assert [t["event_id"] for t in rep["timeline"]] == [real] and rep["confidence"] < 0.9
    assert rep["containment_plan"][0]["approver"]                 # lo pone soc.policy.approvals, no el LLM
    assert rep["containment_plan"][1]["action"] == "escalate"     # nunca acciones sobre OT


def test_investigate_without_llm_never_breaks(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDERS", "bogus")
    rep = investigate(incident("INC-03"), get_store(), use_cache=False)
    assert rep["x_no_ai"] and rep["timeline"] and rep["containment_plan"][0]["action"] == "escalate"
