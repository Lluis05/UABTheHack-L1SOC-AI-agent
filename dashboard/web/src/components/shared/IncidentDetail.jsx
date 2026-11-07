import { AppButton, AppCard, AppChip, AppKeyValueTable, AppStack, AppTable, AppText } from '../base'
import { MAX_ROW_TAGS } from '../../config/constants.js'
import { chipProps } from '../../utils/chips.js'
import { countLabel, formatDateTime } from '../../utils/format.js'
import { incidentEntities, incidentTactics } from '../../utils/incidents.js'
import { splitVisible } from '../../utils/tickets.js'

const CHAIN_COLUMNS = [
  { key: 'time', label: 'Cuándo', render: (k) => formatDateTime(k.time) },
  { key: 'tactic', label: 'Táctica', render: (k) => <AppChip label={k.tactic} tone="sevHigh" /> },
  { key: 'what', label: 'Qué' },
  { key: 'rule_id', label: 'Regla', mono: true },
  { key: 'alert_id', label: 'Alerta', mono: true },
]

// Detalle del incidente: cabecera, ficha en tabla y la cadena de ataque en el tiempo.
// knownTickets: IDs que existen en la cola (solo esos se pueden abrir).
export default function IncidentDetail({ incident: inc, knownTickets, onOpenTicket, onClose }) {
  const openable = (inc.ticket_ids || []).filter((id) => knownTickets.has(id))
  const rows = [
    { key: 'period', icon: 'trace', label: 'Periodo', value: <AppText>{formatDateTime(inc.first_seen)} – {formatDateTime(inc.last_seen)}</AppText> },
    { key: 'tactics', icon: 'mitre', label: 'Tácticas', value: <Tags values={incidentTactics(inc)} tone="sevHigh" /> },
    { key: 'linking', icon: 'rules', label: 'Unido por', value: <Tags values={inc.linking_entities} code /> },
    { key: 'entities', icon: 'people', label: 'Entidades', value: <Tags values={incidentEntities(inc)} code /> },
    { key: 'why', icon: 'severity', label: 'Por qué', value: <Lines values={inc.x_why} /> },
    {
      key: 'tickets', icon: 'summary', label: 'Tickets',
      value: openable.length
        ? <AppStack direction="row" gap={0.5} wrap>{openable.map((id) => <AppButton key={id} variant="link" onClick={() => onOpenTicket(id)}>{id}</AppButton>)}</AppStack>
        : <AppText tone="muted">{countLabel(inc.ticket_ids?.length || 0, 'ticket')}, ninguno en la cola actual</AppText>,
    },
  ]
  return (
    <AppStack gap={1.5}>
      <AppCard>
        <AppStack direction="row" gap={0.75} wrap>
          <AppChip label={inc.incident_id} variant="code" />
          <AppChip {...chipProps('severity', inc.severity)} />
          <AppChip label={countLabel(inc.alert_ids?.length || 0, 'alerta')} />
          <AppStack direction="row" grow justify="flex-end">
            <AppButton onClick={onClose}>Volver a la lista</AppButton>
          </AppStack>
        </AppStack>
      </AppCard>
      <AppCard><AppKeyValueTable rows={rows} label={`Ficha de ${inc.incident_id}`} /></AppCard>
      <AppCard title={`Cadena de ataque (${countLabel(inc.kill_chain?.length || 0, 'paso')})`}>
        <AppTable columns={CHAIN_COLUMNS} rows={inc.kill_chain || []} getRowKey={(k, i) => `${k.alert_id}-${i}`} />
      </AppCard>
    </AppStack>
  )
}

// Fila de tags en horizontal: los primeros MAX_ROW_TAGS y el resto en «+N»
function Tags({ values, tone, code = false }) {
  if (!values?.length) return <AppText tone="muted">—</AppText>
  const { visible, hidden } = splitVisible(values, MAX_ROW_TAGS)
  return (
    <AppStack direction="row" gap={0.5} wrap>
      {visible.map((v) => <AppChip key={v} label={v} tone={tone} variant={code ? 'code' : 'outline'} />)}
      {hidden > 0 ? <AppChip label={`+${hidden}`} title={values.slice(MAX_ROW_TAGS).join(', ')} /> : null}
    </AppStack>
  )
}

// Motivos en texto (son frases largas con hashes: como tags no cabrían)
function Lines({ values }) {
  if (!values?.length) return <AppText tone="muted">—</AppText>
  return <AppStack gap={0.25}>{values.map((v) => <AppText key={v} lines={1} title={v}>{v}</AppText>)}</AppStack>
}
