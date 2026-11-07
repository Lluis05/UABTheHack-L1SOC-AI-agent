import { useState } from 'react'
import { AppAlert, AppButton, AppCard, AppSelect, AppStack, AppTable, AppText, AppTextField } from '../base'
import { DECISION, VERDICT_ORDER } from '../../config/constants.js'
import { chipProps } from '../../utils/chips.js'
import { formatDateTime } from '../../utils/format.js'

const DECISION_BUTTONS = [[DECISION.CLOSE, 'Cerrar ticket'], [DECISION.ESCALATE, 'Escalar ticket'], [DECISION.REOPEN, 'Reabrir ticket']]
const verdictLabel = (v) => chipProps('verdict', v).label

function describe(d) {
  if (d.type === DECISION.CONTAINMENT) {
    return d.ok ? `${d.target}, token ${d.approval_token || 'no necesario (N1)'}` : `Rechazada: ${d.error}`
  }
  return [d.verdict && `veredicto cambiado a ${verdictLabel(d.verdict)}`, d.comment].filter(Boolean).join('. ')
}

const HISTORY_COLUMNS = [
  { key: 'timestamp', label: 'Cuándo', render: (d) => formatDateTime(d.timestamp) },
  { key: 'approver', label: 'Quién' },
  { key: 'type', label: 'Qué', mono: true, render: (d) => (d.type === DECISION.CONTAINMENT ? d.action : d.type) },
  { key: 'detail', label: 'Detalle', render: describe },
]

// Cierre, escalado o reapertura manual, con corrección opcional del veredicto. Queda como decided_by = human.
export default function DecisionPanel({ ticket, approver, busy, error, onDecide }) {
  const [comment, setComment] = useState('')
  const [verdict, setVerdict] = useState('')
  const history = ticket.x_human_decisions || []
  const verdictOptions = VERDICT_ORDER.map((v) => ({ value: v, label: verdictLabel(v) }))

  async function decide(type) {
    if (await onDecide(type, { comment, verdict })) { setComment(''); setVerdict('') }
  }

  return (
    <AppCard title="Decisión humana">
      <AppStack gap={1.25}>
        <AppSelect label="Veredicto" value={verdict} onChange={setVerdict} options={verdictOptions}
                   emptyLabel={`Mantener: ${verdictLabel(ticket.verdict)}`} />
        <AppTextField label="Comentario" name="comment" value={comment} onChange={setComment}
                      placeholder="Confirmado con el usuario por teléfono…" />
        <AppStack direction="row" gap={1} wrap>
          {DECISION_BUTTONS.map(([type, label]) => (
            <AppButton key={type} disabled={!approver || busy} onClick={() => decide(type)}>{label}</AppButton>
          ))}
        </AppStack>
        {!approver ? <AppText variant="caption" tone="muted">Para decidir, escribe tu nombre en «Quién aprueba».</AppText> : null}
        {error ? <AppAlert tone="error">{error}</AppAlert> : null}
        {history.length > 0 ? (
          <AppTable columns={HISTORY_COLUMNS} rows={history} rowError={(d) => d.ok === false} />
        ) : null}
      </AppStack>
    </AppCard>
  )
}
