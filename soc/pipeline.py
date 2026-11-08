"""Pipeline de triaje N1 de punta a punta (Persona A).

    contexto (A) → política (A) → prefiltro (A) → agente LLM + revisor (B) → ticket → output/

CLI:
    python -m soc.pipeline --random 10 --live           # SIMULACRO de la defensa (cronometrado)
    python -m soc.pipeline --ids ALR-...,ALR-... --live  # las 10 alertas de la defensa
    python -m soc.pipeline --file defensa.jsonl --live   # alertas NUEVAS (JSONL o array JSON)
    python -m soc.pipeline --sample                      # 150 de desarrollo (política + IA solo donde haga falta)
    python -m soc.pipeline --all --no-llm                # 11.061 solo con la política (métricas)

Modos:
    --live    el LLM tría TODAS las alertas (el jurado quiere ver razonar a la IA); la política va como pista.
              SIN caché de respuestas LLM: cada alerta se razona de verdad en el momento (--cache para forzarla).
    (normal)  la política cierra lo inequívoco; el LLM solo ve lo ambiguo.
    --no-llm  nada de LLM: lo no concluyente queda como "pendiente de IA".

API para el dashboard (C4) — contrato "Dashboard ↔ pipeline" de docs/04:
    from soc.pipeline import run, triage_live
    tickets = triage_live(alerts=[...] | ids=[...] | random=10, on_step=cb)     # modo lotes (TRIAGE_MODE)
    tickets = run(alerts, mode="live|normal|no_llm", on_step=cb)
    cb(alert_id, step, data): step ∈ context | policy | llm | reviewer | ticket | error
                              data = {"trace_entry"?: {...}, "ticket"?: Ticket, "error"?: str, "message"?: str}
    Cada entrada de la traza se emite al producirse y cada ticket en cuanto su alerta termina.
"""

from __future__ import annotations

import argparse
import collections
import concurrent.futures as cf
import json
import logging
import os
import random
import sys
import threading
import time
from pathlib import Path
from typing import Callable, Iterable

from soc import config
from soc.data.api import HybridStore, SocApi, SocApiError, get_api
from soc.data.normalize import normalize_alert, parse_alerts_text, unwrap_alerts
from soc.data.store import DataStore, get_store
from soc.enrich.context import build_context
from soc.enrich.entities import entity_keys
from soc.metrics import batch_metrics, write_metrics
from soc.timeutil import parse
from soc.triage.prefilter import deterministic_ticket, prefilter

log = logging.getLogger(__name__)

OnStep = Callable[[str, str, dict], None]
HUMAN_MINUTES_PER_ALERT = 15  # diapositiva 3 de Deloitte
DEDUP_WINDOW_S = 3600


# ------------------------------------------------------------------ entrada
def load_alert_file(path: str | Path) -> list[dict]:
    """Alertas del JSON que nos den (array, objeto, envoltorio {"alerts"/"items": [...]}, pretty-printed,
    JSONL u objetos concatenados; con o sin BOM). Lo ilegible se salta con aviso; nunca rompe."""
    raw = Path(path).read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
        log.warning("%s no es UTF-8: leído como latin-1", path)
    alerts, warns = parse_alerts_text(text)
    for w in warns:
        log.warning("%s: %s", Path(path).name, w)
    alerts = [a if isinstance(a, dict) else {"evidence": {"text": str(a)}} for a in alerts]
    for i, a in enumerate(alerts):
        if not a.get("alert_id"):
            a["alert_id"] = f"ALR-NUEVA-{i + 1:04d}"
        a.setdefault("status", "new")
    return alerts


def _tag(a: dict, how: str) -> dict:
    return {**a, "x_intake": how}


def select_alerts(store: DataStore, *, ids: str | None = None, file: str | None = None,
                  random_n: int | None = None, sample: bool = False, all_: bool = False,
                  queue_n: int | None = None, seed: int | None = None, api: SocApi | None = None) -> list[dict]:
    """Alertas a triar. --ids/--random/--queue se leen de la API del SOC (lo que pide Deloitte) si está levantada;
    si no, del dataset local. --sample/--all son lotes de desarrollo y se leen siempre en local."""
    api_up = bool(api and api.available())
    if (ids or random_n or queue_n) and api is not None and not api_up:
        log.warning("API del SOC no disponible en %s: se leen las alertas del dataset local", api.base)
    if ids:
        out = []
        for i in (x.strip() for x in ids.split(",") if x.strip()):
            a = None
            if api_up:
                try:
                    a = api.alert(i)
                except SocApiError as e:
                    log.warning("API: %s", e)
                if a:
                    out.append(_tag(a, f"API SOC · GET /alerts/{i}"))
                    continue
            a = store.alert(i)
            if a is None:
                log.warning("Alerta %s no está ni en la API ni en el dataset: se ignora", i)
            else:
                out.append(_tag(a, "dataset local"))
        return out
    if file:
        return [_tag(a, f"fichero {Path(file).name}") for a in load_alert_file(file)]
    if queue_n:
        if api_up:
            return [_tag(a, "API SOC · GET /alerts?status=new") for a in api.queue("new", limit=queue_n)["items"]]
        return [_tag(a, "dataset local (cola)") for a in [a for a in store.alerts() if a.get("status") == "new"][:queue_n]]
    if random_n:
        if api_up:
            try:
                return [_tag(a, "API SOC · GET /alerts (al azar)") for a in api.random_alerts(random_n, seed=seed)]
            except SocApiError as e:
                log.warning("API: %s; se usa el dataset local", e)
        return [_tag(a, "dataset local (al azar)") for a in random.Random(seed).sample(store.alerts(), random_n)]
    if sample:
        return list(store.alerts(sample=True))
    if all_:
        return list(store.alerts())
    return []


# ------------------------------------------------------------ deduplicación
def dedup_groups(contexts: list[dict]) -> list[list[dict]]:
    """Agrupa alertas duplicadas: misma regla + mismas entidades en < 1 h → un solo ticket (política §6)."""
    groups: dict[tuple, list[list[dict]]] = collections.defaultdict(list)
    out: list[list[dict]] = []
    for ctx in sorted(contexts, key=lambda c: (c.get("alert") or {}).get("created_at") or ""):
        a = ctx.get("alert") or {}
        hubs = {k for k, v in (ctx.get("entity_stats") or {}).items() if v.get("hub")}
        key = (a.get("rule_id"), frozenset(entity_keys(ctx.get("entities") or {}) - hubs))
        placed = False
        if key[1] and a.get("created_at"):
            for g in groups[key]:
                first = (g[0].get("alert") or {}).get("created_at")
                try:
                    if (parse(a["created_at"]) - parse(first)).total_seconds() <= DEDUP_WINDOW_S:
                        g.append(ctx)
                        placed = True
                        break
                except ValueError:
                    pass
        if not placed:
            g = [ctx]
            groups[key].append(g)
            out.append(g)
    return out


# ------------------------------------------------------------ correlación
INCIDENTS_FILE = "incidents.jsonl"           # dentro de config.OUTPUT_DIR (lo genera `python -m soc.correlate.incidents`)
CLOSED_VERDICTS = {"false_positive", "benign_true_positive"}
_incidents_lock = threading.Lock()
_incidents_cache: dict[str, tuple[float, list[dict]]] = {}
_incidents_warned: set[str] = set()


def load_incidents(path: str | Path | None = None) -> list[dict]:
    """Incidentes conocidos (output/incidents.jsonl). Se recarga si el fichero cambia; si no existe, []."""
    path = Path(path) if path else config.OUTPUT_DIR / INCIDENTS_FILE
    key = str(path)
    with _incidents_lock:
        try:
            mtime = path.stat().st_mtime
        except OSError:
            if key not in _incidents_warned:
                _incidents_warned.add(key)
                log.warning("No hay %s: los tickets salen sin x_incident_id (generadlo con "
                            "`python -m soc.correlate.incidents`)", path)
            return []
        cached = _incidents_cache.get(key)
        if cached and cached[0] == mtime:
            return cached[1]
        incidents = []
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                try:
                    incidents.append(json.loads(line))
                except json.JSONDecodeError:
                    log.warning("%s: línea ilegible ignorada", path.name)
        _incidents_cache[key] = (mtime, incidents)
        return incidents


def link_incident(ctx: dict, ticket: dict, store: DataStore, incidents: list[dict]) -> str | None:
    """Rellena ticket["x_incident_id"] con el incidente existente al que se une la alerta (attach() de D).
    Las alertas cerradas como FP/benignas no se unen a incidentes (mismo criterio que candidate_alerts)."""
    from soc.correlate.incidents import attach

    if not incidents or ticket.get("verdict") in CLOSED_VERDICTS:
        return ticket.get("x_incident_id")
    alert = ctx.get("alert") or {}
    # Alertas del dataset: el objeto original trae las entidades precalculadas (más rápido)
    original = store.alert(alert.get("alert_id", "")) if alert.get("alert_id") else None
    t0 = time.perf_counter()
    try:
        inc_id = attach(original or alert, incidents, store)
    except Exception as e:  # noqa: BLE001 - la correlación nunca rompe el triaje
        log.warning("attach falló para %s: %s", alert.get("alert_id"), e)
        return ticket.get("x_incident_id")
    if inc_id:
        ticket["x_incident_id"] = inc_id
        inc = next((i for i in incidents if i.get("incident_id") == inc_id), {})
        ctx.setdefault("trace", []).append({
            "step": "correlate", "source": "Correlación", "query": alert.get("alert_id"),
            "result": f"se une a {inc_id} ({inc.get('severity')}, {len(inc.get('alert_ids') or [])} alertas)",
            "ms": round((time.perf_counter() - t0) * 1000, 1)})
    return inc_id


BATCH_CORRELATE_MAX = 500   # por encima (p. ej. --all) se usa el CLI de soc.correlate.incidents


def correlate_batch(contexts: list[dict], tickets: list[dict], store: DataStore,
                    incidents: list[dict]) -> list[dict]:
    """Correlación dentro del lote triado: alertas NUEVAS (p. ej. el JSON de la defensa) que no se unen a ningún
    incidente conocido pero sí entre ellas forman incidentes nuevos. Devuelve los incidentes nuevos con id
    correlativo a los existentes y rellena x_incident_id en sus tickets."""
    from soc.correlate.incidents import correlate

    ticket_of = {aid: t for t in tickets for aid in t.get("alert_ids") or []}
    open_alerts = [a for c in contexts if (a := c.get("alert")) and a.get("alert_id") and a.get("created_at")
                   and (t := ticket_of.get(a["alert_id"])) and t.get("verdict") not in CLOSED_VERDICTS
                   and not t.get("x_incident_id")]
    if len(open_alerts) < 2:
        return []
    try:
        new = correlate(open_alerts, store, tickets=tickets)
    except Exception as e:  # noqa: BLE001 - la correlación nunca rompe el triaje
        log.warning("correlación del lote falló: %s", e)
        return []
    nums = [int(i["incident_id"].rsplit("-", 1)[1]) for i in incidents
            if str(i.get("incident_id", "")).rsplit("-", 1)[-1].isdigit()]
    n = max(nums, default=0)
    for inc in new:
        n += 1
        inc["incident_id"] = f"INC-{n:04d}"
        inc["x_live"] = True                    # creado en directo a partir del lote triado
        for aid in inc["alert_ids"]:
            if t := ticket_of.get(aid):
                t["x_incident_id"] = inc["incident_id"]
    return new


def save_incidents(new: list[dict], path: str | Path | None = None) -> None:
    """Añade incidentes nuevos a output/incidents.jsonl (el dashboard los muestra y los siguientes lotes se unen)."""
    if not new:
        return
    path = Path(path) if path else config.OUTPUT_DIR / INCIDENTS_FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    with _incidents_lock, open(path, "a", encoding="utf-8") as f:
        for inc in new:
            f.write(json.dumps(inc, ensure_ascii=False, default=str) + "\n")


def _merge_group(ticket: dict, group: list[dict]) -> dict:
    if len(group) > 1:
        ids = [(c.get("alert") or {}).get("alert_id") for c in group]
        ticket["alert_ids"] = list(dict.fromkeys(ticket.get("alert_ids", []) + ids))
        ticket.setdefault("x_notes", []).append(f"Agrupa {len(ids)} alertas duplicadas (misma regla y entidades, < 1 h)")
    return ticket


# ------------------------------------------------------------------ núcleo
def run(alerts: Iterable[dict], *, mode: str = "normal", workers: int = 5, store: DataStore | None = None,
        on_step: OnStep | None = None, dedup: bool | None = None, use_cache: bool | None = None,
        save_traces: bool = True, api: SocApi | None | bool = None,
        incidents: list[dict] | None = None, correlate_new: bool = True,
        save_incidents_file: bool = False) -> list[dict]:
    """Tría alertas. mode: 'live' (IA en todas) | 'normal' (IA solo si hace falta) | 'no_llm'.

    api: API del SOC como respaldo del enriquecimiento (lo que no esté en local). Por defecto solo en 'live';
    en los lotes grandes todo es local para no saturar la API.
    incidents: incidentes a los que unir las alertas (x_incident_id); por defecto, output/incidents.jsonl.
    correlate_new: además, agrupar en incidentes NUEVOS las alertas del lote relacionadas entre sí
    (save_incidents_file: añadirlos a output/incidents.jsonl; solo lo pide el dashboard, triage_live)."""
    assert mode in ("live", "normal", "no_llm"), mode
    store = store or get_store()
    incidents = load_incidents() if incidents is None else incidents
    if api is None or api is True:
        api = get_api() if (mode == "live" or api is True) else None
    hybrid = HybridStore(store, api) if api else None
    if hybrid and not api.available():
        log.warning("API del SOC no disponible en %s: enriquecimiento solo local", api.base)
        hybrid = None
    # Entrada defensiva: alertas nuevas o mal formadas se normalizan (y se anota qué se corrigió)
    alerts = [normalize_alert(a, i) for i, a in enumerate(alerts)]
    lock = threading.Lock()

    def step(aid: str, s: str, data: dict | None = None) -> None:
        if on_step:
            with lock:
                try:
                    on_step(aid, s, data or {})
                except Exception:  # noqa: BLE001 - un fallo del dashboard no tumba el triaje
                    log.exception("on_step falló")

    dedup = (mode != "live") if dedup is None else dedup
    # En directo nunca se reutilizan respuestas: el jurado debe ver a la IA razonar cada alerta
    use_cache = (mode != "live") if use_cache is None else use_cache

    # 1-3 · contexto + política + prefiltro (determinista, ms; con la API de respaldo, segundos)
    def prepare(a: dict) -> tuple[dict, dict | None]:
        aid = a.get("alert_id", "?")
        step(aid, "context", {"message": "recopilando contexto (CMDB, directorio, logs ±24 h, TIP, cambios…)"})
        try:
            if hybrid:
                hybrid.begin(a.get("created_at"))
            ctx = build_context(a, hybrid or store)
            intake = a.get("x_intake")
            extra = ([{"step": "intake", "query": aid, "result": f"alerta leída de: {intake}", "ms": 0,
                       "source": "API SOC" if "API" in intake else "Entrada"}] if intake else [])
            ctx["trace"] = extra + (ctx.get("trace") or []) + (hybrid.api_calls() if hybrid else [])
        except Exception as e:  # noqa: BLE001 - nunca romper la cola por una alerta
            log.exception("build_context falló para %s", aid)
            ctx = {"alert": a, "entities": {}, "trace": [{"step": "error", "source": "Contexto", "query": aid,
                                                          "result": f"error construyendo contexto: {e}", "ms": 0}],
                   "policy_hits": [], "severity": None}
        for e in ctx.get("trace") or []:
            step(aid, "policy" if e.get("source") == "Política" else "context", {"trace_entry": e})
        sev = ctx.get("severity") or {}
        sug = sev.get("suggestion") or {}
        hint = prefilter(ctx)
        step(aid, "policy", {"message": f"política: {len(ctx.get('policy_hits') or [])} reglas · severidad "
                                        f"{sev.get('final')} · sugiere {sug.get('verdict') or '—'}"
                                        f"{' (concluyente)' if hint and hint.get('decisive') else ''}"})
        return ctx, hint

    if hybrid and len(alerts) > 1:
        # Con la API de respaldo cada alerta puede esperar a la red: se preparan en paralelo
        with cf.ThreadPoolExecutor(max_workers=min(len(alerts), CONTEXT_WORKERS)) as pool:
            prepared = list(pool.map(prepare, alerts))
    else:
        prepared = [prepare(a) for a in alerts]
    contexts = [c for c, _ in prepared]
    hints = {(c.get("alert") or {}).get("alert_id", "?"): h for c, h in prepared}

    groups = dedup_groups(contexts) if dedup else [[c] for c in contexts]
    out_by_rep: dict[str, dict] = {}

    def finish(group: list[dict], t: dict) -> None:
        rep = group[0]
        aid = (rep.get("alert") or {}).get("alert_id")
        t = _merge_group(t, group)
        if t.get("triage_seconds") is None and rep.get("build_ms") is not None:
            t["triage_seconds"] = round(rep["build_ms"] / 1000, 3)  # decidido por la política: solo contexto
        n_trace = len(rep.get("trace") or [])
        link_incident(rep, t, store, incidents)
        for e in (rep.get("trace") or [])[n_trace:]:
            step(aid, "policy", {"trace_entry": e})
        if save_traces:
            _save_trace(rep, t)
        warns = (rep.get("alert") or {}).get("x_input_warnings")
        if warns:
            t["x_input_warnings"] = warns
            t.setdefault("open_questions", []).append("Alerta de entrada corregida: " + "; ".join(warns[:3]))
        out_by_rep[aid] = t
        for c in group:
            step((c.get("alert") or {}).get("alert_id"), "ticket", {"ticket": t})

    # 4 · decidir quién tría cada grupo; la política cierra lo inequívoco (salvo en live)
    to_llm = []
    for g in groups:
        aid = (g[0].get("alert") or {}).get("alert_id", "?")
        hint = hints.get(aid)
        if mode == "live" or (mode == "normal" and not (hint and hint.get("decisive"))):
            to_llm.append(g)
        else:
            finish(g, deterministic_ticket(g[0], store, hint))

    # 5 · agente LLM (B) en paralelo; cada ticket se emite en cuanto su alerta termina
    if to_llm:
        _run_llm(to_llm, hints, workers, use_cache, step, finish)

    tickets = [out_by_rep[(g[0].get("alert") or {}).get("alert_id")] for g in groups]
    # 6 · alertas nuevas relacionadas entre sí → incidentes nuevos (los conocidos ya se unieron con attach)
    if correlate_new and len(contexts) <= BATCH_CORRELATE_MAX:
        new_incidents = correlate_batch(contexts, tickets, store, incidents)
        if save_incidents_file:
            save_incidents(new_incidents)
        for inc in new_incidents:
            for aid in inc["alert_ids"]:
                step(aid, "policy", {"message": f"correlación: forma el incidente nuevo {inc['incident_id']} "
                                                f"con {len(inc['alert_ids'])} alertas del lote"})
    return tickets


ALERT_TIMEOUT_S = int(os.getenv("ALERT_TIMEOUT", "150"))
CONTEXT_WORKERS = int(os.getenv("CONTEXT_WORKERS", "10"))
_AGENT_STEP = {"ia": "llm", "revisor": "reviewer"}


def _run_llm(groups: list[list[dict]], hints: dict, workers: int, use_cache: bool,
             step: Callable, finish: Callable) -> None:
    from soc.triage.agent import fallback_ticket, triage

    def one(group: list[dict]) -> tuple[list[dict], dict]:
        ctx = group[0]
        aid = (ctx.get("alert") or {}).get("alert_id", "?")
        n_before = len(ctx.get("trace") or [])

        def agent_step(a: str, s: str, info: dict) -> None:
            if s in _AGENT_STEP:
                msg = "IA analizando la alerta" if s == "ia" else "revisor crítico comprobando el veredicto"
                step(a, _AGENT_STEP[s], {"message": msg + (f" ({info['chars']} car. de contexto)"
                                                           if info.get("chars") else "")})
            elif s == "error":  # el agente genera igualmente un ticket sin IA: no marcar la alerta como rota
                step(a, "llm", {"message": f"IA no disponible ({info.get('error', '')[:120]}): ticket sin IA"})

        t = triage(ctx, hints.get(aid), use_cache=use_cache, on_step=agent_step)
        for e in (ctx.get("trace") or [])[n_before:]:
            step(aid, "reviewer" if e.get("step") == "review" else "llm", {"trace_entry": e})
        t["x_mode"] = "no_ai_fallback" if t.get("x_no_ai") else "llm"
        return group, t

    pool = cf.ThreadPoolExecutor(max_workers=max(1, workers))
    futs = {pool.submit(one, g): g for g in groups}
    done: set[int] = set()
    budget = ALERT_TIMEOUT_S + 30 * (len(groups) // max(1, workers))
    try:
        for fut in cf.as_completed(futs, timeout=budget):
            g = futs[fut]
            try:
                group, t = fut.result()
            except Exception as e:  # noqa: BLE001
                group, t = g, fallback_ticket(g[0], hints.get((g[0].get("alert") or {}).get("alert_id")), str(e))
                t["x_mode"] = "no_ai_fallback"
            finish(group, t)
            done.add(id(g))
    except cf.TimeoutError:
        log.warning("Timeout global del triaje con IA (%ss)", budget)
    for fut, g in futs.items():
        if id(g) not in done:
            aid = (g[0].get("alert") or {}).get("alert_id")
            step(aid, "llm", {"message": "timeout de la IA: ticket sin IA"})
            t = fallback_ticket(g[0], hints.get(aid), "timeout")
            t["x_mode"] = "no_ai_fallback"
            finish(g, t)
    pool.shutdown(wait=False, cancel_futures=True)


# Modo del triaje que lanza el dashboard. Por decisión del equipo es "normal" (lotes: la política cierra lo
# inequívoco y la IA solo ve lo ambiguo), también en la demo. TRIAGE_MODE=live vuelve a pasar todo por la IA.
DASHBOARD_TRIAGE_MODE = os.getenv("TRIAGE_MODE", "normal")


def triage_live(alerts: list[dict] | None = None, ids: list[str] | None = None, random: int = 0,
                on_step: OnStep | None = None, workers: int = 5, mode: str | None = None) -> list[dict]:
    """Punto de entrada del dashboard (contrato docs/04): tría las alertas con progreso paso a paso.
    mode: por defecto DASHBOARD_TRIAGE_MODE ("normal", modo lotes); el nombre se mantiene por el contrato."""
    mode = mode or DASHBOARD_TRIAGE_MODE
    store = get_store()
    api = get_api()
    # El dashboard puede mandar un envoltorio ({"alerts": [...]}, formato de la API…) como si fuera una alerta
    sel = [_tag(a if isinstance(a, dict) else {"evidence": {"text": str(a)}}, "dashboard (alerta pegada)")
           for a in unwrap_alerts(list(alerts or []))]
    for i, a in enumerate(sel):
        a.setdefault("alert_id", f"ALR-NUEVA-{i + 1:04d}")
    if ids:
        sel += select_alerts(store, ids=",".join(ids), api=api)
    if random:
        sel += select_alerts(store, random_n=random, api=api)
    # Los incidentes nuevos del lote se guardan siempre: el dashboard los lee de output/incidents.jsonl
    tickets = run(sel, mode=mode, workers=workers, store=store, on_step=on_step, api=api, save_incidents_file=True)
    _append_tickets(tickets)
    return tickets


def _append_tickets(tickets: list[dict], path: Path | None = None) -> None:
    """Añade tickets a output/tickets.jsonl sustituyendo los de las mismas alertas (re-triaje)."""
    path = path or config.OUTPUT_DIR / "tickets.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    new_ids = {i for t in tickets for i in t.get("alert_ids", [])}
    keep = []
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                try:
                    t = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if not new_ids & set(t.get("alert_ids", [])):
                    keep.append(line)
    with open(path, "w", encoding="utf-8") as f:
        for line in keep:
            f.write(line + "\n")
        for t in tickets:
            f.write(json.dumps(t, ensure_ascii=False, default=str) + "\n")


def _save_trace(ctx: dict, ticket: dict) -> None:
    aid = (ctx.get("alert") or {}).get("alert_id", "ALR-NUEVA")
    d = config.OUTPUT_DIR / "traces"
    d.mkdir(parents=True, exist_ok=True)
    rec = {"alert_id": aid, "ticket_id": ticket.get("ticket_id"), "trace": ctx.get("trace") or [],
           "build_ms": ctx.get("build_ms"), "policy_hits": ctx.get("policy_hits") or [],
           "severity": ctx.get("severity"), "context": ctx}
    (d / f"{aid}.json").write_text(json.dumps(rec, ensure_ascii=False, default=str), encoding="utf-8")
    ticket["x_trace_file"] = str(Path("output") / "traces" / f"{aid}.json")


# --------------------------------------------------------------------- CLI
def _summary(tickets: list[dict], n_alerts: int, seconds: float) -> str:
    c = collections.Counter
    v = c(t["verdict"] for t in tickets)
    s = c(t["severity"] for t in tickets)
    m = c(t.get("x_mode") for t in tickets)
    p = c(t.get("x_llm_provider") or "—" for t in tickets)
    esc = sum(1 for t in tickets if (t.get("escalation") or {}).get("escalate"))
    human_h = n_alerts * HUMAN_MINUTES_PER_ALERT / 60
    lines = [
        f"{n_alerts} alertas → {len(tickets)} tickets en {seconds:.1f}s "
        f"({seconds / max(1, n_alerts):.2f}s/alerta; un N1 humano: ~{human_h:.1f} h)",
        "  veredictos: " + ", ".join(f"{k} {n}" for k, n in v.most_common()),
        "  severidad:  " + ", ".join(f"{k} {n}" for k, n in s.most_common()),
        "  decidido por: " + ", ".join(f"{k} {n}" for k, n in m.most_common()) + f" · proveedor LLM: {dict(p)}",
        f"  escalados a N2: {esc}",
    ]
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description="Triaje N1 del SOC de Tarvia")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--ids", help="alert_ids separados por comas")
    g.add_argument("--file", help="JSONL / JSON con alertas (pueden ser nuevas)")
    g.add_argument("--random", type=int, metavar="N", help="N alertas al azar de la API/dataset (simulacro)")
    g.add_argument("--queue", type=int, metavar="N", help="las N primeras de la cola de la API (status=new)")
    g.add_argument("--sample", action="store_true", help="las 150 alertas de desarrollo")
    g.add_argument("--all", action="store_true", help="las 11.061 alertas")
    m = ap.add_mutually_exclusive_group()
    m.add_argument("--live", action="store_true", help="IA en todas las alertas (modo defensa)")
    m.add_argument("--no-llm", action="store_true", help="solo política, sin IA")
    ap.add_argument("--workers", type=int, default=5)
    ap.add_argument("--local", action="store_true", help="no usar la API del SOC (solo el dataset local)")
    ap.add_argument("--seed", type=int)
    c = ap.add_mutually_exclusive_group()
    c.add_argument("--cache", dest="cache", action="store_true", default=None,
                   help="reutilizar respuestas LLM guardadas (por defecto: sí, salvo en --live)")
    c.add_argument("--no-cache", dest="cache", action="store_false", help="no usar la caché de respuestas LLM")
    ap.add_argument("--no-dedup", action="store_true")
    ap.add_argument("--out", help="JSONL de salida (por defecto output/tickets.jsonl)")
    args = ap.parse_args()
    logging.basicConfig(level=logging.WARNING, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    t_load = time.perf_counter()
    store = get_store()
    print(f"Datos cargados en {time.perf_counter() - t_load:.1f}s")
    api = None if args.local else get_api()
    if api:
        print(f"API del SOC ({api.base}): {'disponible' if api.available() else 'NO disponible → todo en local'}")
    alerts = select_alerts(store, ids=args.ids, file=args.file, random_n=args.random, sample=args.sample,
                           all_=args.all, queue_n=args.queue, seed=args.seed, api=api)
    if not alerts:
        print("No hay alertas que triar.")
        return
    mode = "live" if args.live else "no_llm" if args.no_llm else "normal"
    live_print = mode == "live" or len(alerts) <= 20

    def on_step(aid: str, step: str, info: dict) -> None:
        if not live_print or info.get("trace_entry") or step in ("context", "policy"):
            return
        if step == "ticket":
            t = info.get("ticket") or {}
            extra = f"{t.get('verdict')} / {t.get('severity')}"
        else:
            extra = info.get("error") or info.get("message") or ""
        print(f"  [{time.perf_counter() - t0:6.1f}s] {aid:<22} {step:<8} {extra}", flush=True)

    cache_on = (mode != "live") if args.cache is None else args.cache
    print(f"Triando {len(alerts)} alertas en modo {mode} (caché LLM: {'sí' if cache_on else 'no'})…")
    t0 = time.perf_counter()
    tickets = run(alerts, mode=mode, workers=args.workers, store=store, on_step=on_step,
                  dedup=False if args.no_dedup else None, use_cache=args.cache,
                  save_traces=not args.all, api=(api or False) if mode == "live" else False)
    secs = time.perf_counter() - t0

    out = Path(args.out) if args.out else config.OUTPUT_DIR / ("tickets_all.jsonl" if args.all else "tickets.jsonl")
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        for t in tickets:
            f.write(json.dumps(t, ensure_ascii=False, default=str) + "\n")
    if args.all:  # métricas del batch completo para el dashboard (output/metrics.json)
        mpath = write_metrics(batch_metrics(tickets, n_alerts=len(alerts), wall_seconds=secs, mode=mode))
        print(f"Métricas del batch → {mpath}")
    print()
    if live_print:
        for t in tickets:
            print(f"{t['alert_ids'][0]:<22} {t['verdict']:<21} {t['severity']:<13} "
                  f"{(t.get('x_mode') or ''):<15} {t['title'][:90]}")
        print()
    print(_summary(tickets, len(alerts), secs))
    print(f"→ {out}")


if __name__ == "__main__":
    main()
