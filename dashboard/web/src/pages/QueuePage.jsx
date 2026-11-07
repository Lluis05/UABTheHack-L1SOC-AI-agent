import { useMemo, useState } from 'react'
import { AppAlert, AppCard, AppSplit, AppStack, AppText } from '../components/base'
import {
  ActionsPanel, ConfirmActionDialog, DecisionPanel, EvidencePanel, MetricsBar, TicketHeader, TicketNarrative,
  TicketQueue, TraceTimeline,
} from '../components/shared'
import { useTicketActions } from '../hooks/useTicketActions.js'
import { useTicketTrace } from '../hooks/useTicketTrace.js'
import { EMPTY_FILTERS, queueTickets } from '../utils/tickets.js'

export default function QueuePage({ tickets, metrics, config, approver, selectedId, onSelect, onChanged }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const rows = useMemo(() => queueTickets(tickets, filters), [tickets, filters])
  const ticket = tickets.find((t) => t.ticket_id === selectedId)

  return (
    <AppStack gap={2}>
      <MetricsBar metrics={metrics} />
      <AppSplit
        left={<TicketQueue tickets={rows} total={tickets.length} filters={filters} onFiltersChange={setFilters}
                           selectedId={selectedId} onSelect={onSelect} />}
        right={ticket
          ? <TicketDetail key={ticket.ticket_id} ticket={ticket} config={config} approver={approver} onChanged={onChanged} />
          : <AppCard><AppText tone="muted">Elige un ticket de la cola para ver qué ha consultado la IA y en qué se basa.</AppText></AppCard>}
      />
    </AppStack>
  )
}

function TicketDetail({ ticket, config, approver, onChanged }) {
  const { trace, error: traceError, loading } = useTicketTrace(ticket.ticket_id)
  const actions = useTicketActions(ticket.ticket_id, approver, onChanged)
  const [request, setRequest] = useState(null)

  const closeDialog = () => { setRequest(null); actions.clearError() }
  async function confirm(justification) {
    if (await actions.runContainment(request.action, justification)) setRequest(null)
  }

  return (
    <AppStack gap={2}>
      <TicketHeader ticket={ticket} />
      <TicketNarrative ticket={ticket} />
      <EvidencePanel policyHits={ticket.x_policy_hits} evidence={ticket.evidence} enrichment={ticket.enrichment} />
      <AppCard title={trace.length > 0 ? `Qué ha consultado (${trace.length} pasos)` : 'Qué ha consultado'}>
        {traceError ? <AppAlert tone="error">No se ha podido cargar la traza: {traceError}</AppAlert> : null}
        {loading ? <AppText tone="muted">Cargando traza…</AppText> : <TraceTimeline trace={trace} />}
      </AppCard>
      <ActionsPanel ticket={ticket} config={config} onRequest={(action, kind) => setRequest({ action, kind })} />
      <DecisionPanel ticket={ticket} approver={approver} busy={actions.busy && !request}
                     error={request ? '' : actions.error} onDecide={actions.decide} />
      <ConfirmActionDialog key={request ? `${request.action.action}-${request.action.target}` : 'closed'}
                           request={request} approver={approver} busy={actions.busy} error={actions.error}
                           onConfirm={confirm} onClose={closeDialog} />
    </AppStack>
  )
}
