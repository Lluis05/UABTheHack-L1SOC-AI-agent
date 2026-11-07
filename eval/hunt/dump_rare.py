"""D1 · Vuelca en compacto las alertas de reglas raras (≤ N ocurrencias), ordenadas por tiempo. Solo lectura."""
import collections, json, sys
from soc.data.store import get_store

sys.stdout.reconfigure(encoding="utf-8")
MAX = int(sys.argv[1]) if len(sys.argv) > 1 else 12
s = get_store()
A = s.alerts()
c = collections.Counter(a["rule_id"] for a in A)
for a in sorted((a for a in A if c[a["rule_id"]] <= MAX), key=lambda a: a["created_at"]):
    ents = s.entities_of(a)
    ents = {k: v for k, v in ents.items() if v and k not in ("processes",)}
    ev = json.dumps(a.get("evidence"), ensure_ascii=False)
    print(f"{a['created_at'][:16]} {a['alert_id']} {a['rule_id']:<10} {a['severity']:<8} "
          f"{json.dumps(ents, ensure_ascii=False)[:260]}\n      {ev[:330]}")
