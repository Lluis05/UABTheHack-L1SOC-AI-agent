import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Toolbar from '@mui/material/Toolbar'

// Cabecera fija en dos franjas: arriba título y perfil (children), debajo la navegación (tabs).
export default function AppTopBar({ tabs, children }) {
  return (
    <AppBar position="sticky" color="inherit" elevation={0}
            sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Toolbar sx={{ gap: 2, flexWrap: 'wrap' }}>{children}</Toolbar>
      {tabs ? <Box sx={{ px: { xs: 1, md: 1.5 } }}>{tabs}</Box> : null}
    </AppBar>
  )
}
