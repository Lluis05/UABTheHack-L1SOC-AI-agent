import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { chartColor } from './chartColor.js'

const DEFAULT_HEIGHT = 120
const COLUMN_MAX_WIDTH = 24
const COLUMN_RADIUS = 4
const COLUMN_GAP = 2
// Alto reservado arriba para la cifra del pico
const PEAK_LABEL_ROOM = 18
// Etiquetas del eje x como mucho; con más columnas se muestran una de cada N
const MAX_X_LABELS = 8

// Columnas verticales (histogramas y series por día). Una sola serie, sin leyenda; la cifra solo en el pico (el
// resto, al pasar el ratón por la columna: la zona de hover es toda la franja, no solo la barra).
// items: [{key, label, value, hint?}] · color: clave del tema · format(value): texto de la cifra
export default function AppColumnChart({ items, label, color = 'chart.bar', height = DEFAULT_HEIGHT, format = String }) {
  const max = Math.max(1, ...items.map((it) => it.value))
  const peak = items.reduce((best, it, i) => (it.value > items[best].value ? i : best), 0)
  const every = Math.ceil(items.length / MAX_X_LABELS)
  const showLabel = (i) => i % every === 0 || i === items.length - 1
  return (
    <Box role="figure" aria-label={label} sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'stretch', gap: `${COLUMN_GAP}px`, height, borderBottom: 1, borderColor: 'divider' }}>
        {items.map((it, i) => (
          <Tooltip key={it.key} arrow placement="top" disableInteractive title={`${it.hint ?? it.label}: ${format(it.value)}`}>
            <Box aria-label={`${it.hint ?? it.label}: ${format(it.value)}`}
                 sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                       alignItems: 'center', borderRadius: '4px 4px 0 0', '&:hover': { bgcolor: 'surface.main' } }}>
              {i === peak && it.value > 0 ? (
                <Typography variant="caption" fontWeight={600} sx={{ lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' }}>
                  {format(it.value)}
                </Typography>
              ) : null}
              <Box sx={(t) => ({
                width: '100%', maxWidth: COLUMN_MAX_WIDTH, minHeight: it.value ? 2 : 0,
                height: `calc((100% - ${PEAK_LABEL_ROOM}px) * ${it.value / max})`,
                bgcolor: chartColor(t, color), borderRadius: `${COLUMN_RADIUS}px ${COLUMN_RADIUS}px 0 0`,
              })} />
            </Box>
          </Tooltip>
        ))}
      </Box>
      <Box aria-hidden="true" sx={{ display: 'flex', gap: `${COLUMN_GAP}px`, mt: 0.5 }}>
        {items.map((it, i) => (
          <Typography key={it.key} variant="caption" color="text.secondary"
                      sx={{ flex: 1, minWidth: 0, textAlign: 'center', whiteSpace: 'nowrap', fontSize: 11,
                            visibility: showLabel(i) ? 'visible' : 'hidden' }}>
            {it.label}
          </Typography>
        ))}
      </Box>
    </Box>
  )
}
