import Box from '@mui/material/Box'

// Lista a la izquierda y detalle a la derecha; en pantallas estrechas, uno debajo del otro.
// ratio (explícita): queue (ancho fijo del tema) | third (1/3 lista, 2/3 detalle)
const COLUMNS = {
  queue: (t) => `minmax(320px, ${t.layout.queueWidth}px) 1fr`,
  third: () => 'minmax(300px, 1fr) minmax(0, 2fr)',
}

export default function AppSplit({ left, right, ratio = 'queue' }) {
  return (
    <Box sx={(t) => ({ display: 'grid', gap: 2, alignItems: 'start', gridTemplateColumns: { xs: '1fr', md: COLUMNS[ratio](t) } })}>
      <Box minWidth={0}>{left}</Box>
      <Box minWidth={0}>{right}</Box>
    </Box>
  )
}
