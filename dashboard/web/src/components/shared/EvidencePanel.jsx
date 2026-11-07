import { AppCard, AppChip, AppStack, AppTable, AppText } from '../base'
import { chipProps } from '../../utils/chips.js'

const EVIDENCE_COLUMNS = [
  { key: 'source', label: 'Fuente' },
  { key: 'event_id', label: 'event_id', mono: true },
  { key: 'finding', label: 'Hallazgo' },
]
const ENRICHMENT_COLUMNS = [
  { key: 'indicator', label: 'Indicador', mono: true },
  { key: 'type', label: 'Tipo' },
  { key: 'source', label: 'Fuente' },
  { key: 'result', label: 'Resultado' },
]

// "En qué se basa": reglas de política aplicadas, evidencias con event_id y enriquecimiento.
export default function EvidencePanel({ policyHits = [], evidence = [], enrichment = [] }) {
  return (
    <AppCard title="En qué se basa">
      <AppStack gap={2}>
        <AppStack gap={0.75}>
          <AppText variant="strong">Reglas de la política aplicadas</AppText>
          {policyHits.length === 0 ? <AppText tone="muted">No aplica ninguna regla de la política.</AppText> : null}
          {policyHits.map((h) => (
            <AppStack key={`${h.rule}-${h.reference}`} direction="row" gap={1} wrap>
              <AppChip label={h.rule} variant="code" tone="policy" />
              <AppChip {...chipProps('policyEffect', h.effect)} />
              <AppText>{h.detail}</AppText>
              {h.reference ? <AppChip label={h.reference} variant="code" /> : null}
            </AppStack>
          ))}
        </AppStack>
        <AppStack gap={0.5}>
          <AppText variant="strong">Evidencias</AppText>
          {evidence.length > 0
            ? <AppTable columns={EVIDENCE_COLUMNS} rows={evidence} />
            : <AppText tone="muted">El ticket no cita evidencias.</AppText>}
        </AppStack>
        {enrichment.length > 0 ? (
          <AppStack gap={0.5}>
            <AppText variant="strong">Enriquecimiento</AppText>
            <AppTable columns={ENRICHMENT_COLUMNS} rows={enrichment} />
          </AppStack>
        ) : null}
      </AppStack>
    </AppCard>
  )
}
