import { AppAlert, AppPage, AppStack } from './components/base'
import { TopBar } from './components/shared'
import { PAGE, PAGES } from './config/constants.js'
import { useApprover } from './hooks/useApprover.js'
import { useConfig } from './hooks/useConfig.js'
import { useDashboardData } from './hooks/useDashboardData.js'
import { useUrlState } from './hooks/useUrlState.js'
import ContainmentPage from './pages/ContainmentPage.jsx'
import IncidentsPage from './pages/IncidentsPage.jsx'
import LiveTriagePage from './pages/LiveTriagePage.jsx'
import QueuePage from './pages/QueuePage.jsx'

// Constante de módulo: misma referencia en cada render, así useUrlState no re-suscribe el listener.
const PAGE_VALUES = PAGES.map((p) => p.value)

export default function App() {
  const [nav, setNav] = useUrlState(PAGE_VALUES, PAGE.QUEUE)
  const [approver, approverInput, setApprover] = useApprover()
  const config = useConfig()
  const data = useDashboardData()

  const openTicket = (ticket) => setNav({ page: PAGE.QUEUE, ticket })
  const awaiting = data.metrics?.awaiting_approval
  const pages = PAGES.map((p) => (p.value === PAGE.QUEUE && awaiting > 0 ? { ...p, badge: awaiting } : p))

  return (
    <>
      <TopBar pages={pages} page={nav.page} onPageChange={(page) => setNav({ page })} health={data.health}
              source={data.source} approver={approverInput} onApproverChange={setApprover} />
      <AppPage>
        <AppStack gap={2}>
          {data.error ? <AppAlert tone="error">{data.error}</AppAlert> : null}
          {nav.page === PAGE.QUEUE ? (
            <QueuePage tickets={data.tickets} metrics={data.metrics} config={config} approver={approver}
                       selectedId={nav.ticket} onSelect={(ticket) => setNav({ ticket })} onChanged={data.refresh} />
          ) : null}
          {nav.page === PAGE.LIVE ? (
            <LiveTriagePage health={data.health} config={config} onOpenTicket={openTicket} onTicketsChanged={data.refresh} />
          ) : null}
          {nav.page === PAGE.INCIDENTS ? <IncidentsPage incidents={data.incidents} onOpenTicket={openTicket} /> : null}
          {nav.page === PAGE.CONTAINMENT ? <ContainmentPage /> : null}
        </AppStack>
      </AppPage>
    </>
  )
}
