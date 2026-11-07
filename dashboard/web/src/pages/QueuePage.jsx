import { useMemo, useState } from 'react'
import { AppSidePanel, AppSkeletonRows, AppSplit, AppStack, AppStickyBottom, useLayoutMode } from '../components/base'
import {
  ActionsPanel, ConfirmActionDialog, DecisionPanel, MetricsBar, TicketCardList, TicketChat, TicketDetailDialog,
  TicketFactSheet, TicketFilters, TicketHeader, TicketQueueTable,
} from '../components/shared'
import {
  COMPACT_QUEUE_BELOW_PX, DEFAULT_QUEUE_SORT, DETAIL_TAB, DETAIL_TITLE_ID, PANE_LAYOUT_KEY, PANE_LIMITS, QUEUE_SEARCH_ID,
  SORT_DIR,
} from '../config/constants.js'
import { useNewCount } from '../hooks/useNewCount.js'
import { usePaneLayout } from '../hooks/usePaneLayout.js'
import { useSelectionFocus } from '../hooks/useSelectionFocus.js'
import { useShortcuts } from '../hooks/useShortcuts.js'
import { useTicketActions } from '../hooks/useTicketActions.js'
import { useTicketChat } from '../hooks/useTicketChat.js'
import { useTicketTrace } from '../hooks/useTicketTrace.js'
import { EMPTY_FILTERS, nextSort, pendingCloseCount, queueTickets, stepId } from '../utils/tickets.js'

const SKELETON_ROWS = 10

// Sin ticket abierto: la cola a todo el ancho (tabla en escritorio, tarjetas en móvil). Con ticket: en escritorio,
// cola y ficha en columnas ajustables, y el asistente como tercera columna (o cajón en pantallas medianas);
// en móvil la ficha sustituye a la cola (es otra pantalla, con «← Cola»).
// Teclado: j/k recorre la cola, Esc vuelve, / busca (la ayuda «?» está en App).
export default function QueuePage({ tickets, loading, metrics, config, approver, selectedId, onSelect, onChanged }) {
  const { stacked } = useLayoutMode()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState(DEFAULT_QUEUE_SORT)
  const rows = useMemo(() => queueTickets(tickets, filters, sort), [tickets, filters, sort])
  const ids = useMemo(() => rows.map((t) => t.ticket_id), [rows])
  const allIds = useMemo(() => tickets.map((t) => t.ticket_id), [tickets])
  const fresh = useNewCount(allIds)
  const ticket = tickets.find((t) => t.ticket_id === selectedId)
  const clearFilters = () => setFilters(EMPTY_FILTERS)

  useSelectionFocus(ticket ? selectedId : null, DETAIL_TITLE_ID)
  useShortcuts({
    j: () => onSelect(stepId(ids, selectedId, 1)),
    k: () => onSelect(stepId(ids, selectedId, -1)),
    Escape: () => { if (selectedId) onSelect(null) },
    '/': () => document.getElementById(QUEUE_SEARCH_ID)?.focus(),
  })

  const queue = (layout) => (
    <TicketCardList tickets={rows} selectedId={selectedId} onSelect={onSelect} onClearFilters={clearFilters} layout={layout} />
  )
  let body
  if (loading) body = <AppSkeletonRows rows={SKELETON_ROWS} label="Cargando la cola" />
  else if (ticket) {
    // key: la conversación y el estado de la ficha son de un ticket; al cambiar de ticket empiezan de cero
    body = <TicketWorkspace key={ticket.ticket_id} ticket={ticket} queue={queue} config={config} approver={approver}
                            onChanged={onChanged} onClose={() => onSelect(null)} />
  } else if (stacked) body = queue('grid')
  else {
    body = <TicketQueueTable tickets={rows} selectedId={selectedId} onSelect={onSelect} onClearFilters={clearFilters}
                             sort={sort} onSortChange={(key) => setSort((s) => nextSort(s, key))} />
  }

  return (
    <AppStack gap={2}>
      {ticket ? null : <MetricsBar metrics={metrics} />}
      {/* En móvil, con un ticket abierto, la pantalla es solo la ficha. Cargando, no hay nada que contar ni filtrar */}
      {(ticket && stacked) || loading ? null : (
        <TicketFilters filters={filters} onChange={setFilters} sort={sort}
                       onSortChange={(key) => setSort({ key, direction: SORT_DIR.DESC })} shown={rows.length}
                       total={tickets.length} pendingClose={pendingCloseCount(tickets)} fresh={fresh} />
      )}
      {body}
    </AppStack>
  )
}

// Tres columnas ajustables y recordadas: cola | ficha | asistente. La cola y el asistente se pueden plegar.
// Por debajo de lg el asistente es un cajón (en móvil, hoja inferior) y plegarlo no tiene sentido: abre o cierra.
// El chat vive aquí (no en el panel): la conversación se mantiene al cerrar y reabrir el panel.
function TicketWorkspace({ ticket, queue, config, approver, onChanged, onClose }) {
  const { stacked, asideDrawer } = useLayoutMode()
  const chat = useTicketChat(ticket.ticket_id, config?.chat_max_turns)
  const [chatOpen, setChatOpen] = useState(false)
  const [layout, updateLayout] = usePaneLayout(PANE_LAYOUT_KEY.QUEUE)
  const asideVisible = chatOpen && (asideDrawer || !layout.asideCollapsed)

  // «Preguntar a la IA»: abre el asistente; si estaba plegado (columna), lo despliega; si ya se ve, lo cierra
  function toggleChat() {
    if (!chatOpen) {
      setChatOpen(true)
      updateLayout({ asideCollapsed: false })
    } else if (!asideVisible) updateLayout({ asideCollapsed: false })
    else setChatOpen(false)
  }
  useShortcuts({ i: toggleChat })

  return (
    <AppSplit
      layout={layout} onLayoutChange={updateLayout} limits={PANE_LIMITS} leftLabel="Cola de tickets" asideLabel="Asistente IA"
      onAsideClose={() => setChatOpen(false)}
      left={queue(layout.leftWidth < COMPACT_QUEUE_BELOW_PX ? 'compact' : 'column')}
      right={<TicketDetail ticket={ticket} config={config} approver={approver} onChanged={onChanged} onClose={onClose}
                           chatOpen={asideVisible} onToggleChat={toggleChat} stickyDecision={stacked} />}
      aside={chatOpen ? (
        <AppSidePanel title="Asistente IA" icon="chat" tone="llm" label={`Chat sobre ${ticket.ticket_id}`}
                      onClose={() => setChatOpen(false)} closeLabel="Cerrar el asistente">
          <TicketChat chat={chat} maxChars={config?.chat_max_question_chars} />
        </AppSidePanel>
      ) : null}
    />
  )
}

// stickyDecision: en móvil la decisión humana queda fija abajo, al alcance del pulgar
function TicketDetail({ ticket, config, approver, onChanged, onClose, chatOpen, onToggleChat, stickyDecision }) {
  const { trace, error: traceError, loading } = useTicketTrace(ticket.ticket_id)
  const actions = useTicketActions(ticket.ticket_id, approver, onChanged)
  const [request, setRequest] = useState(null)
  const [tab, setTab] = useState(null)
  useShortcuts({ v: () => setTab(DETAIL_TAB.SUMMARY) })

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
      <AppStickyBottom enabled={stickyDecision}>
        <DecisionPanel ticket={ticket} approver={approver} busy={actions.busy && !request} compact={stickyDecision}
                       error={request ? '' : actions.error} onDecide={actions.decide}
                       onShowHistory={() => setTab(DETAIL_TAB.HISTORY)} />
      </AppStickyBottom>
      <TicketDetailDialog ticket={ticket} tab={tab} onTabChange={setTab} onClose={() => setTab(null)}
                          trace={trace} traceError={traceError} traceLoading={loading} />
      <ConfirmActionDialog key={request ? `${request.action.action}-${request.action.target}` : 'closed'}
                           request={request} approver={approver} busy={actions.busy} error={actions.error}
                           onConfirm={confirm} onClose={closeDialog} />
    </AppStack>
  )
}
