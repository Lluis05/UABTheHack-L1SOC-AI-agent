import { useState } from 'react'
import { socService } from '../services/socService.js'

// Acciones humanas sobre un ticket. Devuelven true/false para que el componente sepa si cerrar el diálogo.
export function useTicketActions(ticketId, approver, onChanged) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(call) {
    setBusy(true); setError('')
    try {
      await call()
      onChanged()
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  return {
    busy,
    error,
    clearError: () => setError(''),
    runContainment: (action, justification) => run(() => socService.runContainment(ticketId,
      { action: action.action, target: action.target, approver, justification })),
    decide: (type, { comment = '', verdict = null } = {}) => run(() => socService.decide(ticketId,
      { type, approver, comment, verdict: verdict || null })),
  }
}
