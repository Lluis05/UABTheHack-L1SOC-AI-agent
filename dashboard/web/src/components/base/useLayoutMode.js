import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

// Modo de disposición según el ancho de pantalla (breakpoints del tema). Única fuente para toda la app:
//   stacked: < md (móvil y tablet vertical) → navegación inferior y lista/detalle como pantallas separadas
//   asideDrawer: < lg → el asistente se abre como cajón superpuesto, no como tercera columna
//   phone: < sm → diálogos a pantalla completa y cajones como hoja inferior
// noSsr: el valor correcto desde el primer render (sin parpadeo de la disposición de escritorio)
export default function useLayoutMode() {
  const theme = useTheme()
  const options = { noSsr: true }
  return {
    stacked: useMediaQuery(theme.breakpoints.down('md'), options),
    asideDrawer: useMediaQuery(theme.breakpoints.down('lg'), options),
    phone: useMediaQuery(theme.breakpoints.down('sm'), options),
  }
}
