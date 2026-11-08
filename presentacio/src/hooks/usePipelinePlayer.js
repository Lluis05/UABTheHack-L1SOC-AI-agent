import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Etapa activa del pipeline. «play» recorre todas las etapas solas, una cada `stepMs`, como si el triaje
 * pasara delante del jurado; cualquier selección manual detiene la reproducción.
 */
export function usePipelinePlayer(count, stepMs) {
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timer = useRef(null)

  const stop = useCallback(() => {
    clearInterval(timer.current)
    setPlaying(false)
  }, [])

  useEffect(() => () => clearInterval(timer.current), [])

  const play = useCallback(() => {
    clearInterval(timer.current)
    setCurrent(0)
    setPlaying(true)
    timer.current = setInterval(() => {
      setCurrent(i => {
        if (i + 1 >= count - 1) {
          clearInterval(timer.current)
          setPlaying(false)
        }
        return Math.min(i + 1, count - 1)
      })
    }, stepMs)
  }, [count, stepMs])

  const select = useCallback(i => {
    stop()
    setCurrent(Math.min(Math.max(i, 0), count - 1))
  }, [count, stop])

  return { current, playing, play, stop, select }
}
