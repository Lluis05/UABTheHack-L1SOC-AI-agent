import { useState } from 'react'
import { PANE_DEFAULTS } from '../config/constants.js'
import { readLocal, writeLocal } from '../services/storage.js'
import { parseLayout } from '../utils/panes.js'

// Anchos y columnas plegadas de una página, recordados en el navegador (si lo permite).
export function usePaneLayout(storageKey, defaults = PANE_DEFAULTS) {
  const [layout, setLayout] = useState(() => parseLayout(readLocal(storageKey, ''), defaults))

  function update(patch) {
    setLayout((prev) => {
      const next = { ...prev, ...patch }
      writeLocal(storageKey, JSON.stringify(next))
      return next
    })
  }

  return [layout, update]
}
