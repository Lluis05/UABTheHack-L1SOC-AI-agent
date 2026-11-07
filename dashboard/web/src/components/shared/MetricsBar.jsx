import { AppCard, AppGrid, AppStat } from '../base'
import { formatPercent, formatSeconds, orDash } from '../../utils/format.js'

// Una sola franja: lo primero, cuánto espera a una persona; después, cuánto resolvió la política y cuánto la IA.
function buildStats(m) {
  return [
    { label: 'Esperan a una persona', value: m.awaiting_approval, emphasis: m.awaiting_approval > 0 ? 'attention' : 'normal' },
    { label: 'Tickets', value: m.total },
    { label: 'Cerrados por la política', value: formatPercent(m.auto_closed_pct), hint: `${m.auto_closed} sin usar el LLM` },
    { label: 'Analizados por la IA', value: formatPercent(m.llm_pct), hint: `${m.llm} tickets` },
    { label: 'Escalados', value: formatPercent(m.escalated_pct), hint: `${m.escalated} tickets` },
    { label: 'Triaje medio', value: formatSeconds(m.avg_triage_seconds), hint: `frente a ${m.manual_minutes_per_alert} min a mano` },
    { label: 'Horas de analista ahorradas', value: m.time_saved_hours },
    ...(m.batch ? [{ label: 'Alertas en el batch completo', value: orDash(m.batch.total) }] : []),
  ]
}

const STAT_MIN_WIDTH = 150

// Rejilla de columnas iguales: en escritorio una franja, en móvil dos columnas alineadas (no un zigzag)
export default function MetricsBar({ metrics }) {
  if (!metrics) return null
  return (
    <AppCard>
      <AppGrid minItemWidth={STAT_MIN_WIDTH}>
        {buildStats(metrics).map((s) => <AppStat key={s.label} {...s} />)}
      </AppGrid>
    </AppCard>
  )
}
