import { useState } from 'react'
import { AppAlert, AppButton, AppCard, AppSelect, AppStack, AppText, AppTextField } from '../base'
import { DECISION, VERDICT_ORDER } from '../../config/constants.js'
import { chipProps } from '../../utils/chips.js'
import { countLabel } from '../../utils/format.js'

const DECISION_BUTTONS = [[DECISION.CLOSE, 'Cerrar'], [DECISION.ESCALATE, 'Escalar'], [DECISION.REOPEN, 'Reabrir']]
const VERDICT_FIELD_WIDTH = 230
const verdictLabel = (v) => chipProps('verdict', v).label

// Decisión humana en una sola franja: veredicto, comentario y botones. El historial vive en el modal.
export default function DecisionPanel({ ticket, approver, busy, error, onDecide, onShowHistory }) {
  const [comment, setComment] = useState('')
  const [verdict, setVerdict] = useState('')
  const history = ticket.x_human_decisions || []
  const verdictOptions = VERDICT_ORDER.map((v) => ({ value: v, label: verdictLabel(v) }))

  async function decide(type) {
    if (await onDecide(type, { comment, verdict })) { setComment(''); setVerdict('') }
  }

  return (
    <AppCard title="Decisión humana"
             action={history.length ? <AppButton variant="link" onClick={onShowHistory}>Historial ({countLabel(history.length, 'decisión', 'decisiones')})</AppButton> : null}>
      <AppStack gap={1}>
        <AppStack direction="row" gap={1} wrap>
          <AppSelect label="Veredicto" value={verdict} onChange={setVerdict} options={verdictOptions}
                     emptyLabel={`Mantener: ${verdictLabel(ticket.verdict)}`} width={VERDICT_FIELD_WIDTH} />
          <AppStack direction="row" grow>
            <AppTextField label="Comentario" name="comment" value={comment} onChange={setComment}
                          placeholder="Confirmado con el usuario por teléfono…" />
          </AppStack>
          {DECISION_BUTTONS.map(([type, label]) => (
            <AppButton key={type} variant={type === DECISION.CLOSE ? 'primary' : 'secondary'}
                       disabled={!approver || busy} onClick={() => decide(type)}>{label}</AppButton>
          ))}
        </AppStack>
        {!approver ? <AppText variant="caption" tone="muted">Para decidir, identifícate en el avatar de arriba a la derecha.</AppText> : null}
        {error ? <AppAlert tone="error">{error}</AppAlert> : null}
      </AppStack>
    </AppCard>
  )
}
