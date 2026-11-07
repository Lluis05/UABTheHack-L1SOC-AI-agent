import Box from '@mui/material/Box'

const DOT_SIZE = 8

// Punto de estado discreto (p. ej. «API conectada»): el texto va en el tooltip y para lectores de pantalla.
// tone: clave de la paleta (success, error, warning...)
export default function AppStatusDot({ tone = 'success', label }) {
  return (
    <Box role="img" aria-label={label} title={label}
         sx={{ width: DOT_SIZE, height: DOT_SIZE, borderRadius: '50%', bgcolor: `${tone}.main`, flexShrink: 0,
               boxShadow: (t) => `0 0 0 3px ${t.palette.background.paper}` }} />
  )
}
