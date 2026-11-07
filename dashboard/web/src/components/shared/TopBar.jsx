import { AppChip, AppStack, AppTabs, AppText, AppTextField, AppTopBar } from '../base'
import { DATA_SOURCE, DECIDER } from '../../config/constants.js'
import { chipProps } from '../../utils/chips.js'

const APPROVER_FIELD_WIDTH = 220
const LEGEND = [DECIDER.POLICY, DECIDER.LLM, DECIDER.HUMAN]

// Cabecera: navegación, la leyenda de quién decide (el mensaje central del pitch), salud de la API y quién aprueba.
export default function TopBar({ pages, page, onPageChange, health, source, approver, onApproverChange }) {
  return (
    <AppTopBar>
      <AppText variant="strong" translate="no">Tarvia SOC N1</AppText>
      <AppTabs items={pages} value={page} onChange={onPageChange} />
      <AppStack direction="row" gap={0.75} wrap>
        <AppText variant="caption" tone="muted">Decide:</AppText>
        {LEGEND.map((d) => <AppChip key={d} {...chipProps('decider', d)} variant="solid" />)}
      </AppStack>
      <AppStack direction="row" gap={1.5} wrap grow justify="flex-end">
        <AppChip label={health?.soc_api ? 'API simulada conectada' : 'API simulada sin conexión'}
                 tone={health?.soc_api ? 'success' : 'error'} title={health?.soc_api_url} />
        {source === DATA_SOURCE.SAMPLE ? (
          <AppChip label="Datos de ejemplo" tone="warning" title="output/tickets.jsonl todavía no existe" />
        ) : null}
        <AppTextField label="Quién aprueba" name="approver" width={APPROVER_FIELD_WIDTH} value={approver}
                      onChange={onApproverChange} placeholder="Ana García…" />
      </AppStack>
    </AppTopBar>
  )
}
