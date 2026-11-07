const LOCALE = 'es-ES'
const DATE_TIME = { dateStyle: 'short', timeStyle: 'short' }
const EMPTY = '—'

export function formatDateTime(iso) {
  if (!iso) return EMPTY
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString(LOCALE, DATE_TIME)
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
