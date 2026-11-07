import { ACTION_KIND, SEVERITY_ORDER, STATUS_ORDER } from '../config/constants.js'

const rank = (order) => Object.fromEntries(order.map((v, i) => [v, i]))
const SEVERITY_RANK = rank(SEVERITY_ORDER)
const STATUS_RANK = rank(STATUS_ORDER)
const UNKNOWN_RANK = Number.MAX_SAFE_INTEGER

export const EMPTY_FILTERS = { text: '', severity: '', verdict: '', status: '', decider: '' }

export function matchesFilters(ticket, filters) {
  const needle = filters.text.trim().toLowerCase()
  return (!filters.severity || ticket.severity === filters.severity)
    && (!filters.verdict || ticket.verdict === filters.verdict)
    && (!filters.status || ticket.x_status === filters.status)
    && (!filters.decider || ticket.x_decided_by?.verdict === filters.decider)
    && (!needle || searchableText(ticket).includes(needle))
}

function searchableText(t) {
  return JSON.stringify([t.ticket_id, t.alert_ids, t.title, t.affected, t.x_incident_id]).toLowerCase()
}

// Cola: primero lo que espera a una persona, luego la severidad y por último lo más reciente.
export function compareQueue(a, b) {
  return (STATUS_RANK[a.x_status] ?? UNKNOWN_RANK) - (STATUS_RANK[b.x_status] ?? UNKNOWN_RANK)
    || (SEVERITY_RANK[a.severity] ?? UNKNOWN_RANK) - (SEVERITY_RANK[b.severity] ?? UNKNOWN_RANK)
    || String(b.ticket_id).localeCompare(String(a.ticket_id))
}

export function queueTickets(tickets, filters) {
  return tickets.filter((t) => matchesFilters(t, filters)).sort(compareQueue)
}

export function findExecution(action, executedActions = []) {
  return executedActions.find((e) => e.action === action.action && e.target === action.target)
}

// Qué puede hacer la persona con una acción recomendada, según /api/config (fuente: dashboard/containment.py).
export function actionKind(actionName, config) {
  if (!config?.api_actions?.includes(actionName)) return ACTION_KIND.DECISION
  return config.no_approval_actions.includes(actionName) ? ACTION_KIND.N1 : ACTION_KIND.APPROVAL
}

export function affectedGroups(affected = {}) {
  return [
    ['Usuarios', affected.users], ['Hosts', affected.hosts],
    ['Servicios', affected.business_services], ['Clientes', affected.customers],
  ].filter(([, values]) => values?.length)
}
