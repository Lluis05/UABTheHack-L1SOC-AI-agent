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

API para el dashboard (C4):
    from soc.pipeline import run
    tickets = run(alerts, mode="live", on_step=lambda alert_id, step, info: ...)
    pasos: contexto → politica → prefiltro → ia → revisor → ticket   (o error)
"""

from __future__ import annotations

import argparse
import collections
import json
import logging
import random
import sys
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
    step = on_step or (lambda *_: None)
    dedup = (mode != "live") if dedup is None else dedup

    # 1-3 · contexto + política + prefiltro (determinista, ms)
    contexts, hints = [], {}
    for a in alerts:
        aid = a.get("alert_id", "?")
        step(aid, "contexto", {})
        try:
            ctx = build_context(a, store)
        except Exception as e:  # noqa: BLE001 - nunca romper la cola por una alerta
            log.exception("build_context falló para %s", aid)
            ctx = {"alert": a, "entities": {}, "trace": [{"step": "error", "source": "Contexto", "query": aid,
                                                          "result": f"error construyendo contexto: {e}", "ms": 0}],
                   "policy_hits": [], "severity": None}
        sev = ctx.get("severity") or {}
        step(aid, "politica", {"hits": len(ctx.get("policy_hits") or []), "severity": sev.get("final"),
                               "suggestion": (sev.get("suggestion") or {}).get("verdict")})
        hint = prefilter(ctx)
        hints[aid] = hint
        step(aid, "prefiltro", {"verdict": (hint or {}).get("verdict"), "decisive": bool(hint and hint["decisive"])})
        contexts.append(ctx)

    groups = dedup_groups(contexts) if dedup else [[c] for c in contexts]

    # 4 · decidir quién tría cada grupo
    to_llm, tickets_by_rep = [], {}
    for g in groups:
        rep = g[0]
        aid = (rep.get("alert") or {}).get("alert_id", "?")
        hint = hints.get(aid)
        if mode == "live" or (mode == "normal" and not (hint and hint.get("decisive"))):
            to_llm.append(rep)
        else:
            t = deterministic_ticket(rep, store, hint)
            step(aid, "ticket", {"verdict": t["verdict"], "severity": t["severity"], "by": t.get("x_mode")})
            tickets_by_rep[aid] = t

    # 5 · agente LLM (B) en paralelo
    if to_llm:
        from soc.triage.agent import triage_many

        llm_tickets = triage_many(to_llm, workers=workers, on_step=step, use_cache=use_cache,
                                  prefilter_hints={(c.get("alert") or {}).get("alert_id"): hints.get(
                                      (c.get("alert") or {}).get("alert_id")) for c in to_llm})
        for c, t in zip(to_llm, llm_tickets):
            t["x_mode"] = t.get("x_mode") or ("no_ai_fallback" if t.get("x_no_ai") else "llm")
            tickets_by_rep[(c.get("alert") or {}).get("alert_id")] = t

    # 6 · ensamblar en orden + trazas
    out = []
    for g in groups:
        aid = (g[0].get("alert") or {}).get("alert_id")
        t = _merge_group(tickets_by_rep[aid], g)
        if save_traces:
            _save_trace(g[0], t)
        out.append(t)
    return out


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
        if live_print and step in ("ia", "revisor", "ticket", "error"):
            extra = {"ticket": f"{info.get('verdict')} / {info.get('severity')}", "error": info.get("error", "")}.get(step, "")
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
