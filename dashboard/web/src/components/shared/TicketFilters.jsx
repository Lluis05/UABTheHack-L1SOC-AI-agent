import { useState } from 'react'
import { AppButton, AppChip, AppDialog, AppGrid, AppIconButton, AppSelect, AppStack, AppText, AppTextField } from '../base'
import { DECIDER, SEVERITY_ORDER, STATUS_ORDER, VERDICT_ORDER } from '../../config/constants.js'
import { chipProps, optionsFor } from '../../utils/chips.js'
import { countLabel } from '../../utils/format.js'
import { activeFilterCount, EMPTY_FILTERS } from '../../utils/tickets.js'

const ANY = 'Todos'
const FILTER_GRID_MIN = 200
const FILTER_SELECTS = [
  { key: 'status', label: 'Estado', options: optionsFor('status', STATUS_ORDER), chip: 'status' },
  { key: 'severity', label: 'Severidad', options: optionsFor('severity', SEVERITY_ORDER), chip: 'severity' },
  { key: 'verdict', label: 'Veredicto', options: optionsFor('verdict', VERDICT_ORDER), chip: 'verdict' },
  { key: 'decider', label: 'Responsable', options: optionsFor('decider', [DECIDER.POLICY, DECIDER.LLM, DECIDER.HUMAN]), chip: 'decider' },
]

// Barra de la cola: botón «Filtros» (abre el modal), filtros activos quitables y recuento.
export default function TicketFilters({ filters, onChange, shown, total }) {
  const [open, setOpen] = useState(false)
  const active = activeFilterCount(filters)
  const clear = (key) => () => onChange({ ...filters, [key]: '' })
  return (
    <AppStack direction="row" gap={1} wrap>
      <AppIconButton icon="filter" label="Filtros" badge={active} onClick={() => setOpen(true)} />
      {filters.text.trim() ? <AppChip label={`id: ${filters.text.trim()}`} variant="code" onDelete={clear('text')} /> : null}
      {FILTER_SELECTS.filter((f) => filters[f.key]).map((f) => (
        <AppChip key={f.key} label={`${f.label}: ${chipProps(f.chip, filters[f.key]).label}`} onDelete={clear(f.key)} />
      ))}
      {active > 0 ? <AppButton variant="link" onClick={() => onChange(EMPTY_FILTERS)}>Quitar filtros</AppButton> : null}
      <AppStack direction="row" grow justify="flex-end">
        <AppText variant="caption" tone="muted" role="status">{shown} de {countLabel(total, 'ticket')}</AppText>
      </AppStack>
      {/* key: el borrador se reinicia con los filtros vigentes cada vez que se abre */}
      {open ? <FiltersDialog key="filters" filters={filters} onApply={(f) => { onChange(f); setOpen(false) }}
                             onClose={() => setOpen(false)} /> : null}
    </AppStack>
  )
}

// Se edita un borrador y se aplica de una vez: la cola no salta mientras se eligen los filtros.
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
          <AppButton onClick={() => setDraft(EMPTY_FILTERS)}>Limpiar</AppButton>
          <AppButton variant="primary" onClick={() => onApply(draft)}>Aplicar</AppButton>
        </>
      )}
    >
      <AppStack gap={2}>
        <AppTextField label="id" name="ticket-id" value={draft.text} onChange={set('text')} icon="search" autoFocus
                      placeholder="TKT-…, ALR-…, host, usuario…" variant="code"
                      onKeyDown={(e) => { if (e.key === 'Enter') onApply(draft) }} />
        <AppGrid minItemWidth={FILTER_GRID_MIN}>
          {FILTER_SELECTS.map((f) => (
            <AppSelect key={f.key} label={f.label} value={draft[f.key]} onChange={set(f.key)} options={f.options} emptyLabel={ANY} />
          ))}
        </AppGrid>
      </AppStack>
    </AppDialog>
  )
}
