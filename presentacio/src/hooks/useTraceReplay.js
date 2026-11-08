import { useCallback, useEffect, useRef, useState } from 'react'
import { replayDelay } from '../utils/trace'
import { REPLAY } from '../config/constants'

/**
 * Cuántas líneas de la traza se ven. Al reproducir, aparecen una a una con una espera proporcional a lo que
 * tardaron de verdad. Al cambiar de caso o de etapa (`resetKey`) se ve todo de nuevo.
 */
export function useTraceReplay(steps, resetKey) {
  const [visible, setVisible] = useState(steps.length)
  const [playing, setPlaying] = useState(false)
  const timer = useRef(null)

  const stop = useCallback(() => {
    clearTimeout(timer.current)
    setPlaying(false)
  }, [])

  useEffect(() => {
    stop()
    setVisible(steps.length)
  }, [resetKey, steps.length, stop])

  useEffect(() => () => clearTimeout(timer.current), [])

  const play = useCallback(() => {
    clearTimeout(timer.current)
    setVisible(0)
    setPlaying(true)
    const showNext = shown => {
      if (shown >= steps.length) {
        setPlaying(false)
        return
      }
      timer.current = setTimeout(() => {
        setVisible(shown + 1)
        showNext(shown + 1)
      }, replayDelay(steps[shown].ms, REPLAY))
    }
    showNext(0)
  }, [steps])

  return { visible, playing, play, stop }
}
