import { AppCard, AppChip, AppKeyValueTable, AppStack, AppText } from '../base'
import { chipProps } from '../../utils/chips.js'
import { toPercent } from '../../utils/format.js'
import { affectedGroups } from '../../utils/tickets.js'
import { CodeTags, Tags } from './TagList.jsx'

// Ancho de lectura cómodo para el texto del resumen
const READING_WIDTH = '78ch'

// Resumen para N2, con la misma forma que la ficha del ticket: el texto arriba y debajo una fila por dato
// (veredicto, severidad razonada, entidades afectadas, MITRE, escalado y preguntas abiertas).
// En el modal hay sitio: los tags se ven todos, sin «+N».
export default function TicketNarrative({ ticket: t }) {
  const decided = t.x_decided_by || {}
  const rows = [
    {
      key: 'verdict', icon: 'verdict', label: 'Veredicto',
      value: (
        <Tags>
          <AppChip {...chipProps('verdict', t.verdict)} />
          <DecidedBy decider={decided.verdict} />
          {t.confidence != null ? <AppText as="span" tone="muted">{toPercent(t.confidence)} % de confianza</AppText> : null}
        </Tags>
      ),
    },
    {
      key: 'severity', icon: 'severity', label: 'Severidad',
      value: (
        <AppStack gap={0.5}>
          <Tags>
            <AppChip {...chipProps('severity', t.severity)} />
            <DecidedBy decider={decided.severity} />
          </Tags>
          <AppText tone="muted">{t.severity_rationale || 'Sin justificación.'}</AppText>
        </AppStack>
      ),
    },
    ...affectedGroups(t.affected).map(([label, values, icon]) => ({ key: label, icon, label, value: <CodeTags values={values} /> })),
    { key: 'mitre', icon: 'mitre', label: 'MITRE', value: <CodeTags values={t.mitre} /> },
    {
      key: 'escalation', icon: 'escalation', label: 'Escalado',
      value: t.escalation?.escalate ? (
        <AppStack gap={0.5}>
          <Tags><AppChip label={t.escalation.to} tone="sevHigh" /></Tags>
          {t.escalation.reason ? <AppText tone="muted">{t.escalation.reason}</AppText> : null}
        </AppStack>
      ) : <AppText tone="muted">No se escala</AppText>,
    },
    {
      key: 'questions', icon: 'question', label: 'Preguntas',
      value: t.open_questions?.length ? (
        <AppStack gap={0.75}>{t.open_questions.map((q) => <AppText key={q}>{q}</AppText>)}</AppStack>
      ) : <AppText tone="muted">—</AppText>,
    },
  ]

  return (
    <AppStack gap={1.5}>
      <AppCard title="Resumen para N2">
        <AppText style={{ maxWidth: READING_WIDTH }}>{t.summary || '—'}</AppText>
      </AppCard>
      <AppCard>
        <AppKeyValueTable rows={rows} label={`Resumen de ${t.ticket_id}`} />
      </AppCard>
    </AppStack>
  )
}

// Quién decidió el campo (Política / IA / Persona), con su color
function DecidedBy({ decider }) {
  return decider ? <AppChip {...chipProps('decider', decider)} title="Quién lo decidió" /> : null
}
