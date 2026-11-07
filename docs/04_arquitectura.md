# 04 · Arquitectura y contratos entre módulos

## Principio de diseño: híbrido determinista + IA
No podemos (ni debemos) pasar 11.061 alertas por un LLM. **Lo que la política define con exactitud lo hace el código**:
lookups, matriz de severidad, cambios aprobados y reglas internas. **El LLM se usa donde hace falta criterio**:
interpretar la evidencia, decidir el veredicto en casos ambiguos, redactar el resumen y conectar los puntos.
Cada campo del ticket indica **quién lo decidió** (`policy`, `llm` o `human`). Es nuestro argumento central para
"papeles claros" y "honestidad".

```
                 ┌──────────────────────────────────────────────────────────────┐
 alertas.jsonl → │ 1. DataStore (soc/data)  índices por entidad y por event_id   │
                 └───────────────┬──────────────────────────────────────────────┘
                                 ▼
                 ┌───────────────────────────────┐
                 │ 2. Enriquecimiento (soc/enrich)│  CMDB, usuario+RRHH, TIP, GeoIP, sandbox,
                 │    → Context                   │  related_events, actividad de entidades ±24h,
                 └───────────────┬───────────────┘  otras alertas de las mismas entidades
                                 ▼
                 ┌───────────────────────────────┐
                 │ 3. Política (soc/policy)       │  severidad (matriz+ajustes), cambios aprobados,
                 │    → policy_hits, severity     │  reglas internas Tarvia → hits trazables
                 └───────────────┬───────────────┘
                                 ▼
                 ┌───────────────────────────────┐   decisión determinista clara ──► Ticket (decided_by=policy)
                 │ 4. Prefiltro (soc/triage)      │
                 └───────────────┬───────────────┘   ambigua / relevante
                                 ▼
                 ┌───────────────────────────────┐
                 │ 5. Agente LLM + revisor        │  → Ticket (decided_by=llm), con evidencia citada
                 │    (soc/triage/agent.py)       │
                 └───────────────┬───────────────┘
                                 ▼
                 ┌───────────────────────────────┐
                 │ 6. Correlación (soc/correlate) │  grafo de entidades → incidentes multi-alerta
                 └───────────────┬───────────────┘
                                 ▼
          output/tickets.jsonl + output/traces/*.json + output/incidents.jsonl
                                 ▼
                 ┌───────────────────────────────┐
                 │ 7. Dashboard (dashboard/)      │  cola, traza, evidencias, aprobación humana
                 │    → POST /approvals           │  → POST /containment (API simulada)
                 └───────────────────────────────┘
```

## Estructura del repo
```
soc/
  config.py              # Settings desde .env (DATASET_DIR, SOC_API_URL...)
  llm.py                 # ✅ HECHO: complete(system, prompt, schema) con fallback Claude Code → Gemini
  data/
    store.py             # DataStore: carga e indexa dataset (Persona A)
  enrich/
    context.py           # build_context(alert) -> Context (Persona A)
    entities.py          # normalización de entidades e IOCs (Persona A)
  policy/
    severity.py          # matriz + ajustes (Persona A)
    rules.py             # cambios aprobados + reglas internas Tarvia -> PolicyHit (Persona A)
  triage/
    prefilter.py         # decisiones deterministas (Persona A/B)
    agent.py             # prompt + llamada LLM + validación -> Ticket (Persona B)
    reviewer.py          # segundo pase crítico (Persona B)
    prompts/             # prompts versionados .md (Persona B)
  correlate/
    incidents.py         # agrupación en incidentes (Persona B)
  pipeline.py            # orquesta 1→6, CLI (Persona A)
dashboard/
  app.py                 # Streamlit (Persona C)
  containment.py         # cliente de la API simulada (Persona C)
eval/
  labels_dev.jsonl       # etiquetas manuales de la muestra (todos)
  evaluate.py            # métricas (Persona B)
docs/                    # esta documentación
output/                  # (gitignored) resultados de ejecución
```

## Contratos (NO cambiar sin avisar)
Todo se pasa como `dict` (JSON-serializable) para que el dashboard lo lea de disco sin importar código.

### DataStore — `soc/data/store.py`
```python
class DataStore:
    def __init__(self, dataset_dir: str): ...
    def alerts(self, sample: bool = False) -> list[dict]
    def alert(self, alert_id: str) -> dict | None
    def event(self, event_id: str) -> dict | None            # cualquier fuente; añade "_source"
    def asset(self, key: str) -> dict | None                 # hostname o ip; incluye "vulnerabilities"
    def user(self, key: str) -> dict | None                  # upn o username; incluye "hr_events"
    def intel(self, indicator: str) -> dict                  # {"indicator","tip":..|None,"geo":..|None}
    def sandbox(self, sha256: str) -> dict | None
    def changes(self) -> list[dict]
    def search(self, entity: str, start: str, end: str, sources: list[str] | None = None,
               limit_per_source: int = 50) -> dict[str, list[dict]]   # eventos que mencionan la entidad
    def alerts_for_entity(self, entity: str, start: str | None = None, end: str | None = None) -> list[str]
```
Rendimiento: `search` y `alerts_for_entity` deben responder en < 200 ms (con índice invertido por entidad).

### Context — salida de `build_context(alert, store)`
```json
{
  "alert": { "...alerta original..." },
  "entities": {"users": ["upn"], "hosts": ["WS-BCN-1174"], "ips": [], "domains": [], "urls": [],
               "hashes": [], "customers": [], "emails": [], "processes": []},
  "assets":  [{"hostname":"...","ip":"...","criticality":"Alta","zone":"...","business_service":"...",
               "owner_upn":"...","internet_facing":false,"edr_installed":true,"vulnerabilities":[...]}],
  "users":   [{"upn":"...","department":"...","title":"...","account_type":"user","privileged":false,
               "vip":false,"status":"active","workstation":"...","hr_events":[...]}],
  "related_events": [{"_source":"edr_events","event_id":"EDR-0005329", "...": "..."}],
  "entity_activity": {"WS-BCN-1174": {"edr_events": [...], "proxy": [...]}},
  "intel":   [{"indicator":"1.2.3.4","type":"ip","tip":{...}|null,"geo":{...}|null}],
  "sandbox": [{...}],
  "other_alerts": [{"alert_id":"...","rule_id":"...","created_at":"...","shared_entity":"..."}],
  "policy_hits": [ PolicyHit ],
  "severity": SeverityResult,
  "trace": [{"step":"asset_lookup","query":"WS-BCN-1174","result":"found","ms":3}]
}
```
`trace` es lo que el dashboard muestra como "qué consultó la IA". **Cada lookup añade una entrada.**

### PolicyHit — `soc/policy/rules.py`
```json
{"rule": "SCCM_INVENTORY", "effect": "benign|suspicious|malicious|context",
 "detail": "PowerShell codificado lanzado por CcmExec.exe dentro de CHG-2026-1031 (08-10h local)",
 "reference": "CHG-2026-1031"}
```
### SeverityResult — `soc/policy/severity.py`
```json
{"rule_severity":"medium","max_criticality":"Alta","criticality_source":"WS-BCN-1174",
 "base":"medium","adjustment":0,"adjustment_reasons":[],"final":"medium",
 "rationale":"Regla medium × activo Alta = medium; sin ajustes."}
```
`compute_severity(rule_sev, max_crit, plus_reasons: list[str], minus_reasons: list[str], authorized: bool)`.
El agente LLM puede proponer `plus_reasons` y `minus_reasons` (p. ej., "ejecución confirmada"), pero la severidad final
la recalcula siempre esta función.

### Ticket — salida de triaje (`output/tickets.jsonl`, una línea por ticket)
El esquema de Deloitte (`ticket_salida.schema.json`) **más** campos propios con prefijo `x_`:
```json
{
  "ticket_id": "TKT-20261005-0001",
  "alert_ids": ["ALR-..."],
  "title": "Qué pasa, no qué regla saltó",
  "verdict": "true_positive|benign_true_positive|false_positive|needs_more_info",
  "confidence": 0.0,
  "severity": "informational|low|medium|high|critical",
  "severity_rationale": "...",
  "affected": {"users":[],"hosts":[],"business_services":[],"customers":[]},
  "summary": "3-5 frases para el N2",
  "evidence": [{"source":"edr_events","event_id":"EDR-...","finding":"..."}],
  "enrichment": [{"indicator":"...","type":"ip","source":"ti_feed","result":"..."}],
  "mitre": ["T1059.001"],
  "recommended_actions": [{"action":"isolate_host","target":"WS-BCN-1174","requires_approval":true,"justification":"..."}],
  "executed_actions": [],
  "escalation": {"escalate": true, "to": "N2", "reason": "..."},
  "open_questions": ["..."],
  "triage_seconds": 12.3,
  "x_decided_by": {"verdict":"policy|llm|human","severity":"policy","actions":"llm"},
  "x_llm_provider": "claude_code|gemini|null",
  "x_policy_hits": [ PolicyHit ],
  "x_incident_id": "INC-0001|null",
  "x_trace_file": "output/traces/ALR-....json",
  "x_status": "triaged|awaiting_approval|closed|escalated"
}
```
`recommended_actions[].action` usa los nombres de la API (`isolate_host`, `block_ioc`, …) o `close` / `escalate` / `monitor`.
`requires_approval` sale de la tabla de [03](03_politica_y_contexto.md); lo calcula el código, no el LLM.

### Incident — `output/incidents.jsonl`
```json
{"incident_id":"INC-0001","alert_ids":[...],"ticket_ids":[...],"entities":{...},
 "first_seen":"...","last_seen":"...","kill_chain":[{"time":"...","tactic":"...","alert_id":"...","what":"..."}],
 "summary":"...","severity":"high"}
```

## Modo defensa en directo (REQUISITO DE DISEÑO PRINCIPAL)
En la defensa nos dan **10 alertas al azar** y el sistema las tiene que triar **en directo**, delante del jurado.
No vale tener nada precalculado: el triaje con IA se hace en el momento. Consecuencias:

1. **El agente funciona alerta a alerta, en el momento.** Nada puede depender de un preproceso batch de horas.
   El batch sobre las 11.061 alertas es un extra para las métricas, no una dependencia.
2. **Las alertas pueden ser NUEVAS** (que no estén en `alertas.jsonl`). La entrada tiene que aceptar:
   - IDs del dataset (`--ids ALR-...`),
   - un fichero JSONL con alertas completas (`--file defensa.jsonl`),
   - subir o pegar JSON en el dashboard.
   Si una alerta nueva hace referencia a eventos que no tenemos, el sistema lo dice (`open_questions`) y no se rompe.
3. **DataStore cargado una sola vez y en memoria ("caliente").** El dashboard lo carga al arrancar
   (`st.cache_resource`) y lo reutiliza. Triar una alerta no puede implicar volver a leer 800.000 eventos.
   - Objetivo: contexto determinista **< 1 s por alerta**. LLM unos 10-30 s.
4. **Las 10 alertas se procesan en paralelo** (pool de 4-5 llamadas LLM simultáneas). Objetivo: **las 10 en menos de 2 minutos**.
5. **En modo en vivo siempre se ejecuta el LLM**, también cuando el prefiltro ya tiene una decisión. El prefiltro
   se le pasa como *hint* y el LLM confirma o discrepa. El jurado quiere ver razonar a la IA. En modo batch, el
   prefiltro sí cierra solo el ruido evidente para ahorrar cuota.
6. **Progreso visible en el dashboard:** cada alerta muestra en tiempo real el paso en que está (contexto → política → IA →
   revisor → ticket) y la traza de consultas a medida que ocurren. Es la parte de "ver cómo la IA hace el triaje".
7. **Robustez:** si Claude falla o se queda sin cuota, salta Gemini automáticamente. Si no hay red, se usa la caché
   (`output/llm_cache/`) y, en último caso, el resultado determinista del prefiltro, **marcado como tal**.
   La demo nunca puede quedarse colgada.
8. **Cuota reservada para el domingo:** no gastar toda la suscripción de Claude por la noche. A partir de las 03:00 se
   limitan las pruebas con LLM a simulacros de 10 alertas.

**Simulacro:** `python -m soc.pipeline --random 10 --live` coge 10 alertas al azar de todo el dataset y las tría en
paralelo midiendo el tiempo. Hay que ejecutarlo en cada punto de integración: es nuestra prueba de aceptación.

## Ejecución
```bash
python -m soc.pipeline --sample                 # 150 alertas de desarrollo
python -m soc.pipeline --ids ALR-...,ALR-... --live   # alertas concretas (¡las 10 de la defensa!)
python -m soc.pipeline --file defensa.jsonl --live    # alertas nuevas desde fichero
python -m soc.pipeline --random 10 --live             # SIMULACRO de la defensa (cronometrado)
python -m soc.pipeline --all --no-llm                 # todo el dataset solo con la parte determinista (métricas)
streamlit run dashboard/app.py
```
