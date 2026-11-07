import Box from '@mui/material/Box'
import { useEffect, useRef } from 'react'
import AppText from './AppText.jsx'

// Log de conversación con alto fijo (clave de theme.layout) y scroll propio que baja solo al llegar mensajes.
// messages: [{role, text}]. roles: {[role]: {label, tone, align}} con tone = clave de la paleta (human, llm, error…)
// y align = start | end. pending: texto del mensaje «escribiendo…» (null = nada). empty: lo que se ve sin mensajes.
export default function AppChatLog({ messages, roles, pending = null, empty, height, label }) {
  const end = useRef(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [messages.length, pending])

  return (
    <Box role="log" aria-live="polite" aria-label={label} tabIndex={0}
         sx={(t) => ({ height: t.layout[height], overflowY: 'auto', overscrollBehavior: 'contain', pr: 0.5,
           display: 'flex', flexDirection: 'column', gap: 1.25 })}>
      {messages.length || pending ? null : empty}
      {messages.map((m, i) => <Bubble key={i} {...roles[m.role]} text={m.text} />)}
      {pending ? <Bubble {...roles.pending} text={pending} /> : null}
      <div ref={end} />
    </Box>
  )
}

function Bubble({ label, tone, align, text }) {
  const right = align === 'end'
  return (
    <Box sx={{ alignSelf: right ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
      <AppText variant="caption" tone="muted" as="div" sx={{ textAlign: right ? 'right' : 'left', mb: 0.25 }}>{label}</AppText>
      <Box sx={(t) => ({ px: 1.5, py: 1, borderRadius: 2, border: 1, borderColor: `${tone}.main`,
        bgcolor: t.palette.mode === 'dark' ? 'background.default' : 'background.paper',
        whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' })}>
        <AppText as="div">{text}</AppText>
      </Box>
    </Box>
  )
}
