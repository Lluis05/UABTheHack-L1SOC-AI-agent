// Navegación entre diapositivas. Lógica pura para poder probarla.

const NEXT_KEYS = new Set(['ArrowRight', 'PageDown', ' '])
const PREV_KEYS = new Set(['ArrowLeft', 'PageUp'])

/** Mantiene el índice dentro de [0, count - 1]. */
export function clampIndex(index, count) {
  if (!Number.isFinite(index) || count <= 0) return 0
  return Math.min(count - 1, Math.max(0, Math.trunc(index)))
}

/** +1, -1 o 0 según la tecla. Home/End devuelven un destino absoluto. */
export function keyToMove(key, count) {
  if (NEXT_KEYS.has(key)) return { delta: 1 }
  if (PREV_KEYS.has(key)) return { delta: -1 }
  if (key === 'Home') return { to: 0 }
  if (key === 'End') return { to: count - 1 }
  return null
}

/** No robamos las flechas cuando la persona escribe o usa un control que ya las usa. */
export function isTypingTarget(target) {
  const tag = target?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target?.isContentEditable)
}

/** «#3» → 2. Así se puede compartir el enlace a una diapositiva concreta. */
export function indexFromHash(hash, count) {
  const n = Number.parseInt(String(hash).replace('#', ''), 10)
  return Number.isNaN(n) ? 0 : clampIndex(n - 1, count)
}
