"""Tests de OSINT sin red: las listas y ThreatFox se simulan."""
import pytest

from soc import config
from soc.enrich import osint

TOR = "# lista\n185.220.101.1\n"
IPSUM = "# IPsum\n45.9.148.3\t7\n"
C2_IP = "#ip,ioc\n91.92.1.1,Possible Cobalt Strike C2 IP\n"
C2_DOM = "#domain,ioc\nevil-c2.top,Possible Sliver C2 Domain\n"
TEXTS = {"tor_exit": TOR, "ipsum": IPSUM, "c2intel_ip": C2_IP, "c2intel_dom": C2_DOM}


def fake_download(url, timeout):
    name = next(n for n, (u, _) in osint.FEEDS.items() if u == url)
    return TEXTS[name]


@pytest.fixture
def feeds(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "OUTPUT_DIR", tmp_path)
    monkeypatch.delenv(osint.ENV_ABUSECH_KEY, raising=False)
    return osint.Feeds(downloader=fake_download)


@pytest.mark.parametrize("ind,typ,ok", [
    ("185.220.101.1", "ip", True),
    ("10.1.2.3", "ip", False),            # red de Tarvia
    ("192.0.2.10", "ip", False),          # rango de documentación (pentest del dataset)
    ("203.0.113.5", "ip", False),
    ("evil-c2.top", "domain", True),
    ("packaging-iberia-pagos.example", "domain", False),
    ("intranet.tarvia.com", "domain", False),
    ("x@y.com", "email", False),
])
def test_is_queryable(ind, typ, ok):
    assert osint.is_queryable(ind, typ) is ok


def test_hashes_only_with_threatfox_key(monkeypatch):
    monkeypatch.delenv(osint.ENV_ABUSECH_KEY, raising=False)
    assert not osint.is_queryable("a" * 64, "sha256")
    monkeypatch.setenv(osint.ENV_ABUSECH_KEY, "k")
    assert osint.is_queryable("a" * 64, "sha256")


def test_parse_feeds():
    assert osint.parse_feed("ipsum", IPSUM) == {"45.9.148.3": "7"}
    assert osint.parse_feed("c2intel_dom", C2_DOM) == {"evil-c2.top": "Possible Sliver C2 Domain"}
    assert osint.parse_feed("tor_exit", TOR) == {"185.220.101.1": ""}


def test_feed_hits_and_unknown(feeds):
    r = osint.lookup("185.220.101.1", "ip", feeds=feeds)
    assert [h["source"] for h in r["hits"]] == ["tor_exit"]
    r = osint.lookup("evil-c2.top", "domain", feeds=feeds)
    assert "Sliver" in r["hits"][0]["result"]
    r = osint.lookup("8.8.8.8", "ip", feeds=feeds)
    assert r["hits"] == [] and "desconocido ≠ limpio" in osint.describe(r)


def test_feeds_are_cached_on_disk(feeds, tmp_path):
    feeds.ensure()
    assert (tmp_path / "osint" / "feeds" / "ipsum.txt").exists()
    calls = []
    again = osint.Feeds(downloader=lambda u, t: calls.append(u) or "")
    assert again.lookup("45.9.148.3", "ip")          # leído del disco
    assert calls == []


def test_feed_download_failure_never_breaks(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "OUTPUT_DIR", tmp_path)

    def boom(url, timeout):
        raise TimeoutError("sin red")

    f = osint.Feeds(downloader=boom)
    r = osint.lookup("185.220.101.1", "ip", feeds=f, threatfox=osint.ThreatFox(post=boom))
    assert r["hits"] == [] and "OSINT no disponible" in osint.describe(r)


def test_threatfox_hit_cache_and_timeout(feeds, monkeypatch):
    monkeypatch.setenv(osint.ENV_ABUSECH_KEY, "k")
    calls = []

    def post(payload, key, timeout):
        calls.append(payload)
        return {"query_status": "ok", "data": [{"threat_type": "botnet_cc", "malware_printable": "AsyncRAT",
                                                "confidence_level": 100}]}

    tf = osint.ThreatFox(post=post)
    r = osint.lookup("91.92.1.1", "ip", feeds=feeds, threatfox=tf)
    assert {h["source"] for h in r["hits"]} == {"c2intel_ip", "threatfox"}
    assert "AsyncRAT" in osint.describe(r)
    osint.lookup("91.92.1.1", "ip", feeds=feeds, threatfox=tf)
    assert len(calls) == 1                            # la segunda vez sale de la caché

    def slow(payload, key, timeout):
        raise TimeoutError("timed out")

    r = osint.lookup("1.1.1.1", "ip", feeds=feeds, threatfox=osint.ThreatFox(post=slow))
    assert r["hits"] == [] and any("threatfox" in e for e in r["errors"])


def test_context_uses_osint_only_when_enabled(feeds, monkeypatch):
    from soc.enrich.context import build_context

    monkeypatch.setattr(osint, "_feeds", feeds)
    alert = {"alert_id": "ALR-NEW-OSINT", "created_at": "2026-10-20T10:00:00Z", "rule_id": "UC-NET-001",
             "entities": {"ips": ["185.220.101.1", "10.1.2.3"], "domains": ["evil-c2.top"]}}
    monkeypatch.setenv(osint.ENV_ENABLED, "0")
    ctx = build_context(alert)
    assert not [t for t in ctx["trace"] if t["step"] == "osint"]

    monkeypatch.setenv(osint.ENV_ENABLED, "1")
    ctx = build_context(alert)
    steps = [t for t in ctx["trace"] if t["step"] == "osint"]
    assert {t["query"] for t in steps} == {"185.220.101.1", "evil-c2.top"}   # la IP interna no sale
    assert all(t["source"] == "OSINT" for t in steps)
