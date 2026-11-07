import { useState } from 'react'
import {
  AppAvatar, AppBottomNav, AppButton, AppChip, AppIcon, AppPopover, AppStack, AppStatusDot, AppTabs, AppText, AppTextField,
  AppTopBar, useLayoutMode,
} from '../base'
import { APP_TITLE, DATA_SOURCE, DECIDER, NAV_LABEL } from '../../config/constants.js'
import { chipProps } from '../../utils/chips.js'
import { initials } from '../../utils/format.js'

const LEGEND = [DECIDER.POLICY, DECIDER.LLM, DECIDER.HUMAN]

// Cabecera en una sola franja: título, pestañas (escritorio) y a la derecha estado y perfil. En móvil las secciones
// pasan a la navegación inferior. El estado de la API es un punto discreto y solo se vuelve chip si hay problema.
// El avatar abre el perfil: quién aprueba, leyenda de colores y atajos de teclado.
export default function TopBar({ pages, page, onPageChange, health, source, approver, onApproverChange, onShowShortcuts }) {
  const { stacked } = useLayoutMode()
  const [anchor, setAnchor] = useState(null)
  const apiUp = Boolean(health?.soc_api)
  return (
    <>
      <AppTopBar title={<AppText variant="title" as="h1" translate="no">{APP_TITLE}</AppText>}
                 nav={stacked ? null : <AppTabs items={pages} value={page} onChange={onPageChange} />}>
        {source === DATA_SOURCE.SAMPLE ? (
          <AppChip label="Datos de ejemplo" tone="warning" title="output/tickets.jsonl todavía no existe" />
        ) : null}
        {apiUp
          ? <AppStatusDot tone="success" label={`API conectada${health?.soc_api_url ? `: ${health.soc_api_url}` : ''}`} />
          : <AppChip label="API sin conexión" tone="error" title={health?.soc_api_url} />}
        <AppAvatar initials={initials(approver)} label={approver ? `Perfil: ${approver}` : 'Perfil: identifícate para aprobar'}
                   onClick={(e) => setAnchor(e.currentTarget)} />
      </AppTopBar>
      {stacked ? <AppBottomNav items={pages} value={page} onChange={onPageChange} label={NAV_LABEL} /> : null}
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
          {stacked ? null : (
            <AppStack direction="row">
              <AppButton variant="link" startIcon={<AppIcon name="keyboard" tone="inherit" />}
                         onClick={() => { setAnchor(null); onShowShortcuts() }}>Atajos de teclado ( ? )</AppButton>
            </AppStack>
          )}
        </AppStack>
      </AppPopover>
    </>
  )
}
