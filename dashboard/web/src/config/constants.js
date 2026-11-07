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

export const ACTION_KIND = { APPROVAL: 'approval', N1: 'n1', DECISION: 'decision' }

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
  { value: PAGE.QUEUE, label: 'Cola' },
  { value: PAGE.LIVE, label: 'Triaje en directo' },
  { value: PAGE.INCIDENTS, label: 'Incidentes' },
  { value: PAGE.CONTAINMENT, label: 'Contención' },
]

export const INPUT_MODES = [
  { value: INPUT_MODE.PASTE, label: 'Pegar JSON' },
  { value: INPUT_MODE.FILE, label: 'Subir fichero' },
  { value: INPUT_MODE.IDS, label: 'IDs del dataset' },
  { value: INPUT_MODE.RANDOM, label: 'Simulacro aleatorio' },
]
