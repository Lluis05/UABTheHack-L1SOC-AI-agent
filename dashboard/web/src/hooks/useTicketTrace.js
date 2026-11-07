import { socService } from '../services/socService.js'
import { useAsync } from './useAsync.js'

export function useTicketTrace(ticketId) {
  const { data, error, loading } = useAsync(
    () => (ticketId ? socService.trace(ticketId) : Promise.resolve(null)), [ticketId])
  return { trace: data?.trace ?? [], error, loading }
}
