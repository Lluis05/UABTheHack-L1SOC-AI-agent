import { AppAlert, AppButton, AppCard, AppText } from '../components/base'
import { ContainmentLogTable } from '../components/shared'
import { useContainmentLog } from '../hooks/useContainmentLog.js'

export default function ContainmentPage() {
  const { log, available, error, loading, reload } = useContainmentLog()
  let body = <ContainmentLogTable log={log} />
  if (!available) {
    body = <AppAlert tone="error">La API simulada no responde ({error}). Arráncala con uvicorn mock_soc_api:app --port 8000.</AppAlert>
  } else if (loading && log.length === 0) {
    body = <AppText tone="muted">Cargando registro…</AppText>
  }
  return (
    <AppCard title="Registro de contención de la API simulada" action={<AppButton onClick={reload}>Recargar registro</AppButton>}>
      {body}
    </AppCard>
  )
}
