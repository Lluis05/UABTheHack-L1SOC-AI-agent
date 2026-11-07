import { theme as actualTheme } from '../theme.js'
import { readLocal, writeLocal } from '../services/storage.js'
import { LOOK_PARAM, LOOK_STORAGE_KEY, pickLook } from './look.js'
import { refinadoTheme } from './refinado.js'

// Variantes estéticas para comparar (rama feat/ui-variants). Misma distribución, distinta piel.
// Se elige con ?look=<nombre> en la URL y se recuerda en el navegador (la navegación reescribe la URL y lo perdería).
export const LOOKS = { actual: actualTheme, refinado: refinadoTheme }

export function currentLook() {
  const fromUrl = new URLSearchParams(window.location.search).get(LOOK_PARAM)
  const look = pickLook(fromUrl, readLocal(LOOK_STORAGE_KEY), Object.keys(LOOKS))
  if (look === fromUrl) writeLocal(LOOK_STORAGE_KEY, look)
  return look
}
