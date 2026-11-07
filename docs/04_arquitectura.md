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
    closure.py           # cuándo se cierra (runbooks) y escalado obligatorio (§5) -> x_status
  triage/
    prefilter.py         # decisiones deterministas (Persona A/B)
    agent.py             # prompt + llamada LLM + validación -> Ticket (Persona B)
    reviewer.py          # segundo pase crítico (Persona B)
    prompts/             # prompts versionados .md (Persona B)
  correlate/
    incidents.py         # agrupación en incidentes (Persona D)
    investigate.py       # informe nivel 3 (Persona D)
  pipeline.py            # orquesta 1→6, CLI (Persona A)
dashboard/
  server.py              # backend FastAPI del dashboard: solo rutas (Persona C)
  settings.py            # constantes y rutas del dashboard
  results.py             # lectura de output/ + decisiones humanas + métricas (con tests)
  live.py                # triaje en directo: motores inprocess/subprocess/simulado (con tests)
  policy.py              # usa soc/policy/approvals.py (A) para decidir quién aprueba cada acción; carga el DataStore en segundo plano
  containment.py         # cliente de la API simulada (Persona C)
  chat.py                # chat IA del ticket con Gemini: solo consulta, sin herramientas (docs/12_chatbot.md)
  sample/                # tickets/incidentes/trazas de EJEMPLO con este contrato (se usan si no hay output/)
  web/                   # frontend React + Material UI + Vite (Persona C); base → shared → pages
eval/
  labels_dev.jsonl       # etiquetas manuales de la muestra (Persona D)
  incidents_truth.jsonl  # incidentes encontrados con threat hunting (Persona D)
  evaluate.py            # métricas (Persona B) ✅: python -m eval.evaluate [--run] → output/eval_report.json
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

### Context — salida de `build_context(alert, store)` ✅ IMPLEMENTADO (`soc/enrich/context.py`)
```python
from soc.data.store import get_store
from soc.enrich.context import build_context
ctx = build_context(alert_dict, get_store())     # 1-20 ms; funciona con alertas nuevas o mal formadas
```
Para tener contextos reales en disco: `python -m soc.enrich.context --sample` → `output/contexts_sample.jsonl`
(o `--ids ALR-...,ALR-...`).
```json
{
  "alert": { "...alerta original..." },
  "entities": {"users": ["upn en minúsculas"], "hosts": ["ws-bcn-1174"], "ips": [], "domains": [], "urls": [],
               "hashes": [], "emails": [], "customers": [], "cloud": [], "sessions": [], "message_ids": [],
               "processes": []},
  "entity_stats": {"<entidad>": {"events_total": 29, "alerts_total": 1, "hub": false,
                                 "first_seen": "ISO", "last_seen": "ISO"}},
  "assets":  [{"hostname":"WS-BCN-1174","ip":"...","type":"Portátil","criticality":"Baja|Media|Alta|Crítica",
               "zone":"HQ-USERS","business_service":"...","owner_upn":"...","internet_facing":"False",
               "edr_installed":"True","vulnerabilities":[...], "_via": "implícito (WAF)" /* solo si es implícito */}],
  "business_services": [{"servicio":"Tienda online y app","criticidad":"Crítica","impacto":"...",
                         "activos":"...","responsable":"Directora de E-commerce","_matched":["web-ecom01"]}],
  "users":   [{"upn":"...","username":"...","display_name":"...","department":"...","title":"...",
               "account_type":"user|service|admin|external","privileged":"True|False","vip":"True|False",
               "mfa_method":"...","status":"...","workstation":"...","notes":"...","hr_events":[...],
               "_via":"alert|asset_owner"}],
  "related_events": [{"_source":"edr_events","event_id":"EDR-0005329", "...": "..."}],
  "missing_related_events": ["ids que la alerta cita pero no existen (alertas nuevas)"],
  "entity_activity": {"<entidad>": {"<fuente>": [eventos ±24h, máx 20 por fuente, sin repetir eventos]}},
  "intel":   [{"indicator":"1.2.3.4","type":"ip|domain|sha256|url|email","tip":{...}|null,"geo":{...}|null}],
  "sandbox": [{...informe...}],
  "other_alerts": [{"alert_id":"...","rule_id":"...","rule_name":"...","severity":"...","created_at":"...",
                    "shared_entities":["..."]}],          // ±7 días, máx 40, sin hubs
  "other_alerts_total": 12,
  "changes": [{"id":"CHG-2026-1031","titulo":"...","inicio":"local","fin":"local","inicio_utc":"ISO",
               "fin_utc":"ISO","active_at_alert":true, "...": "..."}],   // cambios a ±1 día
  "policy_hits": [ PolicyHit ],        // lo rellena A4 (vacío hasta entonces)
  "severity": SeverityResult | null,   // lo rellena A4
  "trace": [{"step":"cmdb","source":"CMDB","query":"WS-BCN-1174","result":"WS-BCN-1174 · criticidad Media · HQ-USERS","ms":0.02}],
  "build_ms": 1.4
}
```
Notas:
- **Ojo con los booleanos del CSV:** `privileged`, `vip`, `internet_facing` y `edr_installed` son strings `"True"`/`"False"`.
- **Hubs:** las entidades con más de 10.000 eventos o más de 300 alertas (p. ej. `tarvia.example` o la IP de salida
  corporativa 198.18.200.10) **no** vuelcan su actividad ni sus alertas relacionadas. Se marcan en `entity_stats[...].hub`.
- **Rareza:** `entity_stats` permite argumentar cosas como "dominio visto por primera vez hoy, en 3 eventos de todo el mes".
- **`trace[].source`** (CMDB, Directorio, Logs, TIP/GeoIP, Sandbox, SIEM, Cambios, Servicios, Política) sirve al
  dashboard para poner iconos y agrupar.
- **Activos implícitos:** las alertas de WAF y ECOM llevan WEB-ECOM01..04 (Crítica) y las de AI_GATEWAY llevan AI-ASSIST01.
- **Hook de política:** `build_context` llama a `soc.policy.evaluate_policy(ctx, store) -> (policy_hits, severity)`
  si existe (A4).

### Política ✅ IMPLEMENTADO (`soc/policy/`)
`build_context` ya la ejecuta: `ctx["policy_hits"]` y `ctx["severity"]` llegan rellenos.
```python
from soc.policy import evaluate_policy, suggest_verdict
hits, sev = evaluate_policy(ctx, store, extra_plus=["ejecución confirmada"], extra_minus=[])  # recalcular con lo que propone el LLM
from soc.policy.approvals import approval_for
approval_for("isolate_host", "WS-BCN-1770", store)  # → requires_approval, approvers, allowed, note
```

### PolicyHit — `soc/policy/rules.py`
```json
{"rule": "SCCM_INVENTORY", "effect": "benign|suspicious|malicious|context",
 "detail": "PowerShell codificado lanzado por CcmExec.exe ... dentro de la ventana 08-10 h ...",
 "reference": "CHG-2026-1031",
 "verdict_hint": "false_positive|benign_true_positive|true_positive",   // opcional
 "plus": "motivo de +1",                                                  // opcional
 "minus": "motivo de −1"}                                                 // opcional
```
Reglas implementadas (unas 50): cambios aprobados (pentest, Nessus, SCCM, PsExec, OT, Logisoft, Backup Operators,
actualización EDR, nóminas), reglas internas (adm.* fuera de JUMP01, AnyDesk, svc_backup, OT, dependency confusion),
RRHH (bajas, actividad tras la baja, viajes), inteligencia (TIP, Tor/hosting, desconocido ≠ limpio, sandbox),
patrones conocidos de FP/TP por regla del SIEM y **PROMPT_INJECTION_TEXT**.

### SeverityResult — `soc/policy/severity.py`
```json
{"rule_severity":"low","max_criticality":"Crítica","criticality_source":"WEB-ECOM01",
 "base":"medium","adjustment":-1,"plus_reasons":[],"minus_reasons":["bloqueado por el WAF antes de producir efecto"],
 "authorized":false,"false_positive":false,"final":"low",
 "rationale":"Regla low × activo Crítica (WEB-ECOM01) = medium; −1 por bloqueado por el WAF ... → low.",
 "suggestion": {"verdict":"true_positive","decisive":true,"confidence":0.85,"because":["WAF_BLOCKED"]}}
```
- `suggestion.decisive = true` → la política tiene una explicación inequívoca y nada en contra. Así se decide el **87 %** del
  dataset. En modo en vivo el LLM la recibe como *hint* y puede discrepar.
- `compute_severity(rule_sev, max_crit, plus, minus, authorized, criticality_source, false_positive)`: ajuste total ±1.
  Si es autorizado → informational/low; si es FP → informational.
- Criticidad de la identidad: admin → Crítica, service → Alta, VIP o privilegiado → Alta, resto → Media. Activo desconocido → Media.

### Aprobaciones — `soc/policy/approvals.py`
`approval_for(action, target, store)` → `{"allowed", "requires_approval", "approvers": ["N2", ...], "note"}`.
`block_ioc` y `purge_email` no requieren aprobación (salvo servicios de uso dual). Los servidores necesitan N2 + responsable del
servicio, y los TPV o frontales N2 + Negocio. Sobre OT `allowed=false`.
`full_scan` y `propose_rule_exclusion` son acciones de cierre de los runbooks (RB-02, RB-09, RB-10): sin API ni aprobación.

### Cierre y escalado — `soc/policy/closure.py`
- `mandatory_escalation(verdict, hits, rule_id)` → motivos de **escalado obligatorio §5** para un `true_positive`, sin
  depender de la severidad: ejecución confirmada, robo de credenciales, persistencia, datos personales que han podido salir
  (no si un control lo bloqueó) y fraude. Se suman al escalado por `true_positive` high/critical.
- `ticket_status(verdict, severity, escalate, actions, confidence, decided_by)` → `x_status`, por orden:
  `escalated` › `awaiting_approval` (alguna acción necesita aprobación) › `triaged` si lo decide el LLM con confianza
  < `LLM_CLOSE_MIN_CONFIDENCE` (0.7; criterio propio, Deloitte no fija umbral) › `closed` si es FP/benigno, o si es un
  `true_positive` low/informational con acción `close` (runbooks: bloqueado o sin interacción → cerrar) › `triaged`.
- **Nunca se cierra con acciones de la API sin ejecutar.** El sistema no ejecuta contención (Deloitte: «siempre con
  aprobación humana»), así que si el runbook manda «bloquear IOC y cerrar» el ticket queda `triaged` hasta que el N1
  pulsa «Ejecutar»; entonces el dashboard recalcula con `status_for(ticket)` y lo cierra. Una decisión humana de estado
  (cerrar, escalar, reabrir) siempre manda sobre el recálculo.

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

**Agente (`soc/triage/agent.py`) ✅ v1 IMPLEMENTADO (Persona B):**
```python
from soc.triage.agent import triage, triage_many
ticket = triage(ctx, prefilter_hint=None)        # nunca lanza excepción; añade pasos "llm"/"review" a ctx["trace"]
tickets = triage_many(ctxs, workers=5, on_step=cb, prefilter_hints={alert_id: ticket_parcial})
# on_step(alert_id, step, info) con step en "ia" | "revisor" | "error" | "ticket"
```
Campos extra que añade el agente al ticket (todos opcionales para quien los lea):
- `recommended_actions[].x_approvers` (`["N2"]`, `["N2","negocio"]`, `["N2","responsable de <servicio>"]`) y `x_note`.
  Las acciones sobre OT se convierten en `escalate` por código.
- `x_severity`: el `SeverityResult` completo. Mientras no exista `soc/policy/severity.py` se usa una réplica
  provisional de la matriz (`"_provisional": true`). Convención: `false_positive` → `informational`.
- `x_injection`: `{"detected": bool, "notes": "..."}`. Si hay inyección se escala siempre.
- `x_review`: validación de evidencias (`evidence_removed`) y, si se ejecutó, el revisor LLM (`outcome`, `issues`).
- `x_rule`, `x_alert_created_at`, `x_prompt`, `x_llm_cached`, `x_prefilter_agreement`, `x_notes`.
- `x_no_ai: true` si el LLM falló y el ticket viene del prefiltro o es `needs_more_info` (nunca se oculta).

### Incident — `output/incidents.jsonl`
```json
{"incident_id":"INC-0001","alert_ids":[...],"ticket_ids":[...],"entities":{...},
 "first_seen":"...","last_seen":"...","kill_chain":[{"time":"...","tactic":"...","alert_id":"...","what":"..."}],
 "summary":"...","severity":"high"}
```
**Correlación ✅ (Persona D, `soc/correlate/incidents.py`):**
```python
from soc.correlate.incidents import correlate, attach
incidents = correlate(alerts, store, tickets=tickets)   # alertas NO cerradas → [Incident] del más grave al menos
inc_id = attach(alert, incidents, store)                 # en vivo: incidente al que se une (→ x_incident_id) o None
```
Campos extra: `linking_entities` (qué une las alertas), `x_why` (por qué es incidente y no ruido), `x_chain` y
`x_tactics` (cadena de ≥ 2 fases → severidad +1, política §5). CLI: `python -m soc.correlate.incidents [--truth]`
(usa `output/tickets_all_nollm.jsonl` de `python -m soc.pipeline --all --no-llm --out output/tickets_all_nollm.jsonl`).

**Integración en el pipeline ✅ (Persona A, `soc/pipeline.py`):** `run()` rellena `x_incident_id` en dos pasos, solo en
tickets que no son FP/benignos:
1. `link_incident()` → `attach()` contra los incidentes conocidos (`load_incidents()` lee `output/incidents.jsonl`;
   si no existe, `[]` y aviso). Añade a la traza un paso `correlate` (fuente "Correlación").
2. `correlate_batch()` → `correlate()` sobre las alertas del **propio lote** que no se unieron a nada. Es lo que hace
   útil la correlación con el JSON nuevo de la defensa, cuyas alertas no están en nuestros incidentes. Los
   incidentes nuevos llevan `x_live: true`, siguen la numeración (`INC-00NN`) y, en modo `live`, se añaden a
   `output/incidents.jsonl` (los ve el dashboard y los lotes siguientes se unen a ellos).
Parámetros nuevos de `run()`: `incidents=None` (por defecto el fichero), `correlate_new=True`,
`save_incidents_file=None` (por defecto solo en `live`). Lotes de más de 500 alertas no se correlan aquí (usar el CLI).

**Informe de nivel 3 ✅ (Persona D, `soc/correlate/investigate.py`):** `investigate(incident, store) -> report` con el
esquema `informe_incidente.schema.json`. `incident_id`/`alert_ids` los pone el código, los `event_id` de la
cronología se validan contra la evidencia y `containment_plan[].approver` lo decide `soc.policy.approvals`. Sin IA →
informe mínimo con `x_no_ai: true`. CLI: `python -m soc.correlate.investigate --top 3` guarda cada informe en
`output/reports/<INC>.json` y en `x_report` del incidente en `output/incidents.jsonl` (lo lee el dashboard).

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
3. **DataStore cargado una sola vez y en memoria ("caliente").** El backend del dashboard
   (`dashboard/server.py`, un proceso de larga duración) lo carga una vez y lo reutiliza. Triar una alerta no puede implicar volver a leer 800.000 eventos.
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

## Pipeline ✅ IMPLEMENTADO (`soc/pipeline.py`, `soc/triage/prefilter.py`)
```python
from soc.pipeline import run, load_alert_file
tickets = run(alerts, mode="live", workers=5, on_step=lambda alert_id, step, info: ...)
# mode: "live" (IA en todas, la política como pista) | "normal" (IA solo si la política no decide) | "no_llm"
# pasos de on_step: context → policy → llm → reviewer → ticket (o "error"); data = {trace_entry?, ticket?, error?, message?}
# triage_live(alerts=…, ids=…, random=N, on_step=…) = run(mode=TRIAGE_MODE, por defecto "normal") + añade a output/tickets.jsonl (para el dashboard)
```
- **API del SOC de Deloitte (`soc/data/api.py`)** — Deloitte (Discord, 15:50): *"mejor usar la API"* para leer las alertas.
  - **Entrada:** `--ids`, `--random N`, `--queue N` y el dashboard leen las alertas de la API (`GET /alerts/{id}`, `GET /alerts?status=new`) si está levantada; si no, del dataset local (con aviso). `--sample`/`--all` siempre en local. `--local` desactiva la API.
  - **Enriquecimiento híbrido (`HybridStore`):** primero el índice en memoria (ms); lo que no esté en local (alerta, evento, activo, usuario, intel o sandbox nuevos) se pide a la API, con timeouts cortos y máx. 25 llamadas por alerta. Solo en modo `live` (en lotes no se satura la API).
  - **Traza:** la entrada (`intake`: de dónde se leyó la alerta) y cada llamada a la API (`api_cmdb`, `api_logs`…) aparecen en la traza con `source: "API SOC"`.
  - Configuración: `SOC_API_URL`, `SOC_API_MODE=auto|local`, `SOC_API_TIMEOUT`, `SOC_API_LOGS_TIMEOUT`, `SOC_API_MAX_CALLS`.
- **Entrada defensiva** (`soc/data/normalize.py`): toda alerta pasa por `normalize_alert` al entrar en `run()`. Fechas raras/epoch, severidad en castellano o desconocida, `entities`/`evidence`/`mitre`/`related_events` con tipos inesperados, Unicode inválido y textos enormes se corrigen sin inventar nada; lo corregido queda en `x_input_warnings` del ticket y en `open_questions`. No altera ninguna de las 11.061 alertas del dataset.
- **Métricas del batch** (`soc/metrics.py`): `--all` escribe `output/metrics.json` con las claves de `compute_metrics` del dashboard (`total`, `auto_closed`, `llm`, `escalated`, `by_*`, `time_saved_hours`…) más `decided_by_policy_pct`, `pending_ai`, `pending_ai_high_or_critical`, `injection_attempts`, `alerts_per_second`, `top_rules_pending_ai` y `top_rules_true_positive`.
- **El dashboard tría en modo lotes (`normal`), también en la demo** (decisión del equipo, 7/11): la política cierra lo
  inequívoco y la IA solo ve lo ambiguo. `triage_live` usa `TRIAGE_MODE` (por defecto `normal`); `TRIAGE_MODE=live`
  en el entorno del servidor vuelve a pasar todas las alertas por la IA. El CLI `--live` sigue disponible.
- **En `live` (CLI `--live` y `triage_live` con `TRIAGE_MODE=live`) NO se usa la caché de respuestas LLM:** el jurado ve a la IA razonar cada alerta en el momento. `--cache` la fuerza (solo para ensayos rápidos).
- Escribe `output/tickets.jsonl` y `output/traces/<alert_id>.json` (traza + contexto completo, para el dashboard).
- `x_mode` en cada ticket: `policy` (decidido por la política) | `llm` | `no_ai_fallback` | `pending_ai`.
- Deduplicación (solo fuera de `live`): misma regla y mismas entidades en < 1 h → un ticket con varios `alert_ids`.
- Sin IA, las alertas pendientes con severidad potencial high/critical se escalan a una persona (nunca quedan en silencio).

## Ejecución
```bash
python -m soc.pipeline --sample                 # 150 alertas de desarrollo
python -m soc.pipeline --ids ALR-...,ALR-... --live   # alertas concretas (¡las 10 de la defensa!)
python -m soc.pipeline --file defensa.jsonl --live    # alertas nuevas desde fichero
python -m soc.pipeline --random 10 --live             # SIMULACRO de la defensa (cronometrado)
python -m soc.pipeline --all --no-llm                 # todo el dataset solo con la parte determinista (métricas)

# Dashboard (React + FastAPI). Una vez: cd dashboard/web && npm install && npm run build
uvicorn dashboard.server:app --port 8001              # http://localhost:8001
# Desarrollo del frontend con recarga: (cd dashboard/web && npm run dev) → http://localhost:5173
# Sin pipeline todavía: DASHBOARD_SIMULATE=1 → triaje en vivo FALSO, marcado [SIMULADO], solo para probar la UI
```

### Dashboard ↔ pipeline (Persona C ↔ Persona A) — ✅ IMPLEMENTADO por A (`soc.pipeline.triage_live`)
El dashboard lee **solo de disco** (`output/tickets.jsonl`, `output/traces/*.json`, `output/incidents.jsonl` y,
si existe, `output/metrics.json` con las métricas del batch). Si `output/tickets.jsonl` no existe, sirve
`dashboard/sample/` y lo indica en la cabecera ("datos de EJEMPLO").

Las decisiones humanas se guardan en `output/human_decisions.jsonl` (el dashboard **no** reescribe `tickets.jsonl`):
```json
{"ticket_id":"TKT-...","type":"containment|close|escalate|reopen","approver":"Adrián","timestamp":"...",
 "action":"revoke_sessions","target":"...","approval_token":"APR-...","ok":true,"verdict":null,"comment":"..."}
```

Para el triaje en directo, el backend usa, por orden:
1. **En proceso (preferido, DataStore caliente):** si `soc.pipeline` expone
   ```python
   def triage_live(alerts: list[dict] | None = None, ids: list[str] | None = None, random: int = 0,
                   on_step: Callable[[str, str, dict], None] | None = None) -> list[dict]   # -> Tickets
   ```
   `on_step(alert_id, step, data)` con `step` en `context|policy|llm|reviewer|ticket|error` y `data` =
   `{"trace_entry"?: {...}, "ticket"?: Ticket, "error"?: str, "message"?: str}`. Cada entrada de `trace` se emite al
   producirse (para verla en vivo) y al final `on_step(alert_id, "ticket", {"ticket": {...}})`. Las 10 en paralelo las gestiona el pipeline.
2. **Subproceso (fallback):** `python -m soc.pipeline --live --file/--ids/--random` y lee los tickets nuevos de
   `output/tickets.jsonl` al acabar (sin progreso paso a paso).

### Chat IA del ticket (dashboard ↔ Gemini) — ✅ IMPLEMENTADO (`dashboard/chat.py`, detalle en `docs/12_chatbot.md`)
```http
POST /api/tickets/{ticket_id}/chat   {"question": str, "history": [{"role": "user|model", "text": str}]}
→ 200 {"answer": str, "model": str} · 404 ticket · 422 petición inválida · 502 Gemini falló · 503 sin GEMINI_API_KEY
```
- **Solo lectura:** el modelo no tiene herramientas ni acceso a contención/decisiones; no modifica el ticket.
- Ve el ticket (con decisiones humanas aplicadas) + traza + contexto compactado, todo dentro de `<untrusted_data>`.
- Sin estado en el servidor: el navegador reenvía el historial (últimos `CHAT_MAX_TURNS`).
- Usa la API de Gemini directamente (no gasta cuota de Claude Code), con modelos de reserva si uno está saturado.
