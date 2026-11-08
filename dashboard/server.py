"""Backend del dashboard (Persona C): solo rutas HTTP; la lógica vive en results.py, live.py y containment.py.

Arranque (desde la raíz del repo):  uvicorn dashboard.server:app --port 8001
"""
from __future__ import annotations

import uuid

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from dashboard import chat
from dashboard import containment
from dashboard import policy
from dashboard import reports
from dashboard import settings as s
from dashboard.live import JobManager, detect_mode
from dashboard.results import ResultsStore, compute_metrics
from soc.data.store import get_store

app = FastAPI(title="L1 SOC Dashboard API", version="1.0")
store = ResultsStore()
jobs = JobManager()
# DataStore caliente (CMDB para la política y, más adelante, el pipeline en vivo). Se carga sin bloquear el arranque.
datastore = policy.StoreHolder(get_store).start()
HTTP_FORBIDDEN = 403

MIN_APPROVER_LEN = 2
MIN_JUSTIFICATION_LEN = 5
VERDICT_PATTERN = "^(" + "|".join(s.VERDICTS) + ")$"
DECISION_PATTERN = "^(" + "|".join(s.STATUS_BY_DECISION) + ")$"


def _tickets() -> list[dict]:
    """Tickets con la decisión de la política sobre cada acción recomendada (x_approval)."""
    return [policy.annotate_ticket(t, datastore.get()) for t in store.tickets(jobs.tickets())]


def _ticket_or_404(ticket_id: str) -> dict:
    ticket = next((t for t in _tickets() if t["ticket_id"] == ticket_id), None)
    if not ticket:
        raise HTTPException(404, f"ticket no encontrado: {ticket_id}")
    return ticket


# --------------------------------------------------------------------------- lectura
@app.get("/api/config")
def config() -> dict:
    """Constantes que el frontend no debe duplicar."""
    return {"api_actions": sorted(policy.API_ACTIONS),
            "live_steps": list(s.LIVE_STEPS), "live_target_seconds": s.LIVE_TARGET_SECONDS,
            "max_live_alerts": s.MAX_LIVE_ALERTS, "manual_minutes_per_alert": s.MINUTES_PER_ALERT_MANUAL,
            "chat_max_question_chars": s.CHAT_MAX_QUESTION_CHARS, "chat_max_turns": s.CHAT_MAX_TURNS}


@app.get("/api/health")
def health() -> dict:
    return {"soc_api": containment.health(), "soc_api_url": s.SOC_API_URL,
            "data_source": store.source, "live_mode": detect_mode(),
            "datastore": datastore.status, "datastore_error": datastore.error}


@app.get("/api/tickets")
def list_tickets() -> dict:
    tickets = sorted(_tickets(), key=lambda t: t.get("ticket_id", ""), reverse=True)
    return {"source": store.source, "tickets": tickets}


@app.get("/api/tickets/{ticket_id}")
def get_ticket(ticket_id: str) -> dict:
    return _ticket_or_404(ticket_id)


@app.get("/api/tickets/{ticket_id}/trace")
def get_trace(ticket_id: str) -> dict:
    return store.trace(_ticket_or_404(ticket_id))


def _report_dirs() -> list:
    return list(dict.fromkeys([s.OUTPUT_DIR, store.data_dir]))


def _incident_or_404(incident_id: str) -> dict:
    incident = next((i for i in store.incidents() if i.get("incident_id") == incident_id), None)
    if not incident:
        raise HTTPException(404, f"incidente no encontrado: {incident_id}")
    return incident


@app.get("/api/incidents")
def list_incidents() -> dict:
    """Incidentes con x_has_report: si ya tienen informe de investigación para N2."""
    incidents = store.incidents()
    for inc in incidents:
        try:
            inc["x_has_report"] = reports.load(inc, _report_dirs()) is not None
        except reports.ReportError:
            inc["x_has_report"] = False
    return {"source": store.source, "incidents": incidents}


@app.get("/api/incidents/{incident_id}/report")
def get_report(incident_id: str) -> dict:
    """Informe de investigación (nivel 3) del incidente, o null si aún no se ha generado."""
    incident = _incident_or_404(incident_id)
    try:
        return {"report": reports.load(incident, _report_dirs()), "generating": reports.generating(incident_id)}
    except reports.ReportError as e:
        raise HTTPException(e.status, e.detail) from e


@app.post("/api/incidents/{incident_id}/report")
def create_report(incident_id: str, fresh: bool = False) -> dict:
    """Clic humano: la IA redacta el informe y el código lo valida (event_id existentes, aprobadores de la política).
    Solo propone: la contención la sigue aprobando una persona. Tarda lo que una llamada al LLM (≈1-2 min)."""
    incident = _incident_or_404(incident_id)
    try:
        return {"report": reports.generate(incident, s.OUTPUT_DIR, datastore.get(), fresh=fresh), "generating": False}
    except reports.ReportError as e:
        raise HTTPException(e.status, e.detail) from e


@app.get("/api/metrics")
def metrics() -> dict:
    return {"source": store.source, **compute_metrics(store.tickets(jobs.tickets())),
            "batch": store.batch_metrics()}


@app.get("/api/containment/log")
def containment_log() -> dict:
    try:
        return {"available": True, "log": containment.containment_log()}
    except containment.ContainmentError as e:
        return {"available": False, "error": e.detail, "log": []}


# --------------------------------------------------------------------------- decisiones humanas
class ContainmentRequest(BaseModel):
    action: str
    target: str
    approver: str = Field(min_length=MIN_APPROVER_LEN)
    justification: str = Field(min_length=MIN_JUSTIFICATION_LEN)


@app.post("/api/tickets/{ticket_id}/containment")
def run_containment(ticket_id: str, req: ContainmentRequest) -> dict:
    """Clic humano: la política decide si se puede y quién aprueba; luego /approvals + /containment/{accion}."""
    _ticket_or_404(ticket_id)
    base = {"ticket_id": ticket_id, "type": s.DECISION_CONTAINMENT, "action": req.action, "target": req.target,
            "approver": req.approver, "comment": req.justification}
    rule = policy.approval(req.action, req.target, datastore.get())
    base["approvers"] = rule["approvers"]
    try:
        if not rule["allowed"]:  # p. ej. OT: no se llama a la API, se escala
            raise containment.ContainmentError(HTTP_FORBIDDEN, rule["note"])
        res = containment.approve_and_contain(req.action, req.target, req.approver, req.justification,
                                              requires_approval=rule["requires_approval"], ticket_id=ticket_id)
    except containment.ContainmentError as e:
        store.record_decision({**base, "ok": False, "error": e.detail, "status": e.status})
        raise HTTPException(e.status, e.detail) from e
    decision = store.record_decision({**base, "ok": True,
                                      "approval_token": (res["approval"] or {}).get("approval_token"),
                                      "result": res["execution"].get("result")})
    return {**res, "decision": decision}


class StatusDecision(BaseModel):
    type: str = Field(pattern=DECISION_PATTERN)
    approver: str = Field(min_length=MIN_APPROVER_LEN)
    comment: str = ""
    verdict: str | None = Field(default=None, pattern=VERDICT_PATTERN)


@app.post("/api/tickets/{ticket_id}/decision")
def decide(ticket_id: str, req: StatusDecision) -> dict:
    """Cierre, escalado o reapertura manual (y opcionalmente corrección del veredicto)."""
    _ticket_or_404(ticket_id)
    return store.record_decision({"ticket_id": ticket_id, **req.model_dump()})


# --------------------------------------------------------------------------- chat del ticket (Gemini)
class ChatMessage(BaseModel):
    role: str = Field(pattern="^(" + "|".join(chat.ROLES) + ")$")
    text: str


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=s.CHAT_MAX_QUESTION_CHARS)
    history: list[ChatMessage] = []


@app.post("/api/tickets/{ticket_id}/chat")
def ticket_chat(ticket_id: str, req: ChatRequest) -> dict:
    """Pregunta en lenguaje natural sobre un ticket. Solo lectura: no cambia el ticket ni ejecuta acciones."""
    ticket = _ticket_or_404(ticket_id)
    try:
        return chat.ask(ticket, store.trace(ticket), req.question, [m.model_dump() for m in req.history])
    except chat.ChatError as e:
        raise HTTPException(e.status, e.detail) from e


# --------------------------------------------------------------------------- triaje en directo
class TriageRequest(BaseModel):
    alerts: list[dict] | None = None   # alertas completas (pegadas o subidas)
    ids: list[str] | None = None       # IDs del dataset
    random: int = Field(default=0, ge=0)  # simulacro: N al azar


@app.post("/api/triage")
def start_triage(req: TriageRequest) -> dict:
    alerts = [_with_alert_id(a) for a in req.alerts or []]
    ids = [i.strip() for i in req.ids or [] if i.strip()]
    total = len(alerts) + len(ids) + req.random
    if not total:
        raise HTTPException(400, "indica alerts, ids o random")
    if total > s.MAX_LIVE_ALERTS:
        raise HTTPException(400, f"máximo {s.MAX_LIVE_ALERTS} alertas por lanzamiento")
    try:
        job = jobs.start(alerts, ids, req.random)
    except RuntimeError as e:
        raise HTTPException(503, str(e)) from e
    return {"job_id": job["job_id"], "mode": job["mode"]}


def _with_alert_id(alert: dict) -> dict:
    # Una alerta nueva pegada a mano puede no traer ID; el pipeline y la UI necesitan uno para seguirla.
    return alert if alert.get("alert_id") else {**alert, "alert_id": f"ALR-LIVE-{uuid.uuid4().hex[:6].upper()}"}


@app.get("/api/triage/{job_id}")
def triage_status(job_id: str) -> dict:
    status = jobs.status(job_id)
    if not status:
        raise HTTPException(404, "job no encontrado")
    return status


# --------------------------------------------------------------------------- frontend compilado
if s.WEB_DIST.exists():
    app.mount("/assets", StaticFiles(directory=s.WEB_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> FileResponse:
        return FileResponse(s.WEB_DIST / "index.html")
