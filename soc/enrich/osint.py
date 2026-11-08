"""OSINT: reputación externa de los indicadores de una alerta (solo consultas de reputación).

Fuentes (las mismas de las que Deloitte sacó los indicadores reales del dataset):
  - Listas públicas, sin API key, descargadas UNA vez y consultadas en memoria (instantáneo):
      · tor_exit      lista oficial de nodos de salida de Tor (IPs)
      · ipsum         IPsum, IPs con mala reputación en varias listas negras (IPs)
      · c2intel_ip    C2IntelFeeds, IPs de C2 de los últimos 30 días
      · c2intel_dom   C2IntelFeeds, dominios de C2 de los últimos 30 días
  - ThreatFox (abuse.ch), en directo y solo si hay ABUSECH_AUTH_KEY: IPs, dominios y hashes.

Reglas (CLAUDE.md): NUNCA se visita, descarga ni escanea un indicador. Solo se descargan las listas de
reputación y se pregunta a ThreatFox por el valor. No se consultan IPs internas, rangos de documentación ni
dominios .example/.local/Tarvia (no tiene sentido y filtraría datos internos).

Robustez (defensa en directo): timeout corto, caché en disco y nunca lanza excepciones. Si una fuente falla,
el resultado lo dice ("OSINT no disponible") y el triaje sigue. La severidad NO depende del OSINT: es un
dato más para el LLM y para el analista.

Configuración (.env): OSINT_ENABLED=1, ABUSECH_AUTH_KEY, OSINT_TIMEOUT, OSINT_MAX_PER_ALERT, OSINT_FEED_MAX_AGE_H.
"""

from __future__ import annotations

import hashlib
import ipaddress
import json
import logging
import os
import threading
import time
import urllib.request
from pathlib import Path
from typing import Any, Callable

from soc import config

log = logging.getLogger(__name__)

ENV_ENABLED = "OSINT_ENABLED"
ENV_ABUSECH_KEY = "ABUSECH_AUTH_KEY"
DEFAULT_TIMEOUT_S = 3.0          # por consulta en directo (ThreatFox)
FEED_TIMEOUT_S = 15.0            # descarga de cada lista (una vez al día)
DEFAULT_MAX_PER_ALERT = 3        # presupuesto de indicadores externos por alerta
DEFAULT_FEED_MAX_AGE_H = 24.0
USER_AGENT = "tarvia-l1-soc-agent/1.0"
THREATFOX_URL = "https://threatfox-api.abuse.ch/api/v1/"

# nombre → (url, tipo de indicador)
FEEDS: dict[str, tuple[str, str]] = {
    "tor_exit": ("https://check.torproject.org/torbulkexitlist", "ip"),
    "ipsum": ("https://raw.githubusercontent.com/stamparm/ipsum/master/ipsum.txt", "ip"),
    "c2intel_ip": ("https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/IPC2s-30day.csv", "ip"),
    "c2intel_dom": ("https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/domainC2s-30day.csv",
                    "domain"),
}
FEED_LABELS = {"tor_exit": "Tor: nodo de salida", "ipsum": "IPsum: en {n} listas negras",
               "c2intel_ip": "C2IntelFeeds: {n}", "c2intel_dom": "C2IntelFeeds: {n}"}

# Rangos que NUNCA salen a Internet: red de Tarvia, privados y rangos de documentación del dataset
_NON_ROUTABLE = [ipaddress.ip_network(n) for n in (
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8", "169.254.0.0/16",
    "192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24", "198.18.0.0/15")]
_SKIP_DOMAIN_SUFFIXES = (".example", ".local", ".internal", ".lan", ".test", ".invalid", ".localhost")
_SKIP_DOMAIN_WORDS = ("tarvia",)
_QUERYABLE_TYPES = ("ip", "domain", "sha256")
SHA256_LEN = 64


def enabled() -> bool:
    return os.getenv(ENV_ENABLED, "0").strip().lower() in ("1", "true", "yes", "on")


def _cache_dir() -> Path:
    return config.OUTPUT_DIR / "osint"


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.getenv(name) or default)
    except ValueError:
        return default


def max_per_alert() -> int:
    return int(_float_env("OSINT_MAX_PER_ALERT", DEFAULT_MAX_PER_ALERT))


def is_queryable(indicator: str, typ: str) -> bool:
    """¿Tiene sentido (y es seguro) preguntar fuera por este indicador?"""
    v = (indicator or "").strip().lower()
    if not v or typ not in _QUERYABLE_TYPES:
        return False
    if typ == "ip":
        try:
            ip = ipaddress.ip_address(v)
        except ValueError:
            return False
        return ip.version == 4 and not any(ip in n for n in _NON_ROUTABLE)
    if typ == "domain":
        return "." in v and not v.endswith(_SKIP_DOMAIN_SUFFIXES) and not any(w in v for w in _SKIP_DOMAIN_WORDS)
    # hashes: ninguna lista pública los cubre, solo ThreatFox (con API key)
    return len(v) == SHA256_LEN and all(c in "0123456789abcdef" for c in v) and ThreatFox.available()


# ---------------------------------------------------------------- listas públicas

def parse_feed(name: str, text: str) -> dict[str, str]:
    """Texto de una lista → {indicador: detalle}. Ignora comentarios y líneas raras."""
    out: dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if name == "ipsum":                       # "1.2.3.4\t7"  (nº de listas negras)
            parts = line.split()
            if len(parts) >= 2:
                out[parts[0]] = parts[1]
        elif name.startswith("c2intel"):          # "1.2.3.4,Possible Cobalt Strike C2 IP"
            ind, _, detail = line.partition(",")
            out[ind.strip().lower()] = detail.strip()
        else:                                     # una IP por línea
            out[line.split()[0]] = ""
    return out


def _download(url: str, timeout: float) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


class Feeds:
    """Listas en memoria. Se cargan una vez (disco si es reciente; si no, descarga). Thread-safe."""

    def __init__(self, downloader: Callable[[str, float], str] = _download) -> None:
        self._download = downloader
        self._lock = threading.Lock()
        self.data: dict[str, dict[str, str]] | None = None
        self.errors: dict[str, str] = {}
        self.load_seconds = 0.0

    def ensure(self) -> dict[str, dict[str, str]]:
        if self.data is not None:
            return self.data
        with self._lock:
            if self.data is None:
                t0 = time.perf_counter()
                self.data = {name: self._load(name, url) for name, (url, _) in FEEDS.items()}
                self.load_seconds = time.perf_counter() - t0
        return self.data

    def _load(self, name: str, url: str) -> dict[str, str]:
        path = _cache_dir() / "feeds" / f"{name}.txt"
        max_age_s = _float_env("OSINT_FEED_MAX_AGE_H", DEFAULT_FEED_MAX_AGE_H) * 3600
        fresh = path.exists() and time.time() - path.stat().st_mtime < max_age_s
        if not fresh:
            try:
                text = self._download(url, FEED_TIMEOUT_S)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text, encoding="utf-8")
            except Exception as e:  # noqa: BLE001 - una lista caída no puede romper el triaje
                self.errors[name] = f"{type(e).__name__}: {e}"
                log.warning("OSINT: no se pudo descargar %s (%s)", name, e)
        if not path.exists():
            return {}
        return parse_feed(name, path.read_text(encoding="utf-8", errors="replace"))

    def lookup(self, indicator: str, typ: str) -> list[dict]:
        hits = []
        for name, entries in self.ensure().items():
            if FEEDS[name][1] != typ:
                continue
            key = indicator.lower() if typ == "domain" else indicator
            if key in entries:
                hits.append({"source": name, "result": FEED_LABELS[name].format(n=entries[key] or "C2")})
        return hits


# ---------------------------------------------------------------- ThreatFox (en directo)

def _threatfox_post(payload: dict, key: str, timeout: float) -> dict:
    req = urllib.request.Request(THREATFOX_URL, data=json.dumps(payload).encode(), method="POST",
                                 headers={"Auth-Key": key, "Content-Type": "application/json",
                                          "User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def summarize_threatfox(resp: dict) -> str | None:
    """Respuesta de ThreatFox → una línea, o None si no lo conoce."""
    if resp.get("query_status") != "ok" or not isinstance(resp.get("data"), list) or not resp["data"]:
        return None
    d = resp["data"][0]
    fam = d.get("malware_printable") or d.get("malware") or "malware"
    return f"ThreatFox: {d.get('threat_type') or 'ioc'} de {fam} (confianza {d.get('confidence_level', '?')}%)"


class ThreatFox:
    """Consulta por indicador con caché en disco (cada valor se pregunta una sola vez)."""

    def __init__(self, post: Callable[[dict, str, float], dict] = _threatfox_post) -> None:
        self._post = post

    @staticmethod
    def available() -> bool:
        return bool(os.getenv(ENV_ABUSECH_KEY, "").strip())

    def lookup(self, indicator: str, typ: str, use_cache: bool = True) -> dict:
        """→ {"result": str|None, "cached": bool, "error": str|None}"""
        path = _cache_dir() / "threatfox" / (hashlib.sha256(indicator.lower().encode()).hexdigest()[:32] + ".json")
        if use_cache and path.exists():
            try:
                return {**json.loads(path.read_text(encoding="utf-8")), "cached": True, "error": None}
            except (OSError, ValueError):
                pass
        payload = ({"query": "search_hash", "hash": indicator} if typ == "sha256"
                   else {"query": "search_ioc", "search_term": indicator, "exact_match": True})
        try:
            resp = self._post(payload, os.getenv(ENV_ABUSECH_KEY, "").strip(),
                              _float_env("OSINT_TIMEOUT", DEFAULT_TIMEOUT_S))
        except Exception as e:  # noqa: BLE001 - timeout, sin red, 401… → el triaje sigue
            return {"result": None, "cached": False, "error": f"{type(e).__name__}: {e}"}
        out = {"result": summarize_threatfox(resp)}
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass
        return {**out, "cached": False, "error": None}


# ---------------------------------------------------------------- API pública

_feeds = Feeds()
_threatfox = ThreatFox()


def lookup(indicator: str, typ: str, *, feeds: Feeds | None = None, threatfox: ThreatFox | None = None,
           use_cache: bool = True) -> dict[str, Any]:
    """Reputación externa de un indicador. Nunca lanza.

    → {"indicator", "type", "verdict", "hits": [{"source", "result"}], "sources_checked": [consultadas],
       "errors": [...]}
    hits vacío = ninguna fuente lo conoce (desconocido ≠ limpio). "verdict" lo dice en una frase porque el LLM
    leía la lista de fuentes consultadas como si fueran coincidencias.
    """
    feeds, threatfox = feeds or _feeds, threatfox or _threatfox
    out: dict[str, Any] = {"indicator": indicator, "type": typ, "verdict": "", "hits": [], "sources_checked": [], "errors": []}
    try:
        out["hits"] += feeds.lookup(indicator, typ)
        out["sources_checked"] += [n for n, (_, t) in FEEDS.items() if t == typ]
        out["errors"] += [f"{n}: {e}" for n, e in feeds.errors.items() if FEEDS[n][1] == typ]
    except Exception as e:  # noqa: BLE001
        out["errors"].append(f"listas: {e}")
    if threatfox.available():
        r = threatfox.lookup(indicator, typ, use_cache=use_cache)
        out["sources_checked"].append("threatfox")
        if r.get("result"):
            out["hits"].append({"source": "threatfox", "result": r["result"]})
        if r.get("error"):
            out["errors"].append(f"threatfox: {r['error']}")
    out["verdict"] = describe(out)
    return out


def describe(res: dict) -> str:
    """Una línea para la traza del dashboard."""
    if res["hits"]:
        return " · ".join(h["result"] for h in res["hits"])
    if res["errors"] and len(res["errors"]) >= len(res["sources_checked"]):
        return "OSINT no disponible: " + "; ".join(res["errors"])
    base = (f"0 coincidencias: ninguna de las {len(res['sources_checked'])} fuentes consultadas lo conoce "
            "(desconocido ≠ limpio)")
    return base + (" · con errores: " + "; ".join(res["errors"]) if res["errors"] else "")
