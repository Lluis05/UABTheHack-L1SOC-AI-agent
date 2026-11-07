import { useState } from 'react'
import { AppAlert, AppButton, AppDialog, AppStack, AppText, AppTextField } from '../base'
import { ACTION_KIND, MIN_JUSTIFICATION_LEN } from '../../config/constants.js'
import { approversLabel } from '../../utils/tickets.js'

// Confirmación humana antes de tocar la API. También para block_ioc/purge_email: N1 las ejecuta, pero confirmando.
// La pantalla lo monta con key por acción, así el estado inicial sale de las props sin efectos.
export default function ConfirmActionDialog({ request, approver, busy, error, onConfirm, onClose }) {
  const [justification, setJustification] = useState(request?.action.justification || '')
  const needsApproval = request?.kind === ACTION_KIND.APPROVAL
  const verb = needsApproval ? 'Aprobar y ejecutar' : 'Ejecutar'
  const tooShort = justification.trim().length < MIN_JUSTIFICATION_LEN
  return (
    <AppDialog
      open={Boolean(request)}
      onClose={onClose}
      title={`${verb} ${request?.action.action ?? ''}`}
      actions={(
        <>
          <AppButton onClick={onClose}>Cancelar</AppButton>
          <AppButton variant="primary" disabled={!approver || tooShort || busy} onClick={() => onConfirm(justification)}>
            {busy ? 'Ejecutando…' : verb}
          </AppButton>
        </>
      )}
    >
      {request ? (
        <AppStack gap={1.5}>
          <AppText>
            Objetivo: <AppText as="span" variant="mono">{request.action.target}</AppText>
            {needsApproval ? `. Quedará registrado que lo aprueba ${approver || '(sin nombre)'}.` : '.'}
          </AppText>
          {request.action.x_approval ? (
            <AppText variant="caption" tone="muted">
              Política: {request.action.x_approval.note}{approversLabel(request.action) ? `. Aprueba: ${approversLabel(request.action)}.` : ''}
            </AppText>
          ) : null}
          {!approver ? <AppAlert tone="warning">Escribe tu nombre en «Quién aprueba», arriba a la derecha.</AppAlert> : null}
          <AppTextField label="Justificación (se guarda en la API)" name="justification" rows={2}
                        value={justification} onChange={setJustification}
                        helperText={tooShort ? `Mínimo ${MIN_JUSTIFICATION_LEN} caracteres.` : ' '} />
          {error ? <AppAlert tone="error">La API ha rechazado la acción: {error}. Revisa el objetivo o escala el ticket.</AppAlert> : null}
        </AppStack>
      ) : null}
    </AppDialog>
  )
}
