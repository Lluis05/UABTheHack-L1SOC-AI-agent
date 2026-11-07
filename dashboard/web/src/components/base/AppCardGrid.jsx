import Box from '@mui/material/Box'

// Rejilla de tarjetas. columns: auto (tantas como quepan) | single (una columna, la cola junto al detalle).
// En single la rejilla hace scroll propio para que la página no se alargue.
export default function AppCardGrid({ columns = 'auto', label, children }) {
  const single = columns === 'single'
  return (
    <Box role="list" aria-label={label}
         sx={(t) => ({
           display: 'grid', gap: 1.25, alignContent: 'start',
           // min(100%, …): en un móvil de 320px la tarjeta se ajusta al ancho en vez de desbordar
           gridTemplateColumns: single ? '1fr' : `repeat(auto-fill, minmax(min(100%, ${t.layout.ticketCardMinWidth}px), 1fr))`,
           ...(single ? { maxHeight: t.layout.queueMaxHeight, overflowY: 'auto', overscrollBehavior: 'contain', pr: 0.5 } : {}),
         })}>
      {children}
    </Box>
  )
}
