import { useMemo, useState } from 'react'
import { AppPhonePanel, AppSplit, AppStack } from '../components/base'
import {
  ActionsPanel, ConfirmActionDialog, DecisionPanel, MetricsBar, TicketCardList, TicketChat, TicketDetailDialog,
  TicketFactSheet, TicketFilters, TicketHeader,
} from '../components/shared'
import { DETAIL_TAB } from '../config/constants.js'
import { useTicketActions } from '../hooks/useTicketActions.js'
import { useTicketChat } from '../hooks/useTicketChat.js'
import { useTicketTrace } from '../hooks/useTicketTrace.js'
import { EMPTY_FILTERS, pendingCloseCount, queueTickets } from '../utils/tickets.js'

// Sin ticket abierto: tarjetas a todo el ancho. Con ticket: la cola ocupa 1/3 y la ficha los 2/3 restantes.
// Con el chat abierto: cola comprimida, ficha y el chat en un panel con forma de móvil (1/3) a la derecha.
export default function QueuePage({ tickets, metrics, config, approver, selectedId, onSelect, onChanged }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const rows = useMemo(() => queueTickets(tickets, filters), [tickets, filters])
  const ticket = tickets.find((t) => t.ticket_id === selectedId)

  const queue = (layout) => <TicketCardList tickets={rows} selectedId={selectedId} onSelect={onSelect} layout={layout} />
  return (
    <AppStack gap={2}>
      {ticket ? null : <MetricsBar metrics={metrics} />}
      <TicketFilters filters={filters} onChange={setFilters} shown={rows.length} total={tickets.length}
                     pendingClose={pendingCloseCount(tickets)} />
      {ticket ? (
        // key: la conversación y el estado de la ficha son de un ticket; al cambiar de ticket empiezan de cero
        <TicketWorkspace key={ticket.ticket_id} ticket={ticket} queue={queue} config={config} approver={approver}
                         onChanged={onChanged} onClose={() => onSelect(null)} />
      ) : queue('grid')}
    </AppStack>
  )
}

// El chat vive aquí (no en el panel): la conversación se mantiene al cerrar y reabrir el panel.
function TicketWorkspace({ ticket, queue, config, approver, onChanged, onClose }) {
  const chat = useTicketChat(ticket.ticket_id, config?.chat_max_turns)
  const [chatOpen, setChatOpen] = useState(false)
  return (
    <AppSplit
      ratio="third"
      left={queue(chatOpen ? 'compact' : 'column')}
      right={<TicketDetail ticket={ticket} config={config} approver={approver} onChanged={onChanged} onClose={onClose}
                           chatOpen={chatOpen} onToggleChat={() => setChatOpen(!chatOpen)} />}
      aside={chatOpen ? (
        <AppPhonePanel title="Asistente IA" icon="chat" tone="llm" label={`Chat sobre ${ticket.ticket_id}`}
                       onClose={() => setChatOpen(false)}>
          <TicketChat chat={chat} maxChars={config?.chat_max_question_chars} />
        </AppPhonePanel>
      ) : null}
    />
  )
}

function TicketDetail({ ticket, config, approver, onChanged, onClose, chatOpen, onToggleChat }) {
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
      <TicketHeader ticket={ticket} onExpand={() => setTab(DETAIL_TAB.SUMMARY)} onAsk={onToggleChat} chatOpen={chatOpen}
                    onClose={onClose} />
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
