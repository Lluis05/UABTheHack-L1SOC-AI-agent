import { useMemo, useState } from 'react'
import { AppSplit, AppStack } from '../components/base'
import {
  ActionsPanel, ConfirmActionDialog, DecisionPanel, MetricsBar, TicketCardList, TicketDetailDialog, TicketFactSheet,
  TicketFilters, TicketHeader,
} from '../components/shared'
import { DETAIL_TAB } from '../config/constants.js'
import { useTicketActions } from '../hooks/useTicketActions.js'
import { useTicketTrace } from '../hooks/useTicketTrace.js'
import { EMPTY_FILTERS, queueTickets } from '../utils/tickets.js'

// Sin ticket abierto: tarjetas a todo el ancho. Con ticket: la cola ocupa 1/3 y la ficha los 2/3 restantes.
export default function QueuePage({ tickets, metrics, config, approver, selectedId, onSelect, onChanged }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const rows = useMemo(() => queueTickets(tickets, filters), [tickets, filters])
  const ticket = tickets.find((t) => t.ticket_id === selectedId)

  const queue = (layout) => <TicketCardList tickets={rows} selectedId={selectedId} onSelect={onSelect} layout={layout} />
  return (
    <AppStack gap={2}>
      {ticket ? null : <MetricsBar metrics={metrics} />}
      <TicketFilters filters={filters} onChange={setFilters} shown={rows.length} total={tickets.length} />
      {ticket ? (
        <AppSplit ratio="third" left={queue('column')}
                  right={<TicketDetail key={ticket.ticket_id} ticket={ticket} config={config} approver={approver}
                                       onChanged={onChanged} onClose={() => onSelect(null)} />} />
      ) : queue('grid')}
    </AppStack>
  )
}

function TicketDetail({ ticket, config, approver, onChanged, onClose }) {
  const { trace, error: traceError, loading } = useTicketTrace(ticket.ticket_id)
  const actions = useTicketActions(ticket.ticket_id, approver, onChanged)
  const [request, setRequest] = useState(null)
  const [tab, setTab] = useState(null)

  const closeDialog = () => { setRequest(null); actions.clearError() }
  async function confirm(justification) {
    if (await actions.runContainment(request.action, justification)) setRequest(null)
  }

  return (
    <AppStack gap={1.5}>
      <TicketHeader ticket={ticket} onExpand={() => setTab(DETAIL_TAB.SUMMARY)} onClose={onClose} />
      <TicketFactSheet ticket={ticket} traceSteps={trace.length} onOpen={setTab} />
      <ActionsPanel ticket={ticket} config={config} onRequest={(action, kind) => setRequest({ action, kind })} />
      <DecisionPanel ticket={ticket} approver={approver} busy={actions.busy && !request}
                     error={request ? '' : actions.error} onDecide={actions.decide}
                     onShowHistory={() => setTab(DETAIL_TAB.HISTORY)} />
      <TicketDetailDialog ticket={ticket} tab={tab} onTabChange={setTab} onClose={() => setTab(null)}
                          trace={trace} traceError={traceError} traceLoading={loading} />
      <ConfirmActionDialog key={request ? `${request.action.action}-${request.action.target}` : 'closed'}
                           request={request} approver={approver} busy={actions.busy} error={actions.error}
                           onConfirm={confirm} onClose={closeDialog} />
    </AppStack>
  )
}
