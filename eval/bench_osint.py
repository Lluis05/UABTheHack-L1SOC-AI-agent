"""Comparativa de tiempo del pipeline con y sin OSINT sobre 10 alertas (sin gastar cuota del LLM).

Se mide el pipeline en modo `no_llm` (contexto + política + ticket) para aislar lo que añade el OSINT.
Los 10-30 s por alerta del LLM son iguales con y sin OSINT, así que no hace falta gastar cuota para compararlo.

Escenarios:
  - sin OSINT
  - con OSINT en frío: primera vez, incluye descargar las listas públicas
  - con OSINT en caliente: listas ya en memoria (lo que pasa en la defensa con el dashboard arrancado)

    python -m eval.bench_osint                  # 10 alertas al azar de la muestra
    python -m eval.bench_osint --with-ioc       # 10 alertas con indicadores externos (peor caso)
"""

from __future__ import annotations

import argparse
import json
import os
import random
import shutil
import statistics
import time

from soc import config
from soc.data.store import get_store
from soc.enrich import osint
from soc.enrich.entities import entity_keys  # noqa: F401  (carga de módulos antes de medir)
from soc.pipeline import run

N_ALERTS = 10
REPEATS = 3
SEED = 8


def _external_iocs(alert: dict, store) -> list[tuple[str, str]]:
    ents = store.entities_of(alert)
    return [(v, t) for t, k in (("ip", "ips"), ("domain", "domains"), ("sha256", "hashes"))
            for v in ents.get(k, []) if osint.is_queryable(v, t)]


def _timed_run(alerts: list[dict], store) -> tuple[float, list[dict]]:
    t0 = time.perf_counter()
    tickets = run(alerts, mode="no_llm", workers=5, store=store, save_traces=False, api=False,
                  dedup=False, correlate_new=False, save_incidents_file=False)
    return time.perf_counter() - t0, tickets


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--with-ioc", action="store_true", help="solo alertas con indicadores externos")
    ap.add_argument("--seed", type=int, default=SEED)
    args = ap.parse_args()

    store = get_store()
    pool = store.alerts(sample=True)
    if args.with_ioc:
        pool = [a for a in pool if _external_iocs(a, store)]
    alerts = random.Random(args.seed).sample(pool, min(N_ALERTS, len(pool)))
    n_iocs = sum(len(_external_iocs(a, store)) for a in alerts)

    # Calentar: DataStore e imports cargados antes de medir nada
    os.environ[osint.ENV_ENABLED] = "0"
    _timed_run(alerts[:1], store)

    off = [_timed_run(alerts, store)[0] for _ in range(REPEATS)]

    os.environ[osint.ENV_ENABLED] = "1"
    shutil.rmtree(config.OUTPUT_DIR / "osint", ignore_errors=True)   # frío de verdad: sin caché en disco
    osint._feeds = osint.Feeds()
    cold, tickets = _timed_run(alerts, store)
    feed_load = osint._feeds.load_seconds
    warm = [_timed_run(alerts, store)[0] for _ in range(REPEATS)]

    hits = [(e["indicator"], e["result"]) for t in tickets for e in t.get("enrichment", [])
            if e.get("source") == "osint" and "desconocido" not in e["result"]]
    feed_sizes = {n: len(d) for n, d in (osint._feeds.data or {}).items()}

    report = {
        "alerts": [a["alert_id"] for a in alerts],
        "external_iocs": n_iocs,
        "threatfox": osint.ThreatFox.available(),
        "seconds": {"sin_osint_mediana": round(statistics.median(off), 3),
                    "con_osint_frio": round(cold, 3),
                    "  de_ellos_descarga_listas": round(feed_load, 3),
                    "con_osint_caliente_mediana": round(statistics.median(warm), 3)},
        "por_alerta_ms": {"sin_osint": round(statistics.median(off) / len(alerts) * 1000, 1),
                          "con_osint_caliente": round(statistics.median(warm) / len(alerts) * 1000, 1)},
        "feed_sizes": feed_sizes,
        "feed_errors": osint._feeds.errors,
        "osint_hits": hits,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
