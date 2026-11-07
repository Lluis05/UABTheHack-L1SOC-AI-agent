// Columnas ajustables (cola | ficha | asistente): lógica pura de anchos, tests en panes.test.js

export function clampWidth(width, min, max) {
  return Math.round(Math.min(Math.max(width, min), Math.max(min, max)))
}

// Anchos efectivos que caben en el contenedor: la columna central nunca baja de centerMin.
// layout: {leftWidth, asideWidth, leftCollapsed, asideCollapsed}; rail: ancho de una columna plegada.
// Sin medir el contenedor todavía (container = 0) devuelve los anchos guardados.
export function fitPanes({ container, layout, hasAside, limits, gutter, rail }) {
  if (!container) return { left: layout.leftWidth, aside: hasAside ? layout.asideWidth : 0 }
  const gutters = gutter * (hasAside ? 2 : 1)
  const leftFloor = layout.leftCollapsed ? rail : limits.leftMin
  let aside = 0
  if (hasAside) {
    aside = layout.asideCollapsed
      ? rail
      : clampWidth(layout.asideWidth, limits.asideMin, container - gutters - limits.centerMin - leftFloor)
  }
  const left = layout.leftCollapsed
    ? rail
    : clampWidth(layout.leftWidth, limits.leftMin, container - gutters - limits.centerMin - aside)
  return { left, aside }
}

// Disposición guardada en el navegador: se fusiona con los valores por defecto y se descarta lo que no cuadre
export function parseLayout(raw, defaults) {
  let saved = {}
  try { saved = JSON.parse(raw || '{}') || {} } catch { saved = {} }
  const out = { ...defaults }
  for (const [key, value] of Object.entries(defaults)) {
    if (typeof saved[key] === typeof value && (typeof value !== 'number' || Number.isFinite(saved[key]))) out[key] = saved[key]
  }
  return out
}
