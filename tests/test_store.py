"""Tests del DataStore (A1). Requieren el dataset en DATASET_DIR. Ejecutar: python -m pytest tests -q"""
from soc.data.store import get_store


def test_counts():
    s = get_store().stats()
    assert s["alerts"] == 11061 and s["sample"] == 150 and s["events"] == 814471


def test_lookups():
    s = get_store()
    assert s.event("EDR-0005329")["_source"] == "edr_events"
    assert s.asset("ws-bcn-1174") is s.asset("10.10.1.185")
    assert s.user("TARVIA\irene.ferrer")["upn"] == "irene.ferrer@tarvia.example"
    assert s.user("nuria.vidal@tarvia.example")["hr_events"]
    assert s.intel("no-existe.example") == {"indicator": "no-existe.example", "tip": None, "geo": None}
    assert s.asset("") is None and s.user("") is None


def test_related_events_resolve():
    s = get_store()
    assert all(s.event(r) for a in s.alerts() for r in a.get("related_events", []))
