import { describe, expect, it } from 'vitest'
import {
  groupTrace, totalMs, formatMs, cumulativeMs, classifyIntel, indicatorVerdicts, contextBySource,
  shortIndicator, splitActions, severityShift, entityChips,
} from './trace'
import { clampIndex, keyToMove, isTypingTarget, indexFromHash } from './nav'
import { STAGES, FALLBACK_STAGE, SEVERITIES, INTEL_STATUS, INTEL_SKIP } from '../config/constants'
import cases from '../data/casos.json'

describe('groupTrace', () => {
  it('reparte los pasos por etapa y conserva el orden', () => {
    const trace = [{ step: 'intake' }, { step: 'cmdb', query: 'a' }, { step: 'llm' }, { step: 'cmdb', query: 'b' }]
    const groups = groupTrace(trace, STAGES, FALLBACK_STAGE)
    expect(groups.entrada).toHaveLength(1)
    expect(groups.contexto.map(s => s.query)).toEqual(['a', 'b'])
    expect(groups.persona).toEqual([])
  })

  it('manda los pasos desconocidos a la etapa de reserva y no pierde ninguno de las trazas reales', () => {
    expect(groupTrace([{ step: 'nuevo' }], STAGES, FALLBACK_STAGE)[FALLBACK_STAGE]).toHaveLength(1)
    for (const c of cases) {
      const groups = groupTrace(c.trace, STAGES, FALLBACK_STAGE)
      expect(Object.values(groups).flat()).toHaveLength(c.trace.length)
    }
  })
})

describe('tiempos', () => {
  it('suma, acumula y formatea', () => {
    expect(totalMs([{ ms: 1.5 }, { ms: null }, { ms: 2 }])).toBe(3.5)
    const groups = Object.fromEntries(STAGES.map(s => [s.id, [{ ms: 1 }]]))
    expect(cumulativeMs(STAGES, groups).at(-1)).toBe(STAGES.length)
    expect(formatMs(0.36)).toBe('0,4 ms')
    expect(formatMs(351.28)).toBe('351 ms')
    expect(formatMs(30015)).toBe('30,0 s')
  })
})

describe('inteligencia', () => {
  it('clasifica resultados reales', () => {
    expect(classifyIntel('TIP: malicious (70) XMRig', INTEL_STATUS)).toBe('malicious')
    expect(classifyIntel('IPsum: en 8 listas negras', INTEL_STATUS)).toBe('malicious')
    expect(classifyIntel('TIP: suspicious (55)', INTEL_STATUS)).toBe('suspicious')
    expect(classifyIntel('sin datos en TIP/GeoIP (desconocido ≠ limpio)', INTEL_STATUS)).toBe('unknown')
    expect(classifyIntel('encontrado en la API', INTEL_STATUS)).toBe('info')
  })

  it('el peor estado gana, une el hash recortado y salta el presupuesto', () => {
    const steps = [
      { query: '45.148.10.121', source: 'TIP', result: 'TIP: suspicious (55)' },
      { query: '45.148.10.121', source: 'OSINT', result: 'IPsum: en 8 listas negras' },
      { query: '561c0d42abcdef', source: 'TIP', result: 'sin datos (desconocido ≠ limpio)' },
      { query: '561c0d42…', source: 'Sandbox', result: 'malicious (XMRig)' },
      { query: '1 indicadores más', source: 'OSINT', result: 'no consultados' },
    ]
    const verdicts = indicatorVerdicts(steps, INTEL_STATUS, INTEL_SKIP)
    expect(verdicts).toHaveLength(2)
    expect(verdicts.every(v => v.status === 'malicious')).toBe(true)
    expect(verdicts.find(v => v.indicator === '561c0d42abcdef').findings).toHaveLength(2)
  })
})

describe('contexto y chips', () => {
  it('agrupa por fuente y descarta los resultados vacíos', () => {
    const tiles = contextBySource([
      { source: 'Logs', result: '0 eventos' },
      { source: 'Logs', result: '14 eventos en firewall' },
      { source: 'CMDB', result: 'JENKINS-DEV01 · criticidad Media' },
    ])
    expect(tiles.find(t => t.source === 'Logs')).toEqual({ source: 'Logs', queries: 2, findings: ['14 eventos en firewall'] })
  })

  it('recorta indicadores largos por el centro', () => {
    const hash = '561c0d422068e204fbcaf5c3fbf6575d6cf6a9610dc530cabd18cafdbaeabf83'
    expect(shortIndicator(hash)).toMatch(/^561c0d.+….+eabf83$/)
    expect(shortIndicator('wms01')).toBe('wms01')
  })

  it('aplana las entidades de la alerta', () => {
    const chips = entityChips({ hosts: [{ hostname: 'WMS01' }], ips: ['10.0.0.1'], users: [{}] })
    expect(chips).toEqual([{ type: 'equipo', value: 'WMS01' }, { type: 'IP', value: '10.0.0.1' }])
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
  it('mantiene el índice en rango y traduce teclas', () => {
    expect(clampIndex(-1, 5)).toBe(0)
    expect(clampIndex(9, 5)).toBe(4)
    expect(keyToMove('ArrowRight', 5)).toEqual({ delta: 1 })
    expect(keyToMove('End', 5)).toEqual({ to: 4 })
    expect(keyToMove('a', 5)).toBeNull()
  })

  it('no captura teclas mientras se escribe y lee el hash', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true)
    expect(indexFromHash('#3', 4)).toBe(2)
    expect(indexFromHash('', 4)).toBe(0)
  })
})
