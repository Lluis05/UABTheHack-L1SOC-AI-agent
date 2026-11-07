import { useState } from 'react'
import { readLocal, writeLocal } from '../services/storage.js'

const ON = '1'
const OFF = '0'

// Interruptor recordado en el navegador (p. ej. gráficas desplegadas). fallback: valor si no hay nada guardado.
export function useStoredToggle(storageKey, fallback) {
  const [value, setValue] = useState(() => {
    const saved = readLocal(storageKey, '')
    return saved === '' ? fallback : saved === ON
  })
  function toggle() {
    setValue((v) => {
      writeLocal(storageKey, v ? OFF : ON)
      return !v
    })
  }
  return [value, toggle]
}
