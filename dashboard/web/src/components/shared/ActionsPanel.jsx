import { AppButton, AppCard, AppChip, AppStack, AppTable, AppText } from '../base'
import { ACTION_KIND } from '../../config/constants.js'
import { chipProps } from '../../utils/chips.js'
import { formatDateTime } from '../../utils/format.js'
import { actionKind, findExecution } from '../../utils/tickets.js'

// Etiqueta del tipo de acción y texto del botón: el mismo verbo en el botón, el diálogo y el resultado.
const KIND = {
  [ACTION_KIND.APPROVAL]: { chip: { label: 'Requiere aprobación', tone: 'warning' }, button: 'Aprobar', buttonVariant: 'primary' },
  [ACTION_KIND.N1]: { chip: { label: 'La ejecuta N1' }, button: 'Ejecutar', buttonVariant: 'secondary' },
  [ACTION_KIND.DECISION]: { chip: { label: 'Decisión' } },
}
const EXECUTED_COLUMNS = [
  { key: 'action', label: 'Acción', mono: true },
  { key: 'target', label: 'Objetivo', mono: true },
  { key: 'approved_by', label: 'Aprobó' },
  { key: 'approval_token', label: 'Token', mono: true, render: (r) => r.approval_token || 'N1, sin aprobación' },
  { key: 'timestamp', label: 'Cuándo', render: (r) => formatDateTime(r.timestamp) },
]

// Acciones recomendadas. El LLM solo propone: ejecutar es siempre un clic humano (onRequest abre la confirmación).
export default function ActionsPanel({ ticket, config, onRequest }) {
  const actions = ticket.recommended_actions || []
  const executed = ticket.executed_actions || []
  return (
    <AppCard title="Acciones recomendadas" action={<AppChip {...chipProps('decider', ticket.x_decided_by?.actions)} />}>
      <AppStack gap={1}>
        {actions.length === 0 ? <AppText tone="muted">No se propone ninguna acción.</AppText> : null}
        {actions.map((a) => {
          const kind = actionKind(a.action, config)
          const done = findExecution(a, executed)
          return (
            <AppStack key={`${a.action}-${a.target}`} direction="row" gap={1} wrap>
              <AppChip label={a.action} variant="code" />
              <AppChip label={a.target} variant="code" />
              <AppChip {...KIND[kind].chip} />
              <AppText variant="caption" tone="muted">{a.justification}</AppText>
              <AppStack direction="row" grow justify="flex-end">
                {done ? <AppText variant="strong" tone="success">Ejecutada</AppText> : null}
                {!done && KIND[kind].button ? (
                  <AppButton variant={KIND[kind].buttonVariant} onClick={() => onRequest(a, kind)}>
                    {KIND[kind].button} {a.action}
                  </AppButton>
                ) : null}
                {!done && !KIND[kind].button ? (
                  <AppText variant="caption" tone="muted">Se decide en «Decisión humana»</AppText>
                ) : null}
              </AppStack>
            </AppStack>
          )
        })}
        {executed.length > 0 ? (
          <>
            <AppText variant="strong">Ejecutadas</AppText>
            <AppTable columns={EXECUTED_COLUMNS} rows={executed} />
          </>
        ) : null}
      </AppStack>
    </AppCard>
  )
}
