import { useState } from 'react'
import { AppAccordion, AppAlert, AppButton, AppCard, AppChip, AppCodeBlock, AppFixedArea, AppStack, AppText } from '../base'
import { JOB_STATUS, STEP, STEP_LABELS } from '../../config/constants.js'
import { countLabel } from '../../utils/format.js'
import { alertElapsedSeconds, stepStates, summarizeJob } from '../../utils/triage.js'

const STEP_TONE = { done: 'success', current: 'primary', pending: 'default' }
const STEP_VARIANT = { done: 'solid', current: 'solid', pending: 'outline' }

// Componente compuesto (vercel-composition-patterns): la pantalla monta
//   <TriageProgress job={…}> <TriageProgress.Alert alert={…}> <TraceTimeline …/> </TriageProgress.Alert> </TriageProgress>
// y cada fila recibe su traza como children, sin render props ni dependencia entre bloques compuestos.
export default function TriageProgress({ job, targetSeconds, children }) {
  const { total, done, failed } = summarizeJob(job)
  const running = job.status === JOB_STATUS.RUNNING
  const overTarget = !running && job.elapsed > targetSeconds
  return (
    <AppCard
      title={`Progreso del lanzamiento ${job.job_id}`}
      action={(
        <AppText variant="strong" tone={running ? 'primary' : undefined} role="status">
          {job.elapsed}&nbsp;s, {done} de {countLabel(total, 'ticket')}{failed ? `, ${failed} con error` : ''}
        </AppText>
      )}
    >
      <AppStack gap={1}>
        <AppText variant="caption" tone="muted">Motor: {job.mode}</AppText>
        {overTarget ? <AppAlert tone="warning">Ha tardado más que el objetivo de la defensa ({targetSeconds}&nbsp;s).</AppAlert> : null}
        {job.error ? <AppAlert tone="error">El triaje ha fallado: {job.error}. Revisa el log del pipeline.</AppAlert> : null}
        <AppFixedArea height="uploadProgressHeight" label="Alertas del lanzamiento">
          <AppStack gap={1}>{children}</AppStack>
        </AppFixedArea>
        {job.log?.length > 0 ? (
          <AppAccordion title={`Log del pipeline (${job.log.length} líneas)`}>
            <AppCodeBlock>{job.log.join('\n')}</AppCodeBlock>
          </AppAccordion>
        ) : null}
      </AppStack>
    </AppCard>
  )
}

function TriageAlert({ alert: a, steps, onOpenTicket, children }) {
  const [showTrace, setShowTrace] = useState(false)
  const seconds = alertElapsedSeconds(a)
  return (
    <AppStack gap={0.5}>
      <AppStack direction="row" gap={1} wrap>
        <AppText variant="mono">{a.alert_id}</AppText>
        {a.label ? <AppText tone="muted" noWrap>{a.label}</AppText> : null}
        <AppStack direction="row" gap={0.5}>
          {stepStates(a.step, steps).map(({ step, state }) => (
            <AppChip key={step} label={STEP_LABELS[step] || step} tone={STEP_TONE[state]} variant={STEP_VARIANT[state]} />
          ))}
          {a.step === STEP.ERROR ? <AppChip label="Error" tone="error" variant="solid" /> : null}
        </AppStack>
        {seconds != null ? <AppText variant="caption" tone="muted">{seconds}&nbsp;s</AppText> : null}
        {a.trace?.length > 0 ? (
          <AppButton variant="link" aria-expanded={showTrace} onClick={() => setShowTrace(!showTrace)}>
            {showTrace ? 'Ocultar traza' : `Ver traza (${a.trace.length})`}
          </AppButton>
        ) : null}
        {a.ticket_id ? <AppButton variant="link" onClick={() => onOpenTicket(a.ticket_id)}>Abrir ticket</AppButton> : null}
      </AppStack>
      {a.error ? <AppText tone="error">{a.error}</AppText> : null}
      {showTrace ? children : null}
    </AppStack>
  )
}

TriageProgress.Alert = TriageAlert
