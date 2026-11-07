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
    (normal)  la política cierra lo inequívoco; el LLM solo ve lo ambiguo.
    --no-llm  nada de LLM: lo no concluyente queda como "pendiente de IA".

API para el dashboard (C4) — contrato "Dashboard ↔ pipeline" de docs/04:
    from soc.pipeline import run, triage_live
    tickets = triage_live(alerts=[...] | ids=[...] | random=10, on_step=cb)     # siempre modo live
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
from soc.data.store import DataStore, get_store
from soc.enrich.context import build_context
from soc.enrich.entities import entity_keys
from soc.timeutil import parse
from soc.triage.prefilter import deterministic_ticket, prefilter

log = logging.getLogger(__name__)

OnStep = Callable[[str, str, dict], None]
HUMAN_MINUTES_PER_ALERT = 15  # diapositiva 3 de Deloitte
DEDUP_WINDOW_S = 3600


# ------------------------------------------------------------------ entrada
def load_alert_file(path: str | Path) -> list[dict]:
    """JSONL o array JSON de alertas. Las que no traen alert_id reciben uno."""
    text = Path(path).read_text(encoding="utf-8").strip()
    if not text:
        return []
    if text.startswith("["):
        alerts = json.loads(text)
    elif text.startswith("{") and "\n" not in text.strip():
        alerts = [json.loads(text)]
    else:
        alerts = [json.loads(line) for line in text.splitlines() if line.strip()]
    for i, a in enumerate(alerts):
        a.setdefault("alert_id", f"ALR-NUEVA-{i + 1:04d}")
        a.setdefault("status", "new")
    return alerts


def select_alerts(store: DataStore, *, ids: str | None = None, file: str | None = None,
                  random_n: int | None = None, sample: bool = False, all_: bool = False,
                  seed: int | None = None) -> list[dict]:
    if ids:
        out = []
        for i in (x.strip() for x in ids.split(",") if x.strip()):
            a = store.alert(i)
            if a is None:
                log.warning("Alerta %s no está en el dataset: se ignora", i)
            else:
                out.append(a)
        return out
    if file:
        return load_alert_file(file)
    if random_n:
        return random.Random(seed).sample(store.alerts(), random_n)
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


def _merge_group(ticket: dict, group: list[dict]) -> dict:
    if len(group) > 1:
        ids = [(c.get("alert") or {}).get("alert_id") for c in group]
        ticket["alert_ids"] = list(dict.fromkeys(ticket.get("alert_ids", []) + ids))
        ticket.setdefault("x_notes", []).append(f"Agrupa {len(ids)} alertas duplicadas (misma regla y entidades, < 1 h)")
    return ticket


# ------------------------------------------------------------------ núcleo
def run(alerts: Iterable[dict], *, mode: str = "normal", workers: int = 5, store: DataStore | None = None,
        on_step: OnStep | None = None, dedup: bool | None = None, use_cache: bool = True,
        save_traces: bool = True) -> list[dict]:
    """Tría alertas. mode: 'live' (IA en todas) | 'normal' (IA solo si hace falta) | 'no_llm'."""
    assert mode in ("live", "normal", "no_llm"), mode
    store = store or get_store()
    alerts = list(alerts)
    lock = threading.Lock()

    def step(aid: str, s: str, data: dict | None = None) -> None:
        if on_step:
            with lock:
                try:
                    on_step(aid, s, data or {})
                except Exception:  # noqa: BLE001 - un fallo del dashboard no tumba el triaje
                    log.exception("on_step falló")

    dedup = (mode != "live") if dedup is None else dedup

    # 1-3 · contexto + política + prefiltro (determinista, ms)
    contexts, hints = [], {}
    for a in alerts:
        aid = a.get("alert_id", "?")
        step(aid, "context", {"message": "recopilando contexto (CMDB, directorio, logs ±24 h, TIP, cambios…)"})
        try:
            ctx = build_context(a, store)
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
        hints[aid] = hint
        step(aid, "policy", {"message": f"política: {len(ctx.get('policy_hits') or [])} reglas · severidad "
                                        f"{sev.get('final')} · sugiere {sug.get('verdict') or '—'}"
                                        f"{' (concluyente)' if hint and hint.get('decisive') else ''}"})
        contexts.append(ctx)

    groups = dedup_groups(contexts) if dedup else [[c] for c in contexts]
    out_by_rep: dict[str, dict] = {}

    def finish(group: list[dict], t: dict) -> None:
        rep = group[0]
        aid = (rep.get("alert") or {}).get("alert_id")
        t = _merge_group(t, group)
        if save_traces:
            _save_trace(rep, t)
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

    return [out_by_rep[(g[0].get("alert") or {}).get("alert_id")] for g in groups]


ALERT_TIMEOUT_S = int(os.getenv("ALERT_TIMEOUT", "150"))
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


def triage_live(alerts: list[dict] | None = None, ids: list[str] | None = None, random: int = 0,
                on_step: OnStep | None = None, workers: int = 5) -> list[dict]:
    """Punto de entrada del dashboard (contrato docs/04): tría en directo, IA en todas, progreso paso a paso."""
    store = get_store()
    sel = list(alerts or [])
    for i, a in enumerate(sel):
        a.setdefault("alert_id", f"ALR-NUEVA-{i + 1:04d}")
    if ids:
        sel += select_alerts(store, ids=",".join(ids))
    if random:
        sel += select_alerts(store, random_n=random)
    tickets = run(sel, mode="live", workers=workers, store=store, on_step=on_step)
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
    g.add_argument("--random", type=int, metavar="N", help="N alertas al azar del dataset (simulacro)")
    g.add_argument("--sample", action="store_true", help="las 150 alertas de desarrollo")
    g.add_argument("--all", action="store_true", help="las 11.061 alertas")
    m = ap.add_mutually_exclusive_group()
    m.add_argument("--live", action="store_true", help="IA en todas las alertas (modo defensa)")
    m.add_argument("--no-llm", action="store_true", help="solo política, sin IA")
    ap.add_argument("--workers", type=int, default=5)
    ap.add_argument("--seed", type=int)
    ap.add_argument("--no-cache", action="store_true", help="no usar la caché de respuestas LLM")
    ap.add_argument("--no-dedup", action="store_true")
    ap.add_argument("--out", help="JSONL de salida (por defecto output/tickets.jsonl)")
    args = ap.parse_args()
    logging.basicConfig(level=logging.WARNING, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    t_load = time.perf_counter()
    store = get_store()
    print(f"Datos cargados en {time.perf_counter() - t_load:.1f}s")
    alerts = select_alerts(store, ids=args.ids, file=args.file, random_n=args.random, sample=args.sample,
                           all_=args.all, seed=args.seed)
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

    print(f"Triando {len(alerts)} alertas en modo {mode}…")
    t0 = time.perf_counter()
    tickets = run(alerts, mode=mode, workers=args.workers, store=store, on_step=on_step,
                  dedup=False if args.no_dedup else None, use_cache=not args.no_cache,
                  save_traces=not args.all)
    secs = time.perf_counter() - t0

    out = Path(args.out) if args.out else config.OUTPUT_DIR / ("tickets_all.jsonl" if args.all else "tickets.jsonl")
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        for t in tickets:
            f.write(json.dumps(t, ensure_ascii=False, default=str) + "\n")
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
