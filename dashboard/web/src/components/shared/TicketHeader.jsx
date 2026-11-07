import { Fragment } from 'react'
import {
  AppAlert, AppButton, AppCard, AppChip, AppIcon, AppRing, AppStack, AppText, useLayoutMode,
} from '../base'
import { CHIP_KINDS, DETAIL_TITLE_ID } from '../../config/constants.js'
import { chipProps } from '../../utils/chips.js'
import { formatSeconds, toPercent } from '../../utils/format.js'

const DECIDED_FIELDS = [['verdict', 'Veredicto'], ['severity', 'Severidad'], ['actions', 'Acciones'], ['status', 'Estado']]

// Cabecera del ticket. Arriba: volver, ID y accesos. Después el título y una sola fila de chips (severidad, estado,
// veredicto): solo la severidad lleva color. Quién decidió cada campo va en una línea de texto pequeña, con el
// nombre en su color (Política / IA / Persona), para no competir con la severidad.
// onAsk: abre o cierra el chat con la IA sobre el ticket. chatOpen: si está abierto.
// Volver: en escritorio, «Volver a la cola» está bajo la búsqueda (TicketFilters); en móvil la ficha es otra pantalla
// y «← Cola» va delante, donde se espera el «atrás».
export default function TicketHeader({ ticket: t, onExpand, onAsk, chatOpen = false, onClose }) {
  const { stacked } = useLayoutMode()
  return (
    <AppCard>
      <AppStack gap={1.25}>
        {t.x_simulated ? <AppAlert tone="warning">Ticket simulado por el dashboard: no es un triaje real.</AppAlert> : null}
        <AppStack direction="row" gap={1} wrap>
          {stacked ? (
            <AppButton onClick={onClose} startIcon={<AppIcon name="back" tone="inherit" />} title="Volver a la cola (Esc)"
                       aria-label="Cerrar el detalle y volver a la cola">Cola</AppButton>
          ) : null}
          <AppText variant="mono" tone="muted">{t.ticket_id}</AppText>
          {t.x_incident_id ? <AppChip label={t.x_incident_id} variant="code" title="Incidente correlacionado" /> : null}
          <AppStack direction="row" gap={1} grow justify="flex-end" wrap>
            {onAsk ? (
              <AppButton variant={chatOpen ? 'primary' : 'link'} aria-pressed={chatOpen} onClick={onAsk} title="Atajo: i"
                         startIcon={<AppIcon name="chat" tone={chatOpen ? 'inherit' : 'llm'} />}>Preguntar a la IA</AppButton>
            ) : null}
            <AppButton variant="link" onClick={onExpand} title="Atajo: v">Ver todo</AppButton>
          </AppStack>
        </AppStack>
        <AppStack direction="row" gap={1.5} align="flex-start">
          <AppStack gap={0.75} grow>
            {/* tabIndex -1: recibe el foco al abrir el ticket (lectores de pantalla y teclado) */}
            <AppText variant="title" as="h2" id={DETAIL_TITLE_ID} tabIndex={-1} style={{ outline: 'none' }}>{t.title}</AppText>
            <AppStack direction="row" gap={0.75} wrap>
              <AppChip {...chipProps('severity', t.severity)} />
              <AppChip {...chipProps('status', t.x_status)} />
              <AppChip {...chipProps('verdict', t.verdict)} />
            </AppStack>
            <DecidedBy ticket={t} />
          </AppStack>
          {t.confidence != null ? <AppRing value={toPercent(t.confidence)} label="Confianza" tone="llm" /> : null}
        </AppStack>
      </AppStack>
    </AppCard>
  )
}

// «Veredicto: IA · Severidad: Política · … · claude_code · 34.8 s»
function DecidedBy({ ticket: t }) {
  const decided = t.x_decided_by || {}
  const parts = DECIDED_FIELDS.filter(([key]) => decided[key]).map(([key, label]) => {
    const { label: who, title } = chipProps('decider', decided[key])
    return (
      <Fragment key={key}>
        {label}: <AppText as="span" variant="caption" fontWeight={600} tone={CHIP_KINDS.decider[decided[key]]?.[1]} title={title}>{who}</AppText>
      </Fragment>
    )
  })
  if (t.x_llm_provider) parts.push(<span key="provider" title="Modelo que analizó el ticket" translate="no">{t.x_llm_provider}</span>)
  if (t.triage_seconds != null) parts.push(<span key="time" title="Tiempo de triaje">{formatSeconds(t.triage_seconds)}</span>)
  if (!parts.length) return null
  return (
    <AppText variant="caption" tone="muted" as="div">
      {parts.map((p, i) => <Fragment key={p.key}>{i ? ' · ' : ''}{p}</Fragment>)}
    </AppText>
  )
}
