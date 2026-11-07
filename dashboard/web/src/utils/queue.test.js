import { describe, expect, it } from 'vitest'
import { CHIP_KINDS, QUEUE_SORT, SORT_DIR, SORT_KEY } from '../config/constants.js'
import { chipProps } from './chips.js'
import { formatAlertTime } from './format.js'
import { countNew, EMPTY_FILTERS, nextSort, queueTickets, stepId } from './tickets.js'

const NOW = Date.parse('2026-11-07T12:00:00Z')
const minutesAgo = (m) => new Date(NOW - m * 60 * 1000).toISOString()

describe('hora de la alerta en la cola', () => {
  it('relativa si es de las últimas 24 h', () => {
    expect(formatAlertTime(minutesAgo(0.5), NOW)).toBe('ahora')
    expect(formatAlertTime(minutesAgo(12), NOW)).toBe('12 min')
    expect(formatAlertTime(minutesAgo(3 * 60 + 5), NOW)).toBe('3 h')
  })
  it('fecha corta si es más antigua o futura', () => {
    expect(formatAlertTime('2026-10-10T11:31:26.000Z', NOW)).toMatch(/oct/)
    expect(formatAlertTime(minutesAgo(-30), NOW)).toMatch(/nov/)
  })
  it('sin fecha, guion; fecha ilegible, tal cual', () => {
    expect(formatAlertTime(null, NOW)).toBe('—')
    expect(formatAlertTime('ayer', NOW)).toBe('ayer')
  })
})

describe('orden de la cola', () => {
  const tickets = [
    { ticket_id: 'T1', x_status: 'triaged', severity: 'critical', x_alert_created_at: minutesAgo(300) },
    { ticket_id: 'T2', x_status: 'awaiting_approval', severity: 'low', x_alert_created_at: minutesAgo(10) },
    { ticket_id: 'T3', x_status: 'triaged', severity: 'critical', x_alert_created_at: minutesAgo(5) },
    { ticket_id: 'T4', x_status: 'closed', severity: 'medium' },
  ]
  const ids = (key, direction = SORT_DIR.DESC) => queueTickets(tickets, EMPTY_FILTERS, { key, direction }).map((t) => t.ticket_id)

  it('prioridad: pendiente primero, luego severidad y, a igualdad, la más reciente', () => {
    expect(ids(QUEUE_SORT.PRIORITY)).toEqual(['T2', 'T3', 'T1', 'T4'])
  })
  it('más recientes: por hora de la alerta; sin hora, al final', () => {
    expect(ids(QUEUE_SORT.RECENT)).toEqual(['T3', 'T2', 'T1', 'T4'])
  })
  it('severidad: crítica primero y, dentro, la más reciente', () => {
    expect(ids(QUEUE_SORT.SEVERITY)).toEqual(['T3', 'T1', 'T4', 'T2'])
  })
  it('un orden desconocido usa la prioridad', () => {
    expect(ids('otro')).toEqual(ids(QUEUE_SORT.PRIORITY))
  })
})

describe('orden por columna', () => {
  const tickets = [
    { ticket_id: 'TKT-2', title: 'beta', x_status: 'triaged', severity: 'low', confidence: 0.5, verdict: 'false_positive' },
    { ticket_id: 'TKT-10', title: 'Alfa', x_status: 'closed', severity: 'high', confidence: 0.9, verdict: 'true_positive', x_incident_id: 'INC-1' },
    { ticket_id: 'TKT-1', title: 'gamma', x_status: 'awaiting_approval', severity: 'medium', verdict: 'needs_more_info' },
  ]
  const ids = (key, direction = SORT_DIR.DESC) => queueTickets(tickets, EMPTY_FILTERS, { key, direction }).map((t) => t.ticket_id)

  it('de mayor a menor y al revés, en números y rangos', () => {
    expect(ids(SORT_KEY.SEVERITY)).toEqual(['TKT-10', 'TKT-1', 'TKT-2'])
    expect(ids(SORT_KEY.SEVERITY, SORT_DIR.ASC)).toEqual(['TKT-2', 'TKT-1', 'TKT-10'])
    expect(ids(SORT_KEY.STATUS)).toEqual(['TKT-1', 'TKT-2', 'TKT-10'])
    expect(ids(SORT_KEY.VERDICT)).toEqual(['TKT-10', 'TKT-2', 'TKT-1'])
  })
  it('textos sin distinguir mayúsculas y con números naturales (TKT-10 > TKT-2)', () => {
    expect(ids(SORT_KEY.ID)).toEqual(['TKT-10', 'TKT-2', 'TKT-1'])
    expect(ids(SORT_KEY.TITLE, SORT_DIR.ASC)).toEqual(['TKT-10', 'TKT-2', 'TKT-1'])
  })
  it('sin dato, siempre al final', () => {
    expect(ids(SORT_KEY.CONFIDENCE)).toEqual(['TKT-10', 'TKT-2', 'TKT-1'])
    expect(ids(SORT_KEY.CONFIDENCE, SORT_DIR.ASC)).toEqual(['TKT-2', 'TKT-10', 'TKT-1'])
    expect(ids(SORT_KEY.INCIDENT, SORT_DIR.ASC)[0]).toBe('TKT-10')
  })
  it('clic en la cabecera: misma columna invierte, otra empieza de mayor a menor', () => {
    const desc = { key: SORT_KEY.TIME, direction: SORT_DIR.DESC }
    expect(nextSort(desc, SORT_KEY.TIME)).toEqual({ key: SORT_KEY.TIME, direction: SORT_DIR.ASC })
    expect(nextSort({ ...desc, direction: SORT_DIR.ASC }, SORT_KEY.TIME)).toEqual(desc)
    expect(nextSort(desc, SORT_KEY.SEVERITY)).toEqual({ key: SORT_KEY.SEVERITY, direction: SORT_DIR.DESC })
  })
})

describe('navegación con j/k', () => {
  const list = ['A', 'B', 'C']
  it('avanza y retrocede sin salirse de la lista', () => {
    expect(stepId(list, 'A', 1)).toBe('B')
    expect(stepId(list, 'B', -1)).toBe('A')
    expect(stepId(list, 'C', 1)).toBe('C')
    expect(stepId(list, 'A', -1)).toBe('A')
  })
  it('sin selección empieza por el primero (o por el último hacia atrás)', () => {
    expect(stepId(list, null, 1)).toBe('A')
    expect(stepId(list, 'X', -1)).toBe('C')
    expect(stepId([], null, 1)).toBeNull()
  })
})

describe('tickets nuevos al refrescar', () => {
  it('cuenta los IDs que no estaban', () => {
    expect(countNew(['A', 'B'], ['A', 'B', 'C', 'D'])).toBe(2)
    expect(countNew(['A', 'B'], ['B'])).toBe(0)
  })
  it('la primera carga no cuenta como nuevos', () => {
    expect(countNew(null, ['A'])).toBe(0)
  })
})

describe('presupuesto de color de los chips', () => {
  it('estado y veredicto no reutilizan colores de severidad', () => {
    const severityTones = new Set(Object.values(CHIP_KINDS.severity).map(([, tone]) => tone))
    for (const kind of ['status', 'verdict']) {
      for (const [, tone] of Object.values(CHIP_KINDS[kind])) expect(severityTones.has(tone)).toBe(false)
    }
  })
  it('estado y veredicto llevan icono', () => {
    expect(chipProps('status', 'escalated').icon).toBe('escalation')
    expect(chipProps('verdict', 'true_positive').icon).toBe('threat')
    expect(chipProps('verdict', 'nuevo').icon).toBeUndefined()
  })
})
