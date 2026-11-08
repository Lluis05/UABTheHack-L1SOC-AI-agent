"""build_context(alert, store) -> Context  (contrato en docs/04_arquitectura.md)

Reúne TODO lo que un analista N1 consultaría para triar una alerta, de forma determinista y trazable:
CMDB, directorio + RRHH, eventos relacionados, actividad de cada entidad ±24 h, TIP + GeoIP,
sandbox, otras alertas de las mismas entidades, cambios aprobados cercanos y estadísticas de rareza.

Cada consulta añade una entrada a `trace` (lo que el dashboard enseña como "qué consultó la IA").
Funciona igual con alertas del dataset y con alertas NUEVAS (defensa en directo).

CLI:
    python -m soc.enrich.context --sample            # → output/contexts_sample.jsonl
    python -m soc.enrich.context --ids ALR-...,ALR-...
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import logging
import time
from typing import Any

from soc import config
from soc.data.store import DataStore, get_store
from soc.enrich import osint
from soc.enrich.entities import base_domain, entity_keys, is_ip
from soc.timeutil import local_to_utc, shift, window

log = logging.getLogger(__name__)

ACTIVITY_HOURS = 24          # ventana de actividad de entidades (política: ±24 h)
OTHER_ALERTS_DAYS = 7        # ventana para otras alertas de las mismas entidades
ACTIVITY_LIMIT = 20          # eventos máx. por entidad y fuente
OTHER_ALERTS_LIMIT = 40
HUB_EVENTS = 10000           # entidad en más eventos que esto → "hub" (no se vuelca su actividad)
HUB_ALERTS = 300             # o en más alertas que esto

ASSET_FIELDS = ("hostname", "ip", "type", "os", "criticality", "zone", "location", "business_service",
                "owner_upn", "internet_facing", "edr_installed", "description", "vulnerabilities")
USER_FIELDS = ("upn", "username", "display_name", "department", "title", "location", "manager_upn",
               "account_type", "privileged", "vip", "mfa_method", "status", "created", "workstation",
               "notes", "hr_events")


class _Tracer:
    def __init__(self) -> None:
        self.items: list[dict] = []

    def add(self, step: str, query: str, result: str, t0: float, **extra: Any) -> None:
        self.items.append({"step": step, "query": query, "result": result,
                           "ms": round((time.perf_counter() - t0) * 1000, 2), **extra})


def session_destinations(related: list[dict], assets: dict, store) -> list[tuple[dict, str]]:
    """Activos internos de la CMDB a los que llega (sin bloqueo) un evento de la alerta y que aún no están en ella."""
    out, seen = [], set(assets)
    for e in related:
        dst = e.get("dst_ip")
        if not dst or not _is_internal_ip(dst) or str(e.get("action") or "").lower() in BLOCKED_ACTIONS:
            continue
        a = store.asset(dst)
        if a and a.get("hostname") and a["hostname"] not in seen:
            seen.add(a["hostname"])
            out.append((a, e.get("event_id", "?")))
    return out


def _is_internal_ip(v: str) -> bool:
    try:
        ip = ipaddress.ip_address(v)
    except ValueError:
        return False
    # 10/8 y 172.16/12 son la red de Tarvia. 192.0.2/24, 198.18/15 y 203.0.113/24 son rangos de
    # documentación que el dataset usa como IPs EXTERNAS, así que no se consideran internas.
    return ip in ipaddress.ip_network("10.0.0.0/8") or ip in ipaddress.ip_network("172.16.0.0/12")


def _zone_for_ip(ip: str, store: DataStore) -> str | None:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return None
    for z in store.zones():
        try:
            if addr in ipaddress.ip_network(z["cidr"]):
                return z["zona"]
        except ValueError:
            continue
    return None


def _pick(d: dict, fields: tuple) -> dict:
    return {k: d.get(k) for k in fields if k in d}


# Activos implícitos: el objetivo de ciertas alertas no viene en `entities` pero es conocido
# (p. ej. el WAF protege los frontales de la tienda online). Sin esto la matriz de severidad
# trataría como "activo desconocido" a 3.400 alertas de la tienda (activo Crítico).
IMPLIED_BY_PRODUCT = {
    "WAF": ["WEB-ECOM01", "WEB-ECOM02", "WEB-ECOM03", "WEB-ECOM04"],
    "ECOM": ["WEB-ECOM01", "WEB-ECOM02", "WEB-ECOM03", "WEB-ECOM04"],
    "AI_GATEWAY": ["AI-ASSIST01"],
}
SHOP_DOMAINS = ("www.tarvia.example", "api.tarvia.example")
BLOCKED_ACTIONS = ("deny", "drop", "block", "blocked", "reset")   # una conexión bloqueada no llega al destino


def _expand_service_assets(spec: str) -> list[str]:
    """'WEB-ECOM01..04, PAY-GW01, POS-T*' → patrones: nombres exactos o prefijos terminados en '*'."""
    import re

    out = []
    for part in (p.strip() for p in spec.split(",")):
        m = re.fullmatch(r"(.*?)(\d+)\.\.(\d+)", part)
        if m:
            prefix, a, b = m.group(1), m.group(2), m.group(3)
            out += [f"{prefix}{i:0{len(a)}d}" for i in range(int(a), int(b) + 1)]
        elif part:
            out.append(part)
    return out


def business_services_for(names: list[str], store: DataStore) -> list[dict]:
    """Servicios de negocio (servicios_negocio.csv) que incluyen alguno de los activos/recursos dados."""
    names_l = [n.lower() for n in names if n]
    out = []
    for svc in store.services():
        pats = [p.lower() for p in _expand_service_assets(svc.get("activos", ""))]
        hit = [n for n in names_l for p in pats
               if (p.endswith("*") and n.startswith(p[:-1])) or n == p or p == f"s3://{n}"]
        if hit:
            out.append({**svc, "_matched": sorted(set(hit))})
    return out


def _changes_near(ts: str, store: DataStore, days: float = 1) -> list[dict]:
    """Cambios aprobados cuya ventana (hora local → UTC) cae a ±days de la alerta."""
    lo, hi = shift(ts, days=-days), shift(ts, days=days)
    out = []
    for c in store.changes():
        try:
            ini, fin = local_to_utc(c["inicio"]), local_to_utc(c["fin"])
        except (ValueError, KeyError):
            continue
        if ini <= hi and fin >= lo:
            out.append({**c, "inicio_utc": ini, "fin_utc": fin, "active_at_alert": ini <= ts <= fin})
    return out


def build_context(alert: dict, store: DataStore | None = None, *,
                  activity_hours: float = ACTIVITY_HOURS,
                  activity_limit: int = ACTIVITY_LIMIT) -> dict:
    store = store or get_store()
    t_start = time.perf_counter()
    tr = _Tracer()
    ts = alert.get("created_at") or ""
    if not ts:
        log.warning("Alerta %s sin created_at", alert.get("alert_id"))

    # 1 · Entender: entidades
    t0 = time.perf_counter()
    ents = store.entities_of(alert)
    keys = entity_keys(ents)
    tr.add("entities", alert.get("alert_id", "?"),
           f"{sum(len(v) for v in ents.values())} entidades", t0, source="alerta")

    # Estadísticas de rareza de cada entidad + detección de hubs
    entity_stats: dict[str, dict] = {}
    hubs: set[str] = set()
    for k in sorted(keys):
        n_ev = store.entity_count(k)
        n_al = len(store.alerts_for_entity(k))
        ts_list = store._ent_ts.get(k) or []
        hub = n_ev > HUB_EVENTS or n_al > HUB_ALERTS
        entity_stats[k] = {"events_total": n_ev, "alerts_total": n_al, "hub": hub,
                           "first_seen": ts_list[0] if ts_list else None,
                           "last_seen": ts_list[-1] if ts_list else None}
        if hub:
            hubs.add(k)

    # 2 · Contexto: CMDB
    assets: dict[str, dict] = {}
    for h in ents.get("hosts", []) + [ip for ip in ents.get("ips", []) if _is_internal_ip(ip)]:
        t0 = time.perf_counter()
        a = store.asset(h)
        if a:
            assets.setdefault(a["hostname"], _pick(a, ASSET_FIELDS))
            tr.add("cmdb", h, f"{a['hostname']} · criticidad {a['criticality']} · {a['zone']}", t0, source="CMDB")
        else:
            zone = _zone_for_ip(h, store) if is_ip(h) else None
            tr.add("cmdb", h, "no está en la CMDB" + (f" (zona {zone})" if zone else ""), t0, source="CMDB")

    # Activos implícitos (objetivo conocido aunque no venga en la alerta)
    implied = list(IMPLIED_BY_PRODUCT.get(alert.get("source_product", ""), []))
    if any(d in SHOP_DOMAINS for d in ents.get("domains", [])):
        implied += IMPLIED_BY_PRODUCT["WAF"]
    for h in dict.fromkeys(implied):
        if h in assets:
            continue
        t0 = time.perf_counter()
        a = store.asset(h)
        if a:
            assets[a["hostname"]] = {**_pick(a, ASSET_FIELDS), "_via": f"implícito ({alert.get('source_product')})"}
            tr.add("cmdb", h, f"objetivo implícito · criticidad {a['criticality']} · {a['business_service']}",
                   t0, source="CMDB")

    # Servicios de negocio afectados (activos + buckets cloud)
    t0 = time.perf_counter()
    services = business_services_for(list(assets) + ents.get("cloud", []), store)
    if services:
        tr.add("services", ", ".join(list(assets)[:4] + ents.get("cloud", [])[:2]),
               "; ".join(f"{s['servicio']} ({s['criticidad']})" for s in services), t0, source="Servicios")

    # 2 · Contexto: directorio + RRHH (usuarios de la alerta + propietarios de los activos)
    users: dict[str, dict] = {}
    for u, via in [(u, "alert") for u in ents.get("users", [])] + \
                  [(a.get("owner_upn"), "asset_owner") for a in assets.values() if a.get("owner_upn")]:
        if not u or u in users:
            continue
        t0 = time.perf_counter()
        rec = store.user(u)
        if rec:
            users[rec["upn"].lower()] = {**_pick(rec, USER_FIELDS), "_via": via}
            flags = [f for f in ("privileged", "vip") if str(rec.get(f)) == "True"]
            hr = f" · {len(rec['hr_events'])} eventos RRHH" if rec.get("hr_events") else ""
            tr.add("directory", u, f"{rec['title']} ({rec['department']}){' · ' + ','.join(flags) if flags else ''}{hr}",
                   t0, source="Directorio")
        elif via == "alert":
            tr.add("directory", u, "no está en el directorio (¿externo?)", t0, source="Directorio")

    # 3 · Eventos relacionados de la alerta
    related, missing = [], []
    t0 = time.perf_counter()
    for eid in alert.get("related_events") or []:
        e = store.event(eid)
        (related.append(e) if e else missing.append(eid))
    tr.add("related_events", f"{len(alert.get('related_events') or [])} ids",
           f"{len(related)} encontrados" + (f", {len(missing)} NO encontrados" if missing else ""), t0, source="Logs")
    related_ids = {e["event_id"] for e in related}

    # Destino de la sesión: el activo interno al que llegan los eventos de la propia alerta también está afectado
    # (VPN de Logisoft → RDP a WMS01). Entra en la matriz igual que los activos de la alerta: lo decide el código.
    t0 = time.perf_counter()
    new_assets = session_destinations(related, assets, store)
    for a, eid in new_assets:
        assets[a["hostname"]] = {**_pick(a, ASSET_FIELDS), "_via": f"destino de la sesión ({eid})"}
        tr.add("cmdb", a["hostname"], f"destino de la sesión ({eid}) · criticidad {a['criticality']} · {a['zone']}",
               t0, source="CMDB")
    if new_assets:
        known = {s_["servicio"] for s_ in services}
        services += [s_ for s_ in business_services_for([a["hostname"] for a, _ in new_assets], store)
                     if s_["servicio"] not in known]

    # 4 · Correlar: actividad de cada entidad ±24 h (sin hubs)
    activity: dict[str, dict[str, list[dict]]] = {}
    seen_events = set(related_ids)  # cada evento aparece UNA sola vez en el contexto
    if ts:
        st, en = window(ts, activity_hours)
        # Primero las entidades más raras (más informativas); los hosts/IPs genéricos al final
        for k in sorted(keys - hubs, key=lambda k: (entity_stats[k]["events_total"], k)):
            t0 = time.perf_counter()
            res = store.search(k, st, en, limit_per_source=activity_limit, around=ts)
            res = {src: [e for e in evs if e["event_id"] not in seen_events] for src, evs in res.items()}
            for evs in res.values():
                seen_events.update(e["event_id"] for e in evs)
            res = {src: evs for src, evs in res.items() if evs}
            if res:
                activity[k] = res
            n = sum(len(v) for v in res.values())
            tr.add("logs", f"{k} ±{activity_hours:g}h",
                   f"{n} eventos" + (f" en {', '.join(sorted(res))}" if res else ""), t0, source="Logs")
        for k in sorted(hubs):
            tr.add("logs", k, f"entidad muy frecuente ({entity_stats[k]['events_total']} eventos): "
                              "no se vuelca su actividad", time.perf_counter(), source="Logs")

    # 3 · Enriquecer: TIP + GeoIP + sandbox
    intel = []
    indicators = [(ip, "ip") for ip in ents.get("ips", []) if not _is_internal_ip(ip)] + \
                 [(d, "domain") for d in ents.get("domains", [])] + \
                 [(h, "sha256") for h in ents.get("hashes", [])] + \
                 [(u, "url") for u in ents.get("urls", [])] + \
                 [(e, "email") for e in ents.get("emails", [])]
    seen_ind = set()
    for ind, typ in indicators:
        if ind in seen_ind:
            continue
        seen_ind.add(ind)
        t0 = time.perf_counter()
        r = store.intel(ind)
        if typ == "domain" and not r["tip"] and base_domain(ind) != ind:
            parent = store.intel(base_domain(ind))
            if parent["tip"]:
                r["tip"] = {**parent["tip"], "_matched_on": base_domain(ind)}
        tip, geo = r["tip"], r["geo"]
        parts = []
        if tip:
            parts.append(f"TIP: {tip.get('reputation')} ({tip.get('confidence')}) {tip.get('malware_family') or ''}".strip())
        if geo:
            flags = [n for n in ("is_tor", "is_vpn_provider", "is_hosting", "is_residential_proxy")
                     if str(geo.get(n)) == "True"]
            parts.append(f"GeoIP: {geo.get('country')} {geo.get('as_org')}" + (f" [{','.join(flags)}]" if flags else ""))
        intel.append({"indicator": ind, "type": typ, "tip": tip, "geo": geo})
        tr.add("intel", ind, " · ".join(parts) or "sin datos en TIP/GeoIP (desconocido ≠ limpio)", t0,
               source="TIP/GeoIP")

    # 3b · OSINT externo (opcional, OSINT_ENABLED=1): solo reputación, con presupuesto por alerta
    if osint.enabled():
        queryable = [i for i in intel if osint.is_queryable(i["indicator"], i["type"])]
        # primero lo que el TIP interno no conoce: ahí es donde el OSINT aporta
        queryable.sort(key=lambda i: i["tip"] is not None)
        for i in queryable[:osint.max_per_alert()]:
            t0 = time.perf_counter()
            res = osint.lookup(i["indicator"], i["type"])
            i["osint"] = res
            tr.add("osint", i["indicator"], osint.describe(res), t0, source="OSINT")
        if len(queryable) > osint.max_per_alert():
            tr.add("osint", f"{len(queryable) - osint.max_per_alert()} indicadores más",
                   "no consultados (presupuesto por alerta)", time.perf_counter(), source="OSINT")

    sandbox = []
    for h in ents.get("hashes", []):
        t0 = time.perf_counter()
        r = store.sandbox(h)
        if r:
            sandbox.append(r)
        tr.add("sandbox", h[:16] + "…", f"{r['verdict']} ({r.get('malware_family') or '-'})" if r else
               "sin informe de sandbox", t0, source="Sandbox")

    # 4 · Correlar: otras alertas de las mismas entidades (±7 días), sin hubs
    other: dict[str, dict] = {}
    if ts:
        st, en = shift(ts, days=-OTHER_ALERTS_DAYS), shift(ts, days=OTHER_ALERTS_DAYS)
        t0 = time.perf_counter()
        for k in sorted(keys - hubs):
            for aid in store.alerts_for_entity(k, st, en):
                if aid == alert.get("alert_id"):
                    continue
                o = other.get(aid)
                if o:
                    o["shared_entities"].append(k)
                    continue
                oa = store.alert(aid)
                other[aid] = {"alert_id": aid, "rule_id": oa.get("rule_id"), "rule_name": oa.get("rule_name"),
                              "severity": oa.get("severity"), "created_at": oa.get("created_at"),
                              "shared_entities": [k]}
        tr.add("alerts", f"mismas entidades ±{OTHER_ALERTS_DAYS}d", f"{len(other)} alertas relacionadas", t0,
               source="SIEM")
    other_list = sorted(other.values(), key=lambda o: (-len(o["shared_entities"]), o["created_at"] or ""))
    other_list = other_list[:OTHER_ALERTS_LIMIT]
    other_list.sort(key=lambda o: o["created_at"] or "")

    # 2 · Contexto: cambios aprobados cercanos
    t0 = time.perf_counter()
    changes = _changes_near(ts, store) if ts else []
    tr.add("changes", "calendario ±1d", f"{len(changes)} cambios" +
           (": " + ", ".join(c["id"] for c in changes) if changes else ""), t0, source="Cambios")

    ctx = {
        "alert": alert,
        "entities": ents,
        "entity_stats": entity_stats,
        "assets": list(assets.values()),
        "business_services": services,
        "users": list(users.values()),
        "related_events": related,
        "missing_related_events": missing,
        "entity_activity": activity,
        "intel": intel,
        "sandbox": sandbox,
        "other_alerts": other_list,
        "other_alerts_total": len(other),
        "changes": changes,
        "policy_hits": [],
        "severity": None,
        "trace": tr.items,
        "build_ms": 0.0,
    }

    # 3 · Política (A4). Opcional hasta que exista el módulo.
    try:
        from soc.policy import evaluate_policy  # type: ignore
    except ImportError:
        evaluate_policy = None
    if evaluate_policy:
        t0 = time.perf_counter()
        hits, sev = evaluate_policy(ctx, store)
        ctx["policy_hits"], ctx["severity"] = hits, sev
        tr.add("policy", "política SOC + reglas Tarvia",
               f"{len(hits)} reglas aplicadas · severidad {sev.get('final') if sev else '?'}", t0, source="Política")

    ctx["build_ms"] = round((time.perf_counter() - t_start) * 1000, 1)
    return ctx


# ---------------------------------------------------------------------- CLI
def main() -> None:
    ap = argparse.ArgumentParser(description="Genera contextos de triaje")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--sample", action="store_true", help="las 150 alertas de desarrollo")
    g.add_argument("--ids", help="alert_ids separados por comas")
    ap.add_argument("--out", help="fichero JSONL de salida")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

    store = get_store()
    alerts = store.alerts(sample=True) if args.sample else [store.alert(i.strip()) for i in args.ids.split(",")]
    out = args.out or str(config.OUTPUT_DIR / ("contexts_sample.jsonl" if args.sample else "contexts.jsonl"))
    config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    times = []
    with open(out, "w", encoding="utf-8") as f:
        for a in alerts:
            if a is None:
                continue
            ctx = build_context(a, store)
            times.append(ctx["build_ms"])
            f.write(json.dumps(ctx, ensure_ascii=False, default=str) + "\n")
    times.sort()
    print(f"{len(times)} contextos → {out}")
    if times:
        print(f"ms por alerta: p50 {times[len(times) // 2]:.0f} · p95 {times[int(len(times) * .95)]:.0f} · max {times[-1]:.0f}")


if __name__ == "__main__":
    main()
