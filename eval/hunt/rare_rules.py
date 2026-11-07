"""D1 · Reglas poco frecuentes: punto de partida del threat hunting (solo lectura)."""
import collections, json, sys
from soc.data.store import get_store

sys.stdout.reconfigure(encoding="utf-8")
s = get_store()
A = s.alerts()
c = collections.Counter(a["rule_id"] for a in A)
names = {a["rule_id"]: a["rule_name"] for a in A}
for rid, n in sorted(c.items(), key=lambda x: x[1]):
    print(f"{n:6} {rid:<11} {names[rid]}")
