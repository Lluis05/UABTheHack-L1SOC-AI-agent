import { useState } from 'react'
import { socService } from '../services/socService.js'
import { useAsync } from './useAsync.js'

// Informe de investigación (nivel 3) de un incidente: lo carga y permite pedirlo a la IA (tarda ≈1-2 min).
// fresh: sin caché del LLM (regenerar).
export function useIncidentReport(incidentId) {
  const { data, error, loading, reload } = useAsync(
    () => (incidentId ? socService.report(incidentId) : Promise.resolve(null)), [incidentId])
  const [generated, setGenerated] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  const generate = async (fresh = false) => {
    setGenerating(true)
    setGenerateError('')
    try {
      const res = await socService.generateReport(incidentId, fresh)
      setGenerated({ incidentId, report: res.report })
    } catch (e) {
      setGenerateError(e.message)
      reload()
    } finally {
      setGenerating(false)
    }
  }

  const own = generated?.incidentId === incidentId ? generated.report : null
  return {
    report: own || data?.report || null,
    loading,
    error: generateError || error,
    generating: generating || Boolean(data?.generating),
    generate,
  }
}
