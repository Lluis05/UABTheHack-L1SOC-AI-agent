import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

// size (explícita): medium (tarjetas, cabecera) | small (cola comprimida)
const RING_SIZES = { medium: 40, small: 30 }
const RING_THICKNESS = 4

// Indicador circular 0-100 con la cifra dentro (confianza). label: qué mide, para lectores de pantalla.
export default function AppRing({ value, label, tone = 'primary', size = 'medium' }) {
  const px = RING_SIZES[size]
  return (
    <Box role="img" aria-label={`${label}: ${value}%`} title={`${label}: ${value}%`}
         sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <CircularProgress variant="determinate" value={100} size={px} thickness={RING_THICKNESS}
                        sx={{ color: 'divider', position: 'absolute' }} />
      <CircularProgress variant="determinate" value={value} size={px} thickness={RING_THICKNESS} color={tone} />
      <Typography variant="caption" fontWeight={700} aria-hidden="true"
                  sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: size === 'small' ? 10 : 11 }}>
        {value}
      </Typography>
    </Box>
  )
}
