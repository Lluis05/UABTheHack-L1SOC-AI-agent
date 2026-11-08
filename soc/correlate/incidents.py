"""Correlación de alertas en incidentes (Persona D · nivel 2).

Dos alertas pertenecen al mismo incidente si comparten una entidad y están lo bastante cerca en el tiempo:
  - vínculo FUERTE (IP externa, dominio, hash, message_id, sesión, cliente, cuenta cloud): hasta `window_days`;
  - vínculo DÉBIL (usuario, puesto o IP interna): solo hasta `weak_window_days`, porque el mismo empleado tiene
    alertas de ruido sin relación a lo largo del mes (medido: con ventana larga salían ~340 incidentes falsos). Las entidades "hub" (las que aparecen en muchas
alertas del dataset, o las de infraestructura conocida: proxy, DCs, NESSUS01, IPs del pentest, la web pública...)
NO unen, porque lo fusionarían todo. Los componentes conexos con ≥ 2 alertas son incidentes.

    from soc.correlate.incidents import correlate, attach
    incidents = correlate(alerts, store, tickets=tickets)       # -> [Incident] (contrato docs/04)
    inc_id = attach(alert, incidents, store)                     # en vivo: ¿a qué incidente se une?

CLI:
    python -m soc.correlate.incidents                       # candidatas = no cerradas en output/tickets_all_nollm.jsonl
    python -m soc.correlate.incidents --truth               # y compara con eval/incidents_truth.jsonl
"""

from __future__ import annotations

import argparse
import collections
import json
import sys
from pathlib import Path
from typing import Iterable

from soc import config
from soc.enrich.entities import entity_keys
from soc.timeutil import parse

WINDOW_DAYS = 10            # una intrusión puede tener días de pausa (INC-01: del 10/10 al 18/10)
WEAK_WINDOW_DAYS = 2        # usuario/puesto/IP interna: solo une alertas cercanas
HUB_MAX_ALERTS = 40         # una entidad presente en más alertas del dataset no une (es infraestructura o ruido)
MIN_ALERTS = 2
# Infraestructura conocida de Tarvia que aparece en todas partes (docs/03 y CMDB)
HUB_STATIC = {
    "198.18.200.10",                                    # IP de salida corporativa
    "www.tarvia.example", "tarvia.example",             # la tienda y el dominio propio
    "nessus01", "10.20.6.62",                           # escáner de vulnerabilidades
    "dc01", "dc02", "10.20.1.10", "10.20.1.11",         # controladores de dominio
    "192.0.2.10", "192.0.2.11", "192.0.2.12",           # pentest contratado
    "jump01", "10.20.6.61",                             # bastión: todo lo de adm.* pasa por aquí
}
# Servicios legítimos de reputación por DNS: sus consultas parecen un túnel DNS (UC-NET-006) pero son de antivirus
# y antispam. Dominios de 10+ años consultados por decenas de equipos (medido en el dataset).
BENIGN_DNS_SERVICES = {"e5.sk", "mcafee.com", "spamhaus.org", "sophosxl.net"}
OWN_WEB = ("https://www.tarvia.example", "http://www.tarvia.example")
# Un grupo de alertas solo se convierte en incidente si tiene algo que lo distinga del ruido (medido con la verdad
# de D1: sin este filtro salían ~136 parejas de ruido del mismo puesto, p. ej. DLP-001 + NET-001 el mismo día)
RARE_RULE_MAX = 15          # reglas con ≤ 15 alertas en todo el dataset (LSASS, BEC, AnyDesk, IAM admin...)
STRONG_MIN_ALERTS = 3       # o ≥ 3 alertas unidas por un vínculo fuerte (IOC externo repetido)
SEV_ORDER = ["informational", "low", "medium", "high", "critical"]
# Orden de la cadena de ataque (MITRE ATT&CK) para ordenar tácticas empatadas en tiempo
TACTICS = ["Reconnaissance", "Resource Development", "Initial Access", "Execution", "Persistence",
           "Privilege Escalation", "Defense Evasion", "Credential Access", "Discovery", "Lateral Movement",
           "Collection", "Command and Control", "Exfiltration", "Impact"]
CLOSED_VERDICTS = {"false_positive", "benign_true_positive"}
# Vínculo por tienda (derived_keys): solo en la zona de tiendas, donde una sede tiene pocos equipos. Va con la ventana
# larga porque en T07 pasan 8 días entre el AnyDesk del portátil (12/10) y el RAM scraping de los TPV (20/10).
STORE_ZONE = "STORES"
SITE_PREFIX = "sede:"


# ----------------------------------------------------------------------------- utilidades
class _UnionFind:
    def __init__(self) -> None:
        self.parent: dict[str, str] = {}

    def find(self, x: str) -> str:
        self.parent.setdefault(x, x)
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[max(ra, rb)] = min(ra, rb)


def alert_keys(alert: dict, store) -> set[str]:
    keys = {k.lower() for k in entity_keys(store.entities_of(alert))}
    # El dominio del message_id une los reportes de una campaña con los clics (aunque la URL sea de otro dominio)
    for mid in store.entities_of(alert).get("message_ids") or []:
        if "@" in mid:
            keys.add(mid.rsplit("@", 1)[1].strip("<> ").lower())
    return keys | derived_keys(alert, store)


def derived_keys(alert: dict, store) -> set[str]:
    """Claves que no vienen en la alerta pero sí en los datos, para unir fases que no comparten ninguna entidad.

    - Destino de la sesión: el equipo interno al que llegan los eventos de la alerta. Una VPN robada que hace RDP a
      WMS01 (FW-0026536) queda unida al túnel DNS que sale después desde WMS01 (INC-07, Logisoft).
    - Tienda: los activos de una tienda comparten sede en la CMDB. El AnyDesk de un portátil queda unido al RAM
      scraping de los TPV de la misma tienda días después (INC-11, T07).
    """
    keys = set()
    for event_id in alert.get("related_events") or []:
        dst = (store.event(event_id) or {}).get("dst_ip")
        asset = store.asset(dst) if dst and is_weak(dst) else None     # solo destinos internos de la CMDB
        if asset and asset.get("hostname"):
            keys.add(asset["hostname"].lower())
    for host in store.entities_of(alert).get("hosts") or []:
        asset = store.asset(host) or {}
        if asset.get("zone") == STORE_ZONE and asset.get("location"):
            keys.add(SITE_PREFIX + asset["location"].lower())
    return keys


def is_site(key: str) -> bool:
    return key.startswith(SITE_PREFIX)


def is_weak(key: str) -> bool:
    """Entidades internas (usuario, puesto, IP interna): unen poco, porque todo el ruido de un empleado las comparte."""
    if key.endswith("@tarvia.example"):
        return True
    if key.startswith("10.") or key.startswith("172.16."):
        return True
    return "." not in key and "-" in key and not key.startswith("ai-") and not key.startswith("s-")  # hostnames


def is_hub(key: str, store, max_alerts: int = HUB_MAX_ALERTS) -> bool:
    if key in HUB_STATIC or key.startswith(OWN_WEB):        # URLs de nuestra web: las comparten miles de escáneres
        return True
    if any(key == d or key.endswith("." + d) for d in BENIGN_DNS_SERVICES):
        return True
    return len(store.alerts_for_entity(key)) > max_alerts


def bump(sev: str, n: int = 1) -> str:
    i = SEV_ORDER.index(sev) if sev in SEV_ORDER else 2
    return SEV_ORDER[max(0, min(len(SEV_ORDER) - 1, i + n))]


def candidate_alerts(store, tickets: Iterable[dict]) -> list[dict]:
    """Alertas que el triaje NO ha cerrado como benignas/FP (las que pueden formar parte de un ataque)."""
    open_ids = {aid for t in tickets if t.get("verdict") not in CLOSED_VERDICTS for aid in t.get("alert_ids") or []}
    return [a for a in (store.alert(i) for i in open_ids) if a]


# ----------------------------------------------------------------------------- correlación
def correlate(alerts: Iterable[dict], store, *, tickets: Iterable[dict] = (), window_days: float = WINDOW_DAYS,
              weak_window_days: float = WEAK_WINDOW_DAYS, hub_max_alerts: int = HUB_MAX_ALERTS,
              min_alerts: int = MIN_ALERTS) -> list[dict]:
    """Agrupa alertas en incidentes. Devuelve la lista de Incident (docs/04), del más grave al menos grave."""
    alerts = {a["alert_id"]: a for a in alerts}
    ticket_of = {aid: t for t in tickets for aid in t.get("alert_ids") or []}
    window_s = window_days * 86400
    keys_of = {aid: alert_keys(a, store) for aid, a in alerts.items()}
    hub_cache: dict[str, bool] = {}

    def hub(k: str) -> bool:
        if k not in hub_cache:
            hub_cache[k] = is_hub(k, store, hub_max_alerts)
        return hub_cache[k]

    by_key: dict[str, list[tuple[float, str]]] = collections.defaultdict(list)
    for aid, keys in keys_of.items():
        ts = parse(alerts[aid]["created_at"]).timestamp()
        for k in keys:
            if not hub(k):
                by_key[k].append((ts, aid))

    uf = _UnionFind()
    links: dict[str, set[str]] = collections.defaultdict(set)   # entidad que une → para explicar el incidente
    weak_s = weak_window_days * 86400
    for k, lst in by_key.items():
        lst.sort()
        limit = weak_s if is_weak(k) else window_s
        for (t1, a1), (t2, a2) in zip(lst, lst[1:]):
            if t2 - t1 <= limit:
                uf.union(a1, a2)
                links[k].update((a1, a2))

    groups: dict[str, list[str]] = collections.defaultdict(list)
    for aid in alerts:
        groups[uf.find(aid)].append(aid)

    rule_count = collections.Counter(a["rule_id"] for a in store.alerts())
    incidents = []
    for members in groups.values():
        if len(members) < min_alerts:
            continue
        inc = _build_incident(members, alerts, ticket_of, keys_of, links, hub)
        if _is_significant(inc, alerts, ticket_of, rule_count):
            incidents.append(inc)
    incidents.sort(key=lambda i: (-SEV_ORDER.index(i["severity"]), i["first_seen"]))
    for n, inc in enumerate(incidents, 1):
        inc["incident_id"] = f"INC-{n:04d}"
    return incidents


def _is_significant(inc: dict, alerts: dict, ticket_of: dict, rule_count: collections.Counter) -> bool:
    why = []
    rare = sorted({alerts[a]["rule_id"] for a in inc["alert_ids"] if rule_count[alerts[a]["rule_id"]] <= RARE_RULE_MAX})
    if rare:
        why.append("regla poco frecuente: " + ", ".join(rare))
    # Compartir tienda une fases, pero no hace sospechoso un grupo por sí solo: no cuenta como IOC repetido
    strong = [k for k in inc["linking_entities"] if not is_weak(k) and not is_site(k)]
    if strong and len(inc["alert_ids"]) >= STRONG_MIN_ALERTS:
        why.append("IOC externo repetido: " + ", ".join(strong[:3]))
    tp_high = [a for a in inc["alert_ids"] if (t := ticket_of.get(a)) and t.get("verdict") == "true_positive"
               and t.get("severity") in ("high", "critical")]
    if tp_high:
        why.append(f"{len(tp_high)} alerta(s) true_positive high/critical")
    inc["x_why"] = why
    return bool(why)


def _build_incident(members: list[str], alerts: dict, ticket_of: dict, keys_of: dict, links: dict, hub) -> dict:
    al = sorted((alerts[m] for m in members), key=lambda a: a["created_at"])
    sevs = [(ticket_of.get(a["alert_id"]) or {}).get("severity") or a.get("severity") or "medium" for a in al]
    tactics = [(a.get("mitre") or {}).get("tactic") for a in al]
    distinct_tactics = {t for t in tactics if t}
    base = max(sevs, key=lambda s: SEV_ORDER.index(s) if s in SEV_ORDER else 2)
    # Política §5: si las alertas forman una cadena (≥ 2 fases distintas) el incidente sube un nivel
    chain = len(distinct_tactics) >= 2
    severity = bump(base) if chain else base

    kill_chain = [{"time": a["created_at"], "tactic": t, "alert_id": a["alert_id"], "rule_id": a["rule_id"],
                   "what": a["rule_name"]} for a, t in zip(al, tactics)]
    ents: dict[str, set[str]] = collections.defaultdict(set)
    for a in al:
        for k, vals in a.get("entities", {}).items():
            for v in vals if isinstance(vals, list) else [vals]:
                if isinstance(v, dict):
                    v = v.get("upn") or v.get("hostname") or v.get("customer_id") or v.get("name")
                if v and isinstance(v, str):
                    ents[k].add(v)
    member_set = set(members)
    linking = sorted(k for k, s in links.items() if len(s & member_set) >= 2)
    rules = collections.Counter(a["rule_id"] for a in al)
    summary = (f"{len(al)} alertas entre {al[0]['created_at'][:16]} y {al[-1]['created_at'][:16]} "
               f"({', '.join(f'{r}×{n}' if n > 1 else r for r, n in rules.most_common())}). "
               f"Unidas por: {', '.join(linking[:6])}. "
               + (f"Cadena de {len(distinct_tactics)} fases ({' → '.join(t for t in TACTICS if t in distinct_tactics)}): "
                  f"severidad {base} +1." if chain else f"Severidad máxima de sus alertas: {base}."))
    return {"incident_id": None, "alert_ids": [a["alert_id"] for a in al],
            "ticket_ids": sorted({t["ticket_id"] for a in al if (t := ticket_of.get(a["alert_id"]))}),
            "entities": {k: sorted(v) for k, v in ents.items()}, "linking_entities": linking,
            "first_seen": al[0]["created_at"], "last_seen": al[-1]["created_at"],
            "kill_chain": kill_chain, "summary": summary, "severity": severity,
            "x_chain": chain, "x_tactics": [t for t in TACTICS if t in distinct_tactics]}


def attach(alert: dict, incidents: list[dict], store, *, window_days: float = WINDOW_DAYS,
           hub_max_alerts: int = HUB_MAX_ALERTS) -> str | None:
    """En vivo: incidente existente al que se une una alerta nueva (comparte entidad no-hub dentro de la ventana)."""
    keys = {k for k in alert_keys(alert, store) if not is_hub(k, store, hub_max_alerts)}
    if not keys:
        return None
    ts = parse(alert.get("created_at") or "").timestamp() if alert.get("created_at") else None
    best = None
    for inc in incidents:
        inc_keys = {k.lower() for k in inc.get("linking_entities") or []}
        inc_keys |= {v.lower() for vals in (inc.get("entities") or {}).values() for v in vals}
        if not keys & inc_keys:
            continue
        if ts is not None:
            lo = parse(inc["first_seen"]).timestamp() - window_days * 86400
            hi = parse(inc["last_seen"]).timestamp() + window_days * 86400
            if not lo <= ts <= hi:
                continue
        if best is None or SEV_ORDER.index(inc["severity"]) > SEV_ORDER.index(best["severity"]):
            best = inc
    return best["incident_id"] if best else None


# ----------------------------------------------------------------------------- evaluación contra la verdad
def match_truth(incidents: list[dict], truth: list[dict]) -> dict:
    """Para cada incidente de la verdad, el incidente encontrado que más alertas comparte."""
    rows, used = [], set()
    for t in truth:
        tset = set(t["alert_ids"])
        best, inter = None, 0
        for inc in incidents:
            n = len(tset & set(inc["alert_ids"]))
            if n > inter:
                best, inter = inc, n
        if best:
            used.add(best["incident_id"])
        found = inter >= max(2, (len(tset) + 1) // 2)        # al menos la mitad de sus alertas en un incidente
        rows.append({"truth": t["incident_id"], "title": t["title"], "n_truth": len(tset),
                     "found": found, "matched": best["incident_id"] if best else None, "shared": inter,
                     "missing": sorted(tset - set(best["alert_ids"])) if best else sorted(tset),
                     "extra": sorted(set(best["alert_ids"]) - tset) if best else []})
    truth_ids = {a for t in truth for a in t["alert_ids"]}
    spurious = [i for i in incidents if i["incident_id"] not in used and not set(i["alert_ids"]) & truth_ids]
    return {"found": sum(r["found"] for r in rows), "total": len(rows), "rows": rows,
            "n_incidents": len(incidents), "spurious": len(spurious),
            "spurious_examples": [{"incident_id": i["incident_id"], "n": len(i["alert_ids"]),
                                   "summary": i["summary"][:160]} for i in spurious[:10]]}


def _read_jsonl(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def main() -> None:
    from soc.data.store import get_store

    ap = argparse.ArgumentParser(description="Correlación de alertas en incidentes (nivel 2)")
    ap.add_argument("--tickets", default=str(config.OUTPUT_DIR / "tickets_all_nollm.jsonl"),
                    help="tickets del triaje: se correlan las alertas NO cerradas (por defecto, el batch sin IA)")
    ap.add_argument("--window-days", type=float, default=WINDOW_DAYS)
    ap.add_argument("--hub-max-alerts", type=int, default=HUB_MAX_ALERTS)
    ap.add_argument("--truth", action="store_true", help="comparar con eval/incidents_truth.jsonl")
    ap.add_argument("--out", default=str(config.OUTPUT_DIR / "incidents.jsonl"))
    args = ap.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    store = get_store()
    tickets = _read_jsonl(Path(args.tickets))
    cands = candidate_alerts(store, tickets)
    incidents = correlate(cands, store, tickets=tickets, window_days=args.window_days,
                          hub_max_alerts=args.hub_max_alerts)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        for i in incidents:
            f.write(json.dumps(i, ensure_ascii=False) + "\n")
    print(f"{len(tickets)} tickets · {len(cands)} alertas no cerradas · {len(incidents)} incidentes → {args.out}")
    for i in incidents[:25]:
        print(f"  {i['incident_id']} {i['severity']:<8} {len(i['alert_ids']):>3} alertas  {i['summary'][:150]}")

    if args.truth:
        truth = _read_jsonl(Path(__file__).resolve().parents[2] / "eval" / "incidents_truth.jsonl")
        m = match_truth(incidents, truth)
        print(f"\nIncidentes reales encontrados: {m['found']}/{m['total']} · incidentes sin relación con la verdad: "
              f"{m['spurious']} de {m['n_incidents']}")
        for r in m["rows"]:
            print(f"  {'✔' if r['found'] else '✘'} {r['truth']} → {r['matched']}  {r['shared']}/{r['n_truth']} alertas"
                  f"  (+{len(r['extra'])} de más)  {r['title'][:70]}")
        for s in m["spurious_examples"]:
            print(f"    · espurio {s['incident_id']} ({s['n']}): {s['summary']}")


if __name__ == "__main__":
    main()
