import { AppCardGrid, AppChip, AppSelectableCard, AppStack, AppText } from '../base'
import { CARD_SUMMARY_LINES, CHIP_KINDS } from '../../config/constants.js'
import { chipProps } from '../../utils/chips.js'
import { formatAlertTime, formatDateTime, toPercent } from '../../utils/format.js'
import { NoTickets } from './TicketQueueTable.jsx'

// Cola de tickets en tarjetas (móvil, y la columna junto al detalle). En escritorio a pantalla completa va en
// tabla (TicketQueueTable). layout (explícito):
//   grid (móvil: tantas columnas como quepan) | column (junto al detalle) | compact (columna estrecha: lo esencial)
export default function TicketCardList({ tickets, selectedId, onSelect, onClearFilters, layout = 'grid' }) {
  if (tickets.length === 0) return <NoTickets onClearFilters={onClearFilters} />
  const Card = layout === 'compact' ? CompactTicketCard : TicketCard
  return (
    <AppCardGrid columns={layout === 'grid' ? 'auto' : 'single'} label="Cola de tickets">
      {tickets.map((t) => (
        <Card key={t.ticket_id} ticket={t} selected={t.ticket_id === selectedId} onSelect={onSelect} />
      ))}
    </AppCardGrid>
  )
}

// ID y hora de la alerta: el ID es lo que se dice en voz alta («mira el TKT-…»), va arriba
function IdLine({ ticket: t }) {
  return (
    <AppStack direction="row" gap={1} justify="space-between">
      <AppText variant="mono" tone="muted" lines={1}>{t.ticket_id}</AppText>
      <AppText variant="mono" tone="muted" title={formatDateTime(t.x_alert_created_at)}>{formatAlertTime(t.x_alert_created_at)}</AppText>
    </AppStack>
  )
}

// Confianza en cifra (no en anillo): se lee más rápido y ocupa menos
function Confidence({ value }) {
  if (value == null) return null
  return <AppText variant="mono" tone="muted" title="Confianza de la IA">{toPercent(value)} %</AppText>
}

const cardProps = (t, selected, onSelect) => ({
  selected, itemId: t.ticket_id, tone: CHIP_KINDS.severity[t.severity]?.[1], label: `${t.ticket_id}: ${t.title}`,
  onClick: () => onSelect(t.ticket_id),
})

function CompactTicketCard({ ticket: t, selected, onSelect }) {
  return (
    <AppSelectableCard {...cardProps(t, selected, onSelect)}>
      <AppStack gap={0.5}>
        <AppText variant="strong" lines={1} title={t.title}>{t.title}</AppText>
        <AppStack direction="row" gap={1}>
          <AppChip {...chipProps('severity', t.severity)} />
          <AppStack direction="row" grow justify="flex-end" gap={1}>
            <Confidence value={t.confidence} />
            <AppText variant="mono" tone="muted">{formatAlertTime(t.x_alert_created_at)}</AppText>
          </AppStack>
        </AppStack>
      </AppStack>
    </AppSelectableCard>
  )
}

function TicketCard({ ticket: t, selected, onSelect }) {
  return (
    <AppSelectableCard {...cardProps(t, selected, onSelect)}>
      <AppStack gap={0.75}>
        <IdLine ticket={t} />
        <AppText variant="strong" lines={2}>{t.title}</AppText>
        {t.summary ? <AppText variant="caption" tone="muted" lines={CARD_SUMMARY_LINES}>{t.summary}</AppText> : null}
        <AppStack direction="row" gap={0.5} wrap>
          <AppChip {...chipProps('severity', t.severity)} />
          <AppChip {...chipProps('status', t.x_status)} />
          {t.x_pending_close ? (
            <AppChip label="Falta ejecutar" tone="warning" title="Se cierra en cuanto el N1 ejecute sus acciones" />
          ) : null}
          <AppStack direction="row" grow justify="flex-end" gap={1}>
            {t.x_incident_id ? <AppText variant="mono" tone="muted" title="Incidente correlacionado">{t.x_incident_id}</AppText> : null}
            <Confidence value={t.confidence} />
          </AppStack>
        </AppStack>
      </AppStack>
    </AppSelectableCard>
  )
}
