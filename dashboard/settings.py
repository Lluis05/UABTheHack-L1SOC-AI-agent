"""Constantes del dashboard. Rutas y URLs salen de soc/config.py (fuente única de configuración del proyecto)."""
from __future__ import annotations

import os

from soc import config

ROOT = config.REPO_ROOT
OUTPUT_DIR = config.OUTPUT_DIR
SAMPLE_DIR = (ROOT / "dashboard" / "sample").resolve()
WEB_DIST = (ROOT / "dashboard" / "web" / "dist").resolve()

TICKETS_FILE = "tickets.jsonl"
INCIDENTS_FILE = "incidents.jsonl"
BATCH_METRICS_FILE = "metrics.json"
DECISIONS_FILE = OUTPUT_DIR / "human_decisions.jsonl"
LIVE_INPUT_DIR = OUTPUT_DIR / "live_input"
TRACES_DIR = "traces"

SOC_API_URL = config.SOC_API_URL.rstrip("/")
SOC_API_TIMEOUT_S = 10

# Solo para desarrollar la UI sin pipeline: los tickets salen marcados como simulados.
SIMULATE = os.getenv("DASHBOARD_SIMULATE", "0") == "1"

MINUTES_PER_ALERT_MANUAL = 15  # referencia del reto: ~15 min por alerta hecha a mano
LIVE_TARGET_SECONDS = 120      # objetivo de la defensa: 10 alertas en menos de 2 min
MAX_LIVE_ALERTS = 50
LIVE_LOG_TAIL = 200

# Valores del contrato Ticket (docs/04)
STATUS_TRIAGED = "triaged"
STATUS_AWAITING = "awaiting_approval"
STATUS_CLOSED = "closed"
STATUS_ESCALATED = "escalated"
DECIDER_POLICY = "policy"
DECIDER_HUMAN = "human"
DECIDER_SIMULATED = "simulated"

# Decisiones humanas sobre el estado y a qué x_status llevan
DECISION_CONTAINMENT = "containment"
STATUS_BY_DECISION = {"close": STATUS_CLOSED, "escalate": STATUS_ESCALATED, "reopen": STATUS_TRIAGED}
# Estados que la política recalcula al ejecutar acciones (no pending_ai ni lo que ya decidió una persona)
RECOMPUTABLE_STATUSES = (STATUS_TRIAGED, STATUS_AWAITING)
VERDICTS = ("true_positive", "benign_true_positive", "false_positive", "needs_more_info")

# Pasos del triaje en vivo (docs/04, "Modo defensa en directo")
STEP_QUEUED = "queued"
STEP_TICKET = "ticket"
STEP_ERROR = "error"
LIVE_STEPS = ("context", "policy", "llm", "reviewer", STEP_TICKET)

LIVE_MODE_INPROCESS = "inprocess"
LIVE_MODE_SUBPROCESS = "subprocess"
LIVE_MODE_SIMULATED = "simulated"
LIVE_MODE_NONE = "none"
