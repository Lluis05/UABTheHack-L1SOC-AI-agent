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
- **LLM (con fallback automático):**
  1. **Claude Code** en modo headless (`claude -p`), sin herramientas, para resistir prompt injection
  2. **Google Gemini** (free tier) como fallback
- **Orquestación del agente:** pipeline propio en Python con salida estructurada (JSON Schema)
- **Enriquecimiento:** VirusTotal, AbuseIPDB, MITRE ATT&CK (STIX)
- **API del SOC:** mock_soc_api (FastAPI) proporcionada por Deloitte
- **Dashboard:** Streamlit
- **Datos:** índices en memoria sobre el dataset de Deloitte + API simulada para contención

> Detalles en [docs/04_arquitectura.md](docs/04_arquitectura.md).

## 📚 Documentación

Toda la documentación del equipo está en [`docs/`](docs/00_INDICE.md): el reto, el dataset, la política del SOC,
la arquitectura y los contratos, el reparto, el setup, la capa LLM y la demo.
Para trabajar con Claude Code, ver [`CLAUDE.md`](CLAUDE.md).

## 📁 Estructura del proyecto

```
.
├── soc/
│   ├── llm.py          # Capa LLM: Claude Code → Gemini (fallback)
│   ├── data/           # Carga e indexado del dataset
│   ├── enrich/         # Contexto: CMDB, usuarios, TIP, GeoIP, sandbox, logs ±24h
│   ├── policy/         # Matriz de severidad, cambios aprobados, reglas de Tarvia
│   ├── triage/         # Prefiltro determinista, agente LLM, revisor
│   ├── correlate/      # Agrupación en incidentes y cadena de ataque
│   └── pipeline.py     # Orquestación y CLI
├── dashboard/          # Streamlit: cola, traza, evidencias, aprobación humana
├── eval/               # Etiquetas manuales y métricas
└── docs/               # Documentación del equipo
```

## 🚀 Puesta en marcha

_Se completará durante la hackathon._

```bash
git clone https://github.com/Lluis05/UABTheHack-L1SOC-AI-agent.git
cd UABTheHack-L1SOC-AI-agent
pip install -r requirements.txt
cp .env.example .env        # añade GEMINI_API_KEY (fallback)
claude                      # login en Claude Code (una sola vez)
python -m soc.llm          # prueba rápida de la capa LLM
```

La capa LLM (`soc/llm.py`) prueba los proveedores en el orden de `LLM_PROVIDERS` y pasa al siguiente si uno falla (límite de uso, timeout, error).

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

- **Lluis Sarries**
- **Adrián Valverde Ambrosio**
- **Marc Cantero Priego**
- **Izan Caballer Jimenez**

---

*Proyecto desarrollado para **UAB The Hack** con el reto propuesto por **Deloitte**.*
