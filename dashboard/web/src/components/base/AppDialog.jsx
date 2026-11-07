import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import useLayoutMode from './useLayoutMode.js'

// size (explícita): sm (confirmaciones, filtros: alto según contenido) |
//                   lg (información extendida: alto fijo proporcional a la pantalla, no salta al cambiar de pestaña)
// header: franja fija bajo el título (p. ej. pestañas); solo children hace scroll.
// En móvil, a pantalla completa (un modal pequeño en un teléfono deja el texto en una columna estrecha).
export default function AppDialog({ open, title, onClose, actions, header, size = 'sm', children }) {
  const { phone } = useLayoutMode()
  const fixed = size === 'lg' && !phone
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={size} fullScreen={phone}
            PaperProps={{ sx: (t) => (fixed ? { height: t.layout.dialogLgHeight } : {}) }}>
      <DialogTitle variant="subtitle1" fontWeight={700}>{title}</DialogTitle>
      {header ? <Box sx={{ px: 3, flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}>{header}</Box> : null}
      {/* pt: MUI quita el padding superior tras el título y recortaría la etiqueta del primer campo */}
      <DialogContent dividers={fixed && !header} sx={{ '&&': { pt: 1.5 }, overscrollBehavior: 'contain' }}>{children}</DialogContent>
      {actions && <DialogActions sx={fixed ? { borderTop: 1, borderColor: 'divider' } : undefined}>{actions}</DialogActions>}
    </Dialog>
  )
}
