// Elección de la variante estética (lógica pura, tests en look.test.js)
export const LOOK_PARAM = 'look'
export const LOOK_STORAGE_KEY = 'look'
export const DEFAULT_LOOK = 'actual'

// Gana la URL; si no, lo recordado en el navegador; si nada es válido, la variante por defecto
export function pickLook(fromUrl, fromStorage, available) {
  if (fromUrl && available.includes(fromUrl)) return fromUrl
  if (fromStorage && available.includes(fromStorage)) return fromStorage
  return DEFAULT_LOOK
}
