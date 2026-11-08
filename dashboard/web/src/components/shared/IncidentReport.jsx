import { AppAlert, AppButton, AppCard, AppChip, AppEmptyState, AppIcon, AppKeyValueTable, AppSkeletonRows, AppStack, AppTable, AppText } from '../base'
import { formatDateTime, orDash, toPercent } from '../../utils/format.js'
import { reportFileName, reportFlags } from '../../utils/incidents.js'
import { Tags } from './TagList.jsx'

const SKELETON_ROWS = 4
const SKELETON_HEIGHT = 72
const READING_WIDTH = '78ch'

const TIMELINE_COLUMNS = [
  { key: 'timestamp', label: 'Cuándo', mono: true, nowrap: true, render: (t) => formatDateTime(t.timestamp) },
  { key: 'description', label: 'Qué pasó' },
  { key: 'mitre', label: 'MITRE', nowrap: true, hideBelow: 'md', render: (t) => (t.mitre ? <AppChip label={t.mitre} variant="code" /> : '—') },
  { key: 'event_id', label: 'Evidencia', mono: true, hideBelow: 'lg' },
]

const PLAN_COLUMNS = [
  { key: 'action', label: 'Acción', mono: true, nowrap: true },
  { key: 'target', label: 'Objetivo', mono: true },
  { key: 'approver', label: 'Aprueba', render: (a) => <AppChip label={a.approver || 'analista'} tone="human" /> },
  { key: 'business_impact', label: 'Impacto en el negocio', hideBelow: 'md', render: (a) => a.x_note ? `${a.business_impact || ''} ${a.x_note}`.trim() : orDash(a.business_impact) },
]

// Informe de investigación (nivel 3) para N2: lo redacta la IA con toda la evidencia del incidente y el código lo
// valida (cada hito con un event_id que existe, aprobadores de la política). Solo propone: la contención la sigue
// aprobando una persona desde el ticket.
export default function IncidentReport({ incidentId, report, loading, error, generating, onGenerate }) {
  if (loading && !report) return <AppSkeletonRows rows={SKELETON_ROWS} height={SKELETON_HEIGHT} label="Cargando el informe" />
  if (!report) {
    return (
      <AppStack gap={1.5}>
        {error ? <AppAlert tone="error">{error}</AppAlert> : null}
        <AppEmptyState icon="summary" title={generating ? 'La IA está redactando el informe…' : 'Este incidente aún no tiene informe'}
                       hint="La IA reconstruye el ataque con todas las alertas y la actividad de sus entidades; el código comprueba que cada hito cita un evento real y asigna los aprobadores según la política. Tarda 1-2 minutos."
                       action={<AppButton variant="primary" disabled={generating} onClick={() => onGenerate(false)}
                                          startIcon={<AppIcon name={generating ? 'pending' : 'summary'} tone="inherit" />}>
                         {generating ? 'Generando…' : `Generar informe de ${incidentId}`}
                       </AppButton>} />
      </AppStack>
    )
  }

  const scope = report.scope || {}
  const rows = [
    { key: 'patient', icon: 'host', label: 'Paciente cero', value: <AppText>{orDash(report.patient_zero)}</AppText> },
    { key: 'access', icon: 'threat', label: 'Acceso inicial', value: <AppText>{orDash(report.initial_access)}</AppText> },
    { key: 'cause', icon: 'evidence', label: 'Causa raíz', value: <AppText>{orDash(report.root_cause)}</AppText> },
    { key: 'users', icon: 'user', label: 'Usuarios', value: <TextLines values={scope.users} /> },
    { key: 'hosts', icon: 'host', label: 'Equipos', value: <TextLines values={scope.hosts} /> },
    { key: 'data', icon: 'service', label: 'Datos', value: <AppText>{orDash(scope.data)}</AppText> },
    { key: 'impact', icon: 'customer', label: 'Impacto', value: <AppText>{orDash(scope.business_impact)}</AppText> },
  ]
  const download = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(report, null, 2))}`

  return (
    <AppStack gap={1.5}>
      {error ? <AppAlert tone="error">{error}</AppAlert> : null}
      <AppCard>
        <AppStack gap={1}>
          <AppText variant="heading" style={{ maxWidth: READING_WIDTH }}>{report.title}</AppText>
          <Tags>
            {report.confidence != null ? <AppChip label={`${toPercent(report.confidence)} % de confianza`} /> : null}
            <AppChip label={`${report.timeline?.length || 0} hitos`} icon="trace" />
            {reportFlags(report).map((f) => <AppChip key={f.key} label={f.label} tone={f.tone} variant="solid" />)}
            {report.x_llm_provider ? <AppChip label={`Redactado por ${report.x_llm_provider}`} tone="llm" /> : null}
          </Tags>
          <AppStack direction="row" gap={0.75} wrap>
            <AppButton href={download} download={reportFileName(report)} startIcon={<AppIcon name="summary" tone="inherit" />}>
              Descargar JSON
            </AppButton>
            <AppButton disabled={generating} onClick={() => onGenerate(true)}
                       title="Vuelve a pedir el informe a la IA, sin caché">
              {generating ? 'Regenerando…' : 'Regenerar'}
            </AppButton>
          </AppStack>
        </AppStack>
      </AppCard>
      <AppCard title="Qué ha pasado"><AppKeyValueTable rows={rows} label={`Informe de ${report.incident_id}`} /></AppCard>
      <AppCard title={`Cronología (${report.timeline?.length || 0})`}>
        <AppTable columns={TIMELINE_COLUMNS} rows={report.timeline || []} getRowKey={(t, i) => `${t.event_id}-${i}`} label="Cronología del ataque" />
      </AppCard>
      <AppCard title="Plan de contención propuesto">
        <AppStack gap={1}>
          <AppText variant="caption" tone="muted">Propuesta: cada acción la aprueba y ejecuta una persona desde el ticket de la alerta.</AppText>
          <AppTable columns={PLAN_COLUMNS} rows={report.containment_plan || []} getRowKey={(a, i) => `${a.action}-${a.target}-${i}`} label="Plan de contención" />
        </AppStack>
      </AppCard>
      <ListCard title="Erradicación y recuperación" values={report.eradication_and_recovery} />
      <ListCard title="Notificaciones" values={report.notifications} />
      <ListCard title="Huecos de detección" values={report.detection_gaps} />
      <ListCard title="Preguntas abiertas" values={report.open_questions} />
    </AppStack>
  )
}

// Abasto: la IA explica cada usuario o equipo en una frase (no son identificadores sueltos)
function TextLines({ values }) {
  if (!values?.length) return <AppText tone="muted">—</AppText>
  return <AppStack gap={0.5}>{values.map((v) => <AppText key={v}>{v}</AppText>)}</AppStack>
}

function ListCard({ title, values }) {
  if (!values?.length) return null
  return (
    <AppCard title={title}>
      <AppStack gap={0.75}>
        {values.map((v) => <AppText key={v} style={{ maxWidth: READING_WIDTH }}>{v}</AppText>)}
      </AppStack>
    </AppCard>
  )
}
