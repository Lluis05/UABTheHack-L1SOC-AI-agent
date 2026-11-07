import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useContext } from 'react'
import AppCloseButton from './AppCloseButton.jsx'
import AppIcon from './AppIcon.jsx'
import { AsideModeContext, ASIDE_MODE } from './asideMode.js'

// Panel lateral (el asistente). Como columna: mismo marco que las fichas y todo el alto de su columna (AppSplit).
// Dentro del cajón (pantallas medianas y móvil, lo decide AppSplit): ocupa todo el cajón, sin marco.
// El cuerpo es una columna flexible: el contenido decide qué parte hace scroll (en el chat, solo la conversación).
export default function AppSidePanel({ title, icon, tone = 'primary', onClose, closeLabel = 'Cerrar', label, children }) {
  const inDrawer = useContext(AsideModeContext) === ASIDE_MODE.DRAWER
  return (
    <Box component="aside" aria-label={label}
         sx={() => ({
           display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', bgcolor: 'background.paper',
           ...(inDrawer
             ? { height: '100%' }
             : { height: '100%', border: 1, borderColor: 'divider', borderRadius: 1 }),
         })}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider',
                 flexShrink: 0 }}>
        {icon ? <AppIcon name={icon} tone={tone} /> : null}
        <Typography variant="strong" component="h2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>{title}</Typography>
        {onClose ? (
          <AppCloseButton label={closeLabel} onClick={onClose} />
        ) : null}
      </Box>
      <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', p: 2,
                 pb: inDrawer ? 'calc(16px + env(safe-area-inset-bottom))' : 2 }}>
        {children}
      </Box>
    </Box>
  )
}
