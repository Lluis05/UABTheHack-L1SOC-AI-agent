"""Tests de la integración con la API del SOC, contra una API FALSA local (no se ejecuta código externo)."""
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import pytest

from soc.data.api import HybridStore, SocApi
from soc.data.store import get_store
from soc.pipeline import run, select_alerts

NEW_ALERT = {"alert_id": "ALR-20261108-000001", "created_at": "2026-11-08T09:00:00.000Z", "rule_id": "UC-EDR-001",
             "rule_name": "Malware detectado", "severity": "high", "source_product": "EDR", "status": "new",
             "entities": {"hosts": [{"hostname": "WS-NUEVO-01"}]}, "evidence": {}, "related_events": ["EDR-9000001"]}
NEW_ASSET = {"hostname": "WS-NUEVO-01", "ip": "10.9.9.9", "criticality": "Alta", "zone": "CORP",
             "business_service": "Pruebas", "owner_upn": "", "os": "Windows 11", "vulnerabilities": []}
NEW_EVENT = {"event_id": "EDR-9000001", "timestamp": "2026-11-08T08:59:00.000Z", "hostname": "WS-NUEVO-01"}


class FakeApi(BaseHTTPRequestHandler):
    calls: list[str] = []

    def log_message(self, *a):  # silencio
        pass

    def do_GET(self):
        u = urlparse(self.path)
        FakeApi.calls.append(u.path)
        q = parse_qs(u.query)
        body = None
        if u.path == "/alerts":
            body = {"total": 1, "items": [NEW_ALERT][: int(q.get("limit", ["50"])[0])]}
        elif u.path == f"/alerts/{NEW_ALERT['alert_id']}":
            body = NEW_ALERT
        elif u.path.lower() == "/assets/ws-nuevo-01":  # la API real no distingue mayúsculas
            body = NEW_ASSET
        elif u.path == "/logs/edr_events" and q.get("q") == ["EDR-9000001"]:
            body = {"count": 1, "items": [NEW_EVENT]}
        elif u.path.startswith("/intel/"):
            body = {"indicator": u.path.split("/")[-1], "tip": None, "geo": None}
        if body is None:
            self.send_response(404)
            self.end_headers()
            return
        data = json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(data)


@pytest.fixture
def fake_api():
    srv = ThreadingHTTPServer(("127.0.0.1", 0), FakeApi)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    FakeApi.calls = []
    yield SocApi(f"http://127.0.0.1:{srv.server_port}")
    srv.shutdown()


def test_ids_are_read_from_the_api(fake_api):
    [a] = select_alerts(get_store(), ids=NEW_ALERT["alert_id"], api=fake_api)
    assert a["rule_id"] == "UC-EDR-001" and "API SOC" in a["x_intake"]


def test_queue_from_the_api(fake_api):
    alerts = select_alerts(get_store(), queue_n=5, api=fake_api)
    assert [a["alert_id"] for a in alerts] == [NEW_ALERT["alert_id"]]


def test_hybrid_store_falls_back_to_api_and_traces_it(fake_api):
    s = get_store()
    tickets = run([{**NEW_ALERT, "x_intake": "API SOC · GET /alerts/x"}], mode="no_llm", store=s,
                  save_traces=False, api=fake_api)
    t = tickets[0]
    assert "WS-NUEVO-01" in json.dumps(t["affected"])          # activo nuevo resuelto por la API
    assert "/logs/edr_events" in FakeApi.calls                  # evento nuevo buscado en la API
    h = HybridStore(s, fake_api)
    h.begin()
    assert h.event("EDR-9000001")["_source"] == "edr_events"
    assert h.api_calls()[0]["source"] == "API SOC"
    assert h.asset("WS-BCN-1770")["hostname"] == "WS-BCN-1770" and len(h.api_calls()) == 1  # local: sin llamada


def test_api_down_falls_back_to_local():
    down = SocApi("http://127.0.0.1:9")
    [a] = select_alerts(get_store(), ids="ALR-20261005-000301", api=down)
    assert a["x_intake"] == "dataset local"
