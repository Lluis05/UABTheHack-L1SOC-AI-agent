import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

// Una cifra con su etiqueta, en línea (las métricas van en una sola franja, no en tarjetas idénticas).
// emphasis: normal | attention
export default function AppStat({ value, label, hint, emphasis = 'normal' }) {
  const attention = emphasis === 'attention'
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="metric" color={attention ? 'warning.main' : undefined}>{value}</Typography>
      <Typography variant="caption" color={attention ? 'warning.main' : 'text.secondary'} display="block">{label}</Typography>
      {hint ? <Typography variant="caption" color="text.secondary" display="block">{hint}</Typography> : null}
    </Box>
  )
}
