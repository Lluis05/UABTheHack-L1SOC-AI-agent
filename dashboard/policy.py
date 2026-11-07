"""Puente entre el dashboard y la política de contención de Persona A (soc/policy/approvals.py).

Quién aprueba cada acción lo decide SIEMPRE approval_for(); el dashboard no repite esas reglas. Para saber si un
objetivo es OT, un servidor o un TPV hace falta la CMDB, así que el DataStore se carga una vez, en segundo plano,
al arrancar el backend (el mismo singleton que usará el pipeline en modo en vivo).
"""
from __future__ import annotations

import logging
import threading
from typing import Callable

from soc.policy.approvals import API_ACTIONS, approval_for
from soc.policy.closure import closes_after_actions

log = logging.getLogger(__name__)

STORE_LOADING, STORE_READY, STORE_UNAVAILABLE = "loading", "ready", "unavailable"


class StoreHolder:
    """Carga el DataStore en un hilo para que el dashboard arranque al momento."""

    def __init__(self, loader: Callable[[], object]):
        self._loader = loader
        self._store = None
        self.status = STORE_LOADING
        self.error = ""

    def start(self) -> "StoreHolder":
        threading.Thread(target=self._load, daemon=True).start()
        return self

    def _load(self) -> None:
        try:
            self._store = self._loader()
            self.status = STORE_READY
        except Exception as e:  # sin dataset el dashboard sigue funcionando; la API simulada también valida
            self.status, self.error = STORE_UNAVAILABLE, f"{type(e).__name__}: {e}"
            log.warning("DataStore no disponible: %s", self.error)

    def get(self):
        return self._store


def approval(action: str, target: str, store) -> dict:
    """Decisión de la política para una acción concreta (con o sin CMDB cargada)."""
    return approval_for(action, target, store)


def annotate_ticket(ticket: dict, store) -> dict:
    """Copia del ticket con lo que decide la política para la UI:
    x_approval en cada acción (allowed, requires_approval, approvers, note) y x_pending_close (solo le faltan
    las acciones de la API para cerrarse)."""
    actions = [{**a, "x_approval": approval(a.get("action", ""), a.get("target", ""), store)}
               for a in ticket.get("recommended_actions") or []]
    return {**ticket, "recommended_actions": actions, "x_pending_close": closes_after_actions(ticket)}


def is_api_action(action: str) -> bool:
    return action in API_ACTIONS
