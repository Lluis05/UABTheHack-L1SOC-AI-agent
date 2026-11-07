import { CHAT_ROLE } from '../config/constants.js'

// Lógica pura del chat del ticket (tests en chat.test.js)

// Mensaje de la conversación tal y como se pinta y se reenvía al backend
export const chatMessage = (role, text) => ({ role, text })

// Historial que se manda al backend: solo preguntas y respuestas reales (sin errores), los últimos maxTurns
export function toHistory(messages, maxTurns) {
  const valid = messages.filter((m) => (m.role === CHAT_ROLE.USER || m.role === CHAT_ROLE.MODEL) && m.text?.trim())
  return maxTurns > 0 ? valid.slice(-maxTurns) : []
}

// Se puede enviar si hay texto, no se está esperando respuesta y no supera el máximo
export function canSend(text, busy, maxChars) {
  const len = text.trim().length
  return !busy && len > 0 && len <= maxChars
}
