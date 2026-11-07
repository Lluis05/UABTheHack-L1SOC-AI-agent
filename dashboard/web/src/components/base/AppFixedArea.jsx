import Box from '@mui/material/Box'

// Zona de alto fijo (clave de theme.layout) con scroll propio: el bloque no cambia de tamaño
// al cambiar de pestaña ni al llegar más contenido.
export default function AppFixedArea({ height, label, children }) {
  return (
    <Box role={label ? 'region' : undefined} aria-label={label} tabIndex={label ? 0 : undefined}
         sx={(t) => ({ height: t.layout[height], overflowY: 'auto', overscrollBehavior: 'contain', minWidth: 0, pr: 0.5,
           // pt: deja sitio a la etiqueta flotante del primer campo, que si no quedaría recortada por el scroll
           pt: 1 })}>
      {children}
    </Box>
  )
}
