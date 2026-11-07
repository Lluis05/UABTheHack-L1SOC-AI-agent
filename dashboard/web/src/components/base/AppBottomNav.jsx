import Badge from '@mui/material/Badge'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Paper from '@mui/material/Paper'
import AppIcon from './AppIcon.jsx'

// Navegación inferior en móvil (al alcance del pulgar). items: [{value, label, icon, badge?}]
// Respeta la zona segura inferior (iPhone); su alto total es --bottom-nav-h (tema).
export default function AppBottomNav({ items, value, onChange, label }) {
  return (
    <Paper component="nav" aria-label={label} square elevation={0}
           sx={(t) => ({
             position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: t.zIndex.appBar,
             borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', pb: 'env(safe-area-inset-bottom)',
           })}>
      <BottomNavigation showLabels value={value} onChange={(_, v) => onChange(v)}
                        sx={(t) => ({ bgcolor: 'transparent', height: t.layout.bottomNavHeight })}>
        {items.map((it) => (
          <BottomNavigationAction key={it.value} value={it.value} label={it.label}
                                  sx={{ minWidth: 0, '&.Mui-selected': { color: 'primary.main' } }}
                                  icon={(
                                    <Badge color="warning" badgeContent={it.badge} max={99}>
                                      <AppIcon name={it.icon} size="medium" tone="inherit" />
                                    </Badge>
                                  )} />
        ))}
      </BottomNavigation>
    </Paper>
  )
}
