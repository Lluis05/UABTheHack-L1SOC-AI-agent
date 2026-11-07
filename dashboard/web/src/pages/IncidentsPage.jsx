import { useMemo, useState } from 'react'
import { AppCard, AppSplit, AppStack, AppText } from '../components/base'
import { IncidentCardList, IncidentDetail } from '../components/shared'
import { countLabel } from '../utils/format.js'

// Mismo patrón que Tickets: tarjetas a todo el ancho; al elegir una, lista en 1/3 y detalle en 2/3.
export default function IncidentsPage({ incidents, tickets, onOpenTicket }) {
  const [selectedId, setSelectedId] = useState(null)
  const knownTickets = useMemo(() => new Set((tickets || []).map((t) => t.ticket_id)), [tickets])

  if (!incidents) return <AppText tone="muted">Cargando incidentes…</AppText>
  if (incidents.length === 0) {
    return (
      <AppCard>
        <AppText tone="muted">Aún no hay incidentes. Aparecerán cuando la correlación escriba output/incidents.jsonl.</AppText>
      </AppCard>
    )
  }
  const incident = incidents.find((i) => i.incident_id === selectedId)
  const list = (layout) => <IncidentCardList incidents={incidents} selectedId={selectedId} onSelect={setSelectedId} layout={layout} />
  return (
    <AppStack gap={2}>
      <AppText variant="caption" tone="muted" role="status">{countLabel(incidents.length, 'incidente')}</AppText>
      {incident ? (
        <AppSplit ratio="third" left={list('column')}
                  right={<IncidentDetail incident={incident} knownTickets={knownTickets} onOpenTicket={onOpenTicket}
                                         onClose={() => setSelectedId(null)} />} />
      ) : list('grid')}
    </AppStack>
  )
}
