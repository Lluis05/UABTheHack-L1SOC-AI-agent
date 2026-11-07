import { describe, expect, it } from 'vitest'
import { buildQueueStats, dailyCounts, histogram, speedup, topCounts, verdictDecider } from './metrics.js'

const tickets = [
  { ticket_id: 'T1', severity: 'high', verdict: 'true_positive', x_status: 'awaiting_approval', confidence: 0.92,
    triage_seconds: 20, x_prefilter_agreement: 'agree', x_decided_by: { verdict: 'llm' }, mitre: ['T1190', 'T1078'],
    x_rule: { rule_id: 'UC-WEB-001', rule_name: 'Inyección web' }, recommended_actions: [{ action: 'block_ioc' }],
    x_alert_created_at: '2026-10-06T10:00:00Z', x_incident_id: 'INC-1' },
  { ticket_id: 'T2', severity: 'low', verdict: 'false_positive', x_status: 'closed', confidence: 0.55, triage_seconds: 50,
    x_prefilter_agreement: 'disagree', x_decided_by: { verdict: 'policy' }, mitre: ['T1190'],
    x_rule: { rule_id: 'UC-WEB-001', rule_name: 'Inyección web' }, recommended_actions: [{ action: 'close' }, { action: 'block_ioc' }],
    x_alert_created_at: '2026-10-08T23:00:00Z' },
  { ticket_id: 'T3', severity: 'low', verdict: 'false_positive', x_status: 'closed', x_prefilter_agreement: 'no_hint',
    x_decided_by: { verdict: 'llm' }, x_human_decisions: [{ type: 'close' }] },
]

describe('panel de métricas', () => {
  const stats = buildQueueStats(tickets)

  it('totales, abiertos y distribuciones en el orden del contrato con ceros', () => {
    expect(stats).toMatchObject({ total: 3, open: 1, closed: 2, correlated: 1 })
    expect(stats.severity.map((s) => s.value)).toEqual([0, 1, 0, 2, 0])
    expect(stats.status[0]).toEqual({ key: 'awaiting_approval', value: 1 })
  })
  it('una decisión humana pasa por delante de quien decidió el veredicto', () => {
    expect(verdictDecider(tickets[2])).toBe('human')
    expect(stats.decider).toEqual([{ key: 'policy', value: 1 }, { key: 'llm', value: 1 }, { key: 'human', value: 1 }])
  })
  it('confianza y triaje: media, extremos e histograma; sin dato no cuenta', () => {
    expect(stats.confidence.average).toBe(73.5)
    expect(stats.confidence.min).toBe(55)
    expect(stats.confidence.bins.map((b) => b.value)).toEqual([1, 0, 0, 0, 1])
    expect(stats.triage).toMatchObject({ average: 35, max: 50 })
  })
  it('acuerdo prefiltro–IA solo sobre los tickets con pista', () => {
    expect(stats.agreement).toEqual({ agree: 1, withHint: 2, rate: 50 })
  })
  it('rankings con el nombre de la regla en la ayuda', () => {
    expect(stats.mitre[0]).toEqual({ key: 'T1190', value: 2 })
    expect(stats.rules[0]).toEqual({ key: 'UC-WEB-001', value: 2, hint: 'Inyección web' })
    expect(stats.actions.map((a) => a.key)).toEqual(['block_ioc', 'close'])
  })
  it('sin tickets no rompe', () => {
    const empty = buildQueueStats([])
    expect(empty).toMatchObject({ total: 0, open: 0, daily: [], agreement: { rate: null } })
    expect(empty.confidence.average).toBeNull()
  })
})

describe('piezas de las gráficas', () => {
  it('histograma con tramos abiertos en los extremos', () => {
    expect(histogram([5, 15, 29, 70], [10, 30], ' s')).toEqual([
      { key: '<10', label: '<10 s', value: 1 }, { key: '10-30', label: '10–30 s', value: 2 }, { key: '>=30', label: '≥30 s', value: 1 },
    ])
  })
  it('top N de mayor a menor y, a igualdad, alfabético', () => {
    expect(topCounts(['b', 'a', 'b', 'c', 'a', 'b'], 2)).toEqual([{ key: 'b', value: 3 }, { key: 'a', value: 2 }])
  })
  it('alertas por día rellena los días vacíos y recorta a los últimos N', () => {
    const days = dailyCounts(['2026-10-06T10:00:00Z', '2026-10-08T01:00:00Z', '2026-10-08T05:00:00Z'])
    expect(days.map((d) => [d.key, d.value])).toEqual([['2026-10-06', 1], ['2026-10-07', 0], ['2026-10-08', 2]])
    expect(days[0].label).toMatch(/oct/)
    expect(dailyCounts(['2026-10-01T00:00:00Z', '2026-10-31T00:00:00Z'], 5)).toHaveLength(5)
  })
  it('cuántas veces más rápido que a mano', () => {
    expect(speedup(30, 15)).toBe(30)
    expect(speedup(null, 15)).toBeNull()
  })
})
