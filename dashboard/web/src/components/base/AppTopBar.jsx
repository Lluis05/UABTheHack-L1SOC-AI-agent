import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Toolbar from '@mui/material/Toolbar'
import { useLayoutEffect, useRef } from 'react'

// Cabecera fija en una sola franja: título, navegación (pestañas, solo en escritorio) y a la derecha el perfil
// (children). Publica su alto real en --header-h para que los paneles fijos se coloquen debajo sin números mágicos.
export default function AppTopBar({ title, nav, children }) {
  const bar = useRef(null)

  useLayoutEffect(() => {
    const root = document.documentElement
    const observer = new ResizeObserver(([entry]) => {
      root.style.setProperty('--header-h', `${Math.round(entry.borderBoxSize[0].blockSize)}px`)
    })
    observer.observe(bar.current)
    return () => observer.disconnect()
  }, [])

  return (
    <AppBar ref={bar} position="sticky" color="inherit" elevation={0}
            sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.bar' }}>
      <Toolbar disableGutters
               sx={(t) => ({ gap: { xs: 1.5, md: 3 }, px: { xs: 2, md: 2.5 }, minHeight: { xs: t.layout.headerHeight } })}>
        {title}
        {nav ? (
          // Las pestañas llegan hasta el borde inferior: su indicador se apoya en la línea de la cabecera
          <Box sx={{ alignSelf: 'stretch', display: 'flex', alignItems: 'flex-end', minWidth: 0 }}>{nav}</Box>
        ) : null}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, ml: 'auto', minWidth: 0 }}>{children}</Box>
      </Toolbar>
    </AppBar>
  )
}
