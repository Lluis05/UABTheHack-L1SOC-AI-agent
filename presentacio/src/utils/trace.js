// Lógica pura sobre las trazas reales del pipeline. Sin React: se prueba con vitest.

/** Reparte los pasos de una traza entre las etapas del pipeline, en su orden original. */
export function groupTrace(trace, stages, fallbackStageId) {
  const stageOfStep = new Map()
  for (const stage of stages) for (const step of stage.steps) stageOfStep.set(step, stage.id)
  const groups = Object.fromEntries(stages.map(stage => [stage.id, []]))
  for (const step of trace) {
    const stageId = stageOfStep.get(step.step) ?? fallbackStageId
    groups[stageId].push(step)
  }
  return groups
}

/** Suma de los ms reales de una lista de pasos. */
export function totalMs(steps) {
  return steps.reduce((sum, step) => sum + (Number(step.ms) || 0), 0)
}

/** «0,4 ms», «351 ms», «30,0 s»: legible en una sala. */
export function formatMs(ms) {
  const value = Number(ms) || 0
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace('.', ',')} s`
  if (value >= 10) return `${Math.round(value)} ms`
  return `${value.toFixed(1).replace('.', ',')} ms`
}

/** Tiempo real acumulado hasta el final de cada etapa (para el contador de la reproducción). */
export function cumulativeMs(stages, groups) {
  let sum = 0
  return stages.map(stage => (sum += totalMs(groups[stage.id])))
}

/** Estado de un resultado de inteligencia según la primera regla de `statuses` que encaje. */
export function classifyIntel(result, statuses) {
  return statuses.find(status => status.pattern.test(result ?? '')).id
}

/**
 * Un veredicto por indicador a partir de todas sus consultas (TIP, OSINT, sandbox, API): el peor estado gana.
 * Ordenados de peor a mejor para que lo malicioso salga primero.
 */
export function indicatorVerdicts(steps, statuses, skipPattern) {
  const rank = Object.fromEntries(statuses.map((status, i) => [status.id, i]))
  const byIndicator = new Map()
  for (const step of steps) {
    if (skipPattern.test(step.query ?? '')) continue
    const key = String(step.query ?? '').replace(/…$/, '')
    const id = [...byIndicator.keys()].find(k => k.startsWith(key) || key.startsWith(k)) ?? key
    const entry = byIndicator.get(id) ?? { indicator: id, status: 'info', findings: [] }
    const status = classifyIntel(step.result, statuses)
    if (rank[status] < rank[entry.status]) entry.status = status
    entry.findings.push({ source: step.source, result: step.result, status })
    byIndicator.set(id, entry)
  }
  return [...byIndicator.values()].sort((a, b) => rank[a.status] - rank[b.status])
}

/** Consultas de contexto agrupadas por fuente: cuántas se hicieron y los resultados que aportan algo. */
export function contextBySource(steps) {
  const bySource = new Map()
  for (const step of steps) {
    const entry = bySource.get(step.source) ?? { source: step.source, queries: 0, findings: [] }
    entry.queries += 1
    if (!/^0 /.test(step.result ?? '') && !entry.findings.includes(step.result)) entry.findings.push(step.result)
    bySource.set(step.source, entry)
  }
  return [...bySource.values()]
}

/** «561c0d42…dbaeabf83»: los hashes no caben en un chip. */
export function shortIndicator(value, max = 28) {
  const text = String(value ?? '')
  if (text.length <= max) return text
  const half = Math.floor((max - 1) / 2)
  return `${text.slice(0, half)}…${text.slice(-half)}`
}

/** Acciones que solo puede ejecutar una persona (requieren aprobación) frente a las que puede hacer el N1. */
export function splitActions(actions = []) {
  const needsApproval = actions.filter(action => action.requires_approval)
  const direct = actions.filter(action => !action.requires_approval)
  return { needsApproval, direct }
}

/** Escalón de severidad entre la propuesta de la política y la final (positivo = sube). */
export function severityShift(severities, base, final) {
  const from = severities.indexOf(base)
  const to = severities.indexOf(final)
  return from < 0 || to < 0 ? 0 : to - from
}

/** Entidades de la alerta como lista plana [{type, value}] para pintarlas como chips. */
export function entityChips(entities = {}) {
  const chips = []
  for (const user of entities.users ?? []) chips.push({ type: 'usuario', value: user.upn ?? user.display_name })
  for (const host of entities.hosts ?? []) chips.push({ type: 'equipo', value: host.hostname ?? host.ip })
  for (const file of entities.files ?? []) chips.push({ type: 'fichero', value: file.name })
  for (const ip of entities.ips ?? []) chips.push({ type: 'IP', value: ip })
  for (const domain of entities.domains ?? []) chips.push({ type: 'dominio', value: domain })
  return chips.filter(chip => chip.value)
}
