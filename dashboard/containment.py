"""Cliente de la API simulada de Tarvia (06_herramientas/mock_soc_api.py).

Solo lo usa el dashboard, y siempre a partir de un clic humano. El LLM nunca tiene acceso a este módulo.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

from dashboard.settings import SOC_API_TIMEOUT_S, SOC_API_URL

# Igual que en la API: N1 ejecuta estas dos sin aprobación (docs/03, tabla de contención).
# Es la fuente de verdad también para el frontend (se sirve en /api/config).
NO_APPROVAL_ACTIONS = frozenset({"block_ioc", "purge_email"})
API_ACTIONS = frozenset({"isolate_host", "disable_user", "revoke_sessions", "reset_password",
                         "block_ioc", "purge_email", "disable_access_key"})

HTTP_BAD_REQUEST = 400
HTTP_UNAVAILABLE = 503


class ContainmentError(Exception):
    """Error devuelto por la API (403 sin aprobación, 403 OT, 400 acción no válida...) o API caída."""

    def __init__(self, status: int, detail: str):
        super().__init__(f"{status}: {detail}")
        self.status = status
        self.detail = detail


def _request(method: str, path: str, body: dict | None = None) -> dict | list:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(SOC_API_URL + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=SOC_API_TIMEOUT_S) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise ContainmentError(e.code, _error_detail(e)) from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise ContainmentError(HTTP_UNAVAILABLE, f"API simulada no disponible en {SOC_API_URL}: {e}") from e


def _error_detail(e: urllib.error.HTTPError) -> str:
    try:
        return json.loads(e.read().decode("utf-8")).get("detail", str(e))
    except (ValueError, AttributeError):
        return str(e)


def requires_approval(action: str) -> bool:
    return action not in NO_APPROVAL_ACTIONS


def health() -> bool:
    """True si la API simulada responde."""
    try:
        containment_log()
        return True
    except ContainmentError:
        return False


def approve(action: str, target: str, approver: str, reason: str = "") -> dict:
    """POST /approvals → {"approval_token": "APR-...", ...}."""
    return _request("POST", "/approvals",
                    {"action": action, "target": target, "approver": approver, "reason": reason})


def contain(action: str, target: str, justification: str, approval_token: str = "",
            ticket_id: str = "") -> dict:
    """POST /containment/{action}. La API valida que el token corresponda a la acción y el objetivo."""
    if action not in API_ACTIONS:
        raise ContainmentError(HTTP_BAD_REQUEST, f"acción no soportada por la API: {action}")
    return _request("POST", f"/containment/{action}",
                    {"target": target, "justification": justification,
                     "approval_token": approval_token, "ticket_id": ticket_id})


def approve_and_contain(action: str, target: str, approver: str, justification: str,
                        ticket_id: str = "") -> dict:
    """Un clic humano: aprobación (si la acción la necesita) y ejecución.

    Devuelve {"approval": {...}|None, "execution": {...}}.
    """
    approval = approve(action, target, approver, justification) if requires_approval(action) else None
    token = approval["approval_token"] if approval else ""
    execution = contain(action, target, justification, token, ticket_id)
    return {"approval": approval, "execution": execution}


def containment_log() -> list[dict]:
    """GET /containment/log: todo lo ejecutado en la API simulada."""
    return _request("GET", "/containment/log")  # type: ignore[return-value]
