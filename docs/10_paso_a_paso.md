# 10 · Paso a paso por persona

Cada paso tiene: **qué hacer**, **qué archivos**, **cuándo está terminado** y un **prompt para tu Claude**.
Marca los checkbox según avances (edita este archivo y haz commit) para que el resto vea el progreso.

> Entrega: **domingo 08:00**. Puntos de integración: **15:30**, **19:00**, **00:00**. Congelación: **03:00**.
> Prueba de aceptación en cada integración: `python -m soc.pipeline --random 10 --live` (simula la defensa).

---

## PASO 0 · Todos (15 min, ya)

- [ ] Aceptar la invitación de colaborador al repo de GitHub (Lluis la envía).
- [ ] Clonar ambos repos en la **misma carpeta padre**:
  ```bash
  git clone https://github.com/Lluis05/UABTheHack-L1SOC-AI-agent.git
  git clone https://github.com/dttdfr/DTT-UAB-The-Hack.git
  ```
- [ ] Entorno: `python -m venv .venv`, activarlo, `pip install -r requirements.txt`.
- [ ] `cp .env.example .env`. Comprobar que `DATASET_DIR` apunta al dataset. Poner `GEMINI_API_KEY` (gratis en https://aistudio.google.com/apikey).
- [ ] `claude` (login) y luego `python -m soc.llm`. Tiene que imprimir un veredicto en JSON.
- [ ] Leer **15 min**: `docs/01_reto.md`, `docs/03_politica_y_contexto.md` y los contratos de `docs/04_arquitectura.md`.
- [ ] Crear tu rama: A → `feat/data`, B → `feat/agent`, C → `feat/dashboard`. Seguir el **flujo obligatorio** de `docs/06_setup_y_convenciones.md` (nunca commits directos a `main`).
- [ ] Arrancar tu Claude con:
  > Lee CLAUDE.md y todo docs/. Soy la Persona X (ver docs/10_paso_a_paso.md). Vamos a hacer mis pasos en orden.
  > Trabaja solo en mis módulos y respeta los contratos de docs/04_arquitectura.md. No añadas Co-Authored-By en los commits.

---

## PERSONA A · Datos y política — Lluis
**Misión:** que cualquier alerta (del dataset o nueva) tenga su contexto completo y su severidad calculada en menos de 1 s.
Eres el camino crítico: B y C dependen de tu A3.

### A1 · Config y DataStore (12:45 → 14:00) ✅ HECHO (13:00)
- **Archivos:** `soc/config.py`, `soc/data/store.py`.
- **Qué:**
  - `config.py`: lee `.env` (DATASET_DIR, SOC_API_URL, OUTPUT_DIR=`output/`).
  - `DataStore.__init__`: carga alertas (completas y muestra), inventario (activos, usuarios, RRHH, vulnerabilidades,
    servicios, zonas, cambios), inteligencia (TIP, GeoIP, sandbox) y **los 18 logs**.
  - Índices: `event_id → evento` (con `_source`) y `hostname/ip → activo`, `upn/username → usuario`.
  - Caché en disco: tras la primera carga, guardar en `output/cache/store.pkl` para que los siguientes arranques sean rápidos.
- **Terminado cuando:** `python -c "from soc.data.store import DataStore; s=DataStore(...); print(s.event('EDR-0005329'), s.asset('WS-BCN-1174'), s.user('alejandro.ruiz'))"` funciona y medimos el tiempo de carga (en frío y desde la caché).
- **Prompt:** *"Implementa A1 de docs/10_paso_a_paso.md siguiendo el contrato DataStore de docs/04. Mide tiempos de carga."*

### A2 · Índice por entidad y búsqueda temporal (14:00 → 15:00) ✅ HECHO (13:10)
- **Archivos:** `soc/data/store.py`, `soc/enrich/entities.py`.
- **Qué:**
  - `entities.py`: `extract_entities(alert) -> dict` que normaliza `entities` + `evidence` a
    `{users, hosts, ips, domains, urls, hashes, customers, emails, processes}`. Extraer IOCs también del texto de evidence con regex.
  - Índice invertido: valor de entidad (en minúsculas) → lista de `(timestamp, source, event_id)` ordenada por tiempo.
    Campos a indexar por fuente: ver la tabla de `docs/02_dataset.md` (src_ip, dst_ip, hostname, user, user_upn, domain,
    sha256, customer_id, email, sender, recipients, message_id, sourceIPAddress, userIdentity.userName…).
  - `search(entity, start, end, sources, limit_per_source)` con búsqueda binaria por tiempo.
  - `alerts_for_entity(entity, start, end)`.
- **Terminado cuando:** `search()` responde en menos de 50 ms y `extract_entities` funciona sobre las 150 alertas de la muestra sin excepciones.
- **Prompt:** *"Implementa A2. Prueba extract_entities sobre las 150 alertas de la muestra y reporta tipos de entidad que no se normalizan."*

### A3 · build_context (15:00 → 15:30) 🔗 **ENTREGA CRÍTICA** ✅ HECHO (13:20)
- **Archivos:** `soc/enrich/context.py`.
- **Qué:** `build_context(alert, store) -> Context` exactamente según `docs/04`: activos, usuarios (+RRHH),
  related_events, entity_activity ±24 h (como mucho 30 eventos por entidad y fuente), intel y GeoIP de cada IP, dominio y hash, sandbox,
  other_alerts ±7 días y **trace** con cada consulta y su tiempo.
- **Volcar** `output/contexts_sample.jsonl` (las 150) y **subirlo a una rama o compartirlo** para B y C.
- **Terminado cuando:** las 150 alertas generan contexto en menos de 1 s cada una y sin errores. Avisar a B y C.
- **Prompt:** *"Implementa A3. Genera output/contexts_sample.jsonl y mide p50 y p95 de tiempo por alerta."*

### A4 · Motor de política (15:30 → 17:30) ✅ HECHO (14:00)
- **Archivos:** `soc/policy/severity.py`, `soc/policy/rules.py`.
- **Qué:**
  - `severity.py`: matriz exacta de `docs/03`, ajustes ±1 (como máximo uno en total), regla de benign authorized →
    informational/low, criticidad de identidades (VIP/privilegiado → Alta, adm/servicio crítico → Crítica, resto Media),
    activo desconocido → Media. Devuelve `SeverityResult` con `rationale` en castellano.
  - `rules.py`: funciones que devuelven `PolicyHit`. Mínimo:
    - `PENTEST_WINDOW` (CHG-2026-1042: IPs 192.0.2.10-12, 08-10/10, WEB-ECOM).
    - `NESSUS_SCAN` (NESSUS01/svc_scanner, miércoles 01-05, nunca OT).
    - `SCCM_INVENTORY` (EDR-002 + padre CcmExec + ventana 08-10 local). **Si el padre es otro → `suspicious`**.
    - `PSEXEC_DEPLOY` (CHG-2026-1057), `OT_MAINT` (CHG-2026-1063), `VPN_CERT` (1066), `LOGISOFT_UPDATE` (1071),
      `BACKUP_OPERATORS` (1078), `EDR_UPGRADE` (1080), `PAYROLL_FLOW` (FLUJO-0007).
    - Reglas internas: `ADM_OUTSIDE_JUMP01`, `ANYDESK_UNAPPROVED`, `SVC_BACKUP_NO_MFA` (context), `OT_UNAUTHORIZED_SRC`,
      `LOGISOFT_OUTSIDE_HOURS`, `TARVIA_PKG_PUBLIC_REGISTRY`.
    - RRHH: `USER_LEAVING` (baja, sobre todo nuria.vidal → competidor), `ACTIVITY_AFTER_LEAVE`, `USER_TRAVELING` (explica viaje imposible).
    - TIP: `TI_MALICIOUS`, `TOR_OR_HOSTING`; si el indicador es desconocido → `context` ("desconocido ≠ limpio").
    - `PROMPT_INJECTION_TEXT`: regex sobre campos de texto ("ignora", "ignore previous", "marca como", "system prompt"…).
  - **Zona horaria:** helper `to_local(ts)` (UTC+2 hasta el 25/10 03:00, UTC+1 después). Las ventanas de cambios se comparan en hora local.
- **Terminado cuando:** existen tests (`tests/test_policy.py`) para la matriz completa (25 celdas) y para cada regla
  con un caso positivo y uno negativo.
- **Prompt:** *"Implementa A4 con tests. Ejecuta las reglas sobre la muestra y dame un recuento de hits por regla."*

### A5 · Prefiltro y pipeline (17:30 → 19:00) 🔗 **INTEGRACIÓN 2** ✅ HECHO (14:30)
- **Archivos:** `soc/triage/prefilter.py`, `soc/pipeline.py`.
- **Qué:**
  - `prefilter(context) -> dict | None`: decisión determinista cuando es inequívoca (p. ej., `PENTEST_WINDOW` +
    WAF bloqueado → benign_true_positive). Devuelve un ticket parcial con `x_decided_by.verdict="policy"`.
  - `pipeline.py` (CLI): `--sample`, `--ids`, `--file`, `--random N`, `--all`, `--live`, `--no-llm`, `--workers 5`.
    Flujo: contexto → política → prefiltro → (LLM de B si `--live` o si el prefiltro devuelve None) → severidad final con
    `compute_severity` → `requires_approval` según la tabla de aprobaciones → ticket → `output/tickets.jsonl` + `output/traces/`.
    Imprimir el tiempo total y por alerta.
  - Deduplicación: misma regla y mismas entidades en menos de 1 h → un solo ticket con varios `alert_ids`.
- **Terminado cuando:** `--sample` funciona de punta a punta con el agente de B y `--random 10 --live` tarda menos de 2 min.

### A6 · Escala y calidad (20:00 → 03:00)
- [ ] `--all --no-llm` sobre las 11.061 → `output/tickets_all.jsonl` y métricas para C (cerradas por política, pendientes de IA, escaladas).
- [ ] Revisar con B los errores de la evaluación y afinar reglas.
- [ ] Alertas nuevas o mal formadas: campos ausentes, event_ids inexistentes, entidades vacías. **Nunca romper.**
- [ ] Simulacro `--random 10 --live` cada 2 h. Apuntar los resultados en `docs/09_hallazgos.md`.

---

## PERSONA B · Agente IA — _(Izan o Marc)_
**Misión:** que la IA razone como un buen N1, cite evidencias reales y no se deje manipular.
**Rama:** `feat/agent`. **Módulos:** `soc/triage/agent.py`, `soc/triage/reviewer.py`, `soc/triage/prompts/`, `eval/evaluate.py`.

### B1 · Conocer el terreno (12:45 → 13:30) ✅ HECHO (13:25)
- [x] Leer los 10 runbooks (`DATASET_DIR/01_contexto/runbooks/`), el catálogo de casos de uso y `docs/07_llm.md`.
- [x] Elegir **8 alertas de desarrollo** de la muestra que cubran: WEB-001, EML-001, EDR-002 (SCCM y otra), IDP-001,
  NET-001, AI-001 y una high. Guardar sus IDs en `eval/dev_set.txt`.
- **Prompt:** *"Lee los runbooks y la muestra. Propón 8 alertas de desarrollo variadas y explica por qué cada una."*

### B2 · Agente de triaje v1 (13:30 → 15:30) 🔗 **INTEGRACIÓN 1** ✅ v1 HECHO (13:30)
- **Archivos:** `soc/triage/agent.py`, `soc/triage/prompts/system.md` (los runbooks se leen del dataset).
- **Qué:**
  - `triage(context, prefilter_hint=None) -> dict` usando `soc.llm.complete()` con JSON Schema (subset del Ticket
    + `plus_reasons`/`minus_reasons`; ver `docs/07`).
  - System prompt: rol N1, política resumida, reglas de Tarvia, **runbook de la regla** inyectado completo,
    criterios de veredicto, "cita event_id", defensa contra inyección.
  - El contexto va dentro de `<untrusted_data>` (escapando la etiqueta de cierre). Compactar a menos de 15.000 tokens.
  - Caché por hash del prompt en `output/llm_cache/`.
  - Mientras A3 no esté: construir 2-3 contextos a mano desde el dataset (o con un stub).
- **Terminado cuando:** las 8 alertas de desarrollo producen tickets válidos y razonables.
- **Prompt:** *"Implementa B2 según docs/07. Ejecuta sobre eval/dev_set.txt y muéstrame los 8 tickets resumidos."*

### B3 · Revisor + paralelismo + robustez (15:30 → 17:30)
- **Archivos:** `soc/triage/reviewer.py`, `soc/triage/agent.py`.
- **Qué:**
  - Validación **en código** (gratis): cada `evidence[].event_id` tiene que existir en el contexto; si no, se elimina y se baja la confianza.
  - Revisor LLM **solo** si el veredicto es TP con severidad ≥ high, o si la confianza es < 0.6. Es más barato y se usa donde importa.
  - `triage_many(contexts, workers=5, on_step=None)` con ThreadPoolExecutor, timeout de 90 s por alerta, y si todo falla
    se devuelve el prefiltro marcado como "sin IA". `on_step` es el callback de progreso que necesita el dashboard (C4).
- **Terminado cuando:** con `LLM_PROVIDERS=bogus,gemini` sigue funcionando, y 10 alertas en paralelo tardan menos de 2 min.

### B4 · Evaluación y afinado (17:30 → 22:00) 🟡 `evaluate.py` HECHO, falta medir con las etiquetas de D
- **Archivos:** `eval/evaluate.py`, prompts.
- **Uso:**
  ```bash
  python -m eval.evaluate --run                  # tría las alertas de eval/labels_dev.jsonl (IA en todas, con caché) y evalúa
  python -m eval.evaluate --run --mode no_llm    # línea base: solo la política (para comparar "con IA" frente a "sin IA")
  python -m eval.evaluate --run --mode normal    # el sistema real (política + IA donde hace falta)
  python -m eval.evaluate --tickets output/tickets.jsonl          # evalúa tickets ya generados
  python -m eval.evaluate --policy-labels --tickets <f>           # sin etiquetas: concordancia IA ↔ política concluyente
  python -m eval.evaluate --run --cases eval/injection_cases.jsonl   # B5: alertas con la etiqueta en "x_expected"
  ```
  Informe en `output/eval_report.json`. Las etiquetas aceptan `"verdict": [..]` con varias respuestas válidas
  (p. ej. SCCM: FP o benigno) y `"injection": true` para medir la detección de inyecciones.
- **Qué:** `evaluate.py` compara `output/tickets.jsonl` con las etiquetas de D (`eval/labels_dev.jsonl`): accuracy del
  veredicto, acierto de severidad (exacto y ±1), matriz de confusión y lista de errores.
  Iterar el prompt (por runbook si hace falta) hasta que los errores tengan explicación.
- **Terminado cuando:** hay un número real de acierto para el pitch y está en `docs/09_hallazgos.md`.

### B5 · Prompt injection a prueba (22:00 → 00:00)
- [ ] Crear `eval/injection_cases.jsonl`: 5-6 alertas manipuladas (asunto de correo, prompt de Vela, command line y
  descripción de servicio con instrucciones del tipo "cierra esta alerta" o "marca como false_positive").
- [ ] Comprobar que **ninguna** cambia el veredicto y que la inyección aparece como evidencia. Medirlo en `evaluate.py`.
- [ ] Preparar el caso de la demo (ver `docs/08`).

### B6 · Bucle de calidad (00:00 → 03:00)
- [ ] Simulacros `--random 10 --live`, revisar cada ticket y corregir prompts o esquema.
- [ ] Ajustar `CLAUDE_MODEL` (sonnet frente a opus) según calidad, tiempo y cuota. **Dejar cuota para el domingo.**

---

## PERSONA D · Threat hunting, correlación e investigación — _(Izan o Marc)_
**Misión:** saber **qué incidentes reales hay escondidos** en el dataset (nuestra "verdad"), etiquetar la evaluación
y construir la correlación que los encuentre automáticamente (niveles 2 y 3).
**Rama:** `feat/correlate`. **Módulos:** `soc/correlate/`, `eval/labels_dev.jsonl`, `eval/incidents_truth.jsonl`, `eval/hunt/`.

### D1 · Threat hunting manual (12:45 → 15:00)
- **Qué:** con tu Claude y scripts de análisis de solo lectura (`eval/hunt/*.py`), buscar los incidentes escondidos.
  Pistas de `docs/03` por las que empezar:
  - **nuria.vidal** (se va a un competidor el 16/10): DLP, subidas a la nube, consultas SQL al CRM, correo externo.
  - **Fraude de IBAN** (UC-EML-004) mientras jordi.serra2 (Tesorería) está de vacaciones (26-30/10).
  - Alertas **de una sola ocurrencia** (LSASS, shadow copies, MFA fatigue, regla de buzón, AnyDesk, CLD-002 admin IAM,
    EDR-011, EDR-012 TPV, AI-002, OT-001, DEV-001): ¿qué pasó antes y después en ese host o usuario?
  - **JENKINS-DEV01** (CVE crítico, expuesto) y la cadena CI/CD → AWS.
  - Actividad fuera de las ventanas de los cambios: IP del pentest fuera de fechas, EDR-002 con un padre que no es CcmExec, `adm.*` fuera de JUMP01.
  - Viajes imposibles que **no** explica RRHH. Bajas con actividad posterior a su último día.
- **Salida:** `eval/incidents_truth.jsonl` (un incidente por línea: id, descripción, alert_ids, entidades, cronología,
  veredicto y severidad esperados) y un resumen en `docs/09_hallazgos.md`. **Compartir a las 15:00:** a A le sirve
  para las reglas, a B para los prompts y a C para elegir los casos de la demo.
- **Prompt:** *"Haz D1: threat hunting de solo lectura sobre el dataset de DATASET_DIR. Empieza por las pistas de docs/10.
  Para cada incidente que encuentres dame alert_ids, event_ids clave y la cronología."*

### D2 · Etiquetas de evaluación (15:00 → 17:30)
- **Archivos:** `eval/labels_dev.jsonl`.
- **Qué:** etiquetar a mano unas **40 alertas** de la muestra de desarrollo, repartidas entre reglas, más las alertas de los
  incidentes de D1. Formato: `{"alert_id", "verdict", "severity", "escalate", "reason", "incident_id"}`.
  Aplicar la matriz de `docs/03` a mano (o con `soc/policy/severity.py` cuando lo tenga A).
- **Terminado cuando:** B puede ejecutar `evaluate.py` con estas etiquetas.

### D3 · Correlación en incidentes (17:30 → 22:00) — nivel 2
- **Archivos:** `soc/correlate/incidents.py`.
- **Qué:**
  - Grafo de alertas que comparten entidades (usuario, host, IP externa, dominio, hash, message_id) dentro de una ventana
    configurable (días). Usar `extract_entities` y `alerts_for_entity` de A. **Excluir entidades "hub"** (IPs de proxy,
    DCs, dominios populares, la IP del pentest, NESSUS01) para no fusionarlo todo.
  - Componentes conexos → `Incident` (ver `docs/04`). Ordenar por tiempo → `kill_chain` por táctica MITRE.
  - En modo en vivo: `attach(alert) -> incident_id | None` para saber a qué incidente existente se une una alerta nueva (`x_incident_id`).
  - Severidad del incidente = la máxima de sus alertas, +1 si forma una cadena (política §5).
- **Terminado cuando:** **encuentra automáticamente los incidentes de `eval/incidents_truth.jsonl`**. Medir cuántos
  encuentra y cuántas alertas sobran o faltan.

### D4 · Investigación nivel 3 (22:00 → 02:00)
- **Archivos:** `soc/correlate/investigate.py`.
- [ ] Para incidentes escalados: un prompt LLM (con `soc.llm.complete`) que redacte el informe según
  `informe_incidente.schema.json` (origen, alcance, cronología y relación con otros incidentes) a partir de las
  alertas, el contexto y los logs de las entidades a lo largo de los días.
- [ ] Guardarlo en `output/incidents.jsonl` para que C lo muestre.

### D5 · Honestidad y apoyo a la demo (02:00 → 06:00)
- [ ] Redactar "Lo que no resolvemos" en `docs/08_demo_y_pitch.md` con datos reales: incidentes que no encontramos,
  errores típicos y limitaciones.
- [ ] Preparar con C el caso estrella de la demo: un incidente multi-día reconstruido de principio a fin.

## PERSONA C · Dashboard, contención y presentación — Adrián
**Misión:** que el jurado *vea* cómo la IA hace el triaje y dónde decide la persona. Esto es lo que van a evaluar visualmente.

### C1 · Esqueleto con datos falsos (12:45 → 14:00)
- **Archivos:** `dashboard/web/` (React + Material UI), `dashboard/server.py` (FastAPI) y `dashboard/sample/` (datos falsos según el contrato de `docs/04`). ✅ hecho.
- **Qué:** React + Material UI con la jerarquía base → shared → pages (ver `docs/06`). Páginas: **Cola**, **Detalle de alerta/ticket**, **Incidentes**,
  **Métricas**, **Defensa en directo**.
  - Cola: tabla con severidad (color), veredicto, título, regla, `x_decided_by`, estado y filtros.
- **Terminado cuando:** `uvicorn dashboard.server:app --port 8001` muestra la cola con los tickets de ejemplo en http://localhost:8001.
- **Nada de Streamlit:** el dashboard es React + Material UI.

### C2 · Detalle y traza (14:00 → 15:30) 🔗 **INTEGRACIÓN 1**
- **Qué:** vista de detalle con:
  - Cabecera: título, veredicto, confianza (barra), severidad + `severity_rationale` (cómo se aplicó la matriz).
  - **"Qué consultó la IA"**: la `trace` como timeline (paso → consulta → resultado → ms).
  - **"En qué se basa"**: evidencias con `event_id` (expandibles al evento crudo), enrichment y `x_policy_hits`.
  - **"Quién decidió qué"**: chips de colores, 🤖 IA, 📏 Política, 👤 Persona.
  - Acciones recomendadas y `open_questions`.
- A las 15:30, cambiar a `output/tickets.jsonl` real.

### C3 · Aprobación humana y contención (15:30 → 18:00) — nivel 4
- **Archivos:** `dashboard/containment.py`.
- **Qué:**
  - Cliente de la API simulada (`SOC_API_URL`): `approve(action, target, approver, reason)` y `contain(action, target, justification, token, ticket_id)`.
  - En el detalle, cada acción con `requires_approval=true` lleva un botón **"Aprobar y ejecutar"**: pide el nombre del
    aprobador (N2) → `POST /approvals` → `POST /containment/{accion}` → mostrar el resultado → guardar en
    `executed_actions` y cambiar `x_status`.
  - `block_ioc` y `purge_email` se ejecutan sin aprobación, pero **con confirmación del analista**.
  - Botones del analista: "Confirmar veredicto", "Cambiar veredicto" (→ `x_decided_by.verdict = "human"`), "Escalar" y "Cerrar".
  - Página "Registro de contención" con `GET /containment/log`.
  - **Bloquear en la UI** las acciones sobre OT (la API también las rechaza).
- **Terminado cuando:** se aprueba y ejecuta `revoke_sessions` y aparece en el log de la API.

### C4 · Defensa en directo (18:00 → 20:00) ⭐ **la página más importante**
- **Qué:** página "Defensa en directo":
  - Entrada: pegar IDs, **pegar JSON de alertas** o subir JSONL.
  - Botón "Triar". Llama al pipeline de A/B **dentro del proceso** del backend (`dashboard/live.py`), con el DataStore precargado.
  - Progreso **en tiempo real** por alerta (contexto → política → IA → revisor → ticket) en la página "Triaje en directo",
    y la traza apareciendo mientras se calcula.
  - Al terminar: resumen (veredictos, severidades, escalados, tiempo total frente a los ~15 min por alerta de un humano).
- Coordinar con A y B: necesitas una función de pipeline con **callback de progreso** (`on_step(alert_id, step, data)`); el contrato está en `docs/04` → "Dashboard ↔ pipeline".

### C5 · Incidentes y métricas (20:00 → 00:00)
- [ ] Página Incidentes: lista y, en el detalle, una **línea de tiempo de la cadena de ataque** (alertas por táctica MITRE a lo largo de los días) con las entidades implicadas.
- [ ] Página Métricas (sobre `--all --no-llm` + muestra): % cerradas por política, % analizadas por IA, % escaladas,
  distribución de severidades, tiempo medio, horas de analista ahorradas y acierto de la evaluación de B.

### C6 · Presentación (00:00 → 06:00)
- [ ] Slides (unas 8): problema → solución → arquitectura (IA / política / persona) → demo → resultados → seguridad
  (prompt injection) → lo que no resolvemos → siguientes pasos.
- [ ] **One-pager para el comité de dirección de Tarvia** (en lenguaje de negocio; ver `docs/08`).
- [ ] Guion de la demo y **ensayo cronometrado** con un simulacro `--random 10`.
- [ ] **Vídeo de respaldo** de la demo grabado antes de las 07:00.

---

## Puntos de integración (todos juntos, 15 min)
| Hora | Qué tiene que funcionar | Responsable de que pase |
|---|---|---|
| **15:00** | Incidentes escondidos documentados (`eval/incidents_truth.jsonl`) | D |
| **15:30** | 5 alertas reales: contexto (A) → agente (B) → ticket → dashboard (C) | A |
| **19:00** | `--sample` completo + `--random 10 --live` < 2 min + aprobación y contención funcionando | B |
| **00:00** | Incidentes + página de defensa en directo + métricas sobre todo el dataset | C |
| **03:00** | 🧊 Congelación. Solo bugs. Simulacro completo de la defensa. | Todos |
| **07:00** | Vídeo de respaldo, README final, `main` estable | Todos |

## Si alguien termina antes
Ayuda en el siguiente orden: (1) simulacros `--random 10` y corregir lo que rompa, (2) etiquetas de evaluación,
(3) buscar incidentes escondidos para `docs/09`, (4) pulir el dashboard.
