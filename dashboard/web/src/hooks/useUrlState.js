import { useEffect, useState } from 'react'
import { buildSearch, readUrlState } from '../utils/url.js'

// Estado de navegación sincronizado con la URL. Atrás/adelante del navegador funcionan.
export function useUrlState(allowedPages, defaultPage) {
  const [state, setState] = useState(() => readUrlState(window.location.search, allowedPages, defaultPage))

  useEffect(() => {
    const onPop = () => setState(readUrlState(window.location.search, allowedPages, defaultPage))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [allowedPages, defaultPage])

  function update(patch) {
    setState((prev) => {
      const next = { ...prev, ...patch }
      const search = buildSearch(next)
      if (search !== window.location.search) window.history.pushState(null, '', `${window.location.pathname}${search}`)
      return next
    })
  }

  return [state, update]
}
