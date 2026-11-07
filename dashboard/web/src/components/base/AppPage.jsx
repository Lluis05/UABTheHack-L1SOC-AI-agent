import Box from '@mui/material/Box'

// Contenedor de cada pantalla, con el margen del tema. Abajo deja sitio a la navegación inferior del móvil.
export default function AppPage({ children }) {
  return (
    <Box component="main" sx={{ px: { xs: 2, md: 2.5 }, pt: 2, pb: 'calc(16px + var(--bottom-nav-h))' }}>
      {children}
    </Box>
  )
}
