import { useEffect, useRef } from 'react'

const itemSelector = (id) => `[data-item-id="${CSS.escape(id)}"]`

// Foco al navegar por la cola (accesibilidad y teclado):
// - al abrir un elemento, la lista se desplaza hasta él y el foco pasa al título del detalle (titleId)
// - al cerrar el detalle, el foco vuelve al elemento de la lista desde el que se abrió
export function useSelectionFocus(selectedId, titleId) {
  const previous = useRef(selectedId)

  useEffect(() => {
    const before = previous.current
    previous.current = selectedId
    if (selectedId === before) return
    if (selectedId) {
      document.querySelector(itemSelector(selectedId))?.scrollIntoView({ block: 'nearest' })
      document.getElementById(titleId)?.focus({ preventScroll: true })
    } else if (before) {
      const item = document.querySelector(itemSelector(before))
      item?.focus({ preventScroll: true })
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedId, titleId])
}
