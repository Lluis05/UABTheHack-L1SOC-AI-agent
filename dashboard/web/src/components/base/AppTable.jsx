import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'

// Tabla de datos que nunca rompe el ancho de la página: si no cabe, hace scroll horizontal propio con sombras en
// el borde que indican que hay más columnas; las secundarias se ocultan antes en pantallas estrechas.
//
// columns: [{key, label, mono?, align?: 'right', hideBelow?: 'sm'|'md'|'lg'|'xl', width?, nowrap?, render?(row)}]
// rowError(row): pinta la fila como error. rowTone(row): clave de la paleta para la franja izquierda (severidad).
// Filas clicables (cola): onRowClick(row) + isRowSelected(row) + rowLabel(row); rowId(row) va en data-item-id.
// maxHeight: clave de theme.layout → scroll vertical con la cabecera fija.
// Ordenar: columnas con sortable: true + sort {key, direction: 'asc'|'desc'} + onSortChange(key). La cabecera es un
// botón con flecha (tenue si la columna no ordena) y aria-sort; qué pasa al pulsar lo decide quien usa la tabla.
const ROW_STRIPE = 3
const ARIA_SORT = { asc: 'ascending', desc: 'descending' }
const INACTIVE_ARROW_OPACITY = 0.3

const hideBelow = (bp) => (bp ? { display: { xs: 'none', [bp]: 'table-cell' } } : {})

// Sombras de scroll solo con CSS: dos capas que tapan las sombras cuando el contenido está en el borde
// (background-attachment local) y dos sombras fijas al contenedor (scroll).
const scrollShadows = (t) => {
  const bg = t.palette.background.paper
  const shade = 'rgba(0,0,0,.45)'
  return {
    background: `linear-gradient(to right, ${bg} 30%, transparent), linear-gradient(to left, ${bg} 30%, transparent) right,
      radial-gradient(farthest-side at 0 50%, ${shade}, transparent), radial-gradient(farthest-side at 100% 50%, ${shade}, transparent) right`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: '40px 100%, 40px 100%, 12px 100%, 12px 100%',
    backgroundAttachment: 'local, local, scroll, scroll',
  }
}

export default function AppTable({
  columns, rows, getRowKey = (_, i) => i, rowError, rowTone, onRowClick, isRowSelected, rowLabel, rowId, maxHeight, label,
  sort, onSortChange,
}) {
  const clickable = Boolean(onRowClick)
  const sticky = Boolean(maxHeight)
  return (
    <TableContainer sx={(t) => ({
      ...scrollShadows(t), overflowX: 'auto', minWidth: 0,
      ...(sticky ? { maxHeight: t.layout[maxHeight], overflowY: 'auto', overscrollBehavior: 'contain' } : {}),
    })}>
      <Table size="small" stickyHeader={sticky} aria-label={label}>
        <TableHead>
          <TableRow>
            {columns.map((c) => {
              const sortable = Boolean(c.sortable && onSortChange)
              const active = sortable && sort?.key === c.key
              return (
                <TableCell key={c.key} align={c.align} aria-sort={active ? ARIA_SORT[sort.direction] : undefined}
                           sx={{ color: 'text.secondary', whiteSpace: 'nowrap', width: c.width, bgcolor: 'background.paper',
                                 ...hideBelow(c.hideBelow) }}>
                  {sortable ? (
                    <TableSortLabel active={active} direction={active ? sort.direction : 'desc'}
                                    onClick={() => onSortChange(c.key)} title={`Ordenar por ${c.label.toLowerCase()}`}
                                    sx={{
                                      // Alineada a la derecha, la flecha va delante para que la cifra no se mueva
                                      flexDirection: c.align === 'right' ? 'row-reverse' : 'row',
                                      '&:not(.Mui-active) .MuiTableSortLabel-icon': { opacity: INACTIVE_ARROW_OPACITY },
                                      '&.Mui-active': { color: 'text.primary' },
                                    }}>
                      {c.label}
                    </TableSortLabel>
                  ) : c.label}
                </TableCell>
              )
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => {
            const selected = Boolean(isRowSelected?.(row))
            const tone = rowTone?.(row)
            const open = () => onRowClick(row)
            return (
              <TableRow
                key={getRowKey(row, i)}
                hover={clickable}
                selected={selected}
                {...(clickable ? {
                  tabIndex: 0, 'aria-selected': selected, 'aria-label': rowLabel?.(row), 'data-item-id': rowId?.(row),
                  onClick: open,
                  onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } },
                } : {})}
                sx={(t) => (clickable ? {
                  cursor: 'pointer', '& > td': { verticalAlign: 'middle' },
                  '&.Mui-selected, &.Mui-selected:hover': { bgcolor: t.palette.surface.selected },
                  '&:focus-visible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: -2 },
                } : {})}
              >
                {columns.map((c, ci) => (
                  <TableCell
                    key={c.key}
                    align={c.align}
                    sx={(t) => ({
                      ...(c.mono ? t.typography.mono : {}),
                      ...(c.nowrap || c.mono ? { whiteSpace: 'nowrap', wordBreak: 'normal' } : {}),
                      color: rowError?.(row) ? 'error.main' : undefined,
                      ...(ci === 0 && tone ? { boxShadow: `inset ${ROW_STRIPE}px 0 0 ${t.palette[tone]?.main ?? t.palette.divider}` } : {}),
                      ...hideBelow(c.hideBelow),
                    })}
                  >
                    {c.render ? c.render(row) : row[c.key]}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
