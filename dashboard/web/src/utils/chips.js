import { CHIP_HINTS, CHIP_KINDS, SOLID_CHIP_KINDS } from '../config/constants.js'

const UNKNOWN_LABEL = '—'

// Props de AppChip para un valor del contrato (severity, verdict, status, decider, policyEffect).
// Un valor desconocido se muestra tal cual en gris para no ocultar datos que el pipeline añada.
export function chipProps(kind, value) {
  const [label, tone, icon] = CHIP_KINDS[kind]?.[value] ?? [value || UNKNOWN_LABEL, 'default']
  return { label, tone, icon, variant: SOLID_CHIP_KINDS.includes(kind) ? 'solid' : 'outline', title: CHIP_HINTS[kind]?.[value] }
}

export function optionsFor(kind, order) {
  return order.map((value) => ({ value, label: chipProps(kind, value).label }))
}
