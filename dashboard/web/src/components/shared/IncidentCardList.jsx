import { AppCardGrid, AppChip, AppSelectableCard, AppStack, AppText } from '../base'
import { CARD_SUMMARY_LINES, CHIP_KINDS } from '../../config/constants.js'
import { chipProps } from '../../utils/chips.js'
import { countLabel, formatDateTime } from '../../utils/format.js'
import { incidentTactics } from '../../utils/incidents.js'

// Incidentes en tarjetas, con el mismo patrón que la cola de tickets. layout: grid | column
export default function IncidentCardList({ incidents, selectedId, onSelect, layout = 'grid' }) {
  return (
    <AppCardGrid columns={layout === 'column' ? 'single' : 'auto'} label="Incidentes">
      {incidents.map((inc) => (
        <IncidentCard key={inc.incident_id} incident={inc} selected={inc.incident_id === selectedId} onSelect={onSelect} />
      ))}
    </AppCardGrid>
  )
}

function IncidentCard({ incident: inc, selected, onSelect }) {
  const tactics = incidentTactics(inc)
  return (
    <AppSelectableCard selected={selected} tone={CHIP_KINDS.severity[inc.severity]?.[1]} label={inc.incident_id}
                       onClick={() => onSelect(selected ? null : inc.incident_id)}>
      <AppStack gap={1}>
        <AppStack direction="row" gap={0.75} wrap>
          <AppText variant="mono">{inc.incident_id}</AppText>
          <AppChip {...chipProps('severity', inc.severity)} />
          <AppChip label={countLabel(inc.alert_ids?.length || 0, 'alerta')} />
          {inc.x_chain ? <AppChip label={countLabel(tactics.length, 'fase')} tone="sevHigh" title={tactics.join(' → ')} /> : null}
        </AppStack>
        <AppText variant="caption" tone="muted" lines={CARD_SUMMARY_LINES}>{tactics.join(' → ')}</AppText>
        <AppText variant="caption" tone="muted">{formatDateTime(inc.first_seen)} – {formatDateTime(inc.last_seen)}</AppText>
      </AppStack>
    </AppSelectableCard>
  )
}
