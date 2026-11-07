"""Quién aprueba cada acción de contención (politica_soc.md §4). Lo calcula el código, no el LLM.

    approval_for("isolate_host", "WS-BCN-1770", store)
    → {"action": "isolate_host", "target": "WS-BCN-1770", "allowed": True, "requires_approval": True,
       "approvers": ["N2"], "note": "Aislar un puesto de trabajo"}
"""

from __future__ import annotations

API_ACTIONS = {"isolate_host", "disable_user", "revoke_sessions", "reset_password", "block_ioc",
               "purge_email", "disable_access_key"}
# full_scan y propose_rule_exclusion: acciones de cierre de los runbooks (RB-02, RB-09, RB-10), sin API
NON_API_ACTIONS = {"close", "escalate", "monitor", "notify", "full_scan", "propose_rule_exclusion"}
DUAL_USE = ("mega.nz", "mega.io", "anydesk", "teamviewer", "wetransfer", "dropbox", "drive.google",
            "onedrive", "github.com")


def approval_for(action: str, target: str, store=None) -> dict:
    a, t = (action or "").strip(), (target or "").strip()
    res = {"action": a, "target": t, "allowed": True, "requires_approval": True, "approvers": ["N2"], "note": ""}
    if a in NON_API_ACTIONS:
        return {**res, "requires_approval": False, "approvers": [], "note": "Acción del analista, sin API"}
    if a not in API_ACTIONS:
        return {**res, "allowed": False, "approvers": [], "note": f"Acción desconocida para la API: {a}"}

    asset = store.asset(t) if store is not None and t else None
    if asset and asset.get("zone") == "LOGISTICS-OT":
        return {**res, "allowed": False, "approvers": ["Responsable de Operaciones"],
                "note": "Política: el SOC NUNCA actúa sobre OT. Solo escalar a Operaciones"}

    if a == "purge_email":
        return {**res, "requires_approval": False, "approvers": [], "note": "El N1 puede ejecutarla"}
    if a == "block_ioc":
        if any(d in t.lower() for d in DUAL_USE):
            return {**res, "note": "Servicio legítimo de uso dual: no bloquear globalmente sin N2"}
        return {**res, "requires_approval": False, "approvers": [], "note": "El N1 puede ejecutarla"}
    if a in ("revoke_sessions", "reset_password"):
        return {**res, "note": "Revocar sesiones / forzar cambio de contraseña"}
    if a == "disable_access_key":
        return {**res, "note": "Desactivar claves cloud"}
    if a == "disable_user":
        u = store.user(t) if store is not None else None
        if u and u.get("account_type") == "service":
            return {**res, "note": "Cuenta de servicio: puede parar un proceso de negocio"}
        return {**res, "note": "Deshabilitar cuenta de usuario"}
    if a == "isolate_host":
        typ = (asset or {}).get("type", "")
        svc = (asset or {}).get("business_service", "")
        if typ in ("TPV", "Frontal web", "Pasarela de pagos"):
            return {**res, "approvers": ["N2", "Negocio"], "note": f"Aislar {typ}: impacto en ventas"}
        if typ in ("Portátil",) or not asset:
            return {**res, "note": "Aislar un puesto de trabajo" + ("" if asset else " (no está en la CMDB)")}
        owner = "responsable del servicio"
        if store is not None:
            for s in store.services():
                if asset["hostname"] in s.get("activos", "") or (svc and s.get("servicio", "").startswith(svc[:20])):
                    owner = s.get("responsable") or owner
                    break
        return {**res, "approvers": ["N2", owner], "note": f"Aislar servidor ({typ}; {svc})"}
    return res
