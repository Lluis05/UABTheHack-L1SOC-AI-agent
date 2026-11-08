import { useCallback, useEffect, useState } from 'react'
import { clampIndex, indexFromHash, isTypingTarget, keyToMove } from '../utils/nav'

/** Diapositiva actual, con teclado (flechas, espacio, Re Pág/Av Pág, Inicio/Fin) y el número en la URL (#3). */
export function useSlideNav(count) {
  const [index, setIndex] = useState(() => indexFromHash(window.location.hash, count))

  const goTo = useCallback(next => setIndex(current => clampIndex(
    typeof next === 'function' ? next(current) : next, count)), [count])

  useEffect(() => {
    const onKey = event => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return
      // Los controles con foco (pestañas, botones) ya usan espacio y flechas: no los pisamos.
      if (event.key === ' ' && event.target?.closest?.('button, [role="tab"]')) return
      const move = keyToMove(event.key, count)
      if (!move) return
      event.preventDefault()
      goTo(current => (move.to ?? current + move.delta))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count, goTo])

  useEffect(() => {
    const hash = `#${index + 1}`
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
    window.scrollTo({ top: 0 })
  }, [index])

  useEffect(() => {
    const onHash = () => setIndex(indexFromHash(window.location.hash, count))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [count])

  return { index, goTo, next: () => goTo(i => i + 1), prev: () => goTo(i => i - 1) }
}
