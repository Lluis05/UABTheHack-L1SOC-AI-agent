import { AppCard, AppStack, AppText } from '../components/base'
import { IncidentCard } from '../components/shared'

export default function IncidentsPage({ incidents, onOpenTicket }) {
  if (!incidents) return <AppText tone="muted">Cargando incidentes…</AppText>
  if (incidents.length === 0) {
    return (
      <AppCard>
        <AppText tone="muted">Aún no hay incidentes. Aparecerán cuando la correlación escriba output/incidents.jsonl.</AppText>
      </AppCard>
    )
  }
  return (
    <AppStack gap={2}>
      {incidents.map((inc) => <IncidentCard key={inc.incident_id} incident={inc} onOpenTicket={onOpenTicket} />)}
    </AppStack>
  )
}
