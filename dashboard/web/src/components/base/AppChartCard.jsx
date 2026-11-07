import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

// Marco de una gráfica: título (qué se mide), subtítulo opcional (la lectura en una frase) y la gráfica.
// wide: ocupa dos columnas de la rejilla cuando hay sitio (series temporales).
export default function AppChartCard({ title, subtitle, wide = false, children }) {
  return (
    <Box component="section" aria-label={title}
         sx={{ gridColumn: wide ? { md: 'span 2' } : undefined, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5,
               p: 2, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
      <Box>
        <Typography variant="strong" component="h3">{title}</Typography>
        {subtitle ? <Typography variant="caption" color="text.secondary" display="block">{subtitle}</Typography> : null}
      </Box>
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minWidth: 0 }}>{children}</Box>
    </Box>
  )
}
