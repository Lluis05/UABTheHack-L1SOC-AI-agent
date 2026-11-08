"""Matriz de severidad de politica_soc.md §2, en código determinista.

El LLM NUNCA decide la severidad final: como mucho propone plus_reasons / minus_reasons
y esta función recalcula. Así el resultado es reproducible y explicable.
"""

from __future__ import annotations

LEVELS = ["informational", "low", "medium", "high", "critical"]
CRITICALITIES = ["Baja", "Media", "Alta", "Crítica"]

# Regla \ Activo:          Baja             Media            Alta        Crítica
MATRIX: dict[str, list[str]] = {
    "informational": ["informational", "informational", "low", "low"],
    "low":           ["informational", "low", "low", "medium"],
    "medium":        ["low", "medium", "medium", "high"],
    "high":          ["medium", "high", "high", "critical"],
    "critical":      ["high", "critical", "critical", "critical"],
}

# Criticidad de identidades (la política no la define; convención documentada en docs/03)
IDENTITY_CRITICALITY = {"admin": "Crítica", "service": "Alta", "external": "Media", "user": "Media"}
DEFAULT_CRITICALITY = "Media"  # activo desconocido / no gestionado


def norm_level(v: str | None) -> str:
    v = (v or "").strip().lower()
    return v if v in LEVELS else "medium"


def norm_crit(v: str | None) -> str | None:
    v = (v or "").strip().lower()
    for c in CRITICALITIES:
        if c.lower() == v or c.lower().replace("í", "i") == v:
            return c
    return None


def _is_true(v) -> bool:
    return v is True or str(v).strip().lower() in ("true", "1", "sí", "si", "yes")


def max_criticality(ctx: dict) -> tuple[str, str, list[str]]:
    """(criticidad máxima, fuente, explicación) entre activos, servicios de negocio e identidades."""
    cands: list[tuple[int, str, str]] = []
    for a in ctx.get("assets") or []:
        c = norm_crit(a.get("criticality"))
        if c:
            cands.append((CRITICALITIES.index(c), a.get("hostname", "?"), f"activo {a.get('hostname')} = {c}"))
    for s in ctx.get("business_services") or []:
        c = norm_crit(s.get("criticidad"))
        if c:
            cands.append((CRITICALITIES.index(c), s.get("servicio", "?"), f"servicio «{s.get('servicio')}» = {c}"))
    for u in ctx.get("users") or []:
        if u.get("_via") not in (None, "alert"):
            continue  # el propietario de un portátil no es la identidad afectada
        c = IDENTITY_CRITICALITY.get((u.get("account_type") or "user").lower(), "Media")
        if (_is_true(u.get("vip")) or _is_true(u.get("privileged"))) and CRITICALITIES.index(c) < 2:
            c = "Alta"
        cands.append((CRITICALITIES.index(c), u.get("upn", "?"), f"identidad {u.get('upn')} = {c}"))
    if not cands:
        return DEFAULT_CRITICALITY, "desconocido", ["sin activo ni identidad conocidos → Media por defecto"]
    best = max(cands, key=lambda x: x[0])
    return CRITICALITIES[best[0]], best[1], [x[2] for x in sorted(cands, reverse=True)[:4]]


def compute_severity(rule_severity: str, max_crit: str, plus_reasons: list[str] | None = None,
                     minus_reasons: list[str] | None = None, authorized: bool = False,
                     criticality_source: str = "", false_positive: bool = False) -> dict:
    """SeverityResult (contrato en docs/04). Ajuste total limitado a ±1 nivel."""
    rule = norm_level(rule_severity)
    crit = norm_crit(max_crit) or DEFAULT_CRITICALITY
    plus, minus = list(plus_reasons or []), list(minus_reasons or [])
    base = MATRIX[rule][CRITICALITIES.index(crit)]
    adj = (1 if plus else 0) - (1 if minus else 0)          # ±1 como máximo en total
    final = LEVELS[max(0, min(len(LEVELS) - 1, LEVELS.index(base) + adj))]

    parts = [f"Regla {rule} × activo {crit} ({criticality_source or 'n/d'}) = {base}"]
    if plus:
        parts.append("+1 por " + "; ".join(plus))
    if minus:
        parts.append("−1 por " + "; ".join(minus))
    if plus and minus:
        parts.append("los ajustes se compensan")
    if authorized:
        final = "low" if LEVELS.index(base) >= LEVELS.index("high") else "informational"
        parts.append("actividad autorizada (cambio o flujo aprobado)")
    elif false_positive:
        final = "informational"
        parts.append("falso positivo de la regla")
    return {"rule_severity": rule, "max_criticality": crit, "criticality_source": criticality_source,
            "base": base, "adjustment": adj, "plus_reasons": plus, "minus_reasons": minus,
            "authorized": authorized, "false_positive": false_positive, "final": final,
            "rationale": "; ".join(parts) + f" → {final}."}
