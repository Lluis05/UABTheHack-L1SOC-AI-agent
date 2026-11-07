import { useState } from 'react'
import { AppAlert, AppButton, AppChatLog, AppStack, AppText, AppTextField } from '../base'
import { CHAT_DEFAULT_MAX_CHARS, CHAT_ROLE, CHAT_SUGGESTIONS } from '../../config/constants.js'
import { canSend } from '../../utils/chat.js'

// Cómo se pinta cada autor del chat (tono = clave de la paleta del tema)
const CHAT_ROLES = {
  [CHAT_ROLE.USER]: { label: 'Tú', tone: 'human', align: 'end' },
  [CHAT_ROLE.MODEL]: { label: 'Asistente IA (Gemini)', tone: 'llm', align: 'start' },
  [CHAT_ROLE.ERROR]: { label: 'Error', tone: 'error', align: 'start' },
  pending: { label: 'Asistente IA (Gemini)', tone: 'llm', align: 'start' },
}
const PENDING_TEXT = 'Pensando…'

// Chat con la IA sobre el ticket abierto: preguntas libres + sugerencias. Solo consulta: no cambia nada del ticket.
// chat: lo que devuelve useTicketChat (vive en la ficha, así la conversación sobrevive al cerrar el modal).
export default function TicketChat({ chat, maxChars = CHAT_DEFAULT_MAX_CHARS }) {
  const [text, setText] = useState('')
  const ready = canSend(text, chat.busy, maxChars)

  function send(question = text) {
    if (!canSend(question, chat.busy, maxChars)) return
    chat.ask(question)
    setText('')
  }
  function onKeyDown(e) {
    // Enter envía; Mayús+Enter hace salto de línea
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const empty = (
    <AppStack gap={1}>
      <AppText tone="muted">
        Pregunta lo que quieras sobre este ticket: por qué se cerró o escaló, qué reglas aplicó la política, en qué
        evidencias se basa… La IA solo consulta; las decisiones y la contención las tomas tú desde la ficha.
      </AppText>
      <AppStack direction="row" gap={0.75} wrap>
        {CHAT_SUGGESTIONS.map((q) => (
          <AppButton key={q} size="small" onClick={() => send(q)} disabled={chat.busy}>{q}</AppButton>
        ))}
      </AppStack>
    </AppStack>
  )

  return (
    <AppStack gap={1.5}>
      <AppAlert tone="info">
        Las respuestas las genera una IA a partir de los datos del ticket y pueden contener errores: verifica las
        evidencias antes de decidir.
      </AppAlert>
      <AppChatLog messages={chat.messages} roles={CHAT_ROLES} pending={chat.busy ? PENDING_TEXT : null}
                  empty={empty} height="chatLogHeight" label="Conversación con la IA sobre el ticket" />
      <AppStack direction="row" gap={1} align="flex-end">
        <AppTextField label="Tu pregunta" name="chat-question" value={text} onChange={setText} rows={1}
                      onKeyDown={onKeyDown} placeholder="¿Por qué se ha cerrado este ticket?"
                      inputProps={{ maxLength: maxChars }} autoComplete="off" />
        <AppButton variant="primary" onClick={() => send()} disabled={!ready}>Enviar</AppButton>
        {chat.messages.length ? <AppButton onClick={chat.reset} disabled={chat.busy}>Nueva conversación</AppButton> : null}
      </AppStack>
    </AppStack>
  )
}
