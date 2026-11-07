"""DataStore: carga el dataset de Tarvia una sola vez y lo deja indexado en memoria.

Contrato en docs/04_arquitectura.md. Todo lo que devuelve son dicts JSON-serializables.

Uso:
    from soc.data.store import get_store
    store = get_store()                     # singleton; la 1ª vez carga (o lee la caché pickle)
    store.event("EDR-0005329"); store.asset("WS-BCN-1174"); store.user("alejandro.ruiz")

Caché: tras la primera carga se guarda un pickle en output/cache/. Se invalida sola si cambia
algún fichero del dataset (tamaño o fecha de modificación) o la versión del formato (CACHE_VERSION).
"""

from __future__ import annotations

import csv
import json
import logging
import pickle
import threading
import time
from pathlib import Path
from typing import Any

from soc import config

log = logging.getLogger(__name__)

CACHE_VERSION = 1

# Fuente -> fichero dentro de 04_logs/
LOG_FILES: dict[str, str] = {
    "ad_events": "ad_events.jsonl",
    "ai_gateway": "ai_gateway.jsonl",
    "cicd_builds": "cicd_builds.jsonl",
    "cloudtrail": "cloudtrail.jsonl",
    "dlp": "dlp.jsonl",
    "dns": "dns.csv",
    "ecom_account": "ecom_account.jsonl",
    "ecom_auth": "ecom_auth.jsonl",
    "edr_events": "edr_events.jsonl",
    "email": "email.jsonl",
    "email_clicks": "email_clicks.jsonl",
    "firewall": "firewall.csv",
    "idp_audit": "idp_audit.jsonl",
    "idp_signins": "idp_signins.jsonl",
    "proxy": "proxy.csv",
    "sql_audit": "sql_audit.jsonl",
    "vpn": "vpn.jsonl",
    "waf": "waf.jsonl",
}

# Prefijo de event_id -> fuente (ver docs/02_dataset.md)
EVENT_PREFIX: dict[str, str] = {
    "ADE": "ad_events", "AIG": "ai_gateway", "CI": "cicd_builds", "CT": "cloudtrail", "DLP": "dlp",
    "DNS": "dns", "ECO": "ecom_account", "ECA": "ecom_auth", "EDR": "edr_events", "EML": "email",
    "CLK": "email_clicks", "FW": "firewall", "AUD": "idp_audit", "SIGN": "idp_signins", "PRX": "proxy",
    "SQL": "sql_audit", "VPN": "vpn", "WAF": "waf",
}


def _read_jsonl(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def _read_csv(path: Path) -> list[dict]:
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _read(path: Path) -> list[dict]:
    return _read_csv(path) if path.suffix == ".csv" else _read_jsonl(path)


def event_ts(e: dict) -> str:
    """Timestamp ISO UTC del evento (cloudtrail puede traer eventTime)."""
    return e.get("timestamp") or e.get("eventTime") or ""


class DataStore:
    def __init__(self, dataset_dir: str | Path | None = None):
        self.dataset_dir = Path(dataset_dir or config.DATASET_DIR)
        if not (self.dataset_dir / "03_alertas" / "alertas.jsonl").exists():
            raise FileNotFoundError(
                f"No encuentro el dataset en {self.dataset_dir}. Revisa DATASET_DIR en .env"
            )
        self.load_stats: dict[str, Any] = {}

    # ------------------------------------------------------------------ carga
    def _files(self) -> list[Path]:
        d = self.dataset_dir
        files = [
            d / "03_alertas" / "alertas.jsonl",
            d / "03_alertas" / "alertas_muestra_desarrollo.jsonl",
            d / "05_inteligencia" / "ti_feed.jsonl",
            d / "05_inteligencia" / "geoip_asn.csv",
            d / "05_inteligencia" / "sandbox_informes.jsonl",
        ]
        files += sorted((d / "02_inventario").glob("*.csv"))
        files += [d / "04_logs" / f for f in LOG_FILES.values()]
        return files

    def _signature(self) -> list:
        return [CACHE_VERSION] + [(f.name, f.stat().st_size, int(f.stat().st_mtime)) for f in self._files()]

    def load(self, use_cache: bool = True) -> "DataStore":
        t0 = time.perf_counter()
        cache_file = config.CACHE_DIR / "store.pkl"
        sig = self._signature()
        if use_cache and cache_file.exists():
            try:
                with open(cache_file, "rb") as f:
                    cached_sig, state = pickle.load(f)
                if cached_sig == sig:
                    self.__dict__.update(state)
                    self.load_stats["source"] = "cache"
                    self.load_stats["seconds"] = round(time.perf_counter() - t0, 1)
                    log.info("DataStore cargado desde caché en %.1fs", self.load_stats["seconds"])
                    return self
                log.info("Caché obsoleta: el dataset ha cambiado, recargando")
            except Exception as e:  # noqa: BLE001 - caché corrupta → recargar
                log.warning("No se pudo leer la caché (%s), recargando", e)

        self._load_raw()
        self._build_indexes()
        self.load_stats["source"] = "raw"
        self.load_stats["seconds"] = round(time.perf_counter() - t0, 1)
        log.info("DataStore cargado desde ficheros en %.1fs", self.load_stats["seconds"])

        if use_cache:
            config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
            state = {k: v for k, v in self.__dict__.items() if k not in ("dataset_dir", "load_stats")}
            tmp = cache_file.with_suffix(".tmp")
            with open(tmp, "wb") as f:
                pickle.dump((sig, state), f, protocol=pickle.HIGHEST_PROTOCOL)
            tmp.replace(cache_file)
        return self

    def _load_raw(self) -> None:
        d = self.dataset_dir
        inv = d / "02_inventario"
        self._alerts: list[dict] = _read_jsonl(d / "03_alertas" / "alertas.jsonl")
        self._sample: list[dict] = _read_jsonl(d / "03_alertas" / "alertas_muestra_desarrollo.jsonl")
        self._assets: list[dict] = _read_csv(inv / "activos.csv")
        self._users: list[dict] = _read_csv(inv / "usuarios.csv")
        self._vulns: list[dict] = _read_csv(inv / "vulnerabilidades.csv")
        self._hr: list[dict] = _read_csv(inv / "eventos_rrhh.csv")
        self._changes: list[dict] = _read_csv(inv / "calendario_cambios.csv")
        self._services: list[dict] = _read_csv(inv / "servicios_negocio.csv")
        self._zones: list[dict] = _read_csv(inv / "zonas_red.csv")
        self._stores: list[dict] = _read_csv(inv / "tiendas.csv")
        self._ti: list[dict] = _read_jsonl(d / "05_inteligencia" / "ti_feed.jsonl")
        self._geo: list[dict] = _read_csv(d / "05_inteligencia" / "geoip_asn.csv")
        self._sbx: list[dict] = _read_jsonl(d / "05_inteligencia" / "sandbox_informes.jsonl")

        # Logs: lista por fuente, ordenada por tiempo, cada evento con "_source"
        self.logs: dict[str, list[dict]] = {}
        for source, fname in LOG_FILES.items():
            t = time.perf_counter()
            rows = _read(d / "04_logs" / fname)
            for r in rows:
                r["_source"] = source
            rows.sort(key=event_ts)
            self.logs[source] = rows
            self.load_stats[f"log_{source}"] = (len(rows), round(time.perf_counter() - t, 2))

    def _build_indexes(self) -> None:
        self._alert_by_id = {a["alert_id"]: a for a in self._alerts}
        for a in self._sample:  # la muestra puede tener alertas que no estén en el fichero completo
            self._alert_by_id.setdefault(a["alert_id"], a)

        self._event_by_id: dict[str, dict] = {}
        for rows in self.logs.values():
            for e in rows:
                self._event_by_id[e["event_id"]] = e

        vulns: dict[str, list] = {}
        for v in self._vulns:
            vulns.setdefault(v["hostname"].lower(), []).append(v)
        self._asset_by_key: dict[str, dict] = {}
        for a in self._assets:
            full = {**a, "vulnerabilities": vulns.get(a["hostname"].lower(), [])}
            self._asset_by_key[a["hostname"].lower()] = full
            if a.get("ip"):
                self._asset_by_key[a["ip"]] = full

        hr: dict[str, list] = {}
        for h in self._hr:
            hr.setdefault(h["usuario"].lower(), []).append(h)
        self._user_by_key: dict[str, dict] = {}
        for u in self._users:
            full = {**u, "hr_events": hr.get(u["upn"].lower(), [])}
            self._user_by_key[u["upn"].lower()] = full
            self._user_by_key[u["username"].lower()] = full

        self._ti_by_value = {r["value"].lower(): r for r in self._ti}
        self._geo_by_ip = {r["ip"]: r for r in self._geo}
        self._sbx_by_hash = {r["sha256"].lower(): r for r in self._sbx}

    # ------------------------------------------------------------ consultas
    def alerts(self, sample: bool = False) -> list[dict]:
        return self._sample if sample else self._alerts

    def alert(self, alert_id: str) -> dict | None:
        return self._alert_by_id.get(alert_id)

    def event(self, event_id: str) -> dict | None:
        """Evento de cualquier fuente por su event_id. Incluye "_source"."""
        return self._event_by_id.get(event_id)

    def asset(self, key: str) -> dict | None:
        """Activo de la CMDB por hostname (sin distinguir mayúsculas) o IP. Incluye "vulnerabilities"."""
        if not key:
            return None
        return self._asset_by_key.get(key.strip().lower()) or self._asset_by_key.get(key.strip())

    def user(self, key: str) -> dict | None:
        """Usuario por UPN o username. Acepta 'DOMINIO\\usuario'. Incluye "hr_events"."""
        if not key:
            return None
        k = key.strip().lower()
        if "\\" in k:
            k = k.rsplit("\\", 1)[1]
        return self._user_by_key.get(k)

    def intel(self, indicator: str) -> dict:
        """TIP + GeoIP. tip/geo = None si no hay datos (desconocido ≠ limpio)."""
        ind = (indicator or "").strip()
        return {"indicator": ind, "tip": self._ti_by_value.get(ind.lower()), "geo": self._geo_by_ip.get(ind)}

    def sandbox(self, sha256: str) -> dict | None:
        return self._sbx_by_hash.get((sha256 or "").strip().lower())

    def changes(self) -> list[dict]:
        return self._changes

    def services(self) -> list[dict]:
        return self._services

    def zones(self) -> list[dict]:
        return self._zones

    def stores(self) -> list[dict]:
        return self._stores

    def stats(self) -> dict:
        return {
            "alerts": len(self._alerts),
            "sample": len(self._sample),
            "events": len(self._event_by_id),
            "assets": len(self._assets),
            "users": len(self._users),
            "ti": len(self._ti),
            "geo": len(self._geo),
            "sandbox": len(self._sbx),
            "changes": len(self._changes),
            "logs": {k: len(v) for k, v in self.logs.items()},
            **self.load_stats,
        }

    # A2: search() y alerts_for_entity() (índice invertido por entidad)


_STORE: DataStore | None = None
_LOCK = threading.Lock()


def get_store(dataset_dir: str | Path | None = None) -> DataStore:
    """Singleton: el dashboard y el pipeline comparten una única instancia ya cargada."""
    global _STORE
    with _LOCK:
        if _STORE is None:
            _STORE = DataStore(dataset_dir).load()
        return _STORE


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    s = get_store()
    st = s.stats()
    print(json.dumps({k: v for k, v in st.items() if not k.startswith("log_")}, indent=2, ensure_ascii=False))
    if "-v" in sys.argv:
        print({k: v for k, v in st.items() if k.startswith("log_")})
