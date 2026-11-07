import Box from '@mui/material/Box'

// Bloque que se queda pegado abajo al hacer scroll (sobre la navegación inferior). enabled: solo en móvil,
// para que la decisión quede al alcance del pulgar; en escritorio se comporta como un bloque normal.
export default function AppStickyBottom({ enabled = false, children }) {
  if (!enabled) return children
  return (
    <Box sx={(t) => ({
      position: 'sticky', bottom: 'var(--bottom-nav-h)', zIndex: t.zIndex.appBar - 1,
      mx: -2, px: 2, pt: 1, pb: 1, bgcolor: 'background.default',
      borderTop: 1, borderColor: 'divider', boxShadow: `0 -8px 16px ${t.palette.background.default}`,
    })}>
      {children}
    </Box>
  )
}
