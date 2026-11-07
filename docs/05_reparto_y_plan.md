# 05 · Reparto y plan (sábado 7/11 12:30 → domingo 8/11 08:00)

## Reparto (4 personas)
Cada persona es dueña de sus módulos. Para tocar los de otra persona, se avisa antes.
B y D: Izan y Marc (decidid quién es quién y poned el nombre aquí, en `CLAUDE.md` y en `docs/10`).

### Persona A: Datos y política (Lluis)
Es la base de todo y lo que más bloquea a los demás, así que va primero.
- `soc/config.py`, `soc/data/store.py`: carga del dataset, índices por `event_id` y por entidad (IP, host, usuario, dominio, hash, cliente).
- `soc/enrich/`: `build_context()` con traza.
- `soc/policy/severity.py` y `soc/policy/rules.py`: matriz, ajustes, cambios aprobados y reglas internas de Tarvia.
- `soc/triage/prefilter.py` (con B) y `soc/pipeline.py`: CLI y escritura de `output/`.
- **Entregable temprano (≤ 15:30):** `build_context()` funcionando sobre las 150 alertas y un fichero
  `output/contexts_sample.jsonl` para que B y C trabajen con datos reales.

### Persona B: Agente IA
- `soc/triage/agent.py` y `prompts/`: prompt del triaje, salida JSON con el esquema del ticket, defensa contra inyección (ver [07](07_llm.md)).
- `soc/triage/reviewer.py`: revisor crítico. Comprueba que cada afirmación esté respaldada por un `event_id` del contexto.
- Paralelismo, fallback y caché de las llamadas LLM (modo en vivo).
- `eval/evaluate.py`: medir el acierto con las etiquetas de D y afinar prompts. Casos de prompt injection.
- **Mientras A termina el contexto:** trabajar con 3-5 alertas reales construyendo el contexto a mano, o con stubs.

### Persona D: Threat hunting, correlación e investigación
- **Threat hunting manual** de los incidentes escondidos → `eval/incidents_truth.jsonl` (nuestra verdad para evaluar y para la demo).
- `eval/labels_dev.jsonl`: etiquetar a mano unas 40 alertas de la muestra.
- `soc/correlate/incidents.py`: agrupación de alertas en incidentes y cadena de ataque (nivel 2).
- `soc/correlate/investigate.py`: informe de investigación de nivel 3.
- "Lo que no resolvemos" con datos reales.

### Persona C: Dashboard, contención y presentación (Adrián)
- `dashboard/web/` (React + Vite) y `dashboard/server.py` (FastAPI): cola de alertas con filtros, detalle del ticket, **traza de consultas**, evidencias,
  quién decidió cada cosa, vista de incidentes y botón **"Aprobar acción"** que llama a `POST /approvals` y luego a `POST /containment/{accion}`.
- `dashboard/containment.py`: cliente de la API simulada.
- Métricas: % de alertas cerradas automáticamente, % que pasan por el LLM, % escaladas y tiempo ahorrado.
- **Presentación:** guion de la demo, slides y la página para el comité de dirección (ver [08](08_demo_y_pitch.md)).
- **Mientras no hay datos reales:** construir el dashboard contra un `output/tickets.jsonl` de ejemplo con el contrato de [04](04_arquitectura.md).

## Plan horario
| Hora | A (datos/política) | B (agente IA) | D (hunting/correlación) | C (dashboard/pitch) |
|---|---|---|---|---|
| 12:30-13:30 | Setup, lectura de docs, DataStore | Setup, leer runbooks, prompt v0 | Setup, threat hunting | Setup, esqueleto del dashboard React con tickets de ejemplo |
| 13:30-15:30 | Índices + `build_context` | `agent.py` con un contexto hecho a mano | Threat hunting → `incidents_truth.jsonl` (15:00) | Vista de cola y detalle + traza |
| **15:30** | **🔗 Integración 1:** contexto real → agente → ticket → dashboard (5 alertas) | | | |
| 15:30-19:00 | `severity` + `rules` + prefiltro | Revisor, paralelismo, robustez | Etiquetas de evaluación, inicio de la correlación | Aprobación y contención en la API, métricas |
| **19:00** | **🔗 Integración 2:** pipeline completo sobre las 150 alertas | | | |
| 19:00-20:00 | Cena + revisión conjunta de errores del triaje | | | |
| 20:00-00:00 | Prefiltro sobre las 11.061 sin LLM, rendimiento | Evaluación y afinado, prompt injection | Correlación en incidentes | Vista de incidentes y de la cadena de ataque |
| 00:00-03:00 | Corregir errores detectados en la evaluación | Bucle de calidad con simulacros | Investigación nivel 3 | Slides y one-pager |
| **03:00** | **🧊 Congelar funcionalidades.** Solo se corrigen bugs a partir de aquí. | | | |
| 03:00-06:00 | Pruebas con alertas no vistas (simular las 10 de la defensa) | Evaluación final | "Lo que no resolvemos" y caso estrella de la demo | Ensayo de la demo |
| 06:00-08:00 | README final, limpieza | | | Ensayo completo y vídeo de respaldo de la demo |

**Regla de oro:** a las 15:30 y a las 19:00 tiene que haber algo funcionando de punta a punta, aunque sea feo.
Un nivel 1 sólido gana a un nivel 4 roto.

**Prueba de aceptación en cada integración:** `python -m soc.pipeline --random 10 --live`, que simula la defensa
(10 alertas al azar triadas en directo). Hay que anotar el tiempo total y los errores. Objetivo: menos de 2 minutos
y ninguna alerta sin ticket. Ver "Modo defensa en directo" en [04](04_arquitectura.md).

**Responsabilidades del modo en vivo:**
- A: DataStore caliente (< 1 s de contexto por alerta) y entrada por `--ids`, `--file` y `--random`.
- B: llamadas LLM en paralelo, caché, cadena de fallback que no se cuelga y el prefiltro como hint en vivo.
- C: en el dashboard, **pegar o subir alertas nuevas** y ver el progreso y la traza en tiempo real.

## Prioridades si vamos justos (recortar desde abajo)
1. ✅ Nivel 1 sobre la muestra, con ticket correcto y argumentado.
2. ✅ Dashboard con cola, traza y decisión humana.
3. ✅ Política determinista: severidad y benignos autorizados (nivel 2).
4. Correlación en incidentes (nivel 2).
5. Contención con aprobación (nivel 4). Es barata porque la API ya existe.
6. Cadena de ataque multi-día (nivel 3).
