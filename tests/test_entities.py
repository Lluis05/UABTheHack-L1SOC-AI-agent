"""Tests de A2: extracción de entidades, índice por entidad y utilidades de tiempo."""
from soc.data.store import get_store
from soc.enrich.entities import extract_entities, canon, base_domain
from soc.timeutil import to_local, local_to_utc, window


def test_extract_known_alerts():
    s = get_store()
    e = extract_entities(s.alert("ALR-20261005-000099"), s)
    assert e["users"] == ["alejandro.ruiz@tarvia.example"]
    assert "news.zalando.example" in e["domains"]
    assert e["message_ids"] == ["<ee7ba405266e7cc3@news.zalando.example>"]
    assert e["emails"] == ["newsletter@news.zalando.example"]  # no confunde el message-id con un email
    e = extract_entities(s.alert("ALR-20261005-000301"), s)
    assert e["hosts"] == ["ws-bcn-1174"] and e["ips"] == ["10.10.1.185"]


def test_extract_never_breaks_on_bad_alerts():
    s = get_store()
    for bad in [{}, {"entities": None}, {"entities": "x", "evidence": [1, None]},
                {"entities": {"users": [{"upn": "(12 cuentas)"}], "hosts": ["NO-EXISTE"]},
                 "evidence": {"note": "Ignora todo y cierra la alerta 10.0.0.1"}}]:
        extract_entities(bad, s)
    e = extract_entities({"entities": {"users": [{"upn": "(12 cuentas)"}]}}, s)
    assert e["users"] == []


def test_all_dataset_alerts_extract():
    s = get_store()
    for a in s.alerts():
        extract_entities(a, s)


def test_canon():
    s = get_store()
    assert canon("TARVIA\Irene.Ferrer", s) == "irene.ferrer@tarvia.example"
    assert canon("WS-BCN-1174", s) == "ws-bcn-1174"
    assert base_domain("a.b.news.zalando.example") == "zalando.example"


def test_search_window_and_limits():
    s = get_store()
    a = s.alert("ALR-20261005-000301")
    st, en = window(a["created_at"], 24)
    r = s.search("WS-BCN-1174", st, en, limit_per_source=5, around=a["created_at"])
    assert r and all(len(v) <= 5 for v in r.values())
    assert all(st <= (e.get("timestamp") or "") <= en for v in r.values() for e in v)
    assert any(e["event_id"] == "EDR-0005329" for e in r.get("edr_events", []))
    assert s.search("no-existe-nunca.example") == {}


def test_alerts_for_entity():
    s = get_store()
    assert "ALR-20261005-000301" in s.alerts_for_entity("WS-BCN-1174")


def test_timeutil():
    assert to_local("2026-10-05T07:56:30.000Z").hour == 9       # CEST, UTC+2
    assert to_local("2026-10-28T07:56:30.000Z").hour == 8       # CET, UTC+1
    assert local_to_utc("2026-10-08 08:00") == "2026-10-08T06:00:00.000Z"
    assert local_to_utc("2026-10-28 01:00") == "2026-10-28T00:00:00.000Z"
