import Box from '@mui/material/Box'

// Lista a la izquierda y detalle a la derecha; en pantallas estrechas, uno debajo del otro.
// ratio (explícita): queue (ancho fijo del tema) | third (1/3 lista, 2/3 detalle)
// aside: tercera columna opcional (el chat). Ocupa 1/3; la lista se comprime y el detalle se queda con el resto.
const COLUMNS = {
  queue: (t) => `minmax(320px, ${t.layout.queueWidth}px) 1fr`,
  third: () => 'minmax(300px, 1fr) minmax(0, 2fr)',
}
const WITH_ASIDE = 'minmax(220px, 0.75fr) minmax(0, 1.25fr) minmax(320px, 1fr)'

export default function AppSplit({ left, right, aside, ratio = 'queue' }) {
  return (
    <Box sx={(t) => ({
      display: 'grid', gap: 2, alignItems: 'start',
      gridTemplateColumns: { xs: '1fr', md: aside ? WITH_ASIDE : COLUMNS[ratio](t) },
    })}>
      <Box minWidth={0}>{left}</Box>
      <Box minWidth={0}>{right}</Box>
      {aside ? <Box minWidth={0}>{aside}</Box> : null}
    </Box>
  )
}
