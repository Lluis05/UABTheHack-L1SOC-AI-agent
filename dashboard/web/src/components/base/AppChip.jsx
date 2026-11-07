import Chip from '@mui/material/Chip'

// variant (explícita, sin booleanos):
//   outline: valor normal · solid: lo que debe saltar a la vista (severidad, paso hecho) · code: identificador/IOC
// tone: clave de la paleta del tema (sevHigh, policy, warning...).
const VARIANTS = {
  outline: { variant: 'outlined' },
  solid: { variant: 'filled' },
  code: { variant: 'outlined', translate: 'no', sx: (t) => ({ ...t.typography.mono, fontWeight: 500 }) },
}

// onDelete: muestra la × para quitarlo (filtros activos)
export default function AppChip({ label, tone = 'default', variant = 'outline', title, onDelete }) {
  return <Chip label={label} title={title} color={tone} onDelete={onDelete} {...VARIANTS[variant]} />
}
