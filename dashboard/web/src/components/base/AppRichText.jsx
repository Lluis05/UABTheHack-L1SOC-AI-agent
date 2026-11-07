import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { Fragment } from 'react'
import { parseInline, parseMarkdown } from '../../utils/markdown.js'

// Texto con formato ligero (respuestas del asistente): subtítulos, párrafos, viñetas, listas numeradas, **negrita**
// y `código` (IDs, reglas, IPs). Todo se pinta con elementos React: nunca HTML crudo.
const NESTED_INDENT = 2.25

function Inlines({ inlines }) {
  return inlines.map((part, i) => {
    if (part.type === 'strong') {
      // Dentro de la negrita puede haber `código` (p. ej. **Reglas (`x_policy_hits`):**)
      return (
        <Box key={i} component="strong" sx={{ fontWeight: 600, color: 'text.primary' }}>
          <Inlines inlines={parseInline(part.text)} />
        </Box>
      )
    }
    if (part.type === 'code') {
      return (
        <Box key={i} component="code" translate="no"
             sx={(t) => ({ ...t.typography.mono, fontSize: '0.9em', px: '3px', borderRadius: 0.5,
                           bgcolor: 'surface.main', color: 'text.primary', overflowWrap: 'anywhere' })}>
          {part.text}
        </Box>
      )
    }
    return <Fragment key={i}>{part.text}</Fragment>
  })
}

export default function AppRichText({ text }) {
  const blocks = parseMarkdown(text)
  return (
    <Box sx={{ '& > * + *': { mt: 1.25 }, minWidth: 0 }}>
      {blocks.map((b, i) => {
        if (b.type === 'heading') {
          return <Typography key={i} variant="strong" component="h3" sx={{ '&&': { mt: i ? 2 : 0 } }}><Inlines inlines={b.inlines} /></Typography>
        }
        if (b.type === 'list') {
          return (
            <Box key={i} component={b.ordered ? 'ol' : 'ul'} sx={{ m: 0, pl: 2.5, '& li + li': { mt: 0.75 } }}>
              {b.items.map((item, j) => (
                <Typography key={j} component="li" variant="body2"
                            sx={{ ml: item.level ? NESTED_INDENT : 0, listStyleType: item.level ? 'circle' : undefined,
                                  '&::marker': { color: 'text.secondary' } }}>
                  <Inlines inlines={item.inlines} />
                </Typography>
              ))}
            </Box>
          )
        }
        return <Typography key={i} variant="body2"><Inlines inlines={b.inlines} /></Typography>
      })}
    </Box>
  )
}
