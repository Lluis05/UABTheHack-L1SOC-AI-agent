import { useCallback, useEffect, useRef, useState } from 'react'

// Carga asíncrona genérica: {data, error, loading, reload}. Ignora respuestas que llegan tarde (carreras).
export function useAsync(loader, deps) {
  const [state, setState] = useState({ data: null, error: '', loading: true })
  const callId = useRef(0)

  const reload = useCallback(async () => {
    const id = ++callId.current
    setState((s) => ({ ...s, loading: true }))
    try {
      const data = await loader()
      if (id === callId.current) setState({ data, error: '', loading: false })
    } catch (e) {
      if (id === callId.current) setState((s) => ({ ...s, error: e.message, loading: false }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { reload() }, [reload])
  return { ...state, reload }
}
