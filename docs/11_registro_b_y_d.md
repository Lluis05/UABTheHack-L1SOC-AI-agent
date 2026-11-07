# 11 · Registro de trabajo: Persona B y Persona D (Marc)

Qué se ha hecho, dónde está, cómo reproducir lo que **no** está en git (todo `output/` está en `.gitignore`), qué
decisiones se tomaron y qué queda pendiente. Los hallazgos del dataset están en [09](09_hallazgos.md); los
contratos, en [04](04_arquitectura.md).

## 1. Estado de las ramas (07/11)
| Rama | Contenido | ¿En main? |
|---|---|---|
| `feat/agent` | B2-B5: agente, revisor, evaluación, casos de inyección, hallazgo de Gemini | Hasta `fd9a729` sí; los commits de evaluación, inyección y Gemini **no** |
| `feat/correlate` | Sale de `feat/agent` y añade D1-D4: hunting, verdad, etiquetas, correlación, informe nivel 3 | **No** |

Para integrar: `feat/correlate` contiene todo `feat/agent`, así que basta con `git checkout main && git pull &&
git merge --ff-only feat/correlate` (si main ha avanzado: `git checkout feat/correlate && git rebase main` antes).
**Pendiente de decidir quién lo hace**, porque toca docs de todos.

## 2. Configuración local que no va en git
- `.env`: `GEMINI_API_KEY` (la de Marc, **regenerarla tras el hackathon**: se pegó en un chat) y
  `GEMINI_MODEL=gemini-3.8-flash`. `.env.example` ya está actualizado; cada uno tiene que cambiarlo en su `.env`.
- `soc/llm.py` (de Lluis) sigue teniendo `gemini-2.5-flash` como valor por defecto si `.env` no dice nada. Lluis:
  cambiadlo a `gemini-3.8-flash`.
- Windows: `PYTHONUTF8=1` antes de cualquier comando.

## 3. Ficheros generados (en `output/`, no versionados) y cómo regenerarlos
| Fichero | Comando | LLM | Tiempo |
|---|---|---|---|
| `output/tickets_dev.jsonl` | `python -m soc.triage.agent --dev` | 8 llamadas (+revisor) | ~60 s |
| `output/tickets_eval.jsonl`, `output/eval_report.json` | `python -m eval.evaluate --run --cases eval/injection_cases.jsonl` | 7 (+revisor) | ~90 s |
| `output/eval_report_nollm.json` | `python -m eval.evaluate --run --mode no_llm --report output/eval_report_nollm.json` | no | 1 s |
| `output/tickets_all_nollm.jsonl` | `python -m soc.pipeline --all --no-llm --out output/tickets_all_nollm.jsonl` | no | ~25 s |
| `output/incidents.jsonl` | `python -m soc.correlate.incidents --truth` (necesita el anterior) | no | ~15 s |
| `output/reports/INC-0004.json` (+ `x_report` en incidents.jsonl) | `python -m soc.correlate.investigate --ids INC-0004` | 1 | ~70 s |
| `output/hunt/rare.txt` | `python -m eval.hunt.dump_rare 12 > output/hunt/rare.txt` | no | 5 s |

**Copia versionada del informe de la intrusión** (para la demo sin gastar cuota): [anexos/informe_INC-0004.json](anexos/informe_INC-0004.json).
Ojo: si se regenera `output/incidents.jsonl`, se pierde el `x_report`; hay que volver a lanzar `investigate`
(desde la caché `output/llm_cache/inv-*.json` es instantáneo si el prompt no cambia).

Orden para dejar el dashboard con incidentes e informes reales:
```bash
python -m soc.pipeline --all --no-llm --out output/tickets_all_nollm.jsonl
python -m soc.correlate.incidents --truth
python -m soc.correlate.investigate --top 3        # 3 llamadas LLM
```

## 4. Resultados medidos (resumen; detalle en 09)
| Prueba | Resultado |
|---|---|
| Dev set (8 alertas, Sonnet) | 8/8 tickets válidos, 60 s con 4 en paralelo |
| Inyección (6 casos + 1 control) | IA: 6/6 detectadas, 0 veredictos cambiados, 6/6 escaladas, 0 falsas detecciones. Política sola: 4/6 |
| B3: Claude caído → Gemini gratis | 10/10 tickets sin romperse, pero solo 2 con IA y 210 s (límite de 5 peticiones/min) |
| Política sola contra la verdad (138 alertas) | 0 ataques cerrados como benignos, 0 falsas alarmas, 55/55 señuelos bien, 49/83 TP "pendientes de IA" |
| Correlación | 12/12 incidentes encontrados, 1 falso de 14 |
| Informe nivel 3 de INC-0004 | 15 hitos con event_id reales, 0 inventados, 67 s |

**Aún no medido:** la evaluación del sistema completo con IA contra la verdad (B4). Comando:
`python -m eval.evaluate --run --mode normal` (~50 llamadas: solo las 49 pendientes pasan por la IA).

## 5. Decisiones tomadas (y por qué)
- **Etiquetas (D2):** en vez de 40 alertas de ruido de la muestra, se etiquetan las **138 alertas del escenario**
  (83 de ataque + 55 señuelos). Miden justo lo que importa (¿cazamos los ataques?, ¿cerramos los señuelos?) y no
  copian la política, así que la evaluación no es circular. Las construyó Marc con su Claude: **revisadlas** (tabla en 09).
- **FP y benigno se aceptan los dos** en los señuelos y en SCCM (`"verdict": [..]`): para el SOC el resultado es el
  mismo (cerrar con justificación). La decisión de equipo sobre SCCM sigue abierta.
- **Severidad de las etiquetas:** solo en los señuelos (`informational`); en los TP es `null` (no se evalúa) porque
  aplicar la matriz a mano a 83 alertas no es fiable.
- **Correlación con vínculos fuertes y débiles:** usuario, puesto o IP interna solo unen alertas a menos de 2 días;
  IOC externos, hasta 10 días. Con una sola ventana salían 344 incidentes falsos.
- **Lista de infraestructura conocida** (`HUB_STATIC`, `BENIGN_DNS_SERVICES` en `soc/correlate/incidents.py`): DCs,
  NESSUS01, JUMP01, IPs del pentest, la web propia y los dominios DNS de antivirus (ESET `e5.sk`, McAfee, Spamhaus,
  Sophos). Es conocimiento de analista: en otra empresa habría que mantenerla.
- **Un grupo solo es incidente** si tiene una regla poco frecuente (≤ 15 alertas en el dataset), un IOC externo
  repetido en ≥ 3 alertas o un TP high/critical (`x_why` lo explica).
- **Severidad del incidente:** la máxima de sus alertas, +1 si hay ≥ 2 tácticas MITRE distintas (política §5).
- **Informe nivel 3:** el LLM redacta, pero el código pone `incident_id`/`alert_ids`, quita los `event_id`
  inventados y decide los aprobadores con `soc.policy.approvals`; nada sobre OT.
- **Casos de inyección:** alertas reales con TP conocido, copiadas con id `ALR-INJ-xxxx` y la instrucción en un campo
  distinto cada una (`eval/make_injection_cases.py`).

## 6. Mapa de ficheros nuevos
| Fichero | Qué es |
|---|---|
| `eval/evaluate.py` | Métricas de triaje contra etiquetas (veredicto, binario, severidad, escalado, inyección) |
| `eval/make_injection_cases.py`, `eval/injection_cases.jsonl` | Casos de prompt injection (B5) |
| `eval/hunt/*.py` | Scripts de threat hunting de solo lectura (`rare_rules`, `dump_rare`, `dump_scenario`, `probe`) |
| `eval/hunt/truth.py` | La verdad escrita a mano; valida y genera `eval/incidents_truth.jsonl` y `eval/labels_dev.jsonl` |
| `soc/correlate/incidents.py` | Correlación en incidentes + `attach()` para el modo en vivo |
| `soc/correlate/investigate.py` | Informe de nivel 3 con el esquema de Deloitte |
| `tests/test_evaluate.py`, `tests/test_correlate.py`, `tests/test_investigate.py` | 15 tests (93 en total en verde) |

## 7. Pendiente y avisos por persona
- **Todos:** revisar la verdad (`docs/09`, tabla de incidentes) y decidir SCCM (FP o benigno).
- **Lluis (A):**
  - Integrar `attach()` en el pipeline para rellenar `x_incident_id` en vivo.
  - Cerrar como FP los UC-NET-006 de servicios DNS de antivirus.
  - Ampliar la regex de inyección a command lines y UC-AI-002.
  - Cambiar el modelo de Gemini por defecto en `soc/llm.py`.
- **Adrián (C):** `output/incidents.jsonl` ya existe con el contrato de 04 (más `x_report` en INC-0004). Falta
  preparar con D el caso estrella de la demo; propuesta: INC-0004, la intrusión de marta.puig (informe en `docs/anexos/`).
- **B:** B4 con IA (`python -m eval.evaluate --run --mode normal`), afinar el prompt con sus errores y B6
  (simulacros). **Guardar cuota de Claude para el domingo:** Gemini gratis no sirve de respaldo para la defensa.
- **D:**
  - Unir los dos incidentes partidos: Logisoft (VPN + túnel DNS de WMS01) y T07 (AnyDesk + TPV).
  - Investigar la actividad de nuria.vidal después de su último día.
  - Hacer el caso estrella de la demo con C.
