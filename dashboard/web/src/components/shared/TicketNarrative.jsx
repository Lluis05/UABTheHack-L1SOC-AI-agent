import { AppCard, AppChip, AppStack, AppText } from '../base'
import { chipProps } from '../../utils/chips.js'
import { affectedGroups } from '../../utils/tickets.js'

// Resumen para N2, entidades afectadas, severidad razonada, MITRE, escalado y preguntas abiertas.
export default function TicketNarrative({ ticket: t }) {
  return (
    <AppCard title="Resumen para N2">
      <AppStack gap={1.5}>
        <AppText>{t.summary}</AppText>
        {affectedGroups(t.affected).map(([label, values]) => (
          <AppStack key={label} direction="row" gap={0.5} wrap>
            <AppText variant="caption" tone="muted">{label}</AppText>
            {values.map((v) => <AppChip key={v} label={v} variant="code" />)}
          </AppStack>
        ))}
        <AppStack direction="row" gap={1} align="flex-start">
          <AppChip {...chipProps('decider', t.x_decided_by?.severity)} />
          <AppText><AppText as="span" variant="strong">Severidad: </AppText>{t.severity_rationale || 'sin justificación.'}</AppText>
        </AppStack>
        {t.mitre?.length > 0 ? (
          <AppStack direction="row" gap={0.5} wrap>
            <AppText variant="caption" tone="muted">MITRE ATT&CK</AppText>
            {t.mitre.map((m) => <AppChip key={m} label={m} variant="code" />)}
          </AppStack>
        ) : null}
        <AppText>
          <AppText as="span" variant="strong">Escalado: </AppText>
          {t.escalation?.escalate ? `a ${t.escalation.to}. ${t.escalation.reason}` : 'no se escala.'}
        </AppText>
        {t.open_questions?.length > 0 ? (
          <AppStack gap={0.25}>
            <AppText variant="strong">Preguntas abiertas</AppText>
            {t.open_questions.map((q) => <AppText key={q}>{q}</AppText>)}
          </AppStack>
        ) : null}
      </AppStack>
    </AppCard>
  )
}
