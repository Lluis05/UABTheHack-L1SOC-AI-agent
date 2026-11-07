import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { chartColor } from './chartColor.js'

const BAR_HEIGHT = 14
const RADIUS = 4
const GAP = 2
const SWATCH = 10

const percent = (value, total) => (total ? Math.round((value / total) * 100) : 0)

// Un todo partido en partes (p. ej. quién decidió): una barra con huecos de 2px entre segmentos y, debajo, la
// leyenda con cifra y porcentaje (la identidad nunca va solo por color).
// segments: [{key, label, value, color}] con color = clave del tema
export default function AppSegmentedBar({ segments, label }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const visible = segments.filter((s) => s.value > 0)
  return (
    <Box role="figure" aria-label={label} sx={{ display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'flex', gap: `${GAP}px`, height: BAR_HEIGHT, borderRadius: `${RADIUS}px`, overflow: 'hidden',
                 bgcolor: total ? 'transparent' : 'surface.main' }}>
        {visible.map((s) => (
          <Tooltip key={s.key} arrow placement="top" disableInteractive
                   title={`${s.label}: ${s.value} (${percent(s.value, total)} %)`}>
            <Box sx={(t) => ({ flex: s.value, minWidth: 3, bgcolor: chartColor(t, s.color) })} />
          </Tooltip>
        ))}
      </Box>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', columnGap: 2.5, rowGap: 0.75 }}>
        {segments.map((s) => (
          <Box component="li" key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box aria-hidden="true" sx={(t) => ({ width: SWATCH, height: SWATCH, borderRadius: 0.5, bgcolor: chartColor(t, s.color) })} />
            <Typography variant="caption" color="text.secondary">{s.label}</Typography>
            <Typography variant="caption" fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {s.value} · {percent(s.value, total)} %
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
