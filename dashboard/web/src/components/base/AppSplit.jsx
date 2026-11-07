import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { useEffect, useRef, useState } from 'react'
import { clampWidth, fitPanes } from '../../utils/panes.js'
import AppIcon from './AppIcon.jsx'
import { AsideModeContext, ASIDE_MODE } from './asideMode.js'
import useLayoutMode from './useLayoutMode.js'

const GUTTER = 16    // separador entre columnas (zona de arrastre)
const RAIL = 40      // ancho de una columna plegada
const SIDE = { LEFT: 'left', ASIDE: 'aside' }

// Columnas ajustables: lista a la izquierda, detalle en el centro (se queda el espacio sobrante) y, opcional, una
// tercera columna a la derecha (aside: el asistente). Los separadores se arrastran (o se mueven con ←/→ con el foco)
// y su botón pliega la columna lateral, que queda como un raíl estrecho con su nombre para volver a abrirla.
// Según el ancho (useLayoutMode):
//   < md (stacked): lista y detalle son pantallas separadas → aquí solo se pinta el detalle (right), que trae su
//     propio «← Volver»; al abrirlo la página sube arriba para que no aparezca fuera de la pantalla.
//   < lg (asideDrawer): el aside no es columna sino un cajón superpuesto (a la derecha; en móvil, hoja inferior).
// layout: {leftWidth, asideWidth, leftCollapsed, asideCollapsed} (usePaneLayout) · onLayoutChange(patch)
// limits: {leftMin, asideMin, centerMin, step} · leftLabel / asideLabel: nombre de cada columna (raíl y separador)
// onAsideClose: cerrar el aside cuando va en cajón (clic fuera o Esc)
export default function AppSplit({ left, right, aside, layout, onLayoutChange, limits, leftLabel, asideLabel, onAsideClose }) {
  const { stacked, asideDrawer, phone } = useLayoutMode()
  const container = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!container.current) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [stacked])

  // Móvil: el detalle sustituye a la lista; sin esto se abriría a la altura a la que estaba la lista
  useEffect(() => { if (stacked) window.scrollTo({ top: 0 }) }, [stacked])

  const drawer = aside && asideDrawer ? (
    <Drawer anchor={phone ? 'bottom' : 'right'} open onClose={onAsideClose}
            PaperProps={{
              'aria-label': asideLabel,
              sx: (t) => (phone
                ? { height: t.layout.asideSheetHeight, borderTopLeftRadius: 12, borderTopRightRadius: 12 }
                : { width: `min(${t.layout.asideDrawerWidth}px, 100vw)`, height: '100dvh' }),
            }}>
      <AsideModeContext.Provider value={ASIDE_MODE.DRAWER}>{aside}</AsideModeContext.Provider>
    </Drawer>
  ) : null

  if (stacked) {
    return (
      <>
        <Box minWidth={0}>{right}</Box>
        {drawer}
      </>
    )
  }

  const hasAside = Boolean(aside) && !asideDrawer
  const fit = fitPanes({ container: width, layout, hasAside, limits, gutter: GUTTER, rail: RAIL })
  const maxFor = (side) => (side === SIDE.LEFT
    ? width - GUTTER * (hasAside ? 2 : 1) - limits.centerMin - fit.aside
    : width - GUTTER * 2 - limits.centerMin - fit.left)
  const resize = (side, next) => {
    const [key, min] = side === SIDE.LEFT ? ['leftWidth', limits.leftMin] : ['asideWidth', limits.asideMin]
    onLayoutChange({ [key]: clampWidth(next, min, maxFor(side)) })
  }
  const toggle = (side) => (side === SIDE.LEFT
    ? onLayoutChange({ leftCollapsed: !layout.leftCollapsed })
    : onLayoutChange({ asideCollapsed: !layout.asideCollapsed }))

  return (
    <Box ref={container} sx={{ display: 'flex', alignItems: 'stretch', minWidth: 0 }}>
      <Pane width={fit.left} collapsed={layout.leftCollapsed} label={leftLabel} side={SIDE.LEFT} onExpand={() => toggle(SIDE.LEFT)}>
        {left}
      </Pane>
      <Gutter side={SIDE.LEFT} label={leftLabel} width={fit.left} collapsed={layout.leftCollapsed} step={limits.step}
              onResize={(w) => resize(SIDE.LEFT, w)} onToggle={() => toggle(SIDE.LEFT)} />
      {/* En pantallas muy anchas el detalle no se estira sin límite: las líneas siguen siendo legibles */}
      <Box sx={(t) => ({ flex: 1, minWidth: 0, maxWidth: t.layout.detailMaxWidth })}>{right}</Box>
      {drawer}
      {hasAside ? (
        <>
          <Gutter side={SIDE.ASIDE} label={asideLabel} width={fit.aside} collapsed={layout.asideCollapsed} step={limits.step}
                  onResize={(w) => resize(SIDE.ASIDE, w)} onToggle={() => toggle(SIDE.ASIDE)} />
          <Pane width={fit.aside} collapsed={layout.asideCollapsed} label={asideLabel} side={SIDE.ASIDE}
                onExpand={() => toggle(SIDE.ASIDE)}>
            {aside}
          </Pane>
        </>
      ) : null}
    </Box>
  )
}

function Pane({ width, collapsed, label, side, onExpand, children }) {
  if (collapsed) {
    return (
      <ButtonBase onClick={onExpand} aria-label={`Mostrar ${label}`} title={`Mostrar ${label}`}
                  sx={(t) => ({
                    width: RAIL, flexShrink: 0, alignSelf: 'flex-start', position: 'sticky', top: t.layout.sidePanelTop,
                    flexDirection: 'column', justifyContent: 'flex-start', gap: 1, py: 1.5,
                    border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper',
                    '&:hover': { borderColor: 'text.secondary' },
                    '&:focus-visible': { outline: 2, outlineStyle: 'solid', outlineColor: 'primary.main' },
                  })}>
        <AppIcon name={side === SIDE.LEFT ? 'chevronRight' : 'chevronLeft'} />
        <Typography variant="caption" fontWeight={600} color="text.secondary"
                    sx={{ writingMode: 'vertical-rl', transform: side === SIDE.LEFT ? 'rotate(180deg)' : undefined }}>
          {label}
        </Typography>
      </ButtonBase>
    )
  }
  return <Box sx={{ width, flexShrink: 0, minWidth: 0 }}>{children}</Box>
}

// Separador: arrastrable con el ratón (pointer capture) y con ←/→ desde el teclado; su botón pliega la columna.
function Gutter({ side, label, width, collapsed, step, onResize, onToggle }) {
  const drag = useRef(null)
  const sign = side === SIDE.LEFT ? 1 : -1

  function onPointerDown(e) {
    if (collapsed || e.button !== 0) return
    drag.current = { x: e.clientX, width }
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.style.userSelect = 'none'
  }
  function onPointerMove(e) {
    if (drag.current) onResize(drag.current.width + sign * (e.clientX - drag.current.x))
  }
  function onPointerUp() {
    drag.current = null
    document.body.style.userSelect = ''
  }
  function onKeyDown(e) {
    if (collapsed) return
    if (e.key === 'ArrowLeft') { e.preventDefault(); onResize(width - sign * step) }
    if (e.key === 'ArrowRight') { e.preventDefault(); onResize(width + sign * step) }
  }

  const collapseIcon = side === SIDE.LEFT ? 'chevronLeft' : 'chevronRight'
  return (
    <Box sx={{ width: GUTTER, flexShrink: 0, position: 'relative' }}>
      <Box role="separator" aria-orientation="vertical" aria-label={`Ancho de ${label}`} aria-valuenow={Math.round(width)}
           tabIndex={collapsed ? -1 : 0}
           onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
           onPointerCancel={onPointerUp} onKeyDown={onKeyDown}
           sx={{
             position: 'absolute', inset: 0, cursor: collapsed ? 'default' : 'col-resize', touchAction: 'none',
             // Línea fina centrada que se ilumina al pasar o con el foco
             '&::after': { content: '""', position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, ml: '-1px',
                           borderRadius: 1, bgcolor: 'transparent', transition: 'background-color 120ms' },
             '&:hover::after, &:focus-visible::after': { bgcolor: collapsed ? 'transparent' : 'primary.main' },
             '&:focus-visible': { outline: 'none' },
           }} />
      {collapsed ? null : (
        <IconButton size="small" onClick={onToggle} aria-label={`Plegar ${label}`} title={`Plegar ${label}`}
                    sx={(t) => ({
                      position: 'sticky', top: t.layout.sidePanelTop, left: 0, zIndex: 1,
                      width: 22, height: 22, ml: '-3px', mt: 1,
                      bgcolor: 'background.paper', border: 1, borderColor: 'divider',
                      '&:hover': { bgcolor: 'surface.main', borderColor: 'text.secondary' },
                    })}>
          <AppIcon name={collapseIcon} />
        </IconButton>
      )}
    </Box>
  )
}
