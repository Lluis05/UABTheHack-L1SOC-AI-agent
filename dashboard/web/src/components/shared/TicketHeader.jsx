import { AppAlert, AppButton, AppCard, AppChip, AppRing, AppStack, AppText } from '../base'
import { chipProps } from '../../utils/chips.js'
import { formatSeconds, toPercent } from '../../utils/format.js'

const DECIDED_FIELDS = [['verdict', 'Veredicto'], ['severity', 'Severidad'], ['actions', 'Acciones'], ['status', 'Estado']]

// Cabecera compacta del ticket: todo en filas horizontales de tags, sin texto explicativo.
export default function TicketHeader({ ticket: t, onExpand, onClose }) {
  const decided = t.x_decided_by || {}
  return (
    <AppCard>
      <AppStack gap={1.25}>
        {t.x_simulated ? <AppAlert tone="warning">Ticket simulado por el dashboard: no es un triaje real.</AppAlert> : null}
        <AppStack direction="row" gap={1.5} align="flex-start">
          <AppStack gap={0.75} grow>
            <AppStack direction="row" gap={0.75} wrap>
              <AppChip label={t.ticket_id} variant="code" />
              {t.x_incident_id ? <AppChip label={t.x_incident_id} variant="code" tone="sevHigh" /> : null}
              {t.x_llm_provider ? <AppChip label={t.x_llm_provider} variant="code" title="Modelo que analizó el ticket" /> : null}
              {t.triage_seconds != null ? <AppChip label={formatSeconds(t.triage_seconds)} title="Tiempo de triaje" /> : null}
            </AppStack>
            <AppText variant="title" as="h2">{t.title}</AppText>
          </AppStack>
          {t.confidence != null ? <AppRing value={toPercent(t.confidence)} label="Confianza" tone="llm" /> : null}
        </AppStack>
        <AppStack direction="row" gap={0.75} wrap>
          <AppChip {...chipProps('severity', t.severity)} />
          <AppChip {...chipProps('status', t.x_status)} />
          <AppChip {...chipProps('verdict', t.verdict)} />
          {DECIDED_FIELDS.filter(([key]) => decided[key]).map(([key, label]) => (
            <AppChip key={key} {...chipProps('decider', decided[key])} label={`${label}: ${chipProps('decider', decided[key]).label}`} />
          ))}
          <AppStack direction="row" gap={1} grow justify="flex-end">
            <AppButton variant="link" onClick={onExpand}>Ver todo</AppButton>
            <AppButton onClick={onClose} aria-label="Cerrar el detalle y volver a la cola completa">Volver a la cola</AppButton>
          </AppStack>
        </AppStack>
      </AppStack>
    </AppCard>
  )
}
