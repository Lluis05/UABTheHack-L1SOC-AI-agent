// Contenido de la presentación (3 minutos). Cifras con su fuente: si cambian, se cambian aquí y solo aquí.

// Quién actúa en cada paso. Es el mismo código de colores que el dashboard (dashboard/web/src/theme.js).
export const ACTORS = {
  data: { label: 'Código', hint: 'recoge datos' },
  policy: { label: 'Política', hint: 'decide por reglas' },
  llm: { label: 'IA', hint: 'razona y propone' },
  human: { label: 'Persona', hint: 'aprueba' },
}

// Etapas del pipeline. `steps` son los nombres de paso que escribe la traza real (output/traces/*.json).
export const STAGES = [
  { id: 'entrada', title: 'Entrada', actor: 'data', steps: ['intake', 'entities'],
    what: 'Lee la alerta (API o cualquier JSON) y extrae sus entidades.' },
  { id: 'contexto', title: 'Contexto', actor: 'data',
    steps: ['cmdb', 'services', 'directory', 'related_events', 'logs', 'alerts', 'changes'],
    what: 'Lo que un analista miraría a mano: activo, usuario, logs ±24 h, otras alertas y cambios aprobados.' },
  { id: 'inteligencia', title: 'Inteligencia', actor: 'data', steps: ['intel', 'osint', 'sandbox', 'api_intel'],
    what: 'TIP, GeoIP, sandbox y OSINT para cada indicador. Solo reputación: nunca se visita nada.' },
  { id: 'politica', title: 'Política', actor: 'policy', steps: ['policy', 'prefilter'],
    what: 'Severidad = regla × criticidad del activo. Si la explicación es inequívoca, cierra sin IA.' },
  { id: 'ia', title: 'IA + revisor', actor: 'llm', steps: ['llm', 'review'],
    what: 'Claude, sin herramientas, decide con evidencias citadas. Un revisor crítico lo comprueba.' },
  { id: 'correlacion', title: 'Correlación', actor: 'policy', steps: ['correlate'],
    what: 'Une la alerta con las demás fases del mismo ataque, aunque pasen días.' },
  { id: 'persona', title: 'Persona', actor: 'human', steps: [],
    what: 'La contención solo se ejecuta si una persona la aprueba. La IA no tiene acceso.' },
]

// Pasos de traza que no están en ningún STAGE (versiones nuevas del pipeline) se muestran en este.
export const FALLBACK_STAGE = 'contexto'

// Reproducción automática del triaje: tiempo que se queda cada etapa en pantalla.
export const PLAY_STAGE_MS = 2200

export const VERDICTS = {
  true_positive: 'Verdadero positivo',
  false_positive: 'Falso positivo',
  benign_true_positive: 'Actividad autorizada',
  needs_more_info: 'Falta información',
}

export const SEVERITIES = ['informational', 'low', 'medium', 'high', 'critical']

// Clasificación de los resultados de TIP / OSINT / sandbox, de peor a mejor. El primer patrón que encaja gana.
export const INTEL_STATUS = [
  { id: 'malicious', label: 'Malicioso', pattern: /malicious|malicioso|listas negras|phishing/i },
  { id: 'suspicious', label: 'Sospechoso', pattern: /suspicious|sospechoso/i },
  { id: 'unknown', label: 'Desconocido', pattern: /desconocido|sin datos|sin coincidencias|tampoco/i },
  { id: 'info', label: 'Dato', pattern: /./ },
]
// Pasos de inteligencia que no hablan de un indicador concreto («1 indicadores más»).
export const INTEL_SKIP = /indicadores más/i

// Efecto de las reglas de la política → color del chip.
export const HIT_TONE = { malicious: 'bad', suspicious: 'warn', benign: 'good', authorized: 'good' }

export const LIVE_DASHBOARD_URL = 'http://localhost:8001'

// Fuente: diapositivas 3 y 6 del reto de Deloitte.
export const PROBLEM_LINE = '4.000 alertas al día · unos 15 min cada una a mano · de noche nadie mira la consola'

// Fuente: README.md y docs/09 (medido el 08/11 con la política actual).
export const RESULTS = [
  { value: '90 %', label: 'de las alertas las decide la política sola, con justificación', actor: 'policy' },
  { value: '0', label: 'ataques cerrados como benignos (de 83 alertas de ataque)', actor: 'policy' },
  { value: '12/12', label: 'incidentes reales encontrados, con todas sus alertas', actor: 'policy' },
  { value: '10/10', label: 'alertas de incidentes reales marcadas como ataque y escaladas', actor: 'llm' },
  { value: '6/6', label: 'inyecciones de prompt detectadas, ninguna obedecida', actor: 'llm' },
  { value: '73 s', label: 'para 10 alertas en directo, frente a ~15 min por alerta a mano', actor: 'llm' },
]

export const LEVELS = [
  { n: 1, title: 'Triaje básico', state: 'done' },
  { n: 2, title: 'Con criterio', state: 'done' },
  { n: 3, title: 'Investigación', state: 'done' },
  { n: 4, title: 'Respuesta', state: 'done' },
]
export const LEVEL_STATES = { done: 'hecho', partial: 'parcial' }

// Limitaciones. Fuente: README.md, «Lo que no resolvemos».
export const LIMITS = [
  'Necesita decisión humana: la contención y lo escalado siempre los aprueba una persona; el sistema propone, no actúa solo.',
  'Sin IA, 49 de 83 alertas de ataque quedan pendientes: nunca se cierran en silencio, pero necesitan IA o persona.',
]
