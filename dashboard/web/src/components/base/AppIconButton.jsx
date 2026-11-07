import Badge from '@mui/material/Badge'
import Button from '@mui/material/Button'
import AppIcon from './AppIcon.jsx'

// Botón con icono y texto. badge: número superpuesto (p. ej. filtros activos); 0 lo oculta.
// Estados: hover resalta el borde en el color principal; disabled lo atenúa (tema).
export default function AppIconButton({ icon, label, badge = 0, onClick, ...rest }) {
  return (
    <Badge color="primary" badgeContent={badge}>
      <Button variant="outlined" color="inherit" onClick={onClick} startIcon={<AppIcon name={icon} />}
              sx={{ borderColor: 'divider', '&:hover': { borderColor: 'primary.main', bgcolor: 'surface.main' } }} {...rest}>
        {label}
      </Button>
    </Badge>
  )
}
