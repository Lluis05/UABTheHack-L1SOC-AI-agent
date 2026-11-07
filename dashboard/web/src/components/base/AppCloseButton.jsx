import IconButton from '@mui/material/IconButton'
import AppIcon from './AppIcon.jsx'

// Botón ✕ de cerrar (paneles, detalle). label: qué cierra, para lectores de pantalla y tooltip.
export default function AppCloseButton({ label = 'Cerrar', onClick }) {
  return (
    <IconButton size="small" onClick={onClick} aria-label={label} title={label}>
      <AppIcon name="close" />
    </IconButton>
  )
}
