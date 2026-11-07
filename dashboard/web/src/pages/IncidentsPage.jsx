import { useMemo, useState } from 'react'
import { AppEmptyState, AppSkeletonRows, AppSplit, AppStack, AppText } from '../components/base'
import { IncidentCardList, IncidentDetail } from '../components/shared'
import { PANE_LAYOUT_KEY, PANE_LIMITS } from '../config/constants.js'
import { usePaneLayout } from '../hooks/usePaneLayout.js'
import { useSelectionFocus } from '../hooks/useSelectionFocus.js'
import { useShortcuts } from '../hooks/useShortcuts.js'
import { countLabel } from '../utils/format.js'

const SKELETON_ROWS = 6
const SKELETON_HEIGHT = 96

// Mismo patrón que Tickets: tarjetas a todo el ancho; al elegir una, lista y detalle en columnas ajustables
// (en móvil, el detalle es otra pantalla). Esc vuelve a la lista.
export default function IncidentsPage({ incidents, tickets, onOpenTicket }) {
  const [selectedId, setSelectedId] = useState(null)
  const [layout, updateLayout] = usePaneLayout(PANE_LAYOUT_KEY.INCIDENTS)
  const knownTickets = useMemo(() => new Set((tickets || []).map((t) => t.ticket_id)), [tickets])
  useSelectionFocus(selectedId, null)
  useShortcuts({ Escape: () => setSelectedId(null) })

  if (!incidents) return <AppSkeletonRows rows={SKELETON_ROWS} height={SKELETON_HEIGHT} label="Cargando incidentes" />
  if (incidents.length === 0) {
    return (
      <AppEmptyState icon="incidents" title="Aún no hay incidentes"
                     hint="Aparecerán cuando la correlación escriba output/incidents.jsonl." />
    )
  }
  const incident = incidents.find((i) => i.incident_id === selectedId)
  const list = (layout) => <IncidentCardList incidents={incidents} selectedId={selectedId} onSelect={setSelectedId} layout={layout} />
  return (
    <AppStack gap={2}>
      <AppText variant="caption" tone="muted" role="status">{countLabel(incidents.length, 'incidente')}</AppText>
      {incident ? (
        <AppSplit layout={layout} onLayoutChange={updateLayout} limits={PANE_LIMITS} leftLabel="Lista de incidentes"
                  left={list('column')}
                  right={<IncidentDetail incident={incident} knownTickets={knownTickets} onOpenTicket={onOpenTicket}
                                         onClose={() => setSelectedId(null)} />} />
      ) : list('grid')}
    </AppStack>
  )
}
