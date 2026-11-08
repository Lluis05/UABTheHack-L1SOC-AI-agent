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

/** Espera antes de mostrar un paso al reproducir la traza: proporcional a lo que tardó, con límites. */
export function replayDelay(ms, { minDelayMs, maxDelayMs, msPerRealMs }) {
  const scaled = (Number(ms) || 0) * msPerRealMs
  return Math.min(maxDelayMs, Math.max(minDelayMs, scaled))
}

/** Acciones que solo puede ejecutar una persona (requieren aprobación) frente a las que puede hacer el N1. */
export function splitActions(actions = []) {
  const needsApproval = actions.filter(action => action.requires_approval)
  const direct = actions.filter(action => !action.requires_approval)
  return { needsApproval, direct }
}

/** Escalón de severidad entre la base de la matriz y la final (positivo = sube). */
export function severityShift(severities, base, final) {
  const from = severities.indexOf(base)
  const to = severities.indexOf(final)
  return from < 0 || to < 0 ? 0 : to - from
}
