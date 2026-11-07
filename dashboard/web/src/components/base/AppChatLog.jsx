import Box from '@mui/material/Box'
import { useEffect, useRef } from 'react'
import AppRichText from './AppRichText.jsx'
import AppText from './AppText.jsx'

// Log de conversación con scroll propio que baja solo al llegar mensajes. Ocupa el alto que le deja su contenedor
// (columna flexible), así que el campo de pregunta queda siempre a la vista.
// messages: [{role, text}]. roles: {[role]: {label, tone, align, variant, rich}}:
//   tone = clave de la paleta · align = start | end
//   variant = bubble (mensaje corto, p. ej. la pregunta) | document (respuesta para leer: a todo el ancho, sin marco)
//   rich = el texto lleva formato ligero (AppRichText)
// pending: texto del mensaje «escribiendo…» (null = nada). empty: lo que se ve sin mensajes.
export default function AppChatLog({ messages, roles, pending = null, empty, label }) {
  const end = useRef(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [messages.length, pending])

  return (
    <Box role="log" aria-live="polite" aria-label={label} tabIndex={0}
         sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', pr: 0.5,
               display: 'flex', flexDirection: 'column', gap: 2 }}>
      {messages.length || pending ? null : empty}
      {messages.map((m, i) => <Message key={i} {...roles[m.role]} text={m.text} />)}
      {pending ? <Message {...roles.pending} text={pending} /> : null}
      <div ref={end} />
    </Box>
  )
}

function Message({ label, tone, align, variant = 'bubble', rich = false, text }) {
  const right = align === 'end'
  const body = rich ? <AppRichText text={text} /> : <AppText as="div" sx={{ whiteSpace: 'pre-wrap' }}>{text}</AppText>
  if (variant === 'document') {
    return (
      <Box sx={{ alignSelf: 'stretch', minWidth: 0 }}>
        <AppText variant="caption" tone="muted" as="div" sx={{ mb: 0.75, display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: `${tone}.main` }} />
          {label}
        </AppText>
        <Box sx={{ pl: 1.5, borderLeft: 2, borderColor: `${tone}.main`, overflowWrap: 'anywhere' }}>{body}</Box>
      </Box>
    )
  }
  return (
    <Box sx={{ alignSelf: right ? 'flex-end' : 'flex-start', maxWidth: '85%', minWidth: 0 }}>
      <AppText variant="caption" tone="muted" as="div" sx={{ textAlign: right ? 'right' : 'left', mb: 0.25 }}>{label}</AppText>
      <Box sx={{ px: 1.5, py: 1, borderRadius: 1.5, bgcolor: 'surface.main', border: 1, borderColor: 'divider',
                 overflowWrap: 'anywhere' }}>
        {body}
      </Box>
    </Box>
  )
}
