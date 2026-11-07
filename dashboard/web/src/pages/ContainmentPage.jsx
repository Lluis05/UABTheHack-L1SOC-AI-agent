import { AppButton, AppCard, AppEmptyState, AppSkeletonRows } from '../components/base'
import { ContainmentLogTable } from '../components/shared'
import { useContainmentLog } from '../hooks/useContainmentLog.js'

const SKELETON_ROWS = 6

export default function ContainmentPage() {
  const { log, available, error, loading, reload } = useContainmentLog()
  let body = <ContainmentLogTable log={log} />
  if (!available) {
    body = (
      <AppEmptyState icon="containment" tone="error" title="La API simulada no responde"
                     hint={`${error}. Arráncala con uvicorn mock_soc_api:app --port 8000 y recarga.`}
                     action={<AppButton onClick={reload}>Reintentar</AppButton>} />
    )
  } else if (loading && log.length === 0) {
    body = <AppSkeletonRows rows={SKELETON_ROWS} label="Cargando registro" />
  }
  return (
    <AppCard title="Registro de contención de la API simulada" action={<AppButton onClick={reload}>Recargar</AppButton>}>
      {body}
    </AppCard>
  )
}
