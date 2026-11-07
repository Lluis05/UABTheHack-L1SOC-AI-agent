import {
  ACTION_KIND, DEFAULT_QUEUE_SORT, SEVERITY_ORDER, SORT_DIR, SORT_KEY, STATUS_ORDER, VERDICT_ORDER,
} from '../config/constants.js'

const rank = (order) => Object.fromEntries(order.map((v, i) => [v, i]))
const SEVERITY_RANK = rank(SEVERITY_ORDER)
const STATUS_RANK = rank(STATUS_ORDER)
const VERDICT_RANK = rank(VERDICT_ORDER)
const UNKNOWN_RANK = Number.MAX_SAFE_INTEGER

export const EMPTY_FILTERS = { text: '', severity: '', verdict: '', status: '', decider: '', pendingClose: '' }

// Tickets a los que solo les faltan las acciones de la API para cerrarse (x_pending_close lo calcula la política)
export function pendingCloseCount(tickets = []) {
  return tickets.filter((t) => t.x_pending_close).length
}

// Cuántos filtros hay activos (el número del botón «Filtros»)
export function activeFilterCount(filters) {
  return Object.values(filters).filter((v) => String(v).trim()).length
}

export function matchesFilters(ticket, filters) {
  const needle = filters.text.trim().toLowerCase()
  return (!filters.severity || ticket.severity === filters.severity)
    && (!filters.verdict || ticket.verdict === filters.verdict)
    && (!filters.status || ticket.x_status === filters.status)
    && (!filters.decider || ticket.x_decided_by?.verdict === filters.decider)
    && (!filters.pendingClose || Boolean(ticket.x_pending_close))
    && (!needle || searchableText(ticket).includes(needle))
}

function searchableText(t) {
  return JSON.stringify([t.ticket_id, t.alert_ids, t.title, t.affected, t.x_incident_id]).toLowerCase()
}

const byStatus = (a, b) => (STATUS_RANK[a.x_status] ?? UNKNOWN_RANK) - (STATUS_RANK[b.x_status] ?? UNKNOWN_RANK)
const bySeverity = (a, b) => (SEVERITY_RANK[a.severity] ?? UNKNOWN_RANK) - (SEVERITY_RANK[b.severity] ?? UNKNOWN_RANK)
const alertTime = (t) => {
  const time = new Date(t.x_alert_created_at).getTime()
  return Number.isNaN(time) ? 0 : time
}
// Más reciente primero: por hora de la alerta y, sin ella, por ID (los IDs llevan la fecha)
const byRecent = (a, b) => alertTime(b) - alertTime(a) || String(b.ticket_id).localeCompare(String(a.ticket_id))

// Cola: primero lo que espera a una persona, luego la severidad y por último lo más reciente.
export function compareQueue(a, b) {
  return byStatus(a, b) || bySeverity(a, b) || byRecent(a, b)
}

// Valor de cada columna para ordenar: más grande = «mayor» (lo primero con el orden descendente).
// En los rangos, lo primero del orden del contrato es lo mayor (crítica, pendiente, verdadero positivo).
// null = sin dato: va siempre al final, en los dos sentidos.
const fromRank = (ranks, value) => (value in ranks ? Object.keys(ranks).length - ranks[value] : null)
const SORT_VALUES = {
  [SORT_KEY.SEVERITY]: (t) => fromRank(SEVERITY_RANK, t.severity),
  [SORT_KEY.ID]: (t) => t.ticket_id || null,
  [SORT_KEY.TITLE]: (t) => t.title || null,
  [SORT_KEY.STATUS]: (t) => fromRank(STATUS_RANK, t.x_status),
  [SORT_KEY.VERDICT]: (t) => fromRank(VERDICT_RANK, t.verdict),
  [SORT_KEY.DECIDER]: (t) => t.x_decided_by?.verdict || null,
  [SORT_KEY.INCIDENT]: (t) => t.x_incident_id || null,
  [SORT_KEY.CONFIDENCE]: (t) => (typeof t.confidence === 'number' ? t.confidence : null),
  [SORT_KEY.TIME]: (t) => alertTime(t) || null,
}
const LOCALE = 'es'

// Comparador de la cola para {key, direction}. A igualdad (o sin dato), desempata con la prioridad.
export function compareBy({ key, direction }) {
  const value = SORT_VALUES[key]
  if (!value) return compareQueue
  const sign = direction === SORT_DIR.ASC ? 1 : -1
  return (a, b) => {
    const va = value(a)
    const vb = value(b)
    if (va == null || vb == null) return va == null && vb == null ? compareQueue(a, b) : (va == null ? 1 : -1)
    const diff = typeof va === 'string' ? va.localeCompare(vb, LOCALE, { numeric: true }) : va - vb
    return sign * diff || compareQueue(a, b)
  }
}

export function queueTickets(tickets, filters, sort = DEFAULT_QUEUE_SORT) {
  return tickets.filter((t) => matchesFilters(t, filters)).sort(compareBy(sort))
}

// Clic en una cabecera: la misma columna invierte el sentido; otra columna empieza de mayor a menor
export function nextSort(current, key) {
  if (current.key === key) return { key, direction: current.direction === SORT_DIR.DESC ? SORT_DIR.ASC : SORT_DIR.DESC }
  return { key, direction: SORT_DIR.DESC }
}

// Navegación con j/k: el ID siguiente (delta 1) o anterior (-1) en la lista visible. Sin selección, el primero
// (o el último si se va hacia atrás); en los extremos se queda donde está.
export function stepId(ids, currentId, delta) {
  if (!ids.length) return null
  const index = ids.indexOf(currentId)
  if (index === -1) return delta > 0 ? ids[0] : ids[ids.length - 1]
  return ids[Math.min(Math.max(index + delta, 0), ids.length - 1)]
}

// Cuántos IDs no estaban en la lista anterior (tickets nuevos que ha traído el refresco)
export function countNew(previousIds, ids) {
  if (!previousIds) return 0
  const before = new Set(previousIds)
  return ids.filter((id) => !before.has(id)).length
}

export function findExecution(action, executedActions = []) {
  return executedActions.find((e) => e.action === action.action && e.target === action.target)
}

// Qué puede hacer la persona con una acción recomendada. Lo decide la política (x_approval, calculado por el
// backend con soc/policy/approvals.py); sin ese dato se asume lo más seguro: pedir aprobación.
export function actionKind(action, config) {
  const rule = action.x_approval
  if (rule && !rule.allowed) return ACTION_KIND.BLOCKED
  if (!config?.api_actions?.includes(action.action)) return ACTION_KIND.DECISION
  return rule && !rule.requires_approval ? ACTION_KIND.N1 : ACTION_KIND.APPROVAL
}

export function approversLabel(action) {
  return (action.x_approval?.approvers || []).join(' + ')
}

export function affectedGroups(affected = {}) {
  return [
    ['Usuarios', affected.users], ['Hosts', affected.hosts],
    ['Servicios', affected.business_services], ['Clientes', affected.customers],
  ].filter(([, values]) => values?.length)
}

// Todas las entidades afectadas en una sola lista, sin repetir (tags en horizontal de la ficha)
export function affectedValues(affected = {}) {
  return [...new Set(affectedGroups(affected).flatMap(([, values]) => values))]
}

// Primeros max elementos y cuántos quedan fuera («+3»), para no partir la fila de tags
export function splitVisible(items = [], max) {
  return { visible: items.slice(0, max), hidden: Math.max(0, items.length - max) }
}
