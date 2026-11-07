import Box from '@mui/material/Box'

// Contenedor de cada pantalla, con el margen del tema
export default function AppPage({ children }) {
  return <Box component="main" sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>{children}</Box>
}
