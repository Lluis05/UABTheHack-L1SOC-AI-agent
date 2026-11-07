import Box from '@mui/material/Box'

// Rejilla de tarjetas del mismo ancho mínimo (métricas)
export default function AppGrid({ minItemWidth = 140, children }) {
  return (
    <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: `repeat(auto-fit, minmax(${minItemWidth}px, 1fr))` }}>
      {children}
    </Box>
  )
}
