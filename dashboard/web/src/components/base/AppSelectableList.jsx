import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'

// Lista con un elemento seleccionado (la cola). renderItem pinta el contenido de cada fila.
// La cola puede tener cientos de tickets: content-visibility evita pintar las filas fuera de pantalla
// (web-design-guidelines y vercel-react-best-practices: listas largas).
export default function AppSelectableList({ items, getKey, selectedKey, onSelect, renderItem, empty, label }) {
  return (
    <List disablePadding aria-label={label} sx={(t) => ({ maxHeight: t.layout.queueMaxHeight, overflowY: 'auto', overscrollBehavior: 'contain' })}>
      {items.map((item) => {
        const key = getKey(item)
        return (
          <ListItemButton
            key={key}
            selected={key === selectedKey}
            onClick={() => onSelect(key)}
            divider
            sx={(t) => ({
              display: 'block',
              contentVisibility: 'auto',
              containIntrinsicSize: `auto ${t.layout.queueItemHeight}px`,
              '&.Mui-selected': { bgcolor: t.palette.surface.selected, boxShadow: `inset 3px 0 0 ${t.palette.primary.main}` },
            })}
          >
            {renderItem(item)}
          </ListItemButton>
        )
      })}
      {items.length === 0 ? empty : null}
    </List>
  )
}
