import Chip from '@mui/material/Chip'
import AppIcon from './AppIcon.jsx'

// variant (explícita, sin booleanos):
//   outline: valor normal · solid: lo que debe saltar a la vista (severidad, paso hecho) · code: identificador/IOC
// tone: clave de la paleta del tema (sevHigh, policy, warning...).
const VARIANTS = {
  outline: { variant: 'outlined' },
  solid: { variant: 'filled' },
  code: { variant: 'outlined', translate: 'no', sx: (t) => ({ ...t.typography.mono, fontWeight: 500 }) },
}

// icon: nombre de AppIcon delante del texto (estado y veredicto: se distinguen por icono, no por color).
// onDelete: muestra la × para quitarlo (filtros activos)
export default function AppChip({ label, tone = 'default', variant = 'outline', title, icon, onDelete }) {
  const start = icon ? <AppIcon name={icon} tone="inherit" /> : undefined
  return <Chip label={label} title={title} color={tone} icon={start} onDelete={onDelete} {...VARIANTS[variant]} />
}
