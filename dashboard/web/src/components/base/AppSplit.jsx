import Box from '@mui/material/Box'

// Lista a la izquierda y detalle a la derecha; en pantallas estrechas, uno debajo del otro.
export default function AppSplit({ left, right }) {
  return (
    <Box sx={(t) => ({
      display: 'grid', gap: 2, alignItems: 'start',
      gridTemplateColumns: { xs: '1fr', md: `minmax(320px, ${t.layout.queueWidth}px) 1fr` },
    })}>
      <Box minWidth={0}>{left}</Box>
      <Box minWidth={0}>{right}</Box>
    </Box>
  )
}
