import { describe, expect, it } from 'vitest'
import { groupTrace, totalMs, formatMs, replayDelay, splitActions, severityShift } from './trace'
import { clampIndex, keyToMove, isTypingTarget, indexFromHash } from './nav'
import { STAGES, FALLBACK_STAGE, SEVERITIES, REPLAY } from '../config/constants'
import cases from '../data/casos.json'

describe('groupTrace', () => {
  it('reparte los pasos por etapa y conserva el orden', () => {
    const trace = [{ step: 'intake' }, { step: 'cmdb', query: 'a' }, { step: 'llm' }, { step: 'cmdb', query: 'b' }]
    const groups = groupTrace(trace, STAGES, FALLBACK_STAGE)
    expect(groups.entrada).toHaveLength(1)
    expect(groups.contexto.map(s => s.query)).toEqual(['a', 'b'])
    expect(groups.ia).toHaveLength(1)
    expect(groups.persona).toEqual([])
  })

  it('manda los pasos desconocidos a la etapa de reserva', () => {
    const groups = groupTrace([{ step: 'nuevo_paso' }], STAGES, FALLBACK_STAGE)
    expect(groups[FALLBACK_STAGE]).toHaveLength(1)
  })

  it('no pierde ningún paso de las trazas reales', () => {
    for (const c of cases) {
      const groups = groupTrace(c.trace, STAGES, FALLBACK_STAGE)
      const n = Object.values(groups).reduce((sum, steps) => sum + steps.length, 0)
      expect(n).toBe(c.trace.length)
    }
  })
})

describe('tiempos', () => {
  it('suma ms ignorando valores vacíos', () => {
    expect(totalMs([{ ms: 1.5 }, { ms: null }, { ms: 2 }])).toBe(3.5)
  })

  it('formatea ms y segundos con coma decimal', () => {
    expect(formatMs(0.36)).toBe('0,4 ms')
    expect(formatMs(351.28)).toBe('351 ms')
    expect(formatMs(30015)).toBe('30,0 s')
  })

  it('acota la espera de la reproducción', () => {
    expect(replayDelay(0, REPLAY)).toBe(REPLAY.minDelayMs)
    expect(replayDelay(30015, REPLAY)).toBe(REPLAY.maxDelayMs)
  })
})

describe('acciones y severidad', () => {
  it('separa lo que necesita aprobación humana', () => {
    const { needsApproval, direct } = splitActions([
      { action: 'isolate_host', requires_approval: true },
      { action: 'block_ioc', requires_approval: false },
    ])
    expect(needsApproval.map(a => a.action)).toEqual(['isolate_host'])
    expect(direct.map(a => a.action)).toEqual(['block_ioc'])
  })

  it('calcula el escalón de severidad', () => {
    expect(severityShift(SEVERITIES, 'high', 'critical')).toBe(1)
    expect(severityShift(SEVERITIES, 'medium', 'informational')).toBe(-2)
    expect(severityShift(SEVERITIES, 'raro', 'high')).toBe(0)
  })
})

describe('navegación', () => {
  it('mantiene el índice en rango', () => {
    expect(clampIndex(-1, 5)).toBe(0)
    expect(clampIndex(9, 5)).toBe(4)
    expect(clampIndex(Number.NaN, 5)).toBe(0)
  })

  it('traduce teclas a movimientos', () => {
    expect(keyToMove('ArrowRight', 5)).toEqual({ delta: 1 })
    expect(keyToMove('PageUp', 5)).toEqual({ delta: -1 })
    expect(keyToMove('End', 5)).toEqual({ to: 4 })
    expect(keyToMove('a', 5)).toBeNull()
  })

  it('no captura teclas mientras se escribe', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV' })).toBe(false)
  })

  it('lee la diapositiva del hash', () => {
    expect(indexFromHash('#3', 9)).toBe(2)
    expect(indexFromHash('#99', 9)).toBe(8)
    expect(indexFromHash('', 9)).toBe(0)
  })
})
