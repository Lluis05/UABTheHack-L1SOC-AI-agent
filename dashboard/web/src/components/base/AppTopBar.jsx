import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'

export default function AppTopBar({ children }) {
  return (
    <AppBar position="sticky" color="inherit" elevation={0}
            sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Toolbar sx={{ gap: 2, flexWrap: 'wrap', py: 1 }}>{children}</Toolbar>
    </AppBar>
  )
}
