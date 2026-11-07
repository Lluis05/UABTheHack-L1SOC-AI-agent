import { AppAlert, AppCard, AppStack } from '../components/base'
import { TraceTimeline, TriageInputForm, TriageProgress } from '../components/shared'
import { LIVE_MODE } from '../config/constants.js'
import { useTriageJob } from '../hooks/useTriageJob.js'

// Modo defensa: el jurado da 10 alertas y se trían aquí, en el momento.
export default function LiveTriagePage({ health, config, onOpenTicket, onTicketsChanged }) {
  const { job, error, running, start } = useTriageJob(onTicketsChanged)
  const mode = health?.live_mode

  return (
    <AppStack gap={2}>
      <AppCard title="Triar alertas nuevas">
        <AppStack gap={1.5}>
          {mode === LIVE_MODE.NONE ? (
            <AppAlert tone="warning">
              El pipeline (soc.pipeline) todavía no existe. Para probar la pantalla, arranca el backend con
              DASHBOARD_SIMULATE=1: los tickets saldrán marcados como simulados.
            </AppAlert>
          ) : null}
          {mode === LIVE_MODE.SIMULATED ? (
            <AppAlert tone="warning">Modo simulado: los tickets son falsos. No lo uses en la defensa.</AppAlert>
          ) : null}
          <TriageInputForm running={running} maxAlerts={config?.max_live_alerts} onSubmit={start} />
          {error ? <AppAlert tone="error">No se ha podido lanzar el triaje: {error}</AppAlert> : null}
        </AppStack>
      </AppCard>
      {job && config ? (
        <TriageProgress job={job} targetSeconds={config.live_target_seconds}>
          {Object.values(job.alerts).map((a) => (
            <TriageProgress.Alert key={a.alert_id} alert={a} steps={config.live_steps} onOpenTicket={onOpenTicket}>
              <TraceTimeline trace={a.trace} />
            </TriageProgress.Alert>
          ))}
        </TriageProgress>
      ) : null}
    </AppStack>
  )
}
