"""D1 · Alertas del escenario (numeración ≥ 011785, separada del ruido por un salto en los IDs). Solo lectura.

    python -m eval.hunt.dump_scenario [RULE_ID ...]   # filtra por regla si se indica
"""
import json, sys
from soc.data.store import get_store

sys.stdout.reconfigure(encoding="utf-8")
SCENARIO_MIN = 11785
rules = set(sys.argv[1:])
s = get_store()
for a in sorted((a for a in s.alerts() if int(a["alert_id"][-6:]) >= SCENARIO_MIN), key=lambda a: a["created_at"]):
    if rules and a["rule_id"] not in rules:
        continue
    ents = {k: v for k, v in s.entities_of(a).items() if v and k != "processes"}
    print(f"{a['created_at'][:16]} {a['alert_id']} {a['rule_id']:<10} {a['severity']:<8} "
          f"{json.dumps(ents, ensure_ascii=False)[:220]}\n      {json.dumps(a.get('evidence'), ensure_ascii=False)[:300]}")
