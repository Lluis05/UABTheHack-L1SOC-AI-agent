import { AppEmptyState, AppTable } from '../base'
import { formatDateTime } from '../../utils/format.js'

// Prioridad en pantallas estrechas: cuándo, qué, sobre qué y el resultado; el resto aparece cuando hay sitio
const COLUMNS = [
  { key: 'timestamp', label: 'Cuándo', mono: true, render: (r) => formatDateTime(r.timestamp) },
  { key: 'action', label: 'Acción', mono: true },
  { key: 'target', label: 'Objetivo', mono: true },
  { key: 'ticket_id', label: 'Ticket', mono: true, hideBelow: 'md' },
  { key: 'approval_token', label: 'Token de aprobación', mono: true, hideBelow: 'lg', render: (r) => r.approval_token || 'N1, sin aprobación' },
  { key: 'justification', label: 'Justificación', hideBelow: 'lg' },
  { key: 'result', label: 'Resultado' },
]

// Registro de la API simulada: prueba de que cada acción llevó aprobación humana. Lo más reciente arriba.
export default function ContainmentLogTable({ log }) {
  if (!log.length) {
    return <AppEmptyState icon="containment" title="Aún no se ha ejecutado ninguna acción" hint="Se aprueban desde el detalle de cada ticket." />
  }
  return <AppTable columns={COLUMNS} rows={log.toReversed()} label="Registro de contención" />
}
