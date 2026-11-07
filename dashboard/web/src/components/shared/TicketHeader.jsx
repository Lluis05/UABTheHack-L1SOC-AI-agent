import { AppAlert, AppCard, AppChip, AppProgressBar, AppStack, AppText } from '../base'
import { chipProps } from '../../utils/chips.js'
import { formatSeconds, toPercent } from '../../utils/format.js'

const DECIDED_FIELDS = [['verdict', 'Veredicto'], ['severity', 'Severidad'], ['actions', 'Acciones'], ['status', 'Estado']]

// Cabecera del ticket: qué pasa, cómo de grave, con qué confianza y QUIÉN decidió cada cosa.
export default function TicketHeader({ ticket: t }) {
  const decided = t.x_decided_by || {}
  const confidence = toPercent(t.confidence)
  return (
    <AppCard>
      <AppStack gap={1.5}>
        {t.x_simulated ? <AppAlert tone="warning">Ticket simulado por el dashboard: no es un triaje real.</AppAlert> : null}
        <AppStack direction="row" gap={0.75} wrap>
          <AppChip label={t.ticket_id} variant="code" />
          {t.x_incident_id ? <AppChip label={t.x_incident_id} variant="code" tone="sevHigh" /> : null}
          {t.x_llm_provider ? <AppChip label={`LLM: ${t.x_llm_provider}`} /> : null}
          {t.triage_seconds != null ? <AppChip label={`Triado en ${formatSeconds(t.triage_seconds)}`} /> : null}
        </AppStack>
        <AppText variant="title">{t.title}</AppText>
        <AppStack direction="row" gap={0.75} wrap>
          <AppChip {...chipProps('status', t.x_status)} />
          <AppChip {...chipProps('severity', t.severity)} />
          <AppChip {...chipProps('verdict', t.verdict)} />
          {t.confidence != null ? (
            <AppStack direction="row" gap={1}>
              <AppText variant="caption" tone="muted">Confianza {confidence}%</AppText>
              <AppProgressBar value={confidence} label={`Confianza ${confidence}%`} />
            </AppStack>
          ) : null}
        </AppStack>
        <AppStack direction="row" gap={2} wrap>
          {DECIDED_FIELDS.filter(([key]) => decided[key]).map(([key, label]) => (
            <AppStack key={key} direction="row" gap={0.75}>
              <AppText variant="caption" tone="muted">{label}</AppText>
              <AppChip {...chipProps('decider', decided[key])} variant="solid" />
            </AppStack>
          ))}
        </AppStack>
      </AppStack>
    </AppCard>
  )
}
