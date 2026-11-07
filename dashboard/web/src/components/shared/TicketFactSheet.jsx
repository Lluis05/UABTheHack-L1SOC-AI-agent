import { AppButton, AppCard, AppChip, AppKeyValueTable, AppText } from '../base'
import { DETAIL_TAB, MAX_ROW_TAGS } from '../../config/constants.js'
import { chipProps } from '../../utils/chips.js'
import { countLabel } from '../../utils/format.js'
import { affectedValues } from '../../utils/tickets.js'
import { CodeTags as AllCodeTags, Tags } from './TagList.jsx'

// En la ficha, pocos tags por fila: el resto en «+N»
const CodeTags = (props) => <AllCodeTags max={MAX_ROW_TAGS} {...props} />

// Ficha del ticket en tabla: una fila por dato, tags en horizontal y «Ver» para abrir el detalle en el modal.
// Solo valores, sin explicar de dónde salen: quien la usa es analista y ya lo sabe.
export default function TicketFactSheet({ ticket: t, traceSteps, onOpen }) {
  const more = (tab) => <AppButton variant="link" onClick={() => onOpen(tab)}>Ver</AppButton>
  const hits = t.x_policy_hits || []
  const evidence = t.evidence || []
  const rows = [
    { key: 'summary', icon: 'summary', label: 'Resumen', value: <AppText lines={2}>{t.summary || '—'}</AppText>, action: more(DETAIL_TAB.SUMMARY) },
    { key: 'severity', icon: 'severity', label: 'Severidad', value: <Tags>{[<AppChip key="s" {...chipProps('severity', t.severity)} />]}</Tags> },
    { key: 'affected', icon: 'people', label: 'Afectados', value: <CodeTags values={affectedValues(t.affected)} /> },
    { key: 'mitre', icon: 'mitre', label: 'MITRE', value: <CodeTags values={t.mitre} /> },
    {
      key: 'rules', icon: 'rules', label: 'Reglas',
      value: <CodeTags values={hits.map((h) => h.rule)} tone="policy" />, action: hits.length ? more(DETAIL_TAB.EVIDENCE) : null,
    },
    {
      key: 'evidence', icon: 'evidence', label: 'Evidencias',
      value: <CodeTags values={[...new Set(evidence.map((e) => e.event_id))]} />, action: evidence.length ? more(DETAIL_TAB.EVIDENCE) : null,
    },
    {
      key: 'trace', icon: 'trace', label: 'Consultas',
      value: <AppText>{traceSteps ? countLabel(traceSteps, 'paso') : '—'}</AppText>, action: traceSteps ? more(DETAIL_TAB.TRACE) : null,
    },
    {
      key: 'escalation', icon: 'escalation', label: 'Escalado',
      value: t.escalation?.escalate
        ? <Tags>{[<AppChip key="e" label={t.escalation.to} tone="sevHigh" title={t.escalation.reason} />]}</Tags>
        : <AppText tone="muted">No</AppText>,
    },
  ]
  return (
    <AppCard>
      <AppKeyValueTable rows={rows} label={`Ficha de ${t.ticket_id}`} />
    </AppCard>
  )
}
