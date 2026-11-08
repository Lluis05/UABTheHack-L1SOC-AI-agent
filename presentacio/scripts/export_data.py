"""Exporta los casos reales que enseña la presentación (presentacio/src/data/casos.json).

Lee las trazas y los tickets que deja el pipeline en output/ (no se versionan) y guarda solo lo que la presentación
necesita, recortado. Así la presentación funciona sin el dataset ni el backend, y lo que enseña es una ejecución real.

    python presentacio/scripts/export_data.py

Antes hay que haber triado los casos (p. ej. `python -m soc.pipeline --ids ... --live`).
Los textos que escribe el atacante (cuerpos de correo, prompts) no se copian: de esos casos se enseña lo que concluyó
nuestro sistema, no la instrucción del atacante.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output"
DEST = ROOT / "presentacio" / "src" / "data" / "casos.json"
TICKET_FILES = ("tickets_sim_incidentes.jsonl", "tickets.jsonl")

# Caso de la presentación: el mismo del vídeo de la demo (BEC tras AiTM, triado en directo con IA y revisor).
# Admite varios casos: con más de uno, la diapositiva muestra pestañas para elegir.
CASES = [
    {"key": "bec", "alert_id": "ALR-20261008-011789", "label": "Cambio de IBAN a Lituania",
     "kind": "Fraude BEC tras AiTM"},
]

MAX_TEXT = 420
# Campos de la alerta que puede haber escrito el atacante: no se exportan.
ATTACKER_FIELDS = {"email_body_excerpt", "prompt", "prompt_excerpt", "subject", "body"}


def clip(value, limit: int = MAX_TEXT):
    if isinstance(value, str):
        return value if len(value) <= limit else value[: limit - 1] + "…"
    if isinstance(value, list):
        return [clip(v, limit) for v in value]
    if isinstance(value, dict):
        return {k: clip(v, limit) for k, v in value.items()}
    return value


def load_tickets() -> dict[str, dict]:
    tickets: dict[str, dict] = {}
    for name in TICKET_FILES:
        path = OUTPUT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            t = json.loads(line)
            tickets.setdefault(t["alert_ids"][0], t)
    return tickets


def export_case(case: dict, ticket: dict) -> dict:
    trace = json.loads((OUTPUT / "traces" / f"{case['alert_id']}.json").read_text(encoding="utf-8"))
    alert = trace["context"]["alert"]
    evidence = {k: v for k, v in (alert.get("evidence") or {}).items() if k not in ATTACKER_FIELDS}
    return {
        **case,
        "alert": clip({
            "created_at": alert.get("created_at"),
            "source_product": alert.get("source_product"),
            "rule_id": alert.get("rule_id"),
            "rule_name": alert.get("rule_name"),
            "severity": alert.get("severity"),
            "description": alert.get("description"),
            "mitre": alert.get("mitre"),
            "entities": alert.get("entities"),
            "evidence": evidence,
        }),
        "trace": [clip({k: s.get(k) for k in ("step", "source", "query", "result", "ms")}, 160)
                  for s in trace["trace"]],
        "policy_hits": clip([{k: h.get(k) for k in ("rule", "effect", "detail", "reference")}
                             for h in trace["policy_hits"]]),
        "policy_severity": clip({k: trace["severity"].get(k) for k in
                                 ("rule_severity", "max_criticality", "criticality_source", "base",
                                  "adjustment", "final", "rationale", "suggestion")}),
        "ticket": clip({k: ticket.get(k) for k in
                        ("title", "verdict", "confidence", "severity", "severity_rationale", "summary",
                         "evidence", "mitre", "recommended_actions", "escalation", "open_questions",
                         "triage_seconds", "x_decided_by", "x_review", "x_injection", "x_incident_id",
                         "x_llm_provider")}),
    }


def main() -> None:
    tickets = load_tickets()
    out = [export_case(c, tickets[c["alert_id"]]) for c in CASES]
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(out)} casos → {DEST}")


if __name__ == "__main__":
    main()
