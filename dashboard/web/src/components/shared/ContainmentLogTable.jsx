import { AppTable, AppText } from '../base'
import { formatDateTime } from '../../utils/format.js'

const COLUMNS = [
  { key: 'timestamp', label: 'Cuándo', render: (r) => formatDateTime(r.timestamp) },
  { key: 'action', label: 'Acción', mono: true },
  { key: 'target', label: 'Objetivo', mono: true },
  { key: 'ticket_id', label: 'Ticket', mono: true },
  { key: 'approval_token', label: 'Token de aprobación', mono: true, render: (r) => r.approval_token || 'N1, sin aprobación' },
  { key: 'justification', label: 'Justificación' },
  { key: 'result', label: 'Resultado' },
]

// Registro de la API simulada: prueba de que cada acción llevó aprobación humana. Lo más reciente arriba.
export default function ContainmentLogTable({ log }) {
  if (!log.length) return <AppText tone="muted">Aún no se ha ejecutado ninguna acción. Se aprueban desde el detalle de cada ticket.</AppText>
  return <AppTable columns={COLUMNS} rows={log.toReversed()} />
}
