# 🛡️ Tarvia · L1 SOC AI Agent — UAB The Hack × Deloitte

> Sistema que hace el **triaje de nivel 1** del SOC de Tarvia Group: recibe cada alerta, la investiga con los datos
> del SOC (CMDB, directorio, TIP, logs, cambios), aplica la política de la empresa y deja al analista una conclusión
> lista para decidir. **La IA investiga, la política decide la severidad y la persona aprueba la contención.**

---

## 🎯 El problema

El SOC de Tarvia recibe unas **4.000 alertas al día** con 3 analistas N1 que trabajan de 8 a 20 h. Triar una alerta
a mano lleva unos **15 minutos** (SIEM → CMDB → directorio → VirusTotal → logs → ticket), y la mayoría son ruido:
falsos positivos, reglas mal afinadas y actividad autorizada que parece un ataque. De noche y en fin de semana nadie
mira la consola.

## 💡 Nuestra solución: híbrido determinista + IA

No pasamos 11.061 alertas por un LLM. **Lo que la política define con exactitud lo hace el código**; **el LLM se usa
donde hace falta criterio**. Cada campo del ticket indica quién lo decidió (`policy`, `llm` o `human`).

| Quién | Qué decide |
|---|---|
| **Código determinista** (`soc/policy`) | Severidad con la matriz de la política (severidad de la regla × criticidad del activo, ajustes de ±1 nivel), cambios aprobados, ventanas de pentest, reglas internas de Tarvia, qué acciones necesitan aprobación y de quién. |
| **IA** (`soc/triage`) | Veredicto en los casos ambiguos, interpretación de la evidencia, resumen para N2, mapeo MITRE y acciones propuestas. Puede proponer un ajuste de severidad justificado, que el código valida. |
| **Persona** (dashboard) | Aprueba o rechaza la contención, revisa lo escalado y puede reabrir o cambiar un veredicto. **La IA nunca tiene acceso a la contención.** |

```
 Alertas (API simulada del SOC / JSON de la defensa)
        │
        ▼
 1. Normalización ─▶ 2. Contexto ─────────▶ 3. Política ──────────▶ 4. Prefiltro
    entrada robusta    CMDB, usuario+RRHH,     matriz de severidad,     ¿decisión clara?
    (cualquier JSON)   TIP, GeoIP, sandbox,    cambios aprobados,        │ sí → ticket (policy)
                       logs ±24 h, alertas     reglas de Tarvia,         │ no
                       de las mismas           detección de inyección    ▼
                       entidades                                    5. Agente LLM + revisor
                                                                       veredicto con evidencia citada
        ┌──────────────────────────────────────────────────────────────┘
        ▼
 6. Correlación ─▶ incidentes multi-alerta (grafo de entidades, días o semanas)
        ▼
 7. Dashboard ─▶ cola, traza de consultas, evidencias, chat del ticket
                 └─▶ aprobación humana ─▶ POST /approvals ─▶ POST /containment (API simulada)
```

Detalle completo y contratos entre módulos en [`docs/04_arquitectura.md`](docs/04_arquitectura.md).

## 🧗 Hasta dónde hemos llegado (niveles del reto)

| Nivel | Estado | Qué hace |
|---|---|---|
| **1 · Triaje básico** | ✅ | Ticket por alerta con el esquema oficial (`ticket_salida.schema.json`): veredicto, confianza, severidad razonada, evidencias con `event_id`, enriquecimiento, MITRE, acciones, escalado y preguntas abiertas. |
| **2 · Triaje con criterio** | ✅ | Matriz de severidad con la criticidad real del activo, descarte argumentado de lo autorizado (SCCM, pentest, Nessus, Terraform, flujos de nóminas…), deduplicación y correlación en incidentes. |
| **3 · Investigación** | 🟡 | Reconstrucción de la cadena de ataque entre días, e informe con el esquema `informe_incidente.schema.json` (`soc/correlate/investigate.py`). Hay un informe generado de ejemplo ([`docs/anexos/informe_INC-0004.json`](docs/anexos/informe_INC-0004.json)); el dashboard muestra los incidentes, pero todavía no el informe completo. |
| **4 · Respuesta** | ✅ | Acciones de contención propuestas con su aprobador según la política; se ejecutan contra la API simulada solo tras la aprobación humana (`approval_token`) y quedan en el registro. |

## 📊 Resultados medidos

- **Todo el dataset sin IA** (`--all --no-llm`): la política decide sola **9.548 de 10.972 tickets (87 %)**; los 1.424
  restantes quedan pendientes de IA. Ninguno se cierra en silencio: los pendientes high/critical se escalan a una persona.
- **Simulacros de la defensa** (`--live`, la IA razona cada alerta en directo, sin caché):
  - 10 alertas al azar (`--random 10`): **73 s** en total (unos 7 s por alerta en paralelo), 10/10 con IA.
  - 10 alertas de 10 incidentes reales distintos, con la API simulada y el OSINT activados: **128 s** en total
    (unos 13 s por alerta en paralelo), **10/10 true_positive y 10/10 escaladas a N2**.
  - Un N1 humano tarda unos 15 min por alerta.
- **Prompt injection:** **6/6** inyecciones detectadas y **0** veredictos cambiados, con 0 falsas detecciones en el
  control. Incluye un caso real del dataset (`ALR-20261020-011905`, factura falsa con texto oculto que pide marcarla como
  false_positive).
- **Correlación:** encuentra los **12/12** incidentes de nuestra verdad de threat hunting (`eval/incidents_truth.jsonl`),
  con todas sus alertas, incluidos los de varias fases sin entidades en común (Logisoft 18/18 y tienda T07 5/5).
- **OSINT** (opcional): con las listas públicas ya cargadas añade unos milisegundos por alerta; en el simulacro encontró
  la IP de la VPN de Logisoft y la del C2 del minero de Jenkins en 8 listas negras de IPsum.
- **Tests:** 184 tests en Python (`pytest`) y tests del frontend (`vitest`). Ningún test puede gastar cuota del LLM.

## 🔒 Seguridad por diseño

- **Datos no confiables:** todo lo que viene de alertas y logs (asuntos, prompts, command lines…) va dentro de
  `<untrusted_data>` y se trata como dato, nunca como instrucción. La política detecta los intentos de inyección.
- **El LLM no tiene herramientas** (`claude -p` sin tools) ni acceso a los endpoints de contención.
- **Indicadores reales del dataset:** no se visitan, no se descargan ni se escanean. El OSINT solo consulta servicios
  de reputación.

## ⚠️ Lo que no resolvemos

Resumen; la lista completa, con datos, está en [`docs/08_demo_y_pitch.md`](docs/08_demo_y_pitch.md#lo-que-no-resolvemos-rellenar-con-honestidad-durante-la-noche).

- **Sin IA, la política deja 49 de 83 alertas de ataque pendientes** (credential stuffing, túnel DNS, AiTM, fuga de
  datos…): necesitan el LLM o una persona.
- **Gemini gratis no aguanta la defensa si Claude se cae** (5 peticiones/min). Las alertas sin IA salen marcadas
  `[SIN IA]` con la decisión de la política.
- **La correlación solo une lo que conecta un dato.** Une fases sin entidades en común si los datos las enlazan
  (destino de la sesión en el firewall, misma tienda en la CMDB: así salen enteros Logisoft y la tienda T07), pero
  no usa conocimiento de negocio que no esté en los datos. Genera además 1 incidente falso de 13.
- **OSINT limitado:** además del TIP interno, GeoIP y el sandbox, consultamos listas públicas de reputación (Tor,
  IPsum, C2IntelFeeds) y ThreatFox (con clave), hasta 3 indicadores por alerta. No consultamos VirusTotal ni AbuseIPDB,
  y viene desactivado por defecto (`OSINT_ENABLED=1`).
- **Listas fijas** de servicios legítimos e infraestructura conocida, que en otra empresa habría que mantener.
- **Las etiquetas de evaluación son nuestras:** la verdad la ha construido el equipo con threat hunting.

## 🧱 Stack

- **Python 3.11+**, pipeline propio con salida estructurada (JSON Schema).
- **LLM con fallback automático:** Claude Code headless (`claude -p`) → Google Gemini (free tier). Orden en `LLM_PROVIDERS`.
- **API del SOC:** `mock_soc_api` (FastAPI) de Deloitte, para leer alertas, enriquecer y ejecutar la contención.
- **Datos:** índices en memoria sobre el dataset, cargados una sola vez (contexto en < 1 s por alerta).
- **Dashboard:** React + Vite + Material UI (frontend) y FastAPI (`dashboard/server.py`). Chat del ticket con Gemini,
  solo de consulta ([`docs/12_chatbot.md`](docs/12_chatbot.md)).

## 🚀 Puesta en marcha

Requisitos: Python 3.11+, Node.js, el CLI de Claude Code con sesión iniciada y el repo de Deloitte
([`dttdfr/DTT-UAB-The-Hack`](https://github.com/dttdfr/DTT-UAB-The-Hack)) clonado **en la misma carpeta padre**.
El dataset no se copia a este repo.

```bash
git clone https://github.com/Lluis05/UABTheHack-L1SOC-AI-agent.git
cd UABTheHack-L1SOC-AI-agent
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # DATASET_DIR, GEMINI_API_KEY (fallback y chat) y, opcional, OSINT_ENABLED y ABUSECH_AUTH_KEY
claude                      # login en Claude Code (una sola vez)
python -m soc.llm           # prueba rápida de la capa LLM
```

**1. API simulada del SOC** (en el repo de Deloitte):
```bash
cd ../DTT-UAB-The-Hack/06_herramientas
pip install -r requirements.txt
uvicorn mock_soc_api:app --port 8000          # http://localhost:8000/docs
```
Si no está levantada, el sistema lee del dataset local y lo avisa.

**2. Dashboard:**
```bash
cd dashboard/web && npm install && npm run build && cd ../..
uvicorn dashboard.server:app --port 8001      # http://localhost:8001
```
Desde el dashboard se puede triar en directo: subir o pegar el JSON de alertas (cualquier formato), o elegir IDs.
Por defecto tría en modo `normal` (la política cierra lo inequívoco y la IA ve lo ambiguo); con `TRIAGE_MODE=live`
la IA analiza todas las alertas.

**3. CLI:**
```bash
python -m soc.pipeline --file defensa.json --live        # alertas nuevas (p. ej. las de la defensa)
python -m soc.pipeline --ids ALR-...,ALR-... --live      # alertas concretas
python -m soc.pipeline --random 10 --live                # simulacro de la defensa, cronometrado
python -m soc.pipeline --sample                          # las 150 alertas de desarrollo
python -m soc.pipeline --all --no-llm                    # todo el dataset solo con la política (métricas)
```
Salida: `output/tickets.jsonl`, `output/traces/<alert_id>.json` y `output/incidents.jsonl`.

**4. Tests** (no gastan cuota del LLM):
```bash
pytest                                  # backend
cd dashboard/web && npm test            # frontend
```

## 📁 Estructura del proyecto

```
.
├── soc/
│   ├── llm.py          # Capa LLM: Claude Code → Gemini (fallback)
│   ├── data/           # Carga e indexado del dataset, cliente de la API y normalización de la entrada
│   ├── enrich/         # Contexto: CMDB, usuarios, TIP, GeoIP, sandbox, logs ±24 h
│   ├── policy/         # Matriz de severidad, cambios aprobados, reglas de Tarvia, aprobaciones, cierre
│   ├── triage/         # Prefiltro determinista, agente LLM, revisor
│   ├── correlate/      # Incidentes multi-alerta e informe de investigación
│   └── pipeline.py     # Orquestación y CLI
├── dashboard/          # React + FastAPI: cola, traza, evidencias, aprobación humana, triaje en vivo, chat del ticket
├── presentacio/        # Presentación interactiva del pipeline con casos reales (ver su README)
├── eval/               # Etiquetas del equipo, verdad de incidentes, casos de inyección y evaluación
├── tests/              # pytest
└── docs/               # Documentación del equipo
```

## 📚 Documentación

Toda la documentación está en [`docs/`](docs/00_INDICE.md): el reto, el dataset, la política del SOC, la
arquitectura y los contratos, el setup, la capa LLM, la demo y los hallazgos del dataset
([`docs/09_hallazgos.md`](docs/09_hallazgos.md)). Para trabajar con Claude Code, ver [`CLAUDE.md`](CLAUDE.md).

## 👥 Equipo

- **Lluis Sarries Mas**
- **Adrián Valverde Ambrosio**
- **Marc Cantero Priego**
- **Izan Caballer Jimenez**

---

*Proyecto desarrollado para **UAB The Hack 2026** con el reto propuesto por **Deloitte**. Empresa, personas y
datos de Tarvia Group son ficticios.*
