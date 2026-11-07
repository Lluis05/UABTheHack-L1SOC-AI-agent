// Métricas del panel de la cola calculadas a partir de los tickets (lógica pura, tests en metrics.test.js).
// Lo que el backend ya calcula (/api/metrics: horas ahorradas, minutos manuales, batch) llega aparte.
import {
  CONFIDENCE_EDGES, DECIDER, MAX_TIMELINE_DAYS, SEVERITY_ORDER, STATUS, STATUS_ORDER, TOP_N, TRIAGE_EDGES_S,
  VERDICT_ORDER,
} from '../config/constants.js'

const DAY_MS = 24 * 60 * 60 * 1000
const DECIDERS = [DECIDER.POLICY, DECIDER.LLM, DECIDER.HUMAN]
const SHORT_DAY = { day: 'numeric', month: 'short', timeZone: 'UTC' }
const LONG_DAY = { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }
const LOCALE = 'es-ES'

const countBy = (items, keyOf) => items.reduce((acc, it) => {
  const key = keyOf(it)
  if (key != null && key !== '') acc[key] = (acc[key] || 0) + 1
  return acc
}, {})

// Recuento en el orden indicado, incluidos los ceros (una distribución sin huecos se lee honesta)
const ordered = (counts, order) => order.map((key) => ({ key, value: counts[key] || 0 }))

// Los N más frecuentes, de mayor a menor (a igualdad, orden alfabético para que no baile entre refrescos)
export function topCounts(values, n = TOP_N) {
  return Object.entries(countBy(values, (v) => v))
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
    .slice(0, n)
}

// Histograma con cortes: edges [60, 70] → «<60», «60–70», «≥70». unit: sufijo de las etiquetas.
export function histogram(values, edges, unit = '') {
  const bins = [
    { key: `<${edges[0]}`, label: `<${edges[0]}${unit}`, test: (v) => v < edges[0] },
    ...edges.slice(1).map((hi, i) => ({
      key: `${edges[i]}-${hi}`, label: `${edges[i]}–${hi}${unit}`, test: (v) => v >= edges[i] && v < hi,
    })),
    { key: `>=${edges.at(-1)}`, label: `≥${edges.at(-1)}${unit}`, test: (v) => v >= edges.at(-1) },
  ]
  return bins.map(({ key, label, test }) => ({ key, label, value: values.filter(test).length }))
}

const average = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)
const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10)

// Quién tiene la última palabra sobre el veredicto: si una persona decidió algo, la persona
export function verdictDecider(ticket) {
  if (ticket.x_human_decisions?.length) return DECIDER.HUMAN
  return ticket.x_decided_by?.verdict
}

// Alertas por día (UTC) del primero al último, rellenando los días sin alertas; como mucho los últimos maxDays
export function dailyCounts(isoDates, maxDays = MAX_TIMELINE_DAYS) {
  const days = isoDates.map((iso) => Date.parse(iso)).filter(Number.isFinite).map((t) => Math.floor(t / DAY_MS))
  if (!days.length) return []
  const counts = countBy(days, (d) => d)
  const last = Math.max(...days)
  const first = Math.max(Math.min(...days), last - maxDays + 1)
  const out = []
  for (let d = first; d <= last; d += 1) {
    const date = new Date(d * DAY_MS)
    out.push({
      key: date.toISOString().slice(0, 10), value: counts[d] || 0,
      label: date.toLocaleDateString(LOCALE, SHORT_DAY), hint: date.toLocaleDateString(LOCALE, LONG_DAY),
    })
  }
  return out
}

export function buildQueueStats(tickets = []) {
  const confidences = tickets.map((t) => t.confidence).filter((v) => typeof v === 'number').map((v) => Math.round(v * 100))
  const seconds = tickets.map((t) => t.triage_seconds).filter((v) => typeof v === 'number')
  const agreement = countBy(tickets, (t) => t.x_prefilter_agreement)
  const withHint = (agreement.agree || 0) + (agreement.disagree || 0)
  const byStatus = countBy(tickets, (t) => t.x_status)
  const rules = Object.fromEntries(tickets.filter((t) => t.x_rule?.rule_id).map((t) => [t.x_rule.rule_id, t.x_rule.rule_name]))

  return {
    total: tickets.length,
    open: tickets.length - (byStatus[STATUS.CLOSED] || 0),
    closed: byStatus[STATUS.CLOSED] || 0,
    severity: ordered(countBy(tickets, (t) => t.severity), SEVERITY_ORDER),
    verdict: ordered(countBy(tickets, (t) => t.verdict), VERDICT_ORDER),
    status: ordered(byStatus, STATUS_ORDER),
    decider: ordered(countBy(tickets, verdictDecider), DECIDERS),
    confidence: { average: round1(average(confidences)), min: confidences.length ? Math.min(...confidences) : null,
                  bins: histogram(confidences, CONFIDENCE_EDGES, ' %') },
    triage: { average: round1(average(seconds)), max: seconds.length ? Math.max(...seconds) : null,
              bins: histogram(seconds, TRIAGE_EDGES_S, ' s') },
    // Acuerdo entre el prefiltro determinista y la IA, sobre los tickets en los que el prefiltro tenía opinión
    agreement: { agree: agreement.agree || 0, withHint, rate: withHint ? Math.round(((agreement.agree || 0) / withHint) * 100) : null },
    correlated: tickets.filter((t) => t.x_incident_id).length,
    mitre: topCounts(tickets.flatMap((t) => t.mitre || [])),
    rules: topCounts(tickets.map((t) => t.x_rule?.rule_id).filter(Boolean)).map((r) => ({ ...r, hint: rules[r.key] })),
    actions: topCounts(tickets.flatMap((t) => (t.recommended_actions || []).map((a) => a.action))),
    daily: dailyCounts(tickets.map((t) => t.x_alert_created_at).filter(Boolean)),
  }
}

// Cuántas veces más rápido que el triaje a mano («×32»). null si falta algún dato.
export function speedup(avgSeconds, manualMinutes) {
  if (!avgSeconds || !manualMinutes) return null
  return Math.round((manualMinutes * 60) / avgSeconds)
}
