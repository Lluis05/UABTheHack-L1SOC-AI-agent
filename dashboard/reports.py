"""Informe de investigación de nivel 3 para N2 (lo redacta soc.correlate.investigate; aquí solo se lee y se pide).

El informe de un incidente se guarda en output/reports/<incident_id>.json. Al leerlo se comprueba que corresponde al
incidente actual: si la correlación se ha vuelto a ejecutar y el incidente tiene otras alertas, se marca obsoleto.
"""
from __future__ import annotations

import json
import re
import threading
from pathlib import Path

from dashboard import settings as s

INCIDENT_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")   # el id va a una ruta de fichero: nada de «..» ni barras


class ReportError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status, self.detail = status, detail


_running: set[str] = set()
_lock = threading.Lock()


def report_path(base: Path, incident_id: str) -> Path:
    if not INCIDENT_ID.match(incident_id or ""):
        raise ReportError(400, f"incident_id no válido: {incident_id!r}")
    return base / s.REPORTS_DIR / f"{incident_id}.json"


def is_stale(report: dict, incident: dict) -> bool:
    """El informe es de otro incidente con el mismo id (la correlación se volvió a ejecutar)."""
    return set(report.get("alert_ids") or []) != set(incident.get("alert_ids") or [])


def load(incident: dict, dirs: list[Path]) -> dict | None:
    """Primer informe que exista en `dirs` (output y, en modo muestra, sample); si no, el que lleve el incidente."""
    for base in dirs:
        path = report_path(base, incident["incident_id"])
        if path.exists():
            try:
                report = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            return {**report, "x_stale": is_stale(report, incident)}
    report = incident.get("x_report")
    return {**report, "x_stale": is_stale(report, incident)} if report else None


def generating(incident_id: str) -> bool:
    return incident_id in _running


def generate(incident: dict, out_dir: Path, store=None, *, fresh: bool = False) -> dict:
    """Pide el informe al investigador (LLM + validación en código) y lo guarda. Una sola ejecución por incidente."""
    from soc.correlate.investigate import investigate

    incident_id = incident["incident_id"]
    path = report_path(out_dir, incident_id)
    with _lock:
        if incident_id in _running:
            raise ReportError(409, f"ya se está generando el informe de {incident_id}")
        _running.add(incident_id)
    try:
        report = investigate(incident, store, use_cache=not fresh)   # nunca lanza: sin IA devuelve x_no_ai
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        return {**report, "x_stale": False}
    finally:
        _running.discard(incident_id)
