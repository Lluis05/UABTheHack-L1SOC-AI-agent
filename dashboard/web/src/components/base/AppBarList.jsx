import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { chartColor } from './chartColor.js'

const BAR_HEIGHT = 10
const BAR_RADIUS = 4
// La barra más larga ocupa como mucho este % de la pista: el resto es para la cifra en la punta
const MAX_BAR_PCT = 82

// Barras horizontales (categorías o rankings): etiqueta a la izquierda, barra desde una línea base común y la cifra
// en la punta. Una sola serie: sin leyenda (el título dice qué se mide).
// items: [{key, label?, value, color?, hint?}] · color: clave del tema por defecto ('chart.bar', 'sevHigh'...)
// mono: etiquetas como identificadores (MITRE, reglas, acciones) · format(value): texto de la cifra
export default function AppBarList({ items, label, color = 'chart.bar', mono = false, format = String }) {
  const max = Math.max(1, ...items.map((it) => it.value))
  return (
    <Box component="ul" aria-label={label} sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}>
      {items.map((it) => {
        const text = it.label ?? it.key
        const pct = (it.value / max) * MAX_BAR_PCT
        return (
          <Tooltip key={it.key} arrow placement="top" disableInteractive
                   title={`${text}${it.hint ? ` · ${it.hint}` : ''}: ${format(it.value)}`}>
            <Box component="li" aria-label={`${text}: ${format(it.value)}`}
                 sx={{ display: 'grid', gridTemplateColumns: 'minmax(72px, 38%) 1fr', alignItems: 'center', gap: 1.25,
                       minHeight: 26, px: 0.5, mx: -0.5, borderRadius: 0.5, '&:hover': { bgcolor: 'surface.main' } }}>
              <Typography variant={mono ? 'mono' : 'caption'} color="text.secondary" noWrap
                          sx={mono ? { fontSize: 12 } : undefined}>{text}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, height: '100%',
                         borderLeft: 1, borderColor: 'divider' }}>
                <Box sx={(t) => ({
                  width: `${pct}%`, minWidth: it.value ? 2 : 0, height: BAR_HEIGHT, flexShrink: 0,
                  bgcolor: chartColor(t, it.color ?? color), borderRadius: `0 ${BAR_RADIUS}px ${BAR_RADIUS}px 0`,
                })} />
                <Typography variant="caption" fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}
                            color={it.value ? 'text.primary' : 'text.secondary'}>{format(it.value)}</Typography>
              </Box>
            </Box>
          </Tooltip>
        )
      })}
    </Box>
  )
}
