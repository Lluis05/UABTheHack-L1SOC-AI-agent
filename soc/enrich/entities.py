"""Normalización de entidades e IOCs.

Dos usos:
  - extract_entities(alert, store): entidades de una alerta (de `entities` + texto de `evidence`).
  - event_keys(event, store): claves por las que se indexa un evento de log (índice invertido).

Todas las claves están canonizadas con canon():
  - minúsculas, sin espacios;
  - usuarios: 'TARVIA\\pepe' / 'pepe' / 'pepe@tarvia.example' → UPN si existe en el directorio;
  - dominios: se indexa el dominio completo y su dominio base (últimas 2 etiquetas).

NOTA: el texto de `evidence` puede venir del atacante. Aquí solo se extraen indicadores con
regex; nunca se interpreta ni se ejecuta.
"""

from __future__ import annotations

import ipaddress
import json
import re
from typing import TYPE_CHECKING, Any, Iterable
from urllib.parse import urlparse

if TYPE_CHECKING:
    from soc.data.store import DataStore

ENTITY_TYPES = ("users", "hosts", "ips", "domains", "urls", "hashes", "emails",
                "customers", "cloud", "sessions", "message_ids", "processes")

RE_IPV4 = re.compile(r"\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b")
RE_SHA256 = re.compile(r"\b[a-fA-F0-9]{64}\b")
RE_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
RE_URL = re.compile(r"\bhttps?://[^\s\"'<>]+", re.I)
RE_TOKEN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._\\-]{2,}")
RE_MSGID = re.compile(r"<[^<>\s]+@[^<>\s]+>")

# Claves de evidence cuyo valor es un dominio o contiene uno
DOMAIN_EVIDENCE_KEYS = {"domain", "parent_domain", "query", "destination", "new_email_domain",
                        "legit_supplier_domain", "registry"}

# Valores demasiado genéricos para indexar o correlacionar
JUNK = {"", "-", "none", "null", "n/a", "system", "nt authority\\system", "local service",
        "network service", "unknown", "desconocido"}


# --------------------------------------------------------------------------- helpers
def base_domain(d: str) -> str:
    parts = d.strip(".").split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else d


def domain_of(url: str) -> str | None:
    try:
        host = urlparse(url if "://" in url else "http://" + url).hostname
    except ValueError:
        return None
    return host.lower() if host else None


def is_ip(v: str) -> bool:
    try:
        ipaddress.ip_address(v)
        return True
    except ValueError:
        return False


def canon_user(v: str, store: "DataStore | None") -> str:
    """Usuario canónico: UPN si el directorio lo conoce; si no, el valor en minúsculas."""
    k = v.strip().lower()
    if "\\" in k:
        k = k.rsplit("\\", 1)[1]
    if store is not None:
        u = store.user(k)
        if u:
            return u["upn"].lower()
    return k


def canon(value: Any, store: "DataStore | None" = None) -> str:
    """Forma canónica de cualquier valor de entidad (para buscar en el índice)."""
    v = str(value).strip()
    if not v:
        return ""
    low = v.lower()
    if is_ip(v) or RE_SHA256.fullmatch(v):
        return low
    if low.startswith(("http://", "https://")):
        return low
    if store is not None and ("\\" in v or "@" in v or "." in v or "_" in v):
        cu = canon_user(v, store)
        if store.user(cu):
            return cu
    if store is not None:
        a = store.asset(v)
        if a:
            return a["hostname"].lower()
    return low


def _strings(obj: Any) -> Iterable[str]:
    """Todos los strings (y números como string) dentro de una estructura anidada."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from _strings(v)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            yield from _strings(v)
    elif isinstance(obj, (str, int, float)) and not isinstance(obj, bool):
        yield str(obj)


# ------------------------------------------------------------------- alertas
def extract_entities(alert: dict, store: "DataStore | None" = None) -> dict[str, list[str]]:
    """Entidades normalizadas de una alerta. Robusto ante alertas nuevas o mal formadas."""
    out: dict[str, set[str]] = {t: set() for t in ENTITY_TYPES}
    ents = alert.get("entities") or {}
    if not isinstance(ents, dict):
        ents = {}

    def add_user(v: Any) -> None:
        if isinstance(v, str) and v.strip().lower() not in JUNK and not v.strip().startswith("("):
            out["users"].add(canon_user(v, store))

    def add_domain(v: Any) -> None:
        if not isinstance(v, str) or not v.strip():
            return
        d = domain_of(v) if ("/" in v or ":" in v) else v.strip().lower().strip(".")
        if d and "." in d and not is_ip(d):
            out["domains"].add(d)

    def add_host(h: Any) -> None:
        if isinstance(h, str) and h.strip():
            a = store.asset(h) if store else None
            out["hosts"].add((a["hostname"] if a else h.strip()).lower())

    for u in _as_list(ents.get("users")):
        add_user(u.get("upn") if isinstance(u, dict) else u)
    for h in _as_list(ents.get("hosts")):
        if isinstance(h, dict):
            add_host(h.get("hostname"))
            if h.get("ip"):
                out["ips"].add(str(h["ip"]).strip())
        else:
            add_host(h)
    for ip in _as_list(ents.get("ips")):
        if isinstance(ip, str) and is_ip(ip.strip()):
            out["ips"].add(ip.strip())
    for d in _as_list(ents.get("domains")):
        add_domain(d)
    for u in _as_list(ents.get("urls")):
        if isinstance(u, str):
            out["urls"].add(u.strip())
            add_domain(u)
    for f in _as_list(ents.get("files")):
        if isinstance(f, dict) and f.get("sha256"):
            out["hashes"].add(str(f["sha256"]).lower())
    for c in _as_list(ents.get("customers")):
        cid = c.get("customer_id") if isinstance(c, dict) else c
        if cid:
            out["customers"].add(str(cid).lower())
    for c in _as_list(ents.get("cloud")):
        if isinstance(c, dict):
            for k in ("identity", "bucket", "access_key", "new_user", "account"):
                if c.get(k):
                    out["cloud"].add(str(c[k]).lower())
    for s in _as_list(ents.get("ai_session")):
        if s:
            out["sessions"].add(str(s).lower())
    for p in _as_list(ents.get("processes")):
        if isinstance(p, dict) and p.get("name"):
            out["processes"].add(str(p["name"]).lower())

    # ---- evidence (texto libre): IOCs por regex + tokens que son usuarios/hosts conocidos
    ev = alert.get("evidence") or {}
    if isinstance(ev, dict):
        for k in DOMAIN_EVIDENCE_KEYS:
            if isinstance(ev.get(k), str):
                add_domain(ev[k])
    for s in _strings(ev):
        for ip in RE_IPV4.findall(s):
            out["ips"].add(ip)
        for h in RE_SHA256.findall(s):
            out["hashes"].add(h.lower())
        for m in RE_MSGID.findall(s):
            out["message_ids"].add(m.lower())
        for url in RE_URL.findall(s):
            out["urls"].add(url)
            add_domain(url)
        for em in RE_EMAIL.findall(RE_MSGID.sub(" ", s)):
            cu = canon_user(em, store)
            if store is not None and store.user(cu):
                out["users"].add(cu)
            else:
                out["emails"].add(em.lower())
                add_domain(em.split("@", 1)[1])
        if store is not None:
            for tok in RE_TOKEN.findall(s):
                if store.asset(tok):
                    add_host(tok)
                elif ("." in tok or "_" in tok or "\\" in tok) and store.user(tok):
                    add_user(tok)

    return {k: sorted(v) for k, v in out.items()}


def _as_list(v: Any) -> list:
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


def entity_keys(ents: dict[str, list[str]], include_processes: bool = False) -> set[str]:
    """Claves de búsqueda (canónicas) a partir del resultado de extract_entities."""
    keys: set[str] = set()
    for t, vals in ents.items():
        if t == "processes" and not include_processes:
            continue
        for v in vals:
            if v and v not in JUNK:
                keys.add(v)
                if t == "domains":
                    keys.add(base_domain(v))
    return keys


# ------------------------------------------------------------------- eventos
# Campos a indexar por fuente: (ruta, tipo). Ruta con '.' = anidado; tipo decide la canonización.
EVENT_FIELDS: dict[str, list[tuple[str, str]]] = {
    "proxy": [("src_ip", "ip"), ("hostname", "host"), ("user", "user"), ("domain", "domain"), ("dst_ip", "ip")],
    "dns": [("src_ip", "ip"), ("hostname", "host"), ("query", "domain")],
    "edr_events": [("hostname", "host"), ("user", "user"), ("sha256", "raw")],
    "idp_signins": [("user_upn", "user"), ("src_ip", "ip"), ("session_id", "raw"), ("device_id", "raw")],
    "waf": [("src_ip", "ip")],
    "email": [("sender", "user"), ("recipients", "user"), ("message_id", "raw"), ("sender_ip", "ip"),
              ("attachments.sha256", "raw"), ("attachments.contains.sha256", "raw"), ("urls", "url")],
    "ecom_auth": [("customer_id", "raw"), ("email", "raw"), ("src_ip", "ip"), ("device_fp", "raw")],
    "firewall": [("src_ip", "ip"), ("dst_ip", "ip")],
    "email_clicks": [("user", "user"), ("message_id", "raw"), ("src_ip", "ip"), ("url", "url")],
    "vpn": [("user", "user"), ("src_ip", "ip"), ("assigned_ip", "ip")],
    "ai_gateway": [("session_id", "raw"), ("customer_id", "raw"), ("src_ip", "ip")],
    "ecom_account": [("customer_id", "raw"), ("src_ip", "ip")],
    "cloudtrail": [("sourceIPAddress", "ip"), ("userIdentity.userName", "raw"), ("userIdentity.accessKeyId", "raw"),
                   ("requestParameters.bucketName", "raw"), ("requestParameters.userName", "raw")],
    "sql_audit": [("user", "user"), ("client_host", "host")],
    "dlp": [("user", "user"), ("hostname", "host"), ("destination", "domain")],
    "idp_audit": [("actor_upn", "user"), ("target", "user"), ("src_ip", "ip")],
    "cicd_builds": [("runner", "host"), ("pipeline", "raw")],
    "ad_events": [("subject", "user"), ("target", "user"), ("src_host", "host"), ("dc", "host")],
}


def _get_path(e: Any, path: list[str]) -> Iterable[Any]:
    if not path:
        yield from (e if isinstance(e, list) else [e])
        return
    if isinstance(e, list):
        for x in e:
            yield from _get_path(x, path)
    elif isinstance(e, dict) and path[0] in e:
        yield from _get_path(e[path[0]], path[1:])


def event_keys(e: dict, store: "DataStore | None") -> set[str]:
    keys: set[str] = set()
    for path, kind in EVENT_FIELDS.get(e.get("_source", ""), []):
        for v in _get_path(e, path.split(".")):
            if v is None or isinstance(v, (dict, bool)):
                continue
            s = str(v).strip()
            if s.lower() in JUNK:
                continue
            if kind == "user":
                keys.add(canon_user(s, store))
                if "@" in s:
                    keys.add(s.split("@", 1)[1].lower())  # dominio del remitente
            elif kind == "host":
                keys.add(s.lower())
            elif kind == "domain":
                d = s.lower().strip(".")
                keys.add(d)
                keys.add(base_domain(d))
            elif kind == "url":
                keys.add(s.lower())
                d = domain_of(s)
                if d:
                    keys.add(d)
                    keys.add(base_domain(d))
            else:  # ip / raw
                keys.add(s.lower())
    keys.discard("")
    return keys


def dumps_compact(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
