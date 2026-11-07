import { INPUT_MODE, STEP } from '../config/constants.js'

// Acepta un array JSON, un objeto suelto o JSONL (una alerta por línea).
export function parseAlerts(text) {
  const s = text.trim()
  if (!s) return []
  try {
    const value = JSON.parse(s)
    return Array.isArray(value) ? value : [value]
  } catch {
    return s.split(/\r?\n/).filter((l) => l.trim()).map((line, i) => {
      try { return JSON.parse(line) } catch { throw new Error(`Línea ${i + 1}: JSON no válido`) }
    })
  }
}

export function parseIds(text) {
  return text.split(/[\s,;]+/).filter(Boolean)
}

// Convierte lo que hay en el formulario en el cuerpo de POST /api/triage. Lanza Error si está vacío.
export function buildTriageRequest(mode, { text = '', ids = '', count = 0 } = {}) {
  if (mode === INPUT_MODE.PASTE || mode === INPUT_MODE.FILE) {
    const alerts = parseAlerts(text)
    if (!alerts.length) throw new Error('No hay alertas')
    return { alerts }
  }
  if (mode === INPUT_MODE.IDS) {
    const list = parseIds(ids)
    if (!list.length) throw new Error('No hay IDs')
    return { ids: list }
  }
  const n = Number(count)
  if (!Number.isInteger(n) || n < 1) throw new Error('Indica cuántas alertas al azar')
  return { random: n }
}

// Estado de cada paso del pipeline para una alerta: 'done' | 'current' | 'pending'
export function stepStates(currentStep, steps) {
  const finished = currentStep === STEP.TICKET
  const idx = steps.indexOf(currentStep)
  return steps.map((step, i) => ({
    step,
    state: finished || (idx >= 0 && i < idx) ? 'done' : i === idx ? 'current' : 'pending',
  }))
}

export function summarizeJob(job) {
  const alerts = job ? Object.values(job.alerts) : []
  return {
    total: alerts.length,
    done: alerts.filter((a) => a.step === STEP.TICKET).length,
    failed: alerts.filter((a) => a.step === STEP.ERROR).length,
  }
}

export function alertElapsedSeconds(alert, nowSeconds = Date.now() / 1000) {
  if (!alert.started_at) return null
  return Number(((alert.finished_at || nowSeconds) - alert.started_at).toFixed(1))
}
