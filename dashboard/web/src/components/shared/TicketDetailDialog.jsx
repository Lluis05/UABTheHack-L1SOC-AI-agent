import { AppAlert, AppButton, AppDialog, AppStack, AppTabs, AppText } from '../base'
import { DETAIL_TAB, DETAIL_TABS } from '../../config/constants.js'
import DecisionHistory from './DecisionHistory.jsx'
import EvidencePanel from './EvidencePanel.jsx'
import TicketNarrative from './TicketNarrative.jsx'
import TraceTimeline from './TraceTimeline.jsx'

// Información extendida del ticket en un modal con pestañas, para que la ficha quepa sin scroll.
// tab: pestaña abierta (null = cerrado). Alto fijo: las pestañas quedan fijas y solo el contenido hace scroll.
export default function TicketDetailDialog({ ticket, tab, onTabChange, onClose, trace, traceError, traceLoading }) {
  return (
    <AppDialog open={Boolean(tab)} onClose={onClose} size="lg" title={`${ticket.ticket_id} · ${ticket.title}`}
               header={<AppTabs items={DETAIL_TABS} value={tab || DETAIL_TAB.SUMMARY} onChange={onTabChange} />}
               actions={<AppButton onClick={onClose}>Cerrar</AppButton>}>
      <AppStack gap={2}>
        {tab === DETAIL_TAB.SUMMARY ? <TicketNarrative ticket={ticket} /> : null}
        {tab === DETAIL_TAB.EVIDENCE ? (
          <EvidencePanel policyHits={ticket.x_policy_hits} evidence={ticket.evidence} enrichment={ticket.enrichment} />
        ) : null}
        {tab === DETAIL_TAB.TRACE ? (
          <>
            {traceError ? <AppAlert tone="error">No se ha podido cargar la traza: {traceError}</AppAlert> : null}
            {traceLoading ? <AppText tone="muted">Cargando traza…</AppText> : <TraceTimeline trace={trace} />}
          </>
        ) : null}
        {tab === DETAIL_TAB.HISTORY ? <DecisionHistory decisions={ticket.x_human_decisions} /> : null}
      </AppStack>
    </AppDialog>
  )
}
