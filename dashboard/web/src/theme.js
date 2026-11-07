import { createTheme } from '@mui/material/styles'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'

// Plan de diseño (skill frontend-design):
// - Tema: consola del SOC N1 de Tarvia. Trabajo principal: ver qué necesita a una persona y quién decidió qué.
// - Lo memorable: el sistema de tres colores Política / IA / Persona. Todo lo demás, sobrio.
// - Tipografía: IBM Plex Sans (interfaz) + IBM Plex Mono solo para identificadores e IOCs, que son código.
//   Empaquetadas con npm: la demo no depende de la red.
// - Sin mayúsculas en etiquetas, sin flechas decorativas, sin tarjetas idénticas para las métricas.
const PALETTE = {
  night: '#0f1219',   // fondo: turno de noche, pantalla encendida horas
  panel: '#161b26',
  raised: '#1d2433',
  line: '#283044',
  ink: '#e6e9ef',
  muted: '#8a93a6',
  signal: '#6c8cff',  // acción principal
  policy: '#b388ff',  // decide el código determinista
  llm: '#2ec4d6',     // decide la IA
  human: '#4cc38a',   // decide la persona
}

const tone = (main, contrastText = PALETTE.night) => ({ main, light: main, dark: main, contrastText })
const SANS = '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const MONO = '"IBM Plex Mono", ui-monospace, Consolas, monospace'
const TABULAR = { fontVariantNumeric: 'tabular-nums' }

// Breakpoint «md» de MUI: por debajo, navegación inferior y lista/detalle como pantallas separadas
const MD_MAX = '899.95px'
const HEADER_HEIGHT = 52
const BOTTOM_NAV_HEIGHT = 56
// Área táctil mínima con dedo (WCAG 2.5.5 / guías de iOS y Android)
const TOUCH_TARGET = 44
// iOS hace zoom al enfocar un campo con letra de menos de 16px
const TOUCH_INPUT_FONT = 16

// Opciones del tema «actual»: las variantes de themes/ parten de aquí y solo sobrescriben lo que cambian
export const themeOptions = {
  palette: {
    mode: 'dark',
    primary: { main: PALETTE.signal },
    background: { default: PALETTE.night, paper: PALETTE.panel, bar: PALETTE.panel },
    divider: PALETTE.line,
    text: { primary: PALETTE.ink, secondary: PALETTE.muted },
    success: { main: '#4cc38a' },
    warning: { main: '#e0a43a' },
    error: { main: '#f2646a' },
    info: { main: '#6ab0ff' },
    sevCritical: tone('#ff4d6d', '#fff'),
    sevHigh: tone('#ff8c42'),
    sevMedium: tone('#e3b341'),
    sevLow: tone('#6ab0ff'),
    sevInfo: tone(PALETTE.muted),
    policy: tone(PALETTE.policy),
    llm: tone(PALETTE.llm),
    human: tone(PALETTE.human),
    surface: { main: PALETTE.raised, selected: '#1f2a44' },
    // Gráficas del panel de métricas: los mismos tonos Política / IA / Persona un paso más oscuros, validados con
    // el validador de dataviz sobre la superficie oscura (banda de luminosidad, daltonismo y visión normal).
    // bar: barras de una sola serie (magnitud).
    chart: { policy: '#9a6cf0', llm: '#1a97a8', human: '#79a02f', bar: '#5f7fe8' },
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: SANS,
    fontSize: 13,
    h1: { fontSize: 20, fontWeight: 700, lineHeight: 1.3, textWrap: 'balance' },
    h2: { fontSize: 14, fontWeight: 600, lineHeight: 1.4, textWrap: 'balance' },
    body2: { lineHeight: 1.55 },
    strong: { fontSize: 13, fontWeight: 600, lineHeight: 1.45 },
    mono: { fontFamily: MONO, fontSize: 12.5, ...TABULAR },
    metric: { fontSize: 22, fontWeight: 700, lineHeight: 1.2, ...TABULAR },
    caption: { ...TABULAR },
  },
  // Alturas en dvh (la barra del navegador móvil no tapa nada) y relativas a --header-h, que AppTopBar mide en
  // vivo: si la cabecera cambia de alto, nada se descuadra.
  layout: {
    headerHeight: HEADER_HEIGHT, bottomNavHeight: BOTTOM_NAV_HEIGHT,
    logMaxHeight: 260,
    // La cola a pantalla completa (tabla): ocupa hasta el borde inferior
    queueTableMaxHeight: 'calc(100dvh - var(--header-h) - var(--bottom-nav-h) - 200px)',
    ticketCardMinWidth: 300, ticketCardHeight: 132,
    // Columna del detalle: en pantallas muy anchas no se estira más (líneas legibles)
    detailMaxWidth: 1400,
    // Modal de información extendida: alto fijo proporcional a la pantalla
    dialogLgHeight: '80dvh',
    // Asistente como cajón (por debajo de lg): ancho a la derecha; en móvil, hoja inferior
    asideDrawerWidth: 440, asideSheetHeight: '85dvh',
    // Upload: la zona de entrada y el progreso tienen alto fijo (no saltan al cambiar de modo ni al llegar alertas)
    uploadInputHeight: 230, uploadProgressHeight: '45dvh',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { colorScheme: 'dark' },
        ':root': { '--header-h': `${HEADER_HEIGHT}px`, '--bottom-nav-h': '0px' },
        [`@media (max-width: ${MD_MAX})`]: {
          ':root': { '--bottom-nav-h': `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))` },
        },
        // Con dedo: áreas táctiles de 44px y campos a 16px
        '@media (pointer: coarse)': {
          '.MuiButton-root, .MuiIconButton-root, .MuiTab-root, .MuiMenuItem-root': { minHeight: TOUCH_TARGET },
          '.MuiIconButton-root': { minWidth: TOUCH_TARGET },
          '.MuiChip-deletable, .MuiChip-clickable': { height: 32 },
          '.MuiInputBase-input': { fontSize: TOUCH_INPUT_FONT },
        },
        // web-design-guidelines: respetar prefers-reduced-motion
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': { animationDuration: '0.01ms !important', transitionDuration: '0.01ms !important' },
        },
      },
    },
    // Variantes propias: bloque por defecto; AppText as="span" las fuerza a línea
    MuiTypography: { defaultProps: { variantMapping: { mono: 'div', metric: 'div', strong: 'p' } } },
    MuiButton: { defaultProps: { disableElevation: true, size: 'small' }, styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
    // maxWidth: un hash o un dominio largo se corta con puntos suspensivos en vez de desbordar la página
    MuiChip: { defaultProps: { size: 'small' }, styleOverrides: { root: { fontWeight: 600, maxWidth: '100%' } } },
    MuiTextField: { defaultProps: { size: 'small', autoComplete: 'off' } },
    MuiCard: { defaultProps: { variant: 'outlined' } },
    MuiTableCell: { styleOverrides: { root: { verticalAlign: 'top', wordBreak: 'break-word', ...TABULAR } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', minHeight: 40, fontWeight: 600 } } },
    // Deshabilitado: legible pero claramente inactivo (botones, tabs, tarjetas)
    MuiButtonBase: { styleOverrides: { root: { '&.Mui-disabled': { opacity: 0.45 } } } },
  },
}

export const theme = createTheme(themeOptions)
