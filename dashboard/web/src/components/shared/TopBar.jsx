import { useState } from 'react'
import { AppAvatar, AppChip, AppPopover, AppStack, AppTabs, AppText, AppTextField, AppTopBar } from '../base'
import { APP_TITLE, DATA_SOURCE, DECIDER } from '../../config/constants.js'
import { chipProps } from '../../utils/chips.js'
import { initials } from '../../utils/format.js'

const LEGEND = [DECIDER.POLICY, DECIDER.LLM, DECIDER.HUMAN]

// Cabecera: título y perfil arriba, pestañas debajo. El avatar abre el perfil: quién aprueba, estado y leyenda.
export default function TopBar({ pages, page, onPageChange, health, source, approver, onApproverChange }) {
  const [anchor, setAnchor] = useState(null)
  return (
    <AppTopBar tabs={<AppTabs items={pages} value={page} onChange={onPageChange} />}>
      <AppText variant="title" as="h1" translate="no">{APP_TITLE}</AppText>
      <AppStack direction="row" gap={1.25} grow justify="flex-end">
        {source === DATA_SOURCE.SAMPLE ? (
          <AppChip label="Datos de ejemplo" tone="warning" title="output/tickets.jsonl todavía no existe" />
        ) : null}
        <AppChip label={health?.soc_api ? 'API conectada' : 'API sin conexión'}
                 tone={health?.soc_api ? 'success' : 'error'} title={health?.soc_api_url} />
        <AppAvatar initials={initials(approver)} label={approver ? `Perfil: ${approver}` : 'Perfil: identifícate para aprobar'}
                   onClick={(e) => setAnchor(e.currentTarget)} />
      </AppStack>
      <AppPopover anchor={anchor} onClose={() => setAnchor(null)}>
        <AppStack gap={1.5}>
          <AppTextField label="Quién aprueba" name="approver" value={approver} onChange={onApproverChange}
                        placeholder="Ana García…" autoFocus
                        helperText="Queda registrado en cada decisión y en la API." />
          <AppStack gap={0.75}>
            <AppText variant="caption" tone="muted">Quién decide cada campo</AppText>
            <AppStack direction="row" gap={0.75} wrap>
              {LEGEND.map((d) => <AppChip key={d} {...chipProps('decider', d)} variant="solid" />)}
            </AppStack>
          </AppStack>
        </AppStack>
      </AppPopover>
    </AppTopBar>
  )
}
