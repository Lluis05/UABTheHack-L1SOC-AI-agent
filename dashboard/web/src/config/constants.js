// Constantes y etiquetas de la UI. Los valores del contrato (docs/04) se nombran aquí una sola vez.
// Lo que también usa el backend (acciones de la API, pasos del vivo) llega de /api/config: no se duplica aquí.

export const POLL_DASHBOARD_MS = 10000
export const POLL_TRIAGE_MS = 800
// Cuánto se ve el aviso «N nuevos» tras un refresco que trae tickets
export const NEW_ITEMS_NOTICE_MS = 20000
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

// Etiqueta, tono (clave de la paleta del tema) e icono opcional de cada valor que se pinta como chip.
// Presupuesto de color: el color es de la severidad y de quién decidió (Política / IA / Persona). Estado y veredicto
// van en gris y se distinguen por el icono; la única excepción es «Pendiente de aprobación», que pide una persona.
export const CHIP_KINDS = {
  severity: {
    [SEVERITY.CRITICAL]: ['Crítica', 'sevCritical'],
    [SEVERITY.HIGH]: ['Alta', 'sevHigh'],
    [SEVERITY.MEDIUM]: ['Media', 'sevMedium'],
    [SEVERITY.LOW]: ['Baja', 'sevLow'],
    [SEVERITY.INFO]: ['Info', 'sevInfo'],
  },
  verdict: {
    [VERDICT.TP]: ['Verdadero positivo', 'default', 'threat'],
    [VERDICT.BTP]: ['Benigno autorizado', 'default', 'authorized'],
    [VERDICT.FP]: ['Falso positivo', 'default', 'dismiss'],
    [VERDICT.MORE_INFO]: ['Falta información', 'default', 'help'],
  },
  status: {
    [STATUS.AWAITING]: ['Pendiente de aprobación', 'warning', 'pending'],
    [STATUS.ESCALATED]: ['Escalada', 'default', 'escalation'],
    [STATUS.TRIAGED]: ['Triada', 'default', 'done'],
    [STATUS.CLOSED]: ['Cerrada', 'default', 'closedTicket'],
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

// icon: el de la navegación inferior en móvil
export const PAGES = [
  { value: PAGE.QUEUE, label: 'Tickets', icon: 'queue' },
  { value: PAGE.LIVE, label: 'Upload', icon: 'upload' },
  { value: PAGE.INCIDENTS, label: 'Incidentes', icon: 'incidents' },
  { value: PAGE.CONTAINMENT, label: 'Acciones', icon: 'containment' },
]
export const NAV_LABEL = 'Secciones'

export const APP_TITLE = 'Tarvia'

// Información extendida del ticket (modal con pestañas): lo que no cabe en la ficha sin hacer scroll
export const DETAIL_TAB = { SUMMARY: 'summary', EVIDENCE: 'evidence', TRACE: 'trace', HISTORY: 'history' }
export const DETAIL_TABS = [
  { value: DETAIL_TAB.SUMMARY, label: 'Resumen' },
  { value: DETAIL_TAB.EVIDENCE, label: 'Evidencias' },
  { value: DETAIL_TAB.TRACE, label: 'Consultas' },
  { value: DETAIL_TAB.HISTORY, label: 'Historial' },
]

// Chat del ticket con Gemini (dashboard/chat.py, docs/12_chatbot.md), en el panel lateral con forma de móvil.
// Los máximos reales llegan de /api/config.
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

// Filtro «listas para cerrar»: valor del select (los filtros son cadenas; '' = sin filtro)
export const PENDING_CLOSE = 'yes'
export const PENDING_CLOSE_LABEL = 'Listas para cerrar'

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

// Columnas ajustables y plegables (cola | ficha | asistente). Anchos en px; se recuerdan en el navegador por página.
export const PANE_LIMITS = { leftMin: 240, asideMin: 320, centerMin: 420, step: 24 }
export const PANE_DEFAULTS = { leftWidth: 380, asideWidth: 440, leftCollapsed: false, asideCollapsed: false }
export const PANE_LAYOUT_KEY = { QUEUE: 'panes:queue', INCIDENTS: 'panes:incidents' }
// Por debajo de este ancho la cola usa tarjetas compactas (solo título, severidad y confianza)
export const COMPACT_QUEUE_BELOW_PX = 340

// Orden de la cola: {key, direction}. key es «priority» (primero lo que espera a una persona, luego severidad, luego
// lo más reciente) o una columna de la tabla (SORT_KEY). El primer clic en una cabecera ordena de mayor a menor.
export const SORT_DIR = { DESC: 'desc', ASC: 'asc' }
export const SORT_KEY = {
  SEVERITY: 'severity', ID: 'ticket_id', TITLE: 'title', STATUS: 'status', VERDICT: 'verdict', DECIDER: 'decider',
  INCIDENT: 'incident', CONFIDENCE: 'confidence', TIME: 'time',
}
export const QUEUE_SORT = { PRIORITY: 'priority', RECENT: SORT_KEY.TIME, SEVERITY: SORT_KEY.SEVERITY }
export const DEFAULT_QUEUE_SORT = { key: QUEUE_SORT.PRIORITY, direction: SORT_DIR.DESC }
// Atajos del selector «Orden» (en móvil no hay cabeceras de tabla); siempre de mayor a menor
export const QUEUE_SORTS = [
  { value: QUEUE_SORT.PRIORITY, label: 'Prioridad' },
  { value: QUEUE_SORT.RECENT, label: 'Más recientes' },
  { value: QUEUE_SORT.SEVERITY, label: 'Severidad' },
]
// Lo que muestra el selector cuando el orden viene de una cabecera de la tabla
export const CUSTOM_SORT_LABEL = 'Por columna'

// Campo de búsqueda de la cola (el atajo «/» le da el foco) y título del detalle (recibe el foco al abrir un ticket)
export const QUEUE_SEARCH_ID = 'queue-search'
export const DETAIL_TITLE_ID = 'ticket-detail-title'

// Atajos de teclado (se ignoran mientras se escribe en un campo o hay un diálogo abierto)
export const SHORTCUTS = [
  { keys: ['j', 'k'], label: 'Siguiente / anterior ticket de la cola' },
  { keys: ['Esc'], label: 'Cerrar el detalle y volver a la cola' },
  { keys: ['/'], label: 'Buscar en la cola' },
  { keys: ['i'], label: 'Abrir o cerrar el asistente IA del ticket' },
  { keys: ['v'], label: 'Ver toda la información del ticket' },
  { keys: ['?'], label: 'Mostrar esta ayuda' },
]
