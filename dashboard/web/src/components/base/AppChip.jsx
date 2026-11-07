import Chip from '@mui/material/Chip'

// variant (explícita, sin booleanos):
//   outline: valor normal · solid: lo que debe saltar a la vista (severidad, paso hecho) · code: identificador/IOC
// tone: clave de la paleta del tema (sevHigh, policy, warning...).
const VARIANTS = {
  outline: { variant: 'outlined' },
  solid: { variant: 'filled' },
  code: { variant: 'outlined', translate: 'no', sx: (t) => ({ ...t.typography.mono, fontWeight: 500 }) },
}

export default function AppChip({ label, tone = 'default', variant = 'outline', title }) {
  return <Chip label={label} title={title} color={tone} {...VARIANTS[variant]} />
}
