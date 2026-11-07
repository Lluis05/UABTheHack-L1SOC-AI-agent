import { alpha, createTheme, lighten } from '@mui/material/styles'
import { deepmerge } from '@mui/utils'
import '@fontsource/ibm-plex-sans-condensed/500.css'
import '@fontsource/ibm-plex-sans-condensed/600.css'
import { themeOptions } from '../theme.js'

// Variante «Oscuro refinado» (rama feat/ui-variants). Misma distribución; cambia la piel:
// - Superficies en capas (filo claro en el borde superior de los paneles) para que la cabecera, las métricas y las
//   tarjetas se separen. Sin resplandores ni degradados en los botones: es una consola, no una landing.
// - Lo memorable: chips TONALES (fondo teñido con su color) en vez de contornos finos: severidad, estado y quién
//   decidió se leen de un vistazo. Todo lo demás, sobrio.
// - Plex Sans Condensed en títulos y cifras: los títulos largos de los tickets caben mejor y la cola gana carácter.
const R = {
  canvas: '#0d111a',
  panel: '#141a26',
  raised: '#1a2232',
  line: '#232c3d',
  lineStrong: '#2f3a50',
  ink: '#e8ecf3',
  muted: '#8b95a9',
  signal: '#7b93ff',  // acción principal
  policy: '#b69cff',  // decide el código determinista
  llm: '#3cc9da',     // decide la IA
  human: '#52c993',   // decide la persona
}

const tone = (main, contrastText = R.canvas) => ({ main, light: main, dark: main, contrastText })
const CONDENSED = '"IBM Plex Sans Condensed", "IBM Plex Sans", system-ui, sans-serif'
const TOP_EDGE = `inset 0 1px 0 ${alpha('#ffffff', 0.04)}`
const CHIP_TINT = 0.14
const CHIP_EDGE = 0.32
const CHIP_TEXT_LIFT = 0.25
const DECIDER_TINT = 0.24
const DECIDER_TONES = ['policy', 'llm', 'human']

const refined = {
  palette: {
    primary: { main: R.signal },
    background: { default: R.canvas, paper: R.panel, bar: alpha(R.panel, 0.82) },
    divider: R.line,
    text: { primary: R.ink, secondary: R.muted },
    success: { main: R.human },
    warning: { main: '#eaa94a' },
    error: { main: '#ff6470' },
    info: { main: '#68aefc' },
    sevCritical: tone('#ff5470', '#fff'),
    sevHigh: tone('#ff9152'),
    sevMedium: tone('#f0c04a'),
    sevLow: tone('#68aefc'),
    sevInfo: tone(R.muted),
    policy: tone(R.policy),
    llm: tone(R.llm),
    human: tone(R.human),
    surface: { main: R.raised, selected: '#1b2540' },
  },
  shape: { borderRadius: 8 },
  typography: {
    h1: { fontFamily: CONDENSED, fontSize: 22, fontWeight: 600, letterSpacing: '-0.005em' },
    h2: { fontFamily: CONDENSED, fontSize: 15, fontWeight: 600 },
    strong: { fontFamily: CONDENSED, fontSize: 14.5, fontWeight: 600, lineHeight: 1.35 },
    metric: { fontFamily: CONDENSED, fontSize: 24, fontWeight: 600, lineHeight: 1.1, letterSpacing: '-0.01em' },
    caption: { lineHeight: 1.45 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': { scrollbarWidth: 'thin', scrollbarColor: `${R.lineStrong} transparent` },
        '::selection': { backgroundColor: alpha(R.signal, 0.35) },
      },
    },
    MuiAppBar: { styleOverrides: { root: { backdropFilter: 'saturate(140%) blur(12px)' } } },
    MuiCard: {
      styleOverrides: {
        root: {
          borderColor: R.line,
          backgroundImage: `linear-gradient(180deg, ${alpha('#ffffff', 0.025)}, ${alpha('#ffffff', 0)} 96px)`,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        // Tonal: fondo teñido + borde suave + texto algo más claro que el color, para que contraste sobre el tinte
        root: ({ ownerState, theme }) => {
          const base = { fontWeight: 600, maxWidth: '100%', letterSpacing: '0.01em' }
          const c = theme.palette[ownerState.color]?.main
          // Sólido solo para la severidad; quién decidió (Política/IA/Persona) va tonal intenso: se ve sin gritar
          if (ownerState.variant !== 'outlined') {
            return DECIDER_TONES.includes(ownerState.color)
              ? { ...base, backgroundColor: alpha(c, DECIDER_TINT), color: lighten(c, CHIP_TEXT_LIFT), boxShadow: `inset 0 0 0 1px ${alpha(c, CHIP_EDGE)}` }
              : base
          }
          if (!c || ownerState.color === 'default') {
            return { ...base, backgroundColor: R.raised, borderColor: R.line, color: R.ink }
          }
          return { ...base, backgroundColor: alpha(c, CHIP_TINT), borderColor: alpha(c, CHIP_EDGE), color: lighten(c, CHIP_TEXT_LIFT) }
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
        outlined: { borderColor: R.lineStrong, '&:hover': { borderColor: R.muted, backgroundColor: alpha(R.ink, 0.04) } },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(R.canvas, 0.6),
          '& .MuiOutlinedInput-notchedOutline': { borderColor: R.line },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: R.lineStrong },
        },
      },
    },
    MuiTabs: { styleOverrides: { indicator: { height: 2, borderRadius: 2 } } },
    MuiTab: { styleOverrides: { root: { color: R.muted, '&.Mui-selected': { color: R.ink } } } },
    MuiDialog: {
      styleOverrides: {
        paper: { backgroundImage: 'none', backgroundColor: R.panel, border: `1px solid ${R.lineStrong}`, borderRadius: 12, boxShadow: `${TOP_EDGE}, 0 24px 64px ${alpha('#000', 0.55)}` },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: ({ ownerState }) => (ownerState.invisible ? {} : { backgroundColor: alpha('#05070c', 0.7), backdropFilter: 'blur(3px)' }),
      },
    },
    MuiPopover: { styleOverrides: { paper: { backgroundImage: 'none', backgroundColor: R.raised, border: `1px solid ${R.lineStrong}` } } },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: R.raised, color: R.ink, border: `1px solid ${R.lineStrong}`, fontSize: 12, fontWeight: 500 },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: R.line } } },
  },
}

export const refinadoTheme = createTheme(deepmerge(themeOptions, refined))
