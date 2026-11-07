"""Cliente de la API del SOC de Tarvia (mock_soc_api de Deloitte) + DataStore híbrido (Persona A).

Deloitte pide leer las alertas de la API. Diseño:
  - ENTRADA de alertas: siempre de la API si está levantada (GET /alerts/{id}, GET /alerts?status=new).
  - ENRIQUECIMIENTO: primero el índice local en memoria (ms; la API recorre logs enteros en cada consulta) y, si
    algo no está en local (alerta nueva, evento, activo, usuario, intel o sandbox desconocidos), la API como
    respaldo. Cada llamada a la API queda en la traza del ticket como una herramienta más ("API SOC").
  - Si la API no responde, todo sigue funcionando en local y se avisa (la demo nunca se cuelga).

Solo lectura: la contención (POST /approvals, /containment) la hace el humano desde el dashboard, nunca esto.

    api = SocApi()                      # SOC_API_URL de .env
    store = HybridStore(get_store(), api)
"""

from __future__ import annotations

import json
import logging
import os
import random as _random
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from soc import config
from soc.data.store import EVENT_PREFIX, DataStore
from soc.timeutil import window

log = logging.getLogger(__name__)

TIMEOUT_S = float(os.getenv("SOC_API_TIMEOUT", "3"))
LOGS_TIMEOUT_S = float(os.getenv("SOC_API_LOGS_TIMEOUT", "15"))   # /logs recorre el fichero entero
MAX_FALLBACK_CALLS = int(os.getenv("SOC_API_MAX_CALLS", "25"))   # por alerta
ALERT_BUDGET_S = float(os.getenv("SOC_API_ALERT_BUDGET", "8"))   # segundos de API por alerta como máximo
MAX_LOG_LOOKUPS = int(os.getenv("SOC_API_MAX_LOG_LOOKUPS", "4"))  # /logs es lo caro: recorre el fichero
LOG_WINDOW_H = 24
HEALTH_TTL_S = 30
_HEALTH: dict[str, tuple[float, bool]] = {}  # por URL: una API caída no se re-comprueba en cada alerta


class SocApiError(RuntimeError):
    pass


class SocApi:
    """Cliente mínimo (urllib, sin dependencias). Devuelve None en 404."""

    def __init__(self, base_url: str | None = None) -> None:
        self.base = (base_url or config.SOC_API_URL).rstrip("/")

    def _get(self, path: str, params: dict | None = None, timeout: float = TIMEOUT_S) -> Any:
        q = {k: v for k, v in (params or {}).items() if v not in (None, "")}
        url = self.base + path + ("?" + urllib.parse.urlencode(q) if q else "")
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}),
                                        timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            raise SocApiError(f"GET {path}: HTTP {e.code}") from e
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as e:
            raise SocApiError(f"GET {path}: {e}") from e

    @staticmethod
    def _seg(v: str) -> str:
        return urllib.parse.quote(str(v), safe="")

    # ------------------------------------------------------------ salud
    def available(self) -> bool:
        t, ok = _HEALTH.get(self.base, (0.0, False))
        if time.time() - t < HEALTH_TTL_S:
            return ok
        try:
            ok = self._get("/alerts", {"limit": 1}, timeout=2) is not None
        except SocApiError:
            ok = False
        _HEALTH[self.base] = (time.time(), ok)
        return ok

    # ----------------------------------------------------------- alertas
    def alert(self, alert_id: str) -> dict | None:
        return self._get(f"/alerts/{self._seg(alert_id)}")

    def queue(self, status: str = "new", limit: int = 50, offset: int = 0, rule_id: str = "") -> dict:
        return self._get("/alerts", {"status": status, "limit": limit, "offset": offset, "rule_id": rule_id}) \
            or {"total": 0, "items": []}

    def random_alerts(self, n: int, status: str = "new", seed: int | None = None) -> list[dict]:
        total = int(self.queue(status, limit=1).get("total") or 0)
        rnd = _random.Random(seed)
        out = []
        for off in rnd.sample(range(total), min(n, total)):
            items = self.queue(status, limit=1, offset=off).get("items") or []
            out += items[:1]
        return out

    # ------------------------------------------------------ enriquecimiento
    def asset(self, key: str) -> dict | None:
        return self._get(f"/assets/{self._seg(key)}")

    def user(self, key: str) -> dict | None:
        return self._get(f"/users/{self._seg(key)}")

    def intel(self, indicator: str) -> dict | None:
        return self._get(f"/intel/{self._seg(indicator)}")

    def sandbox(self, sha256: str) -> dict | None:
        return self._get(f"/sandbox/{self._seg(sha256)}")

    def event(self, event_id: str, around: str | None = None) -> dict | None:
        """Busca un evento por id. Con `around` (ISO) se acota a ±24 h: la API se salta el resto del fichero sin
        serializarlo, que es lo que hace lenta la búsqueda de texto."""
        src = EVENT_PREFIX.get(str(event_id).split("-", 1)[0])
        if not src:
            return None
        params = {"q": event_id, "limit": 5}
        if around:
            try:
                st, en = window(around, LOG_WINDOW_H)
                params.update(desde=st, hasta=en)
            except (ValueError, TypeError):
                pass
        res = self._get(f"/logs/{src}", params, timeout=LOGS_TIMEOUT_S) or {}
        e = next((x for x in res.get("items") or [] if x.get("event_id") == event_id), None)
        return {**e, "_source": src} if e else None


class HybridStore:
    """DataStore local + API como respaldo. Misma interfaz que DataStore (delegación)."""

    def __init__(self, local: DataStore, api: SocApi | None) -> None:
        self.local = local
        self.api = api
        self._tl = threading.local()

    def __getattr__(self, name: str) -> Any:  # todo lo no redefinido va al DataStore local
        return getattr(self.local, name)

    # --------------------------------------------------------- traza de API
    def begin(self, alert_ts: str | None = None) -> None:
        """Empieza a registrar las llamadas a la API de una alerta (presupuesto de llamadas y de tiempo)."""
        self._tl.calls, self._tl.budget = [], MAX_FALLBACK_CALLS
        self._tl.deadline = time.perf_counter() + ALERT_BUDGET_S
        self._tl.logs_left = MAX_LOG_LOOKUPS
        self._tl.ts = alert_ts
        self._tl.exhausted = False

    def api_calls(self) -> list[dict]:
        return list(getattr(self._tl, "calls", []))

    def _fallback(self, kind: str, key: str, fn) -> Any:
        if not self.api or getattr(self._tl, "budget", MAX_FALLBACK_CALLS) <= 0 or not self.api.available():
            return None
        if kind == "logs":
            if getattr(self._tl, "logs_left", MAX_LOG_LOOKUPS) <= 0:
                return None
            self._tl.logs_left = getattr(self._tl, "logs_left", MAX_LOG_LOOKUPS) - 1
        if time.perf_counter() > getattr(self._tl, "deadline", float("inf")):
            calls = getattr(self._tl, "calls", None)
            if calls is not None and not getattr(self._tl, "exhausted", False):
                self._tl.exhausted = True
                calls.append({"step": "api_budget", "query": f"{ALERT_BUDGET_S:.0f} s", "ms": 0, "source": "API SOC",
                              "result": "presupuesto de tiempo de la API agotado: se sigue con lo que hay"})
            return None
        self._tl.budget = getattr(self._tl, "budget", MAX_FALLBACK_CALLS) - 1
        t0 = time.perf_counter()
        try:
            res = fn(key)
            result = "encontrado en la API" if res else "tampoco está en la API"
        except SocApiError as e:
            res, result = None, f"error de la API: {e}"
        calls = getattr(self._tl, "calls", None)
        if calls is not None:
            calls.append({"step": f"api_{kind}", "query": str(key)[:120], "result": result,
                          "ms": round((time.perf_counter() - t0) * 1000, 1), "source": "API SOC"})
        return res

    # ------------------------------------------------- consultas con respaldo
    def alert(self, alert_id: str) -> dict | None:
        return self.local.alert(alert_id) or self._fallback("alert", alert_id, self.api.alert if self.api else None)

    def event(self, event_id: str) -> dict | None:
        return self.local.event(event_id) or self._fallback(
            "logs", event_id, (lambda e: self.api.event(e, getattr(self._tl, "ts", None))) if self.api else None)

    def asset(self, key: str) -> dict | None:
        return self.local.asset(key) or self._fallback("cmdb", key, self.api.asset if self.api else None)

    def user(self, key: str) -> dict | None:
        return self.local.user(key) or self._fallback("directory", key, self.api.user if self.api else None)

    def sandbox(self, sha256: str) -> dict | None:
        return self.local.sandbox(sha256) or self._fallback("sandbox", sha256, self.api.sandbox if self.api else None)

    def intel(self, indicator: str) -> dict | None:
        r = self.local.intel(indicator)
        if r and (r.get("tip") or r.get("geo")):
            return r
        return self._fallback("intel", indicator, self.api.intel if self.api else None) or r


def get_api() -> SocApi | None:
    """API configurada (SOC_API_MODE: auto | api | local)."""
    mode = os.getenv("SOC_API_MODE", "auto").lower()
    return None if mode == "local" else SocApi()
