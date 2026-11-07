import { socService } from '../services/socService.js'
import { useAsync } from './useAsync.js'

export function useContainmentLog() {
  const { data, error, loading, reload } = useAsync(socService.containmentLog, [])
  return {
    log: data?.log ?? [],
    available: data ? data.available : !error,
    error: error || data?.error || '',
    loading,
    reload,
  }
}
