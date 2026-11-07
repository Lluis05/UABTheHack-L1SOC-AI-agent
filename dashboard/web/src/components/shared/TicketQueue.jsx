import { AppCard, AppChip, AppGrid, AppSelect, AppSelectableList, AppStack, AppText, AppTextField } from '../base'
import { DECIDER, SEVERITY_ORDER, STATUS_ORDER, VERDICT_ORDER } from '../../config/constants.js'
import { chipProps, optionsFor } from '../../utils/chips.js'
import { countLabel } from '../../utils/format.js'

const ANY = 'Todos'
const FILTER_SELECTS = [
  { key: 'status', label: 'Estado', options: optionsFor('status', STATUS_ORDER) },
  { key: 'severity', label: 'Severidad', options: optionsFor('severity', SEVERITY_ORDER) },
  { key: 'verdict', label: 'Veredicto', options: optionsFor('verdict', VERDICT_ORDER) },
  { key: 'decider', label: 'Decidido por', options: optionsFor('decider', [DECIDER.POLICY, DECIDER.LLM, DECIDER.HUMAN]) },
]

// Cola de tickets con filtros. Recibe la lista ya filtrada y ordenada (utils/tickets.queueTickets).
export default function TicketQueue({ tickets, total, filters, onFiltersChange, selectedId, onSelect }) {
  const set = (key) => (value) => onFiltersChange({ ...filters, [key]: value })
  return (
    <AppCard>
      <AppStack gap={1.25}>
        <AppTextField label="Buscar" name="search" value={filters.text} onChange={set('text')}
                      placeholder="TKT-…, ALR-…, WS-BCN-1174, m.garcia…" />
        <AppGrid>
          {FILTER_SELECTS.map((f) => (
            <AppSelect key={f.key} label={f.label} value={filters[f.key]} onChange={set(f.key)} options={f.options} emptyLabel={ANY} />
          ))}
        </AppGrid>
        <AppText variant="caption" tone="muted" role="status">{tickets.length} de {countLabel(total, 'ticket')}</AppText>
      </AppStack>
      <AppSelectableList
        label="Cola de tickets"
        items={tickets}
        getKey={(t) => t.ticket_id}
        selectedKey={selectedId}
        onSelect={onSelect}
        renderItem={(t) => <QueueItem ticket={t} />}
        empty={<AppText tone="muted">Ningún ticket coincide. Quita algún filtro.</AppText>}
      />
    </AppCard>
  )
}

function QueueItem({ ticket: t }) {
  return (
    <AppStack gap={0.5}>
      <AppStack direction="row" gap={1} align="flex-start">
        <AppChip {...chipProps('severity', t.severity)} />
        <AppText variant="strong">{t.title}</AppText>
      </AppStack>
      <AppStack direction="row" gap={1} wrap>
        <AppText variant="mono" tone="muted">{t.ticket_id}</AppText>
        <AppText variant="caption" tone="muted">{countLabel(t.alert_ids?.length || 0, 'alerta')}</AppText>
        {t.x_incident_id ? <AppText variant="mono" tone="warning">{t.x_incident_id}</AppText> : null}
      </AppStack>
      <AppStack direction="row" gap={0.5} wrap>
        <AppChip {...chipProps('status', t.x_status)} />
        <AppChip {...chipProps('verdict', t.verdict)} />
        <AppChip {...chipProps('decider', t.x_decided_by?.verdict)} />
      </AppStack>
    </AppStack>
  )
}
