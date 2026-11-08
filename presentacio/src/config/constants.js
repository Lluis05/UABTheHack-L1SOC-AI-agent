// Contenido de la presentación. Cifras con su fuente: si cambian, se cambian aquí y solo aquí.

// Quién actúa en cada paso. Es el mismo código de colores que el dashboard (dashboard/web/src/theme.js).
export const ACTORS = {
  data: { label: 'Código', hint: 'recoge datos, no decide' },
  policy: { label: 'Política', hint: 'código determinista que decide' },
  llm: { label: 'IA', hint: 'razona y propone' },
  human: { label: 'Persona', hint: 'aprueba y ejecuta' },
}

// Pasos del pipeline. `steps` son los nombres de paso que escribe la traza real (output/traces/*.json).
export const STAGES = [
  {
    id: 'entrada', title: 'Entrada', actor: 'data', module: 'soc/data/normalize.py',
    steps: ['intake', 'entities'],
    what: 'Lee la alerta de la API simulada o de cualquier JSON y extrae sus entidades: personas, equipos, IPs, dominios, URLs y hashes.',
  },
  {
    id: 'contexto', title: 'Contexto', actor: 'data', module: 'soc/enrich/context.py',
    steps: ['cmdb', 'services', 'directory', 'related_events', 'logs', 'alerts', 'changes'],
    what: 'Lo que un analista miraría a mano: criticidad del activo, rol del usuario y RRHH, logs de ±24 h, otras alertas de las mismas entidades y el calendario de cambios.',
  },
  {
    id: 'inteligencia', title: 'Inteligencia', actor: 'data', module: 'soc/enrich/osint.py',
    steps: ['intel', 'osint', 'sandbox', 'api_intel'],
    what: 'TIP interno, GeoIP/ASN, sandbox y OSINT público para cada indicador. Solo servicios de reputación: nunca se visita ni se descarga nada. Desconocido no es limpio.',
  },
  {
    id: 'politica', title: 'Política', actor: 'policy', module: 'soc/policy/',
    steps: ['policy', 'prefilter'],
    what: 'Aplica la política del SOC: severidad = regla × criticidad del activo, cambios aprobados, pentest, reglas de Tarvia y detección de inyección. Si la explicación es inequívoca, el ticket sale aquí, sin IA.',
  },
  {
    id: 'ia', title: 'IA y revisor', actor: 'llm', module: 'soc/triage/',
    steps: ['llm', 'review'],
    what: 'Claude, sin herramientas, lee el contexto como dato dentro de <untrusted_data> y propone veredicto, evidencias con event_id y acciones. Un segundo pase crítico revisa el veredicto.',
  },
  {
    id: 'correlacion', title: 'Correlación', actor: 'policy', module: 'soc/correlate/incidents.py',
    steps: ['correlate'],
    what: 'Une la alerta con otras del mismo ataque aunque estén separadas por días, mediante un grafo de entidades compartidas.',
  },
  {
    id: 'persona', title: 'Persona', actor: 'human', module: 'dashboard/',
    steps: [],
    what: 'La contención la aprueba una persona en el dashboard. Solo entonces se pide el approval_token a la API y se ejecuta. La IA no tiene acceso a esos endpoints.',
  },
]

// Pasos de traza que no están en ningún STAGE (versiones nuevas del pipeline) se muestran en este.
export const FALLBACK_STAGE = 'contexto'

export const VERDICTS = {
  true_positive: 'Verdadero positivo',
  false_positive: 'Falso positivo',
  benign_true_positive: 'Actividad autorizada',
  needs_more_info: 'Falta información',
}

export const SEVERITIES = ['informational', 'low', 'medium', 'high', 'critical']

// Reproducción de la traza: cada línea espera proporcional a su duración real, dentro de estos límites,
// para que el LLM (30 s) no congele la sala y los ms de una búsqueda en memoria se lleguen a ver.
export const REPLAY = { minDelayMs: 70, maxDelayMs: 900, msPerRealMs: 0.03 }

// Resultados de la traza que son un hallazgo (se resaltan): TIP, sandbox u OSINT que confirman algo malo.
export const TRACE_HIT_PATTERN = /malicious|malicioso|listas negras|phishing/i

export const LIVE_DASHBOARD_URL = 'http://localhost:8001'

// Fuente: diapositivas 3 y 6 de Deloitte (Reto IA en ciberseguridad.pptx).
export const PROBLEM_STATS = [
  { value: 4000, separator: '.', label: 'alertas al día en el SOC de Tarvia' },
  { value: 15, prefix: '≈', suffix: ' min', label: 'por alerta a mano: SIEM, CMDB, VirusTotal, logs y ticket' },
  { value: 3, label: 'analistas N1, de 8 a 20 h y de lunes a viernes' },
  { value: 73, suffix: ' %', label: 'de las organizaciones dice que su mayor problema son los falsos positivos' },
]

// Fuente: README.md (medido el 08/11 sobre la política actual) y docs/09_hallazgos.md.
export const RESULTS = [
  { value: 87, suffix: ' %', label: 'de las 10.972 alertas las decide la política sola, sin IA y con justificación', actor: 'policy' },
  { value: 12, suffix: '/12', label: 'incidentes reales encontrados por la correlación (1 falso de 14)', actor: 'policy' },
  { value: 6, suffix: '/6', label: 'inyecciones de prompt detectadas, 0 veredictos cambiados', actor: 'llm' },
  { value: 10, suffix: '/10', label: 'alertas de incidentes reales marcadas como ataque y escaladas a N2 en el simulacro', actor: 'llm' },
  { value: 73, suffix: ' s', label: 'para triar 10 alertas al azar en directo, con IA y sin caché', actor: 'llm' },
  { value: 184, label: 'tests automáticos; ninguno gasta cuota del LLM', actor: 'data' },
]

export const LEVELS = [
  { n: 1, title: 'Triaje básico', state: 'done', text: 'Ticket por alerta con el esquema oficial: veredicto, confianza, severidad razonada, evidencias con event_id, MITRE y acciones.' },
  { n: 2, title: 'Triaje con criterio', state: 'done', text: 'Matriz de severidad con la criticidad real del activo, descarte argumentado de lo autorizado y correlación en incidentes.' },
  { n: 3, title: 'Investigación', state: 'partial', text: 'El informe de la cadena de ataque se genera con el esquema de Deloitte, pero el dashboard todavía no lo enseña.' },
  { n: 4, title: 'Respuesta', state: 'done', text: 'Contención propuesta con su aprobador según la política y ejecutada en la API simulada solo con aprobación humana.' },
]

export const LEVEL_STATES = { done: 'Hecho', partial: 'Parcial' }

// Fuente: README.md, «Lo que no resolvemos».
export const LIMITS = [
  { title: 'Sin IA, 49 de 83 alertas de ataque quedan pendientes', text: 'Credential stuffing, túnel DNS, AiTM o fuga de datos necesitan el LLM o una persona. Nunca se cierran en silencio.' },
  { title: 'Gemini gratis no sustituye a Claude', text: 'Con 5 peticiones por minuto, si Claude cae, las alertas salen marcadas «sin IA» con la decisión de la política.' },
  { title: 'La correlación parte dos incidentes', text: 'Si dos fases no comparten ninguna entidad (Logisoft, tienda T07), el código no las une. Un analista sí.' },
  { title: 'La severidad mira la criticidad de la alerta', text: 'Si la IA descubre un activo más crítico durante la investigación, la matriz no lo recalcula (caso Logisoft y WMS01).' },
  { title: 'Listas fijas y etiquetas propias', text: 'Servicios legítimos e infraestructura conocida están en una lista; la verdad de la evaluación la construimos nosotros.' },
]
