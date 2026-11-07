"""Tests de D3 (correlación en incidentes) sobre el dataset real, sin LLM."""
import copy
import json
from pathlib import Path

from soc.correlate.incidents import attach, correlate, is_hub, is_weak, match_truth
from soc.data.store import get_store

TRUTH = Path(__file__).resolve().parents[1] / "eval" / "incidents_truth.jsonl"


def truth() -> dict:
    return {t["incident_id"]: t for t in (json.loads(l) for l in TRUTH.read_text(encoding="utf-8").splitlines())}


def alerts(ids):
    s = get_store()
    return [s.alert(i) for i in ids]


def test_weak_and_hub_entities():
    s = get_store()
    assert is_weak("marta.puig@tarvia.example") and is_weak("10.10.3.95") and is_weak("ws-bcn-1770")
    assert not is_weak("aplihartom.com") and not is_weak("203.0.113.45") and not is_weak("ai-c07inj0001")
    assert is_hub("192.0.2.10", s)                                   # IP del pentest
    assert is_hub("https://www.tarvia.example/api/v1/products?id=1", s)
    assert is_hub("x1.e5.sk", s)                                     # DNS del antivirus ESET
    assert not is_hub("aplihartom.com", s)


def test_intrusion_chain_is_one_critical_incident():
    t = truth()["INC-01"]
    incs = correlate(alerts(t["alert_ids"]), get_store())
    assert len(incs) == 1 and set(incs[0]["alert_ids"]) == set(t["alert_ids"])
    assert incs[0]["severity"] == "critical" and incs[0]["x_chain"]
    assert incs[0]["kill_chain"][0]["rule_id"] == "UC-EML-002"       # empieza por el correo


def test_decoys_do_not_form_incidents():
    s = get_store()
    pentest = [a for a in s.alerts() if a["rule_id"] == "UC-WEB-001" and "192.0.2.1" in json.dumps(a)]
    assert pentest and correlate(pentest, s) == []


def test_match_truth_counts():
    t = truth()
    incs = correlate(alerts(t["INC-02"]["alert_ids"] + t["INC-05"]["alert_ids"]), get_store())
    m = match_truth(incs, [t["INC-02"], t["INC-05"], t["INC-03"]])
    assert m["found"] == 2 and m["total"] == 3 and m["spurious"] == 0


def test_attach_new_alert_to_existing_incident():
    s = get_store()
    t = truth()["INC-02"]
    incs = correlate(alerts(t["alert_ids"]), s)
    new = copy.deepcopy(s.alert("ALR-20261008-011789"))
    new["alert_id"] = "ALR-NEW-0001"
    assert attach(new, incs, s) == incs[0]["incident_id"]
    unrelated = copy.deepcopy(s.alert("ALR-20261006-011826"))       # minero de Jenkins
    unrelated["alert_id"] = "ALR-NEW-0002"
    assert attach(unrelated, incs, s) is None
