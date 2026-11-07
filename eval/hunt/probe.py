"""D1 · Consultas puntuales sobre entidades (solo lectura).

    python -m eval.hunt.probe ENTIDAD [inicio] [fin] [fuentes,coma]   # eventos de la entidad
    python -m eval.hunt.probe --user UPN                              # ficha de directorio/RRHH
    python -m eval.hunt.probe --alerts ENTIDAD                        # alertas que la mencionan
"""
import json, sys
from soc.data.store import get_store

sys.stdout.reconfigure(encoding="utf-8")
s = get_store()
args = sys.argv[1:]
if args[0] == "--user":
    print(json.dumps(s.user(args[1]), ensure_ascii=False, default=str))
elif args[0] == "--alerts":
    for aid in s.alerts_for_entity(args[1]):
        a = s.alert(aid)
        print(a["created_at"][:16], aid, a["rule_id"], a["severity"], json.dumps(a.get("evidence"), ensure_ascii=False)[:160])
else:
    start = args[1] if len(args) > 1 and args[1] != "-" else None
    end = args[2] if len(args) > 2 and args[2] != "-" else None
    srcs = args[3].split(",") if len(args) > 3 else None
    lim = 40
    for src, evs in s.search(args[0], start, end, sources=srcs, limit_per_source=lim).items():
        print(f"--- {src} ({len(evs)})")
        for e in evs:
            e = {k: v for k, v in e.items() if k != "_source"}
            print("  ", json.dumps(e, ensure_ascii=False)[:300])
