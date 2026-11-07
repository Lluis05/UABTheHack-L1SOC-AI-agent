import { describe, expect, it } from 'vitest'
import { ACTION_KIND, INPUT_MODE } from '../config/constants.js'
import {
  actionKind, activeFilterCount, affectedGroups, affectedValues, approversLabel, EMPTY_FILTERS, findExecution, queueTickets,
  splitVisible,
} from './tickets.js'
import { alertElapsedSeconds, buildTriageRequest, parseAlerts, parseIds, stepStates, summarizeJob } from './triage.js'
import { countLabel, formatDateTime, formatPercent, initials, toPercent } from './format.js'
import { chipProps, optionsFor } from './chips.js'
import { buildSearch, readUrlState } from './url.js'

const CONFIG = { api_actions: ['isolate_host', 'block_ioc'] }
const rule = (allowed, requires_approval, approvers = []) => ({ allowed, requires_approval, approvers })
const STEPS = ['context', 'policy', 'llm', 'reviewer', 'ticket']

describe('queueTickets', () => {
  const tickets = [
    { ticket_id: 'T1', x_status: 'closed', severity: 'critical', title: 'a' },
    { ticket_id: 'T2', x_status: 'awaiting_approval', severity: 'low', title: 'b', affected: { hosts: ['WS-1'] } },
    { ticket_id: 'T3', x_status: 'awaiting_approval', severity: 'high', title: 'c', x_decided_by: { verdict: 'llm' } },
  ]
  it('pone primero lo pendiente de aprobación y dentro, por severidad', () => {
    expect(queueTickets(tickets, EMPTY_FILTERS).map((t) => t.ticket_id)).toEqual(['T3', 'T2', 'T1'])
  })
  it('filtra por texto en entidades afectadas y por quién decidió', () => {
    expect(queueTickets(tickets, { ...EMPTY_FILTERS, text: 'ws-1' }).map((t) => t.ticket_id)).toEqual(['T2'])
    expect(queueTickets(tickets, { ...EMPTY_FILTERS, decider: 'llm' }).map((t) => t.ticket_id)).toEqual(['T3'])
  })
})

describe('acciones', () => {
  it('clasifica según la política (x_approval)', () => {
    expect(actionKind({ action: 'isolate_host', x_approval: rule(true, true) }, CONFIG)).toBe(ACTION_KIND.APPROVAL)
    expect(actionKind({ action: 'block_ioc', x_approval: rule(true, false) }, CONFIG)).toBe(ACTION_KIND.N1)
    expect(actionKind({ action: 'isolate_host', x_approval: rule(false, true) }, CONFIG)).toBe(ACTION_KIND.BLOCKED)
    expect(actionKind({ action: 'escalate', x_approval: rule(true, false) }, CONFIG)).toBe(ACTION_KIND.DECISION)
  })
  it('sin dato de la política, pide aprobación (lo más seguro)', () => {
    expect(actionKind({ action: 'block_ioc' }, CONFIG)).toBe(ACTION_KIND.APPROVAL)
  })
  it('muestra quién aprueba', () => {
    expect(approversLabel({ x_approval: rule(true, true, ['N2', 'Negocio']) })).toBe('N2 + Negocio')
    expect(approversLabel({})).toBe('')
  })
  it('encuentra la ejecución por acción y objetivo', () => {
    const executed = [{ action: 'block_ioc', target: '1.2.3.4' }]
    expect(findExecution({ action: 'block_ioc', target: '1.2.3.4' }, executed)).toBeTruthy()
    expect(findExecution({ action: 'block_ioc', target: '5.6.7.8' }, executed)).toBeUndefined()
  })
  it('agrupa solo las entidades afectadas no vacías', () => {
    expect(affectedGroups({ users: ['u'], hosts: [] })).toEqual([['Usuarios', ['u']]])
  })
})

describe('entrada del triaje', () => {
  it('acepta array, objeto suelto y JSONL', () => {
    expect(parseAlerts('[{"a":1},{"a":2}]')).toHaveLength(2)
    expect(parseAlerts('{"a":1}')).toHaveLength(1)
    expect(parseAlerts('{"a":1}\n\n{"a":2}\n')).toHaveLength(2)
    expect(() => parseAlerts('{"a":1}\nroto')).toThrow('Línea 2')
  })
  it('separa IDs por comas, espacios o saltos de línea', () => {
    expect(parseIds('ALR-1, ALR-2\nALR-3;ALR-4')).toEqual(['ALR-1', 'ALR-2', 'ALR-3', 'ALR-4'])
  })
  it('construye el cuerpo según el modo', () => {
    expect(buildTriageRequest(INPUT_MODE.IDS, { ids: 'A,B' })).toEqual({ ids: ['A', 'B'] })
    expect(buildTriageRequest(INPUT_MODE.RANDOM, { count: '10' })).toEqual({ random: 10 })
    expect(() => buildTriageRequest(INPUT_MODE.PASTE, { text: ' ' })).toThrow()
    expect(() => buildTriageRequest(INPUT_MODE.RANDOM, { count: 0 })).toThrow()
  })
})

describe('progreso del triaje', () => {
  it('marca pasos hechos, actual y pendientes', () => {
    expect(stepStates('llm', STEPS).map((s) => s.state)).toEqual(['done', 'done', 'current', 'pending', 'pending'])
    expect(stepStates('ticket', STEPS).every((s) => s.state === 'done')).toBe(true)
    expect(stepStates('queued', STEPS).every((s) => s.state === 'pending')).toBe(true)
  })
  it('resume el job', () => {
    const job = { alerts: { a: { step: 'ticket' }, b: { step: 'error' }, c: { step: 'llm' } } }
    expect(summarizeJob(job)).toEqual({ total: 3, done: 1, failed: 1 })
    expect(summarizeJob(null)).toEqual({ total: 0, done: 0, failed: 0 })
  })
  it('calcula el tiempo por alerta', () => {
    expect(alertElapsedSeconds({ started_at: 10, finished_at: 22.34 })).toBe(12.3)
    expect(alertElapsedSeconds({ started_at: 10 }, 15)).toBe(5)
    expect(alertElapsedSeconds({ started_at: null })).toBeNull()
  })
})

describe('chips', () => {
  it('resuelve etiqueta, tono y relleno', () => {
    expect(chipProps('severity', 'high')).toMatchObject({ label: 'Alta', tone: 'sevHigh', variant: 'solid' })
    expect(chipProps('decider', 'llm')).toMatchObject({ label: 'IA', variant: 'outline' })
    expect(chipProps('decider', 'llm').title).toBeTruthy()
  })
  it('muestra los valores desconocidos tal cual', () => {
    expect(chipProps('verdict', 'nuevo_valor')).toMatchObject({ label: 'nuevo_valor', tone: 'default' })
    expect(chipProps('verdict', undefined).label).toBe('—')
  })
  it('genera opciones de select en el orden indicado', () => {
    expect(optionsFor('severity', ['low', 'high'])).toEqual([{ value: 'low', label: 'Baja' }, { value: 'high', label: 'Alta' }])
  })
})

describe('estado en la URL', () => {
  const PAGES = ['queue', 'live']
  it('lee la página y el ticket, y descarta páginas desconocidas', () => {
    expect(readUrlState('?page=live&ticket=TKT-1', PAGES, 'queue')).toEqual({ page: 'live', ticket: 'TKT-1' })
    expect(readUrlState('?page=hack', PAGES, 'queue')).toEqual({ page: 'queue', ticket: null })
  })
  it('construye la query y se puede releer', () => {
    const search = buildSearch({ page: 'queue', ticket: 'TKT 1&x' })
    expect(readUrlState(search, PAGES, 'live')).toEqual({ page: 'queue', ticket: 'TKT 1&x' })
    expect(buildSearch({})).toBe('')
  })
})

describe('formato', () => {
  it('no rompe con valores vacíos o raros', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('no-es-fecha')).toBe('no-es-fecha')
    expect(formatPercent(null)).toBe('—')
    expect(toPercent(0.856)).toBe(86)
    expect(countLabel(1, 'alerta')).toBe('1 alerta')
    expect(countLabel(3, 'alerta')).toBe('3 alertas')
  })
})

describe('rediseño: filtros, tags y avatar', () => {
  it('cuenta solo los filtros con valor', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0)
    expect(activeFilterCount({ ...EMPTY_FILTERS, text: '  ', severity: 'high', decider: 'llm' })).toBe(2)
  })
  it('aplana las entidades afectadas sin repetir', () => {
    expect(affectedValues({ users: ['u1'], hosts: ['H1', 'u1'], customers: [] })).toEqual(['u1', 'H1'])
    expect(affectedValues(undefined)).toEqual([])
  })
  it('corta la fila de tags y dice cuántos quedan', () => {
    expect(splitVisible(['a', 'b', 'c'], 2)).toEqual({ visible: ['a', 'b'], hidden: 1 })
    expect(splitVisible(['a'], 4)).toEqual({ visible: ['a'], hidden: 0 })
  })
  it('saca las iniciales del nombre', () => {
    expect(initials('  ana  garcía lópez ')).toBe('AG')
    expect(initials('')).toBe('')
  })
})
