// Constantes y etiquetas de la UI. Los valores del contrato (docs/04) se nombran aquí una sola vez.
// Lo que también usa el backend (acciones de la API, pasos del vivo) llega de /api/config: no se duplica aquí.

export const POLL_DASHBOARD_MS = 10000
export const POLL_TRIAGE_MS = 800
export const MIN_JUSTIFICATION_LEN = 5
export const APPROVER_STORAGE_KEY = 'approver'

export const SEVERITY = { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low', INFO: 'informational' }
export const SEVERITY_ORDER = [SEVERITY.CRITICAL, SEVERITY.HIGH, SEVERITY.MEDIUM, SEVERITY.LOW, SEVERITY.INFO]

export const VERDICT = {
  TP: 'true_positive', BTP: 'benign_true_positive', FP: 'false_positive', MORE_INFO: 'needs_more_info',
}
export const VERDICT_ORDER = [VERDICT.TP, VERDICT.BTP, VERDICT.FP, VERDICT.MORE_INFO]

export const STATUS = { AWAITING: 'awaiting_approval', ESCALATED: 'escalated', TRIAGED: 'triaged', CLOSED: 'closed' }
// Orden de la cola: primero lo que necesita a una persona
export const STATUS_ORDER = [STATUS.AWAITING, STATUS.ESCALATED, STATUS.TRIAGED, STATUS.CLOSED]

export const DECIDER = { POLICY: 'policy', LLM: 'llm', HUMAN: 'human', SIMULATED: 'simulated' }

export const DECISION = { CLOSE: 'close', ESCALATE: 'escalate', REOPEN: 'reopen', CONTAINMENT: 'containment' }

export const ACTION_KIND = { APPROVAL: 'approval', N1: 'n1', DECISION: 'decision', BLOCKED: 'blocked' }

export const STEP = { QUEUED: 'queued', TICKET: 'ticket', ERROR: 'error' }
export const JOB_STATUS = { RUNNING: 'running', DONE: 'done', ERROR: 'error' }

export const DATA_SOURCE = { SAMPLE: 'sample', PIPELINE: 'pipeline' }
export const LIVE_MODE = { NONE: 'none', SIMULATED: 'simulated' }

export const INPUT_MODE = { PASTE: 'paste', FILE: 'file', IDS: 'ids', RANDOM: 'random' }
export const DEFAULT_RANDOM_ALERTS = 10

export const PAGE = { QUEUE: 'queue', LIVE: 'live', INCIDENTS: 'incidents', CONTAINMENT: 'containment' }

// Solo la severidad va rellena (variante solid): es lo primero que tiene que saltar a la vista
export const SOLID_CHIP_KINDS = ['severity']

// Etiqueta y tono (clave de la paleta del tema) de cada valor que se pinta como chip
export const CHIP_KINDS = {
  severity: {
    [SEVERITY.CRITICAL]: ['Crítica', 'sevCritical'],
    [SEVERITY.HIGH]: ['Alta', 'sevHigh'],
    [SEVERITY.MEDIUM]: ['Media', 'sevMedium'],
    [SEVERITY.LOW]: ['Baja', 'sevLow'],
    [SEVERITY.INFO]: ['Info', 'sevInfo'],
  },
  verdict: {
    [VERDICT.TP]: ['Verdadero positivo', 'error'],
    [VERDICT.BTP]: ['Benigno autorizado', 'success'],
    [VERDICT.FP]: ['Falso positivo', 'sevInfo'],
    [VERDICT.MORE_INFO]: ['Falta información', 'warning'],
  },
  status: {
    [STATUS.AWAITING]: ['Pendiente de aprobación', 'warning'],
    [STATUS.ESCALATED]: ['Escalada', 'sevHigh'],
    [STATUS.TRIAGED]: ['Triada', 'info'],
    [STATUS.CLOSED]: ['Cerrada', 'sevInfo'],
  },
  decider: {
    [DECIDER.POLICY]: ['Política', 'policy'],
    [DECIDER.LLM]: ['IA', 'llm'],
    [DECIDER.HUMAN]: ['Persona', 'human'],
    [DECIDER.SIMULATED]: ['Simulado', 'warning'],
  },
  policyEffect: {
    benign: ['benigno', 'success'],
    suspicious: ['sospechoso', 'warning'],
    malicious: ['malicioso', 'error'],
    context: ['contexto', 'policy'],
  },
}

// Texto de ayuda (tooltip) por valor
export const CHIP_HINTS = {
  decider: {
    [DECIDER.POLICY]: 'Código determinista con la matriz y las reglas de Tarvia',
    [DECIDER.LLM]: 'Agente LLM con evidencia citada',
    [DECIDER.HUMAN]: 'Decisión humana desde el dashboard',
    [DECIDER.SIMULATED]: 'Simulador del dashboard (no es real)',
  },
}

export const STEP_LABELS = { context: 'Contexto', policy: 'Política', llm: 'IA', reviewer: 'Revisor', ticket: 'Ticket' }

export const PAGES = [
  { value: PAGE.QUEUE, label: 'Tickets' },
  { value: PAGE.LIVE, label: 'Upload' },
  { value: PAGE.INCIDENTS, label: 'Incidentes' },
  { value: PAGE.CONTAINMENT, label: 'Acciones' },
]

export const APP_TITLE = 'Dashboard de incidencias'

// Información extendida del ticket (modal con pestañas): lo que no cabe en la ficha sin hacer scroll
export const DETAIL_TAB = { SUMMARY: 'summary', EVIDENCE: 'evidence', TRACE: 'trace', HISTORY: 'history', CHAT: 'chat' }
export const DETAIL_TABS = [
  { value: DETAIL_TAB.SUMMARY, label: 'Resumen' },
  { value: DETAIL_TAB.EVIDENCE, label: 'Evidencias' },
  { value: DETAIL_TAB.TRACE, label: 'Consultas' },
  { value: DETAIL_TAB.HISTORY, label: 'Historial' },
  { value: DETAIL_TAB.CHAT, label: 'Chat IA' },
]

// Chat del ticket con Gemini (dashboard/chat.py, docs/12_chatbot.md). Los máximos reales llegan de /api/config.
export const CHAT_ROLE = { USER: 'user', MODEL: 'model', ERROR: 'error' }
export const CHAT_DEFAULT_MAX_CHARS = 2000
export const CHAT_DEFAULT_MAX_TURNS = 12
export const CHAT_SUGGESTIONS = [
  '¿Por qué se ha cerrado (o escalado) este ticket?',
  '¿Qué reglas de la política han disparado y qué significan?',
  '¿Cómo se ha calculado la severidad?',
  '¿En qué evidencias se basa el veredicto?',
  '¿Quién decidió cada cosa: la política, la IA o una persona?',
  '¿Qué queda pendiente o sin resolver?',
]

// Tags visibles por fila de la ficha antes de resumir en «+N»
export const MAX_ROW_TAGS = 4
// Líneas de resumen en cada tarjeta de la cola
export const CARD_SUMMARY_LINES = 2

export const INPUT_MODES = [
  { value: INPUT_MODE.PASTE, label: 'Pegar JSON' },
  { value: INPUT_MODE.FILE, label: 'Subir fichero' },
  { value: INPUT_MODE.IDS, label: 'IDs del dataset' },
  { value: INPUT_MODE.RANDOM, label: 'Simulacro aleatorio' },
]
