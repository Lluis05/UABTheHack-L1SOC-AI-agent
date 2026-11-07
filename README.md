# 🛡️ L1 SOC AI Agent — UAB The Hack × Deloitte

> Agente de IA autónomo que realiza el **triage de nivel 1 (L1)** de alertas de seguridad: las recibe, las enriquece, las correlaciona, decide un veredicto razonado y propone (o ejecuta con aprobación) la respuesta. Inspirado en los enfoques *AIR (Automated Investigation & Response)* y *Triage Agents* de los SOC modernos.

---

## 🎯 El problema

Los analistas L1 de un SOC reciben cientos o miles de alertas al día. La mayoría son **falsos positivos** o ruido, y el tiempo dedicado a revisarlas una a una provoca:

- **Alert fatigue** y alertas críticas que se pasan por alto.
- **MTTR** (tiempo medio de respuesta) elevado.
- Criterios de triage inconsistentes entre analistas.

## 💡 Nuestra solución

Un agente que hace el trabajo de un analista L1 de punta a punta y entrega a L2 solo lo que importa, **con la investigación ya hecha y explicada**.

```
 Alertas (repo GitHub de Deloitte)
        │
        ▼
 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 │  1. Ingesta  │──▶│ 2. Enrich.   │──▶│ 3. Triage    │──▶│ 4. Revisión  │
 │ normalizar   │   │ IOCs, intel, │   │ veredicto +  │   │ agente crítico│
 │ deduplicar   │   │ contexto     │   │ MITRE ATT&CK │   │ (anti-alucin.)│
 └──────────────┘   └──────────────┘   └──────────────┘   └──────┬───────┘
                                                                  ▼
                         ┌──────────────────────────────────────────────┐
                         │ 5. Salida: TP / FP / Benigno / Escalar a L2   │
                         │    informe, acciones propuestas, dashboard    │
                         └──────────────────────────────────────────────┘
```

### Flujo de triage

1. **Ingesta y normalización** — lectura de las alertas del repositorio proporcionado por Deloitte y conversión a un esquema común (inspirado en OCSF/ECS).
2. **Enriquecimiento** — extracción de IOCs (IPs, dominios, hashes, usuarios, hosts) y consulta a fuentes de threat intelligence y contexto interno.
3. **Correlación** — agrupación de alertas relacionadas en **incidentes** (mismo host, usuario, IOC o ventana temporal) para no tratar cada alerta de forma aislada.
4. **Triage con LLM** — clasificación (*True Positive / False Positive / Benign / Needs escalation*), severidad, **mapeo a MITRE ATT&CK** y razonamiento paso a paso.
5. **Agente revisor** — un segundo agente cuestiona el veredicto y verifica que cada afirmación esté respaldada por evidencia de la alerta.
6. **Respuesta** — informe para L2 y acciones de contención recomendadas (aislar host, bloquear IP, resetear credenciales…) con **human-in-the-loop**.

## 🏆 Qué nos diferencia

| Diferenciador | Por qué importa |
|---|---|
| **Veredictos explicables con cadena de evidencia** | Cada decisión cita los campos concretos de la alerta y del enriquecimiento que la justifican. Nada de cajas negras. |
| **Puntuación de confianza calibrada** | Si la confianza es baja, el agente escala en lugar de adivinar. |
| **Arquitectura multi-agente con revisor crítico** | Reduce alucinaciones y falsos negativos. |
| **Defensa contra prompt injection** | Las alertas contienen datos controlados por el atacante (command lines, asuntos de email, user-agents). Los aislamos y sanitizamos antes de pasarlos al LLM. |
| **Correlación alerta → incidente** | El agente ve la historia completa del ataque, no piezas sueltas. |
| **Aprendizaje del feedback del analista** | Las correcciones de L2 se guardan y se usan como ejemplos en futuros triajes. |
| **Métricas medibles** | Benchmark de precisión/recall frente al ground truth y tiempo ahorrado por alerta. |
| **Dashboard en tiempo real** | Visualización de la cola de alertas, veredictos, mapa MITRE e incidentes. |

## 🧱 Stack tecnológico (propuesto)

- **Lenguaje:** Python 3.11+
- **LLM:** Claude (Anthropic API) con tool use
- **Orquestación del agente:** tool-calling loop propio / Claude Agent SDK
- **Enriquecimiento:** VirusTotal, AbuseIPDB, MITRE ATT&CK (STIX)
- **Backend:** FastAPI
- **Frontend / Dashboard:** Streamlit o React
- **Almacenamiento:** SQLite / JSON

> El stack se ajustará cuando conozcamos el formato de las alertas proporcionadas por Deloitte.

## 📁 Estructura del proyecto (prevista)

```
.
├── agent/              # Lógica del agente (triage, revisor, prompts)
├── enrichment/         # Conectores de threat intel y extracción de IOCs
├── ingestion/          # Lectura y normalización de alertas
├── correlation/        # Agrupación de alertas en incidentes
├── dashboard/          # Interfaz de visualización
├── eval/               # Benchmark y métricas
├── data/               # Alertas de ejemplo
└── README.md
```

## 🚀 Puesta en marcha

_Se completará durante la hackathon._

```bash
git clone https://github.com/Lluis05/UABTheHack-L1SOC-AI-agent.git
cd UABTheHack-L1SOC-AI-agent
# pip install -r requirements.txt
# cp .env.example .env   # añade tus API keys
# python -m agent.main
```

## 🗺️ Roadmap

- [ ] Analizar el formato de las alertas de Deloitte
- [ ] Ingesta y normalización
- [ ] Extracción de IOCs y enriquecimiento
- [ ] Agente de triage con salida estructurada y mapeo MITRE
- [ ] Agente revisor
- [ ] Correlación en incidentes
- [ ] Dashboard
- [ ] Evaluación y métricas
- [ ] Demo y pitch

## 👥 Equipo

- **Lluis Sarries** — [@Lluis05](https://github.com/Lluis05)

---

*Proyecto desarrollado para **UAB The Hack** con el reto propuesto por **Deloitte**.*
