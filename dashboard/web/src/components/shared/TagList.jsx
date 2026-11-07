import { AppChip, AppStack, AppText } from '../base'
import { splitVisible } from '../../utils/tickets.js'

// Tags en horizontal (fichas en tabla: ficha del ticket y resumen para N2)
export function Tags({ children }) {
  return <AppStack direction="row" gap={0.5} wrap>{children}</AppStack>
}

// Valores como chips de código. max: los primeros max y el resto resumido en «+N» (lista completa en el tooltip);
// sin max, todos. Sin valores, una raya.
export function CodeTags({ values = [], tone, max }) {
  if (!values?.length) return <AppText tone="muted">—</AppText>
  const { visible, hidden } = max ? splitVisible(values, max) : { visible: values, hidden: 0 }
  return (
    <Tags>
      {visible.map((v) => <AppChip key={v} label={v} variant="code" tone={tone} />)}
      {hidden > 0 ? <AppChip label={`+${hidden}`} title={values.slice(max).join(', ')} /> : null}
    </Tags>
  )
}
