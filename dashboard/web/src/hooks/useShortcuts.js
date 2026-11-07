import { useEffect, useRef } from 'react'

// No se dispara mientras se escribe ni con un diálogo, cajón o menú abierto (el foco está dentro de ellos)
const TYPING = 'input, textarea, select, [contenteditable="true"]'
const OVERLAY = '[role="dialog"], [role="presentation"], [role="menu"], [role="listbox"]'

// Atajos de teclado de una pantalla. handlers: {tecla: () => void}, con la tecla como en KeyboardEvent.key
// ('j', '/', '?', 'Escape'...). Se ignoran las combinaciones con Ctrl/Cmd/Alt (son del navegador).
export function useShortcuts(handlers) {
  const current = useRef(handlers)
  current.current = handlers

  useEffect(() => {
    function onKeyDown(e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target instanceof Element ? e.target : null
      if (target?.closest(TYPING) || target?.closest(OVERLAY)) return
      const handler = current.current[e.key]
      if (!handler) return
      e.preventDefault()
      handler()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}
