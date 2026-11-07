const LOCALE = 'es-ES'
const DATE_TIME = { dateStyle: 'short', timeStyle: 'short' }
const EMPTY = '—'

export function formatDateTime(iso) {
  if (!iso) return EMPTY
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString(LOCALE, DATE_TIME)
}

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const SHORT_DATE_TIME = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }

// Hora de la alerta en la cola: relativa si es de hoy («ahora», «12 min», «3 h»); si no, fecha corta («10 oct, 11:31»).
// now: inyectable para los tests.
export function formatAlertTime(iso, now = Date.now()) {
  if (!iso) return EMPTY
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return String(iso)
  const ago = now - time
  if (ago >= 0 && ago < MINUTE_MS) return 'ahora'
  if (ago >= 0 && ago < HOUR_MS) return `${Math.floor(ago / MINUTE_MS)} min`
  if (ago >= 0 && ago < DAY_MS) return `${Math.floor(ago / HOUR_MS)} h`
  return new Date(time).toLocaleString(LOCALE, SHORT_DATE_TIME)
}

export function formatPercent(value) {
  return value == null ? EMPTY : `${value}%`
}

export function formatSeconds(value) {
  return value == null ? EMPTY : `${value} s`
}

export function toPercent(fraction) {
  return Math.round((fraction ?? 0) * 100)
}

export function orDash(value) {
  return value == null || value === '' ? EMPTY : value
}

// "1 alerta", "3 alertas". plural por defecto: singular + "s"
export function countLabel(n, singular, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`
}

const MAX_INITIALS = 2
// "Ana García López" → "AG". Vacío si no hay nombre (el avatar muestra «?»).
export function initials(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, MAX_INITIALS).map((w) => w[0].toUpperCase()).join('')
}
