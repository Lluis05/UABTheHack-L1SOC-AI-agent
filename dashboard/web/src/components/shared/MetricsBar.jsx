import { useMemo } from 'react'
import {
  AppBarList, AppButton, AppCard, AppChartCard, AppColumnChart, AppGrid, AppIcon, AppSegmentedBar, AppStack, AppStat,
  AppText,
} from '../base'
import { CHIP_KINDS, DECIDER, METRICS_CHARTS_KEY } from '../../config/constants.js'
import { useStoredToggle } from '../../hooks/useStoredToggle.js'
import { chipProps } from '../../utils/chips.js'
import { countLabel, formatSeconds, orDash } from '../../utils/format.js'
import { buildQueueStats, speedup } from '../../utils/metrics.js'

const STAT_MIN_WIDTH = 150
const CHART_MIN_WIDTH = 300
// Color de cada responsable en las gráficas (tonos de theme.palette.chart, validados para gráficas)
const DECIDER_CHART_COLOR = { [DECIDER.POLICY]: 'chart.policy', [DECIDER.LLM]: 'chart.llm', [DECIDER.HUMAN]: 'chart.human' }

const DECIDER_PHRASE = { [DECIDER.POLICY]: 'la política', [DECIDER.LLM]: 'la IA', [DECIDER.HUMAN]: 'una persona' }
const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0)
const withLabels = (items, kind) => items.map((it) => ({ ...it, label: chipProps(kind, it.key).label }))

// Cifras clave: lo primero, cuánto espera a una persona; después volumen, velocidad, ahorro y fiabilidad de la IA.
function buildStats(m, s) {
  const times = speedup(m.avg_triage_seconds, m.manual_minutes_per_alert)
  return [
    { label: 'Esperan a una persona', value: m.awaiting_approval, emphasis: m.awaiting_approval > 0 ? 'attention' : 'normal',
      hint: countLabel(m.escalated, 'escalado') },
    { label: 'Tickets', value: m.total, hint: `${s.open} abiertos · ${s.closed} cerrados` },
    { label: 'Triaje medio', value: formatSeconds(m.avg_triage_seconds),
      hint: times ? `×${times} más rápido que a mano (${m.manual_minutes_per_alert} min)` : `frente a ${m.manual_minutes_per_alert} min a mano` },
    { label: 'Horas de analista ahorradas', value: orDash(m.time_saved_hours), hint: 'frente al triaje manual' },
    { label: 'Confianza media de la IA', value: s.confidence.average == null ? '—' : `${Math.round(s.confidence.average)} %`,
      hint: s.confidence.min == null ? null : `mínima ${s.confidence.min} %` },
    { label: 'Acuerdo prefiltro ↔ IA', value: s.agreement.rate == null ? '—' : `${s.agreement.rate} %`,
      hint: `${s.agreement.agree} de ${s.agreement.withHint} con pista del prefiltro` },
    { label: 'Cerrados por la política', value: `${Math.round(m.auto_closed_pct ?? 0)} %`, hint: `${m.auto_closed} sin usar el LLM` },
    { label: 'Correlados en incidentes', value: s.correlated, hint: `${pct(s.correlated, s.total)} % de los tickets` },
    ...(m.batch ? [{ label: 'Alertas en el batch completo', value: orDash(m.batch.total) }] : []),
  ]
}

// Panel de métricas de la cola: cifras clave siempre a la vista y, debajo, las gráficas (plegables y recordadas;
// empiezan plegadas para no alejar la cola; se despliegan con «Ver gráficas»). Todo se calcula con los tickets cargados (utils/metrics.js).
export default function MetricsBar({ metrics, tickets = [] }) {
  const [showCharts, toggleCharts] = useStoredToggle(METRICS_CHARTS_KEY, false)
  const stats = useMemo(() => buildQueueStats(tickets), [tickets])
  if (!metrics) return null

  return (
    <AppCard>
      <AppStack gap={2}>
        <AppStack direction="row" gap={1} wrap>
          <AppText variant="heading" as="h2">Resumen de la cola</AppText>
          <AppStack direction="row" grow justify="flex-end">
            <AppButton variant="link" aria-expanded={showCharts} onClick={toggleCharts}
                       startIcon={<AppIcon name="chart" tone="inherit" />}>
              {showCharts ? 'Ocultar gráficas' : 'Ver gráficas'}
            </AppButton>
          </AppStack>
        </AppStack>
        <AppGrid minItemWidth={STAT_MIN_WIDTH}>
          {buildStats(metrics, stats).map((s) => <AppStat key={s.label} {...s} />)}
        </AppGrid>
        {showCharts ? <Charts stats={stats} /> : null}
      </AppStack>
    </AppCard>
  )
}

function Charts({ stats: s }) {
  const deciders = s.decider.map((d) => ({ ...d, label: chipProps('decider', d.key).label, color: DECIDER_CHART_COLOR[d.key] }))
  const severities = withLabels(s.severity, 'severity').map((it) => ({ ...it, color: CHIP_KINDS.severity[it.key][1] }))
  const busiest = s.daily.reduce((best, d) => (d.value > (best?.value ?? -1) ? d : best), null)
  const lead = deciders.reduce((best, d) => (d.value > best.value ? d : best), deciders[0])
  return (
    <AppGrid minItemWidth={CHART_MIN_WIDTH}>
      <AppChartCard title="Quién decidió el veredicto"
                    subtitle="Política determinista, IA o una persona (si una persona decidió, cuenta como suya)">
        <AppStack gap={1.5}>
          {/* La lectura en una cifra: quién se lleva la mayor parte */}
          <AppStack gap={0}>
            <AppText variant="metric">{pct(lead.value, s.total)} %</AppText>
            <AppText variant="caption" tone="muted">de los veredictos los decidió {DECIDER_PHRASE[lead.key]}</AppText>
          </AppStack>
          <AppSegmentedBar segments={deciders} label="Quién decidió el veredicto" />
        </AppStack>
      </AppChartCard>
      <AppChartCard title="Severidad" subtitle="La calcula el código con la matriz de la política">
        <AppBarList items={severities} label="Tickets por severidad" />
      </AppChartCard>
      <AppChartCard title="Veredicto" subtitle={`${pct(s.verdict[0].value, s.total)} % verdaderos positivos`}>
        <AppBarList items={withLabels(s.verdict, 'verdict')} label="Tickets por veredicto" />
      </AppChartCard>
      <AppChartCard title="Estado" subtitle={`${s.open} abiertos de ${s.total}`}>
        <AppBarList items={withLabels(s.status, 'status')} label="Tickets por estado" />
      </AppChartCard>
      <AppChartCard wide title="Alertas por día"
                    subtitle={busiest ? `Pico: ${busiest.hint} (${countLabel(busiest.value, 'alerta')})` : 'Sin fechas de alerta'}>
        <AppColumnChart items={s.daily} label="Alertas por día" />
      </AppChartCard>
      <AppChartCard title="Confianza de la IA" subtitle={s.confidence.average == null ? 'Sin datos' : `Media ${Math.round(s.confidence.average)} %`}>
        <AppColumnChart items={s.confidence.bins} label="Tickets por tramo de confianza" color="chart.llm" />
      </AppChartCard>
      <AppChartCard title="Tiempo de triaje" subtitle={s.triage.average == null ? 'Sin datos' : `Media ${s.triage.average} s · máximo ${s.triage.max} s`}>
        <AppColumnChart items={s.triage.bins} label="Tickets por tiempo de triaje" />
      </AppChartCard>
      <AppChartCard title="Técnicas MITRE más vistas" subtitle={`Top ${s.mitre.length}`}>
        <AppBarList items={s.mitre} label="Técnicas MITRE más frecuentes" mono />
      </AppChartCard>
      <AppChartCard title="Reglas de detección" subtitle="Las que más alertas generan (el nombre, al pasar el ratón)">
        <AppBarList items={s.rules} label="Reglas de detección más frecuentes" mono />
      </AppChartCard>
      <AppChartCard wide title="Acciones recomendadas" subtitle="Propuestas por la IA; ejecutarlas es siempre un clic humano">
        <AppBarList items={s.actions} label="Acciones recomendadas más frecuentes" mono />
      </AppChartCard>
    </AppGrid>
  )
}
