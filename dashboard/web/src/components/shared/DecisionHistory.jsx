import { AppTable, AppText } from '../base'
import { DECISION } from '../../config/constants.js'
import { chipProps } from '../../utils/chips.js'
import { formatDateTime } from '../../utils/format.js'

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

// Historial de decisiones humanas del ticket (cierres, escalados, contenciones), las fallidas en rojo.
export default function DecisionHistory({ decisions = [] }) {
  if (!decisions?.length) return <AppText tone="muted">Nadie ha decidido nada sobre este ticket todavía.</AppText>
  return <AppTable columns={HISTORY_COLUMNS} rows={decisions} rowError={(d) => d.ok === false} />
}
