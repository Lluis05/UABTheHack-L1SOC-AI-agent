import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import AppIcon from './AppIcon.jsx'

// Estado vacío o de error, siempre con la misma forma: icono, frase, explicación opcional y una acción.
// tone: muted (vacío) | error (algo no responde)
export default function AppEmptyState({ icon = 'queue', title, hint, action, tone = 'muted' }) {
  return (
    <Box role="status"
         sx={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 1, py: 5, px: 2,
               border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1 }}>
      <AppIcon name={icon} size="medium" tone={tone === 'error' ? 'error' : 'muted'} />
      <Typography variant="strong" component="p">{title}</Typography>
      {hint ? <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 480 }}>{hint}</Typography> : null}
      {action ? <Box sx={{ mt: 0.5 }}>{action}</Box> : null}
    </Box>
  )
}
