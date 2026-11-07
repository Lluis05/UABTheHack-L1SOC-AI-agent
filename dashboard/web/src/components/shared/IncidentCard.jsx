import { AppButton, AppCard, AppChip, AppStack, AppText } from '../base'
import { chipProps } from '../../utils/chips.js'
import { countLabel, formatDateTime } from '../../utils/format.js'

// Incidente: alertas agrupadas, entidades implicadas y la cadena de ataque en el tiempo.
export default function IncidentCard({ incident: inc, onOpenTicket }) {
  const entities = Object.entries(inc.entities || {}).flatMap(([kind, values]) => (values || []).map((v) => [kind, v]))
  return (
    <AppCard title={`${inc.incident_id}: ${countLabel(inc.alert_ids?.length || 0, 'alerta')}`} action={<AppChip {...chipProps('severity', inc.severity)} />}>
      <AppStack gap={1.5}>
        <AppText>{inc.summary}</AppText>
        <AppText variant="caption" tone="muted">Del {formatDateTime(inc.first_seen)} al {formatDateTime(inc.last_seen)}</AppText>
        <AppStack direction="row" gap={0.5} wrap>
          {entities.map(([kind, v]) => <AppChip key={kind + v} label={`${kind}: ${v}`} variant="code" />)}
        </AppStack>
        <AppStack gap={0.75}>
          {(inc.kill_chain || []).map((k) => (
            <AppStack key={`${k.time}-${k.alert_id}`} direction="row" gap={1.5} wrap>
              <AppText variant="caption" tone="muted">{formatDateTime(k.time)}</AppText>
              <AppChip label={k.tactic} tone="sevHigh" />
              <AppText>{k.what}</AppText>
              <AppText variant="mono" tone="muted">{k.alert_id}</AppText>
            </AppStack>
          ))}
        </AppStack>
        <AppStack direction="row" gap={1} wrap>
          {(inc.ticket_ids || []).map((id) => (
            <AppButton key={id} variant="link" onClick={() => onOpenTicket(id)}>Abrir {id}</AppButton>
          ))}
        </AppStack>
      </AppStack>
    </AppCard>
  )
}
