import { useEffect, useRef } from 'react'

// Ejecuta `callback` cada `ms` mientras `enabled` sea true, siempre con la versión más reciente del callback.
export function useInterval(callback, ms, enabled = true) {
  const saved = useRef(callback)
  useEffect(() => { saved.current = callback }, [callback])
  useEffect(() => {
    if (!enabled) return undefined
    const id = setInterval(() => saved.current(), ms)
    return () => clearInterval(id)
  }, [ms, enabled])
}
