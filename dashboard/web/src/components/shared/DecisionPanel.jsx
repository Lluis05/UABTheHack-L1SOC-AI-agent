import { useState } from 'react'
import { AppAlert, AppButton, AppCard, AppSelect, AppStack, AppText, AppTextField } from '../base'
import { DECISION, VERDICT_ORDER } from '../../config/constants.js'
import { chipProps } from '../../utils/chips.js'
import { countLabel } from '../../utils/format.js'

const DECISION_BUTTONS = [[DECISION.CLOSE, 'Cerrar'], [DECISION.ESCALATE, 'Escalar'], [DECISION.REOPEN, 'Reabrir']]
// Ancho base de cada campo: por debajo, el campo baja a la línea siguiente (móvil)
const VERDICT_BASIS = '200px'
const COMMENT_BASIS = '240px'
const verdictLabel = (v) => chipProps('verdict', v).label

// Decisión humana: veredicto, comentario y botones. El historial vive en el modal.
// compact (móvil, barra fija abajo): solo los botones; veredicto y comentario se despliegan bajo demanda para que
// la barra no tape la ficha.
export default function DecisionPanel({ ticket, approver, busy, error, onDecide, onShowHistory, compact = false }) {
  const [comment, setComment] = useState('')
  const [verdict, setVerdict] = useState('')
  const [expanded, setExpanded] = useState(false)
  const history = ticket.x_human_decisions || []
  const verdictOptions = VERDICT_ORDER.map((v) => ({ value: v, label: verdictLabel(v) }))
  const showFields = !compact || expanded

  async function decide(type) {
    if (await onDecide(type, { comment, verdict })) { setComment(''); setVerdict(''); setExpanded(false) }
  }

  const historyLink = history.length
    ? <AppButton variant="link" onClick={onShowHistory}>Historial ({countLabel(history.length, 'decisión', 'decisiones')})</AppButton>
    : null
  const buttons = (
    <AppStack direction="row" gap={1}>
      {DECISION_BUTTONS.map(([type, label]) => (
        <AppButton key={type} variant={type === DECISION.CLOSE ? 'primary' : 'secondary'}
                   disabled={!approver || busy} onClick={() => decide(type)}>{label}</AppButton>
      ))}
    </AppStack>
  )

  return (
    <AppCard title={compact ? null : 'Decisión humana'} action={compact ? null : historyLink}>
      <AppStack gap={1}>
        {showFields ? (
          <AppStack direction="row" gap={1} wrap>
            <AppStack grow basis={VERDICT_BASIS}>
              <AppSelect label="Veredicto" value={verdict} onChange={setVerdict} options={verdictOptions}
                         emptyLabel={`Mantener: ${verdictLabel(ticket.verdict)}`} />
            </AppStack>
            <AppStack grow basis={COMMENT_BASIS}>
              <AppTextField label="Comentario" name="comment" value={comment} onChange={setComment}
                            placeholder="Confirmado con el usuario por teléfono…" />
            </AppStack>
            {compact ? null : buttons}
          </AppStack>
        ) : null}
        {compact ? (
          <AppStack direction="row" gap={1} wrap>
            {buttons}
            <AppStack direction="row" grow justify="flex-end">
              <AppButton variant="link" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Ocultar' : 'Veredicto y comentario'}
              </AppButton>
            </AppStack>
          </AppStack>
        ) : null}
        {!approver ? <AppText variant="caption" tone="muted">Para decidir, identifícate en el avatar de arriba a la derecha.</AppText> : null}
        {error ? <AppAlert tone="error">{error}</AppAlert> : null}
      </AppStack>
    </AppCard>
  )
}
