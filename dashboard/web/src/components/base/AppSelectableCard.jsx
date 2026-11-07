import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'

// Tarjeta clicable con estados visibles:
//   hover: borde gris claro · active: se hunde un poco · foco de teclado: anillo · seleccionada: borde y fondo de acento.
// tone: color de la franja izquierda (la severidad), para leer la cola de un vistazo.
// itemId: va en data-item-id (para devolver el foco y llevar la lista hasta la tarjeta seleccionada)
export default function AppSelectableCard({ selected = false, tone, onClick, label, itemId, children }) {
  return (
    <Card
      role="listitem"
      sx={(t) => ({
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? t.palette.surface.selected : 'background.paper',
        boxShadow: `inset 3px 0 0 ${t.palette[tone]?.main ?? t.palette.divider}`,
        transition: t.transitions.create(['border-color', 'background-color', 'transform'], { duration: t.transitions.duration.shortest }),
        '&:hover': { borderColor: selected ? 'primary.main' : 'text.secondary' },
        '&:active': { transform: 'scale(0.995)' },
        contentVisibility: 'auto',
        containIntrinsicSize: `auto ${t.layout.ticketCardHeight}px`,
      })}
    >
      <CardActionArea onClick={onClick} aria-pressed={selected} aria-label={label} data-item-id={itemId}
                      sx={{ p: 1.75, pl: 2, height: '100%' }}>
        {children}
      </CardActionArea>
    </Card>
  )
}
