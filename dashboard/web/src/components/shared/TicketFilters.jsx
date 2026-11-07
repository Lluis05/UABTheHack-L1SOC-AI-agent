import { useState } from 'react'
import { AppButton, AppChip, AppDialog, AppGrid, AppIcon, AppIconButton, AppSelect, AppStack, AppText, AppTextField } from '../base'
import {
  CUSTOM_SORT_LABEL, DECIDER, PENDING_CLOSE, PENDING_CLOSE_LABEL, QUEUE_SEARCH_ID, QUEUE_SORTS, SEVERITY_ORDER, SORT_DIR,
  STATUS_ORDER, VERDICT_ORDER,
} from '../../config/constants.js'
import { chipProps, optionsFor } from '../../utils/chips.js'
import { countLabel } from '../../utils/format.js'
import { activeFilterCount, EMPTY_FILTERS } from '../../utils/tickets.js'

const ANY = 'Todos'
const FILTER_GRID_MIN = 200
const SEARCH_BASIS = '260px'
const SORT_WIDTH = 170
const FILTER_SELECTS = [
  { key: 'status', label: 'Estado', options: optionsFor('status', STATUS_ORDER), chip: 'status' },
  { key: 'severity', label: 'Severidad', options: optionsFor('severity', SEVERITY_ORDER), chip: 'severity' },
  { key: 'verdict', label: 'Veredicto', options: optionsFor('verdict', VERDICT_ORDER), chip: 'verdict' },
  { key: 'decider', label: 'Responsable', options: optionsFor('decider', [DECIDER.POLICY, DECIDER.LLM, DECIDER.HUMAN]), chip: 'decider' },
  { key: 'pendingClose', label: 'Acciones pendientes', options: [{ value: PENDING_CLOSE, label: PENDING_CLOSE_LABEL }] },
]

// Barra de la cola: búsqueda siempre visible (atajo «/»), orden, botón «Filtros» (modal), acceso directo a
// «Listas para cerrar», filtros activos quitables y recuento. pendingClose: cuántos tickets solo esperan a que el
// N1 ejecute sus acciones. fresh: tickets nuevos del último refresco (se anuncian, la vista no salta).
// sort {key, direction}: el selector muestra el atajo que coincide o «Por columna» si viene de una cabecera.
// onSortChange(key): elige un atajo (siempre de mayor a menor).
// onBack: con un ticket abierto, «Volver a la cola» al principio de la fila del recuento (bajo la búsqueda).
export default function TicketFilters({
  filters, onChange, sort, onSortChange, shown, total, pendingClose = 0, fresh = 0, onBack,
}) {
  const sortPreset = sort.direction === SORT_DIR.DESC && QUEUE_SORTS.some((s) => s.value === sort.key) ? sort.key : ''
  const [open, setOpen] = useState(false)
  const active = activeFilterCount(filters)
  // La búsqueda ya se ve en su campo: el número del botón solo cuenta los filtros del modal
  const inDialog = activeFilterCount({ ...filters, text: '' })
  const clear = (key) => () => onChange({ ...filters, [key]: '' })
  const tags = FILTER_SELECTS.filter((f) => f.chip && filters[f.key])
  return (
    <AppStack gap={1}>
      <AppStack direction="row" gap={1} wrap>
        <AppStack grow basis={SEARCH_BASIS}>
          <AppTextField id={QUEUE_SEARCH_ID} label="Buscar" name="queue-search" value={filters.text} icon="search" variant="code"
                        placeholder="TKT-…, ALR-…, host, usuario…  ( / )" type="search"
                        onChange={(text) => onChange({ ...filters, text })} />
        </AppStack>
        <AppSelect label="Orden" value={sortPreset} onChange={(key) => { if (key) onSortChange(key) }} options={QUEUE_SORTS}
                   emptyLabel={CUSTOM_SORT_LABEL} width={SORT_WIDTH} />
        <AppIconButton icon="filter" label="Filtros" badge={inDialog} onClick={() => setOpen(true)} />
        {pendingClose > 0 || filters.pendingClose ? (
          <AppButton variant={filters.pendingClose ? 'primary' : 'secondary'} aria-pressed={Boolean(filters.pendingClose)}
                     title="Tickets que se cierran en cuanto el N1 ejecute sus acciones pendientes"
                     onClick={() => onChange({ ...filters, pendingClose: filters.pendingClose ? '' : PENDING_CLOSE })}>
            {PENDING_CLOSE_LABEL} ({pendingClose})
          </AppButton>
        ) : null}
      </AppStack>
      <AppStack direction="row" gap={1} wrap>
        {onBack ? (
          <AppButton variant="link" onClick={onBack} startIcon={<AppIcon name="back" tone="inherit" />}
                     title="Cerrar el ticket y volver a la cola (Esc)">Volver a la cola</AppButton>
        ) : null}
        {/* «Listas para cerrar» no lleva tag: el botón de la barra ya se ve pulsado */}
        {tags.map((f) => (
          <AppChip key={f.key} label={`${f.label}: ${chipProps(f.chip, filters[f.key]).label}`} onDelete={clear(f.key)} />
        ))}
        {active > 0 ? <AppButton variant="link" onClick={() => onChange(EMPTY_FILTERS)}>Quitar filtros</AppButton> : null}
        <AppStack direction="row" grow justify="flex-end" gap={1}>
          <AppText variant="caption" tone="muted" role="status" aria-live="polite">
            {shown} de {countLabel(total, 'ticket')}
            {fresh > 0 ? <AppText as="span" variant="caption" tone="primary"> · {countLabel(fresh, 'nuevo')}</AppText> : null}
          </AppText>
        </AppStack>
      </AppStack>
      {/* key: el borrador se reinicia con los filtros vigentes cada vez que se abre */}
      {open ? <FiltersDialog key="filters" filters={filters} onApply={(f) => { onChange(f); setOpen(false) }}
                             onClose={() => setOpen(false)} /> : null}
    </AppStack>
  )
}

// Se edita un borrador y se aplica de una vez: la cola no salta mientras se eligen los filtros.
// La búsqueda por texto no está aquí: vive en la barra, siempre visible.
function FiltersDialog({ filters, onApply, onClose }) {
  const [draft, setDraft] = useState(filters)
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }))
  return (
    <AppDialog
      open
      onClose={onClose}
      title="Filtrar tickets"
      actions={(
        <>
          <AppButton onClick={() => setDraft({ ...EMPTY_FILTERS, text: draft.text })}>Limpiar</AppButton>
          <AppButton variant="primary" onClick={() => onApply(draft)}>Aplicar</AppButton>
        </>
      )}
    >
      <AppGrid minItemWidth={FILTER_GRID_MIN}>
        {FILTER_SELECTS.map((f) => (
          <AppSelect key={f.key} label={f.label} value={draft[f.key]} onChange={set(f.key)} options={f.options} emptyLabel={ANY} />
        ))}
      </AppGrid>
    </AppDialog>
  )
}
