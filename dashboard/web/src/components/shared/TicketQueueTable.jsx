import { AppButton, AppChip, AppEmptyState, AppStack, AppTable, AppText } from '../base'
import { CHIP_KINDS, SORT_KEY } from '../../config/constants.js'
import { chipProps } from '../../utils/chips.js'
import { formatAlertTime, formatDateTime, toPercent } from '../../utils/format.js'

const EMPTY = '—'

// Columnas por prioridad: severidad, ID, título, estado y hora siempre; lo demás aparece cuando hay sitio.
// Las claves son las de SORT_KEY: todas se pueden ordenar desde su cabecera.
const COLUMNS = [
  { key: SORT_KEY.SEVERITY, label: 'Severidad', nowrap: true, render: (t) => <AppChip {...chipProps('severity', t.severity)} /> },
  { key: SORT_KEY.ID, label: 'ID', mono: true },
  {
    key: SORT_KEY.TITLE, label: 'Título',
    render: (t) => (
      <AppStack direction="row" gap={0.75}>
        <AppText lines={1} title={t.title}>{t.title}</AppText>
        {t.x_pending_close ? <AppChip label="Falta ejecutar" tone="warning" title="Se cierra en cuanto el N1 ejecute sus acciones" /> : null}
      </AppStack>
    ),
  },
  { key: SORT_KEY.STATUS, label: 'Estado', nowrap: true, render: (t) => <AppChip {...chipProps('status', t.x_status)} /> },
  { key: SORT_KEY.VERDICT, label: 'Veredicto', nowrap: true, hideBelow: 'xl', render: (t) => <AppChip {...chipProps('verdict', t.verdict)} /> },
  {
    key: SORT_KEY.DECIDER, label: 'Decidió', nowrap: true, hideBelow: 'lg',
    render: (t) => <AppChip {...chipProps('decider', t.x_decided_by?.verdict)} variant="solid" />,
  },
  { key: SORT_KEY.INCIDENT, label: 'Incidente', mono: true, hideBelow: 'lg', render: (t) => t.x_incident_id || EMPTY },
  {
    key: SORT_KEY.CONFIDENCE, label: 'Confianza', mono: true, align: 'right', hideBelow: 'lg',
    render: (t) => (t.confidence == null ? EMPTY : `${toPercent(t.confidence)} %`),
  },
  {
    key: SORT_KEY.TIME, label: 'Alerta', mono: true, align: 'right',
    render: (t) => <span title={formatDateTime(t.x_alert_created_at)}>{formatAlertTime(t.x_alert_created_at)}</span>,
  },
].map((c) => ({ ...c, sortable: true }))

// Cola a pantalla completa (escritorio): tabla densa, una fila por ticket, franja de color por severidad.
// Las filas se abren con clic, Enter o Espacio; j/k se gestiona en la página.
// sort {key, direction} + onSortChange(key): orden por columna (la página decide el sentido, ver nextSort)
export default function TicketQueueTable({ tickets, selectedId, onSelect, onClearFilters, sort, onSortChange }) {
  if (tickets.length === 0) return <NoTickets onClearFilters={onClearFilters} />
  return (
    <AppTable columns={COLUMNS} rows={tickets} label="Cola de tickets" maxHeight="queueTableMaxHeight"
              sort={sort} onSortChange={onSortChange} getRowKey={(t) => t.ticket_id} rowId={(t) => t.ticket_id} rowLabel={(t) => `${t.ticket_id}: ${t.title}`}
              rowTone={(t) => CHIP_KINDS.severity[t.severity]?.[1]}
              isRowSelected={(t) => t.ticket_id === selectedId} onRowClick={(t) => onSelect(t.ticket_id)} />
  )
}

export function NoTickets({ onClearFilters }) {
  return (
    <AppEmptyState icon="filterOff" title="Ningún ticket coincide con los filtros"
                   action={onClearFilters ? <AppButton onClick={onClearFilters}>Quitar filtros</AppButton> : null} />
  )
}
