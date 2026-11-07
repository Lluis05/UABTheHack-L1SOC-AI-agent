import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import AppIcon from './AppIcon.jsx'

const NOTCH_WIDTH = 72
const NOTCH_HEIGHT = 5

// Panel lateral con forma de móvil (marco redondeado, muesca arriba), fijo al hacer scroll y con el alto de la
// pantalla. Solo para el chat: es una conversación, y así se distingue de las fichas.
export default function AppPhonePanel({ title, icon, tone = 'primary', onClose, label, children }) {
  return (
    <Box component="aside" aria-label={label}
         sx={(t) => ({
           position: 'sticky', top: t.layout.phoneTop, height: t.layout.phoneHeight,
           display: 'flex', flexDirection: 'column', minWidth: 0,
           border: 6, borderColor: 'surface.main', borderRadius: 6, bgcolor: 'background.paper',
           boxShadow: `0 0 0 1px ${t.palette.divider}`, overflow: 'hidden',
         })}>
      <Box aria-hidden="true" sx={{ alignSelf: 'center', width: NOTCH_WIDTH, height: NOTCH_HEIGHT, mt: 1,
                                    borderRadius: 3, bgcolor: 'divider', flexShrink: 0 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: 1, borderColor: 'divider',
                 flexShrink: 0 }}>
        {icon ? <AppIcon name={icon} tone={tone} /> : null}
        <Typography variant="strong" component="h2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>{title}</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Cerrar el chat">
          <AppIcon name="close" />
        </IconButton>
      </Box>
      <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', p: 2 }}>{children}</Box>
    </Box>
  )
}
