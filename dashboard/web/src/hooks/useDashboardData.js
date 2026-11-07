import { useCallback } from 'react'
import { socService } from '../services/socService.js'
import { POLL_DASHBOARD_MS } from '../config/constants.js'
import { useAsync } from './useAsync.js'
import { useInterval } from './useInterval.js'

const BACKEND_HINT = '¿Está arrancado uvicorn dashboard.server:app --port 8001?'

// Estado global de la pantalla: tickets, métricas, incidentes y salud. Se refresca solo porque el pipeline
// puede seguir escribiendo tickets mientras el dashboard está abierto.
export function useDashboardData() {
  const loader = useCallback(async () => {
    const [tickets, metrics, incidents, health] = await Promise.all([
      socService.tickets(), socService.metrics(), socService.incidents(), socService.health(),
    ])
    return { tickets: tickets.tickets, source: tickets.source, metrics, incidents: incidents.incidents, health }
  }, [])
  const { data, error, reload } = useAsync(loader, [loader])
  useInterval(reload, POLL_DASHBOARD_MS)
  return {
    tickets: data?.tickets ?? [],
    source: data?.source,
    metrics: data?.metrics,
    incidents: data?.incidents,
    health: data?.health,
    error: error && `No se puede hablar con el backend (${error}). ${BACKEND_HINT}`,
    refresh: reload,
  }
}
