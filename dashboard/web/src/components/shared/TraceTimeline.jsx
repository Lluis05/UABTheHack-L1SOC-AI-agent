import { AppStack, AppText } from '../base'

// "Qué ha consultado": cada lookup en orden. Aquí la numeración sí aporta: es una secuencia real.
export default function TraceTimeline({ trace }) {
  if (!trace?.length) return <AppText tone="muted">Este ticket no tiene traza.</AppText>
  return (
    <AppStack gap={0.5}>
      {trace.map((s, i) => (
        <AppStack key={i} direction="row" gap={1} wrap align="baseline">
          <AppText variant="caption" tone="muted">{i + 1}</AppText>
          <AppText variant="mono" color="llm.main">{s.step}</AppText>
          <AppText>{String(s.query ?? '')}</AppText>
          <AppText tone="muted" aria-hidden="true">→</AppText>
          <AppText tone="success">{String(s.result ?? '')}</AppText>
          {s.ms != null ? <AppText variant="caption" tone="muted">{s.ms}&nbsp;ms</AppText> : null}
        </AppStack>
      ))}
    </AppStack>
  )
}
