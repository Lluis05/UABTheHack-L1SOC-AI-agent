"""Tests de dashboard/reports.py: lectura del informe de nivel 3, informes obsoletos y rutas seguras."""
import json

import pytest

from dashboard import reports
from dashboard import settings as s

INCIDENT = {"incident_id": "INC-0001", "alert_ids": ["ALR-1", "ALR-2"]}


def write_report(base, alert_ids, incident_id="INC-0001"):
    path = base / s.REPORTS_DIR / f"{incident_id}.json"
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps({"incident_id": incident_id, "alert_ids": alert_ids, "title": "t"}), encoding="utf-8")


def test_load_reads_the_report_file(tmp_path):
    write_report(tmp_path, ["ALR-2", "ALR-1"])
    report = reports.load(INCIDENT, [tmp_path])
    assert report["title"] == "t" and report["x_stale"] is False


def test_report_of_a_different_incident_is_stale(tmp_path):
    write_report(tmp_path, ["ALR-1", "ALR-9"])          # la correlación se volvió a ejecutar
    assert reports.load(INCIDENT, [tmp_path])["x_stale"] is True


def test_without_file_falls_back_to_the_incident_or_none(tmp_path):
    assert reports.load(INCIDENT, [tmp_path]) is None
    inc = {**INCIDENT, "x_report": {"alert_ids": ["ALR-1", "ALR-2"], "title": "embebido"}}
    assert reports.load(inc, [tmp_path])["title"] == "embebido"


@pytest.mark.parametrize("bad", ["../secreto", "INC/0001", "", "a" * 65])
def test_incident_id_cannot_escape_the_reports_dir(tmp_path, bad):
    with pytest.raises(reports.ReportError):
        reports.report_path(tmp_path, bad)


def test_generate_saves_the_report_and_frees_the_slot(tmp_path, monkeypatch):
    import soc.correlate.investigate as inv

    calls = []

    def fake_investigate(incident, store, use_cache):
        calls.append(use_cache)
        return {"incident_id": incident["incident_id"], "alert_ids": incident["alert_ids"], "title": "nuevo"}

    monkeypatch.setattr(inv, "investigate", fake_investigate)
    report = reports.generate(INCIDENT, tmp_path, fresh=True)
    assert report["title"] == "nuevo" and calls == [False]
    assert json.loads((tmp_path / s.REPORTS_DIR / "INC-0001.json").read_text(encoding="utf-8"))["title"] == "nuevo"
    assert not reports.generating("INC-0001")


def test_generate_never_uses_llm_cache_from_dashboard(tmp_path, monkeypatch):
    """«Generar informe» (sin fresh) tampoco puede salir de la caché del LLM."""
    import soc.correlate.investigate as inv

    calls = []
    monkeypatch.setattr(inv, "investigate", lambda incident, store, use_cache: calls.append(use_cache) or
                        {"incident_id": incident["incident_id"], "alert_ids": incident["alert_ids"], "title": "t"})
    reports.generate(INCIDENT, tmp_path)
    assert calls == [False]
