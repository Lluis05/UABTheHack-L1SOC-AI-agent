import { useEffect, useRef, useState } from 'react'
import { NEW_ITEMS_NOTICE_MS } from '../config/constants.js'
import { countNew } from '../utils/tickets.js'

// Cuántos elementos nuevos ha traído el último refresco (para anunciarlo sin mover la vista).
// ids: lista de identificadores actual; la primera carga no cuenta.
export function useNewCount(ids) {
  const previous = useRef(null)
  const [fresh, setFresh] = useState(0)
  const key = ids.join('|')

  useEffect(() => {
    const added = countNew(previous.current, ids)
    // Sin nuevos en este refresco, el aviso desaparece
    if (previous.current) setFresh(added)
    if (ids.length) previous.current = ids
    // key resume ids: solo se recalcula cuando cambia la lista, no en cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // El aviso se quita solo al cabo de un rato
  useEffect(() => {
    if (!fresh) return undefined
    const timer = setTimeout(() => setFresh(0), NEW_ITEMS_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [fresh])

  return fresh
}
