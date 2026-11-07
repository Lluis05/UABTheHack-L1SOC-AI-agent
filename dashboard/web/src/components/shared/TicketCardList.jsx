import { AppCardGrid, AppChip, AppRing, AppSelectableCard, AppStack, AppText } from '../base'
import { CARD_SUMMARY_LINES, CHIP_KINDS } from '../../config/constants.js'
import { chipProps } from '../../utils/chips.js'
import { toPercent } from '../../utils/format.js'

// Cola de tickets en tarjetas. layout: grid (pantalla completa) | column (1/3 de ancho, junto al detalle).
export default function TicketCardList({ tickets, selectedId, onSelect, layout = 'grid' }) {
  if (tickets.length === 0) return <AppText tone="muted">Ningún ticket coincide. Quita algún filtro.</AppText>
  return (
    <AppCardGrid columns={layout === 'column' ? 'single' : 'auto'} label="Cola de tickets">
      {tickets.map((t) => (
        <TicketCard key={t.ticket_id} ticket={t} selected={t.ticket_id === selectedId} onSelect={onSelect} />
      ))}
    </AppCardGrid>
  )
}

function TicketCard({ ticket: t, selected, onSelect }) {
  const severityTone = CHIP_KINDS.severity[t.severity]?.[1]
  return (
    <AppSelectableCard selected={selected} tone={severityTone} label={`${t.ticket_id}: ${t.title}`}
                       onClick={() => onSelect(selected ? null : t.ticket_id)}>
      <AppStack gap={1}>
        <AppStack direction="row" gap={1.25} align="flex-start">
          <AppStack gap={0.75} grow>
            <AppText variant="strong" lines={2}>{t.title}</AppText>
            <AppStack direction="row" gap={0.5} wrap>
              <AppChip {...chipProps('severity', t.severity)} />
              <AppChip {...chipProps('status', t.x_status)} />
              {t.x_pending_close ? (
                <AppChip label="Falta ejecutar" tone="warning" title="Se cierra en cuanto el N1 ejecute sus acciones" />
              ) : null}
            </AppStack>
          </AppStack>
          {t.confidence != null ? <AppRing value={toPercent(t.confidence)} label="Confianza" tone="llm" /> : null}
        </AppStack>
        {t.summary ? <AppText variant="caption" tone="muted" lines={CARD_SUMMARY_LINES}>{t.summary}</AppText> : null}
        <AppStack direction="row" gap={0.75} wrap>
          <AppText variant="mono" tone="muted">{t.ticket_id}</AppText>
          {t.x_incident_id ? <AppText variant="mono" tone="warning">{t.x_incident_id}</AppText> : null}
          <AppStack direction="row" gap={0.5} grow justify="flex-end">
            <AppText variant="caption" tone="muted">Decide</AppText>
            <AppChip {...chipProps('decider', t.x_decided_by?.verdict)} variant="solid" />
          </AppStack>
        </AppStack>
      </AppStack>
    </AppSelectableCard>
  )
}
