"""Lectura de los resultados del pipeline y superposición de las decisiones humanas.

El pipeline es el dueño de output/tickets.jsonl; el dashboard nunca lo reescribe. Lo que decide una persona va a
output/human_decisions.jsonl y se aplica encima al leer, así ambos procesos pueden escribir a la vez sin pisarse.
"""
from __future__ import annotations

import datetime as dt
import json
import threading
from pathlib import Path
from typing import Any, Callable, Iterable

from dashboard import settings as s
from soc.policy.closure import status_for

_write_lock = threading.Lock()


# --------------------------------------------------------------------------- JSONL
def read_jsonl(path: Path) -> list[dict]:
    """Lee un JSONL ignorando líneas vacías o a medio escribir (el pipeline puede estar escribiendo)."""
    if not path.exists():
        return []
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def append_jsonl(path: Path, row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with _write_lock, open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


# --------------------------------------------------------------------------- lógica pura (con tests)
def apply_decisions(tickets: list[dict], decisions: Iterable[dict]) -> list[dict]:
    """Devuelve copias de los tickets con las decisiones humanas aplicadas (decided_by = human)."""
    by_ticket: dict[str, list[dict]] = {}
    for d in decisions:
        by_ticket.setdefault(d.get("ticket_id", ""), []).append(d)
    return [_apply_ticket_decisions(dict(t), by_ticket.get(t.get("ticket_id", ""), [])) for t in tickets]


def _apply_ticket_decisions(ticket: dict, decisions: list[dict]) -> dict:
    ticket["x_human_decisions"] = decisions
    if not decisions:
        return ticket
    ticket["executed_actions"] = list(ticket.get("executed_actions") or [])
    ticket["x_decided_by"] = dict(ticket.get("x_decided_by") or {})
    status_by_human = False
    for d in decisions:
        if d.get("type") == s.DECISION_CONTAINMENT and d.get("ok"):
            ticket["executed_actions"].append(_executed_action(d))
            ticket["x_decided_by"]["actions"] = s.DECIDER_HUMAN
        elif d.get("type") in s.STATUS_BY_DECISION:
            ticket["x_status"] = s.STATUS_BY_DECISION[d["type"]]
            ticket["x_decided_by"]["status"] = s.DECIDER_HUMAN
            status_by_human = True
            if d.get("verdict"):
                ticket["verdict"] = d["verdict"]
                ticket["x_decided_by"]["verdict"] = s.DECIDER_HUMAN
    if not status_by_human and ticket.get("x_status") in s.RECOMPUTABLE_STATUSES and not ticket.get("x_no_ai"):
        # Tras ejecutar acciones, el estado lo vuelve a decidir la política (soc/policy/closure.py): p. ej. un
        # ataque bloqueado que el runbook manda cerrar se cierra cuando el N1 ya ha bloqueado el IOC.
        ticket["x_status"] = status_for(ticket)
    return ticket


def _executed_action(decision: dict) -> dict:
    return {"action": decision["action"], "target": decision["target"], "approved_by": decision["approver"],
            "approval_token": decision.get("approval_token"), "timestamp": decision["timestamp"],
            "result": decision.get("result")}


def compute_metrics(tickets: list[dict]) -> dict:
    n = len(tickets)
    decided_by = lambda t: (t.get("x_decided_by") or {}).get("verdict")  # noqa: E731
    auto_closed = sum(1 for t in tickets
                      if t.get("x_status") == s.STATUS_CLOSED and decided_by(t) == s.DECIDER_POLICY)
    llm = sum(1 for t in tickets if t.get("x_llm_provider"))
    escalated = sum(1 for t in tickets
                    if (t.get("escalation") or {}).get("escalate") or t.get("x_status") == s.STATUS_ESCALATED)
    awaiting = sum(1 for t in tickets if t.get("x_status") == s.STATUS_AWAITING)
    secs = [float(t["triage_seconds"]) for t in tickets if isinstance(t.get("triage_seconds"), (int, float))]
    manual_secs = n * s.MINUTES_PER_ALERT_MANUAL * 60
    return {
        "total": n,
        "auto_closed": auto_closed, "auto_closed_pct": percent(auto_closed, n),
        "llm": llm, "llm_pct": percent(llm, n),
        "escalated": escalated, "escalated_pct": percent(escalated, n),
        "awaiting_approval": awaiting,
        "avg_triage_seconds": round(sum(secs) / len(secs), 1) if secs else None,
        "time_saved_hours": round(max(0.0, manual_secs - sum(secs)) / 3600, 1),
        "manual_minutes_per_alert": s.MINUTES_PER_ALERT_MANUAL,
        "by_verdict": count_by(tickets, lambda t: t.get("verdict")),
        "by_severity": count_by(tickets, lambda t: t.get("severity")),
        "by_status": count_by(tickets, lambda t: t.get("x_status")),
        "by_decider": count_by(tickets, decided_by),
    }


def count_by(rows: Iterable[dict], key: Callable[[dict], Any]) -> dict[str, int]:
    out: dict[str, int] = {}
    for r in rows:
        k = str(key(r))
        out[k] = out.get(k, 0) + 1
    return out


def percent(part: int, total: int) -> float:
    return round(100 * part / total, 1) if total else 0.0


def resolve_inside(ref: str, bases: Iterable[Path], allowed: Iterable[Path]) -> Path | None:
    """Resuelve una ruta del ticket (x_trace_file) sin permitir salir de las carpetas permitidas."""
    allowed = [a.resolve() for a in allowed]
    for base in bases:
        for candidate in (base / ref, base / s.TRACES_DIR / Path(ref).name):
            c = candidate.resolve()
            if any(c.is_relative_to(a) for a in allowed) and c.is_file():
                return c
    return None


# --------------------------------------------------------------------------- acceso a disco
class ResultsStore:
    """Resultados del pipeline en disco; si aún no hay, los ejemplos de dashboard/sample/."""

    def __init__(self, output_dir: Path = s.OUTPUT_DIR, sample_dir: Path = s.SAMPLE_DIR,
                 decisions_file: Path = s.DECISIONS_FILE):
        self.output_dir = output_dir
        self.sample_dir = sample_dir
        self.decisions_file = decisions_file

    @property
    def uses_sample(self) -> bool:
        return not (self.output_dir / s.TICKETS_FILE).exists()

    @property
    def source(self) -> str:
        return "sample" if self.uses_sample else "pipeline"

    @property
    def data_dir(self) -> Path:
        return self.sample_dir if self.uses_sample else self.output_dir

    def tickets(self, extra: Iterable[dict] = ()) -> list[dict]:
        """Tickets del disco + `extra` (los del triaje en vivo), con las decisiones humanas aplicadas."""
        merged = {t["ticket_id"]: t for t in read_jsonl(self.data_dir / s.TICKETS_FILE) if "ticket_id" in t}
        merged.update({t["ticket_id"]: t for t in extra})
        return apply_decisions(list(merged.values()), read_jsonl(self.decisions_file))

    def ticket(self, ticket_id: str, extra: Iterable[dict] = ()) -> dict | None:
        return next((t for t in self.tickets(extra) if t["ticket_id"] == ticket_id), None)

    def incidents(self) -> list[dict]:
        return read_jsonl(self.data_dir / s.INCIDENTS_FILE)

    def batch_metrics(self) -> dict | None:
        path = self.output_dir / s.BATCH_METRICS_FILE
        try:
            return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
        except json.JSONDecodeError:
            return None

    def trace(self, ticket: dict) -> dict:
        """Context (docs/04) o al menos {"trace": [...]} del ticket."""
        if ticket.get("x_live_trace") is not None:
            return {"trace": ticket["x_live_trace"]}
        ref = ticket.get("x_trace_file")
        path = ref and resolve_inside(ref, [s.ROOT, self.data_dir], [self.output_dir, self.sample_dir])
        if not path:
            return {"trace": [], "missing": True}
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {"trace": data}

    def record_decision(self, decision: dict) -> dict:
        row = {**decision, "timestamp": utc_now()}
        append_jsonl(self.decisions_file, row)
        return row
