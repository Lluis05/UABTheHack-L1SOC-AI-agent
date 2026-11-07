"""Normalización defensiva de alertas de entrada (Persona A).

En la defensa entran alertas NUEVAS que pueden venir incompletas o mal formadas. Antes de triarlas se llevan al
formato del dataset sin inventar nada: lo que no se puede interpretar se descarta o se marca, y cada corrección
queda anotada en `alert["x_input_warnings"]` (sale en el ticket). Nunca lanza excepción.

    alert = normalize_alert(raw)
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

from soc.timeutil import fmt, parse

LEVELS = ("informational", "low", "medium", "high", "critical")
SEVERITY_ALIASES = {
    "info": "informational", "informativa": "informational", "informacional": "informational",
    "baja": "low", "media": "medium", "moderate": "medium", "alta": "high",
    "critica": "critical", "crítica": "critical", "crit": "critical",
}
DEFAULT_SEVERITY = "medium"
MAX_STR = 20_000          # un campo de texto más largo se recorta (prompts y trazas manejables)
MAX_LIST = 500
MAX_DEPTH = 8
_BAD_CHARS = re.compile(r"[\x00\ud800-\udfff]")  # NUL y surrogates sueltos: rompen JSON/UTF-8


def _clean(v: Any, warnings: list[str], path: str, depth: int = 0) -> Any:
    if depth > MAX_DEPTH:
        warnings.append(f"{path}: anidamiento excesivo, recortado")
        return str(v)[:200]
    if isinstance(v, str):
        if _BAD_CHARS.search(v):
            v = _BAD_CHARS.sub("�", v)
            warnings.append(f"{path}: caracteres inválidos sustituidos")
        if len(v) > MAX_STR:
            warnings.append(f"{path}: texto de {len(v)} caracteres recortado a {MAX_STR}")
            v = v[:MAX_STR] + "…[recortado]"
        return v
    if isinstance(v, dict):
        return {str(_clean(k, warnings, path, depth + 1)): _clean(x, warnings, f"{path}.{k}", depth + 1)
                for k, x in v.items()}
    if isinstance(v, (list, tuple, set)):
        v = list(v)
        if len(v) > MAX_LIST:
            warnings.append(f"{path}: lista de {len(v)} elementos recortada a {MAX_LIST}")
            v = v[:MAX_LIST]
        return [_clean(x, warnings, f"{path}[]", depth + 1) for x in v]
    if v is None or isinstance(v, (bool, int, float)):
        return v
    return str(v)


def _created_at(v: Any, warnings: list[str]) -> str:
    try:
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            ts = v / 1000 if v > 1e11 else v  # epoch en ms o en s
            return fmt(datetime.fromtimestamp(ts, tz=timezone.utc))
        if isinstance(v, str) and v.strip():
            return fmt(parse(v))
    except (ValueError, OverflowError, OSError):
        pass
    now = fmt(datetime.now(timezone.utc))
    warnings.append(f"created_at {v!r} no interpretable: se usa la hora de recepción ({now})")
    return now


def _severity(v: Any, warnings: list[str]) -> str:
    s = str(v or "").strip().lower()
    s = SEVERITY_ALIASES.get(s, s)
    if s in LEVELS:
        return s
    warnings.append(f"severity {v!r} desconocida: se asume {DEFAULT_SEVERITY}")
    return DEFAULT_SEVERITY


def _entities(v: Any, warnings: list[str]) -> tuple[dict, list[str]]:
    """Devuelve (entities, tokens sueltos). Los valores no interpretables se pasan como tokens a la evidencia."""
    if v is None:
        return {}, []
    if not isinstance(v, dict):
        warnings.append("entities no es un objeto: sus valores se tratan como texto de la evidencia")
        items = v if isinstance(v, list) else [v]
        return {}, [str(x) for x in items if isinstance(x, (str, int, float)) and str(x).strip()]
    out = {}
    for k, vals in v.items():
        if vals is None:
            continue
        if isinstance(vals, (dict, str)):  # formato del dataset: entities.cloud = {...}, ai_session = "..."
            if vals:
                out[str(k)] = vals
            continue
        if not isinstance(vals, list):
            vals = [vals]
        good = [x for x in vals if isinstance(x, (str, dict)) and x not in ("", {})]
        if len(good) != len(vals):
            warnings.append(f"entities.{k}: {len(vals) - len(good)} valores vacíos o inválidos descartados")
        if good:
            out[str(k)] = good
    return out, []


WRAPPER_KEYS = ("alerts", "items", "data", "results", "alertas", "records")


def unwrap_alerts(value: Any) -> list:
    """Lista de alertas desde lo que nos den: lista, alerta suelta o envoltorio ({"alerts": [...]}, el formato
    de la API {"total":…, "items": [...]}, {"data": {...}}…). Recursivo y tolerante."""
    if isinstance(value, list):
        out = []
        for v in value:
            out += unwrap_alerts(v) if isinstance(v, (list, dict)) and _is_wrapper(v) else [v]
        return out
    if isinstance(value, dict):
        if _is_wrapper(value):
            for k in WRAPPER_KEYS:
                if isinstance(value.get(k), (list, dict)):
                    return unwrap_alerts(value[k])
        return [value]
    return [value] if value not in (None, "") else []


def _is_wrapper(v: Any) -> bool:
    if isinstance(v, list):
        return True
    return (isinstance(v, dict) and "alert_id" not in v and "rule_id" not in v
            and any(isinstance(v.get(k), (list, dict)) for k in WRAPPER_KEYS))


def parse_alerts_text(text: str) -> tuple[list, list[str]]:
    """Alertas desde texto: JSON (array, objeto, envoltorio, pretty-printed), JSONL u objetos concatenados.
    Devuelve (alertas, avisos). Un fragmento ilegible se salta con aviso; nunca lanza excepción."""
    text = (text or "").lstrip("﻿").strip()
    if not text:
        return [], []
    try:
        return unwrap_alerts(json.loads(text)), []
    except json.JSONDecodeError:
        pass
    dec, i, out, warns = json.JSONDecoder(), 0, [], []
    while i < len(text):
        while i < len(text) and text[i] in " \t\r\n,":
            i += 1
        if i >= len(text):
            break
        try:
            v, i = dec.raw_decode(text, i)
            out += unwrap_alerts(v)
        except json.JSONDecodeError:
            line_end = text.find("\n", i)
            line_end = len(text) if line_end < 0 else line_end
            warns.append(f"fragmento JSON ilegible saltado (línea {text.count(chr(10), 0, i) + 1}): "
                         f"{text[i:line_end][:80]!r}")
            i = line_end + 1
    return out, warns


def normalize_alert(raw: Any, index: int = 0) -> dict:
    warnings: list[str] = []
    if not isinstance(raw, dict):
        warnings.append(f"la alerta no es un objeto JSON ({type(raw).__name__}): se trata como texto")
        raw = {"evidence": {"text": str(raw)}}
    a = _clean(dict(raw), warnings, "alert")

    aid = a.get("alert_id")
    if aid in (None, "") or not isinstance(aid, (str, int)):
        aid = f"ALR-NUEVA-{index + 1:04d}"
        warnings.append(f"sin alert_id: se asigna {aid}")
    a["alert_id"] = str(aid)
    a["created_at"] = _created_at(a.get("created_at"), warnings)
    a["severity"] = _severity(a.get("severity"), warnings)
    for k in ("rule_id", "rule_name", "source_product", "runbook", "description"):
        if a.get(k) is not None and not isinstance(a[k], str):
            a[k] = str(a[k])

    ev = a.get("evidence")
    if ev is None:
        ev = {}
    elif isinstance(ev, str):
        ev = {"text": ev}
    elif isinstance(ev, list):
        ev = {"items": ev}
    elif not isinstance(ev, dict):
        ev = {"text": str(ev)}
    ents, loose = _entities(a.get("entities"), warnings)
    if loose:
        ev["entities_raw"] = loose
    a["entities"], a["evidence"] = ents, ev

    rel = a.get("related_events")
    if isinstance(rel, str):
        rel = [rel]
    if rel is not None and not isinstance(rel, list):
        rel = []
    good = [r for r in rel or [] if isinstance(r, str) and r.strip()]
    if rel and len(good) != len(rel):
        warnings.append(f"related_events: {len(rel) - len(good)} ids inválidos descartados")
    a["related_events"] = good

    m = a.get("mitre")
    if isinstance(m, str):
        a["mitre"] = {"technique_id": m}
    elif not isinstance(m, dict):
        a["mitre"] = {}
    a.setdefault("status", "new")
    if warnings:
        a["x_input_warnings"] = list(dict.fromkeys(warnings))[:30]
    return a
