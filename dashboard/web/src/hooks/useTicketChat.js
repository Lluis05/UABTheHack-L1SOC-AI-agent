import { useState } from 'react'
import { CHAT_DEFAULT_MAX_TURNS, CHAT_ROLE } from '../config/constants.js'
import { socService } from '../services/socService.js'
import { chatMessage, toHistory } from '../utils/chat.js'

// Conversación con la IA sobre un ticket. Vive en el navegador (el backend no guarda estado): se pierde al cambiar
// de ticket o recargar. Los errores se muestran como un mensaje más y no se reenvían al modelo.
export function useTicketChat(ticketId, maxTurns = CHAT_DEFAULT_MAX_TURNS) {
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)

  async function ask(question) {
    const q = question.trim()
    if (!q || busy) return
    const history = toHistory(messages, maxTurns)
    setMessages((m) => [...m, chatMessage(CHAT_ROLE.USER, q)])
    setBusy(true)
    try {
      const res = await socService.chat(ticketId, { question: q, history })
      setMessages((m) => [...m, chatMessage(CHAT_ROLE.MODEL, res.answer)])
    } catch (e) {
      setMessages((m) => [...m, chatMessage(CHAT_ROLE.ERROR, e.message)])
    } finally {
      setBusy(false)
    }
  }

  return { messages, busy, ask, reset: () => setMessages([]) }
}
