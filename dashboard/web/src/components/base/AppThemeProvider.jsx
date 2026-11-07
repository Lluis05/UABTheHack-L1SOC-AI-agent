import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { currentLook, LOOKS } from '../../themes/index.js'

// La variante estética (?look=actual|refinado) se decide una vez al cargar la página
const look = currentLook()

export default function AppThemeProvider({ children }) {
  return (
    <ThemeProvider theme={LOOKS[look]}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
