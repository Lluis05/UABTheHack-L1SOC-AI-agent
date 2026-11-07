"""Triaje en directo (modo defensa): lanza el pipeline sobre alertas nuevas y expone su progreso.

Motores, por orden de preferencia (ver docs/04, "Dashboard ↔ pipeline"):
  - inprocess: soc.pipeline.triage_live(...) en este proceso, con el DataStore caliente y progreso paso a paso.
  - subprocess: la CLI documentada `python -m soc.pipeline --live`; sin progreso fino.
  - simulated: DASHBOARD_SIMULATE=1, tickets falsos marcados como tales, solo para desarrollar la UI.
"""
from __future__ import annotations

import importlib
import json
import random
import subprocess
import sys
import threading
import time
import uuid
from typing import Callable

from dashboard import settings as s
from dashboard.results import read_jsonl

OnStep = Callable[[str, str, dict], None]
JOB_RUNNING, JOB_DONE, JOB_ERROR = "running", "done", "error"


def detect_mode() -> str:
    if s.SIMULATE:
        return s.LIVE_MODE_SIMULATED
    try:
        pipeline = importlib.import_module("soc.pipeline")
    except ImportError:
        return s.LIVE_MODE_NONE
    return s.LIVE_MODE_INPROCESS if hasattr(pipeline, "triage_live") else s.LIVE_MODE_SUBPROCESS


def new_alert_state(alert_id: str, label: str | None = None) -> dict:
    return {"alert_id": alert_id, "label": label, "step": s.STEP_QUEUED, "trace": [], "ticket_id": None,
            "error": None, "started_at": None, "finished_at": None}


def apply_step(job: dict, alert_id: str, step: str, data: dict) -> None:
    """Actualiza el estado del job con un evento del pipeline. data: trace_entry?, ticket?, error?, message?"""
    st = job["alerts"].setdefault(alert_id, new_alert_state(alert_id))
    st["started_at"] = st["started_at"] or time.time()
    if step in s.LIVE_STEPS or step == s.STEP_ERROR:
        st["step"] = step
    if data.get("trace_entry"):
        st["trace"].append(data["trace_entry"])
    if data.get("message"):
        job["log"].append(f"[{alert_id}] {data['message']}")
    if data.get("error"):
        st.update(error=str(data["error"]), step=s.STEP_ERROR, finished_at=time.time())
    if data.get("ticket"):
        ticket = {**data["ticket"], "x_live_trace": st["trace"]}
        job["tickets"].append(ticket)
        st.update(ticket_id=ticket.get("ticket_id"), step=s.STEP_TICKET, finished_at=time.time())


class JobManager:
    """Jobs de triaje en memoria. Cada lanzamiento corre en un hilo para no bloquear la API."""

    def __init__(self) -> None:
        self.jobs: dict[str, dict] = {}

    def tickets(self) -> list[dict]:
        return [t for job in list(self.jobs.values()) for t in job["tickets"]]

    def start(self, alerts: list[dict], ids: list[str], n_random: int) -> dict:
        mode = detect_mode()
        if mode == s.LIVE_MODE_NONE:
            raise RuntimeError("soc.pipeline todavía no existe. Para probar la UI: DASHBOARD_SIMULATE=1")
        job = {"job_id": "JOB-" + uuid.uuid4().hex[:8], "mode": mode, "status": JOB_RUNNING,
               "started_at": time.time(), "finished_at": None, "alerts": {}, "log": [], "tickets": [],
               "error": None, "target_seconds": s.LIVE_TARGET_SECONDS}
        for a in alerts:
            job["alerts"][a["alert_id"]] = new_alert_state(a["alert_id"], a.get("rule_name") or a.get("rule_id"))
        for i in ids:
            job["alerts"][i] = new_alert_state(i)
        self.jobs[job["job_id"]] = job
        runner = RUNNERS[mode]
        threading.Thread(target=self._run, args=(runner, job, alerts, ids, n_random), daemon=True).start()
        return job

    @staticmethod
    def _run(runner: Callable, job: dict, *args) -> None:
        on_step: OnStep = lambda aid, step, data=None: apply_step(job, aid, step, data or {})  # noqa: E731
        try:
            runner(job, on_step, *args)
            job["status"] = JOB_DONE
        except Exception as e:  # la demo nunca se queda colgada: el error se ve en la UI
            job.update(status=JOB_ERROR, error=f"{type(e).__name__}: {e}")
        finally:
            job["finished_at"] = time.time()

    def status(self, job_id: str) -> dict | None:
        job = self.jobs.get(job_id)
        if not job:
            return None
        end = job["finished_at"] or time.time()
        return {**{k: v for k, v in job.items() if k != "tickets"},
                "elapsed": round(end - job["started_at"], 1),
                "tickets": [t.get("ticket_id") for t in job["tickets"]],
                "log": job["log"][-s.LIVE_LOG_TAIL:]}


# --------------------------------------------------------------------------- motores
def run_inprocess(job: dict, on_step: OnStep, alerts: list[dict], ids: list[str], n_random: int) -> None:
    pipeline = importlib.import_module("soc.pipeline")
    pipeline.triage_live(alerts=alerts or None, ids=ids or None, random=n_random, on_step=on_step)


def run_subprocess(job: dict, on_step: OnStep, alerts: list[dict], ids: list[str], n_random: int) -> None:
    tickets_file = s.OUTPUT_DIR / s.TICKETS_FILE
    already = len(read_jsonl(tickets_file))
    cmd = [sys.executable, "-m", "soc.pipeline", "--live", *_cli_args(job["job_id"], alerts, ids, n_random)]
    for aid in job["alerts"]:
        on_step(aid, s.LIVE_STEPS[0], {})
    proc = subprocess.Popen(cmd, cwd=s.ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, encoding="utf-8", errors="replace")
    for line in proc.stdout:  # type: ignore[union-attr]
        job["log"].append(line.rstrip())
    proc.wait()
    for ticket in read_jsonl(tickets_file)[already:]:
        for aid in ticket.get("alert_ids", []):
            on_step(aid, s.STEP_TICKET, {"ticket": ticket})
    if proc.returncode != 0:
        raise RuntimeError(f"soc.pipeline terminó con código {proc.returncode}")


def _cli_args(job_id: str, alerts: list[dict], ids: list[str], n_random: int) -> list[str]:
    args: list[str] = []
    if alerts:
        path = s.LIVE_INPUT_DIR / f"{job_id}.jsonl"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("\n".join(json.dumps(a, ensure_ascii=False) for a in alerts), encoding="utf-8")
        args += ["--file", str(path)]
    if ids:
        args += ["--ids", ",".join(ids)]
    if n_random:
        args += ["--random", str(n_random)]
    return args


SIMULATED_TRACE = [
    ("context", "asset_lookup", "host", "found"),
    ("context", "user_lookup", "upn", "found"),
    ("context", "logs_search", "±24h", "37 eventos"),
    ("policy", "change_calendar", "CHG-*", "sin cambio aprobado"),
    ("policy", "severity_matrix", "medium × Alta", "medium"),
    ("llm", "llm_triage", "simulado", "needs_more_info"),
    ("reviewer", "reviewer", "evidencias citadas", "ok"),
]
SIMULATED_STEP_DELAY_S = (0.3, 1.2)
SIMULATED_LLM_DELAY_S = (2.0, 5.0)


def run_simulated(job: dict, on_step: OnStep, alerts: list[dict], ids: list[str], n_random: int) -> None:
    labels = {a["alert_id"]: a.get("rule_name") or a.get("rule_id") or "alerta" for a in alerts}
    all_ids = [*labels, *ids, *(f"ALR-RAND-{i:02d}" for i in range(n_random))]

    def one(aid: str) -> None:
        for step, name, query, result in SIMULATED_TRACE:
            on_step(aid, step, {"trace_entry": {"step": name, "query": query, "result": result, "ms": 0}})
            time.sleep(random.uniform(*(SIMULATED_LLM_DELAY_S if step == "llm" else SIMULATED_STEP_DELAY_S)))
        on_step(aid, s.STEP_TICKET, {"ticket": simulated_ticket(aid, labels.get(aid, "alerta"))})

    threads = [threading.Thread(target=one, args=(aid,)) for aid in all_ids]
    for t in threads:
        t.start()
    for t in threads:
        t.join()


def simulated_ticket(alert_id: str, label: str) -> dict:
    return {
        "ticket_id": f"TKT-SIM-{alert_id}", "alert_ids": [alert_id], "title": f"[SIMULADO] {label}",
        "verdict": "needs_more_info", "confidence": 0.0, "severity": "medium",
        "severity_rationale": "[SIMULADO] sin pipeline real",
        "affected": {"users": [], "hosts": [], "business_services": [], "customers": []},
        "summary": "Ticket generado por el simulador del dashboard. No es un triaje real.",
        "evidence": [], "enrichment": [], "mitre": [], "recommended_actions": [], "executed_actions": [],
        "escalation": {"escalate": False, "to": None, "reason": ""}, "open_questions": [], "triage_seconds": None,
        "x_decided_by": {"verdict": s.DECIDER_SIMULATED, "severity": s.DECIDER_SIMULATED},
        "x_llm_provider": None, "x_policy_hits": [], "x_incident_id": None, "x_trace_file": None,
        "x_status": s.STATUS_TRIAGED, "x_simulated": True,
    }


RUNNERS = {s.LIVE_MODE_INPROCESS: run_inprocess, s.LIVE_MODE_SUBPROCESS: run_subprocess,
           s.LIVE_MODE_SIMULATED: run_simulated}
