import { useState } from 'react'
import { AppButton, AppCard, AppChip, AppIcon, AppKeyValueTable, AppStack, AppTable, AppTabs, AppText } from '../base'
import { INCIDENT_TAB, INCIDENT_TABS, MAX_ROW_TAGS } from '../../config/constants.js'
import { useIncidentReport } from '../../hooks/useIncidentReport.js'
import { chipProps } from '../../utils/chips.js'
import { countLabel, formatDateTime } from '../../utils/format.js'
import { incidentEntities, incidentTactics } from '../../utils/incidents.js'
import { splitVisible } from '../../utils/tickets.js'
import IncidentReport from './IncidentReport.jsx'

const CHAIN_COLUMNS = [
  { key: 'time', label: 'Cuándo', mono: true, render: (k) => formatDateTime(k.time) },
  { key: 'tactic', label: 'Táctica', nowrap: true, render: (k) => <AppChip label={k.tactic} /> },
  { key: 'what', label: 'Qué' },
  { key: 'rule_id', label: 'Regla', mono: true, hideBelow: 'lg' },
  { key: 'alert_id', label: 'Alerta', mono: true, hideBelow: 'md' },
]

// Detalle del incidente: cabecera y dos pestañas: la ficha con la cadena de ataque, y el informe de investigación
// (nivel 3) para N2. El padre lo monta con key=incident_id, así cada incidente empieza en la primera pestaña.
// knownTickets: IDs que existen en la cola (solo esos se pueden abrir).
export default function IncidentDetail({ incident: inc, knownTickets, onOpenTicket, onClose }) {
  const [tab, setTab] = useState(INCIDENT_TAB.DETAIL)
  const report = useIncidentReport(inc.incident_id)
  const openable = (inc.ticket_ids || []).filter((id) => knownTickets.has(id))
  const rows = [
    { key: 'period', icon: 'trace', label: 'Periodo', value: <AppText>{formatDateTime(inc.first_seen)} – {formatDateTime(inc.last_seen)}</AppText> },
    { key: 'tactics', icon: 'mitre', label: 'Tácticas', value: <Tags values={incidentTactics(inc)} /> },
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
          <AppButton onClick={onClose} startIcon={<AppIcon name="back" tone="inherit" />} title="Volver a la lista (Esc)"
                     aria-label="Cerrar el detalle y volver a la lista de incidentes">Lista</AppButton>
          <AppText variant="mono" tone="muted">{inc.incident_id}</AppText>
          <AppChip {...chipProps('severity', inc.severity)} />
          <AppChip label={countLabel(inc.alert_ids?.length || 0, 'alerta')} />
        </AppStack>
        <AppTabs items={INCIDENT_TABS} value={tab} onChange={setTab} />
      </AppCard>
      {tab === INCIDENT_TAB.DETAIL ? (
        <>
          <AppCard><AppKeyValueTable rows={rows} label={`Ficha de ${inc.incident_id}`} /></AppCard>
          <AppCard title={`Cadena de ataque (${countLabel(inc.kill_chain?.length || 0, 'paso')})`}>
            <AppTable columns={CHAIN_COLUMNS} rows={inc.kill_chain || []} getRowKey={(k, i) => `${k.alert_id}-${i}`} label="Cadena de ataque" />
          </AppCard>
        </>
      ) : (
        <IncidentReport incidentId={inc.incident_id} report={report.report} loading={report.loading} error={report.error}
                        generating={report.generating} onGenerate={report.generate} />
      )}
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
