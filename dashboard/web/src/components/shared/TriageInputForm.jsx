import { useState } from 'react'
import { AppAlert, AppButton, AppFileButton, AppFixedArea, AppStack, AppTabs, AppText, AppTextField } from '../base'
import { DEFAULT_RANDOM_ALERTS, INPUT_MODE, INPUT_MODES } from '../../config/constants.js'
import { buildTriageRequest, parseAlerts } from '../../utils/triage.js'

const ALERT_FILE_TYPES = '.json,.jsonl,.txt'
// Mismas filas en los dos campos de texto: el área no cambia de alto entre pestañas
const INPUT_ROWS = 8

function describeLoaded(text) {
  try { return `${parseAlerts(text).length} alertas cargadas` } catch (e) { return e.message }
}

// Entrada de alertas para la defensa: pegar JSON, subir fichero, IDs del dataset o simulacro aleatorio.
export default function TriageInputForm({ running, maxAlerts, onSubmit }) {
  const [mode, setMode] = useState(INPUT_MODE.PASTE)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [ids, setIds] = useState('')
  const [count, setCount] = useState(DEFAULT_RANDOM_ALERTS)
  const [error, setError] = useState('')

  function submit() {
    setError('')
    try {
      onSubmit(buildTriageRequest(mode, { text, ids, count }))
    } catch (e) {
      setError(`${e.message}. Revisa la entrada y vuelve a lanzar.`)
    }
  }

  return (
    <AppStack gap={1.5}>
      <AppTabs items={INPUT_MODES} value={mode} onChange={setMode} />
      <AppFixedArea height="uploadInputHeight">
        {mode === INPUT_MODE.PASTE ? (
          <AppTextField label="Alertas en JSON o JSONL" name="alerts" variant="code" rows={INPUT_ROWS} fixedRows value={text} onChange={setText}
                        placeholder='[{"alert_id": "ALR-…", "rule_id": "…"}] o una alerta por línea…' />
        ) : null}
        {mode === INPUT_MODE.FILE ? (
          <AppStack direction="row" gap={1.5}>
            <AppFileButton label="Elegir fichero" accept={ALERT_FILE_TYPES}
                           onText={(content, name) => { setText(content); setFileName(name) }} />
            {fileName ? <AppText tone="muted" role="status">{fileName}: {describeLoaded(text)}</AppText> : null}
          </AppStack>
        ) : null}
        {mode === INPUT_MODE.IDS ? (
          <AppTextField label="IDs de alertas del dataset" name="alert_ids" variant="code" rows={INPUT_ROWS} fixedRows value={ids} onChange={setIds}
                        placeholder="ALR-…, ALR-… (separados por comas o saltos de línea)…" />
        ) : null}
        {mode === INPUT_MODE.RANDOM ? (
          <AppTextField type="number" label="Alertas al azar" name="random_count" width={200} value={count} onChange={setCount}
                        inputProps={{ min: 1, max: maxAlerts, inputMode: 'numeric' }} />
        ) : null}
      </AppFixedArea>
      <AppStack direction="row">
        <AppButton variant="primary" disabled={running} onClick={submit}>{running ? 'Triando…' : 'Triar alertas'}</AppButton>
      </AppStack>
      {error ? <AppAlert tone="error">{error}</AppAlert> : null}
    </AppStack>
  )
}
