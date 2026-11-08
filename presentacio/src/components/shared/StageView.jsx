// Lo que produce cada etapa con el caso real elegido, en formato visual (chips, ecuaciones, diagramas).
import { Chip, Mono, Severity } from '../base'
import { HIT_TONE, INTEL_SKIP, INTEL_STATUS, SEVERITIES, VERDICTS } from '../../config/constants'
import {
  contextBySource, entityChips, indicatorVerdicts, severityShift, shortIndicator, splitActions,
} from '../../utils/trace'

const STATUS_TONE = { malicious: 'bad', suspicious: 'warn', unknown: 'neutral', info: 'neutral' }
const VERDICT_TONE = { true_positive: 'bad', false_positive: 'good', benign_true_positive: 'good', needs_more_info: 'warn' }
const statusLabel = id => INTEL_STATUS.find(status => status.id === id).label

function Entrada({ data }) {
  const { alert } = data
  return (
    <div className="view">
      <div className="alertcard reveal">
        <div className="alertcard__top">
          <Mono>{alert.rule_id}</Mono>
          <Severity level={alert.severity} />
          <span className="muted">{alert.source_product} · {alert.created_at?.slice(0, 16).replace('T', ' ')} UTC</span>
        </div>
        <div className="alertcard__name">{alert.rule_name}</div>
        <div className="chips">
          {entityChips(alert.entities).map(chip => (
            <Chip key={chip.value} label={chip.type} mono title={chip.value}>{shortIndicator(chip.value)}</Chip>
          ))}
        </div>
      </div>
      <p className="view__caption reveal">La severidad de la regla no es la final: la decide la política.</p>
    </div>
  )
}

function Contexto({ steps }) {
  const tiles = contextBySource(steps)
  return (
    <div className="tiles">
      {tiles.map(tile => (
        <div className="tile reveal" key={tile.source}>
          <span className="tile__source">{tile.source}</span>
          <span className="tile__count">{tile.queries}<small>{tile.queries === 1 ? ' consulta' : ' consultas'}</small></span>
          {tile.findings.slice(0, 2).map(finding => <span className="tile__finding" key={finding}>{finding}</span>)}
        </div>
      ))}
    </div>
  )
}

function Inteligencia({ steps }) {
  const verdicts = indicatorVerdicts(steps, INTEL_STATUS, INTEL_SKIP)
  if (verdicts.length === 0) {
    return <p className="view__empty reveal">La alerta no tiene indicadores externos: no hay nada que consultar fuera.</p>
  }
  return (
    <ul className="intel">
      {verdicts.map(v => (
        <li className="intel__row reveal" key={v.indicator}>
          <Chip tone={STATUS_TONE[v.status]}>{statusLabel(v.status)}</Chip>
          <Mono title={v.indicator}>{shortIndicator(v.indicator, 34)}</Mono>
          {/* El hallazgo que explica el estado (el peor), con su fuente */}
          <span className="intel__sources">
            {(v.findings.find(f => f.status === v.status) ?? v.findings[0]).result}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Politica({ data }) {
  const sev = data.policy_severity
  return (
    <div className="view">
      <div className="equation reveal">
        <span className="eq__box"><small>regla</small><Severity level={sev.rule_severity} size="lg" /></span>
        <span className="eq__op">×</span>
        <span className="eq__box"><small>activo {sev.criticality_source}</small><strong>{sev.max_criticality}</strong></span>
        <span className="eq__op">=</span>
        <span className="eq__box eq__box--result"><small>política</small><Severity level={sev.final} size="lg" /></span>
      </div>
      <div className="chips reveal">
        {data.policy_hits.slice(0, 6).map((hit, i) => (
          <Chip key={`${hit.rule}-${i}`} tone={HIT_TONE[hit.effect] ?? 'neutral'} title={hit.detail} mono>{hit.rule}</Chip>
        ))}
      </div>
      <p className="view__caption reveal">
        {sev.suggestion?.decisive
          ? 'Explicación inequívoca: en modo normal el ticket sale aquí, sin gastar IA.'
          : 'No es concluyente: lo decide la IA.'}
      </p>
    </div>
  )
}

function Ia({ data }) {
  const { ticket } = data
  const review = ticket.x_review ?? {}
  const shift = severityShift(SEVERITIES, data.policy_severity.final, ticket.severity)
  const confidence = Math.round((ticket.confidence ?? 0) * 100)
  return (
    <div className="view">
      <div className={`verdict verdict--${VERDICT_TONE[ticket.verdict] ?? 'neutral'} reveal`}>
        <span className="verdict__label">{VERDICTS[ticket.verdict] ?? ticket.verdict}</span>
        <span className="meter" aria-label={`confianza ${confidence} %`}>
          {/* El ancho es un dato (la confianza), no estilo: va como variable CSS */}
          <span className="meter__fill" style={{ '--value': `${confidence}%` }} />
          <span className="meter__text tabular">{confidence} %</span>
        </span>
      </div>
      <div className="sevchange reveal">
        <Severity level={data.policy_severity.final} />
        {shift !== 0 ? (
          <>
            <span className="eq__op">→</span>
            <Severity level={ticket.severity} />
            <span className="muted">la IA propone {shift > 0 ? `+${shift}` : shift} y el código lo valida</span>
          </>
        ) : <span className="muted">la IA mantiene la severidad de la política</span>}
      </div>
      <div className="chips reveal">
        {ticket.evidence.slice(0, 6).map(ev => (
          <Chip key={ev.event_id} tone="llm" title={ev.finding} mono>{ev.event_id}</Chip>
        ))}
      </div>
      {ticket.x_injection?.detected ? (
        <p className="banner banner--bad reveal">Inyección de prompt detectada en el correo: no se obedece y cuenta como prueba de ataque.</p>
      ) : null}
      {review.agrees !== undefined ? (
        <p className="view__caption reveal">
          Revisor crítico {review.agrees ? 'de acuerdo' : 'en desacuerdo'}: {review.evidence_checked} evidencias comprobadas, {review.evidence_removed?.length ?? 0} eliminadas.
        </p>
      ) : null}
    </div>
  )
}

function Correlacion({ data }) {
  const id = data.ticket.x_incident_id
  return (
    <div className="graph reveal">
      <span className="graph__node"><Mono>{data.alert_id}</Mono></span>
      <span className={`graph__edge${id ? '' : ' graph__edge--none'}`} />
      {id
        ? <span className="graph__node graph__node--incident"><Mono>{id}</Mono><small>otras fases del mismo ataque</small></span>
        : <span className="graph__node graph__node--none">ticket suelto<small>no comparte entidades con otro ataque</small></span>}
    </div>
  )
}

function Persona({ data }) {
  const { ticket } = data
  const { needsApproval, direct } = splitActions(ticket.recommended_actions)
  return (
    <div className="view">
      <div className="lanes">
        <div className="lane lane--human reveal">
          <span className="lane__title">Necesita aprobación humana</span>
          {needsApproval.length ? needsApproval.map((a, i) => (
            <div className="lane__item" key={`${a.action}-${i}`}>
              <Mono>{a.action}</Mono> <span className="muted">{shortIndicator(a.target)}</span>
              <span className="lane__who">{a.x_approvers.join(' + ')}</span>
            </div>
          )) : <span className="muted">Nada</span>}
        </div>
        <div className="lane reveal">
          <span className="lane__title">El N1 puede hacerlo ya</span>
          {direct.slice(0, 3).map((a, i) => (
            <div className="lane__item" key={`${a.action}-${i}`}>
              <Mono>{a.action}</Mono> <span className="muted">{shortIndicator(a.target)}</span>
            </div>
          ))}
        </div>
      </div>
      <ol className="flow reveal">
        <li>Aprueba en el dashboard</li>
        <li><Mono>POST /approvals</Mono></li>
        <li><Mono>approval_token</Mono></li>
        <li><Mono>POST /containment</Mono></li>
      </ol>
      <p className="view__caption reveal">
        {ticket.escalation?.escalate ? `Escalado a ${ticket.escalation.to}.` : 'Se cierra con su justificación; una persona puede reabrirlo.'}
      </p>
    </div>
  )
}

const VIEWS = {
  entrada: Entrada, contexto: Contexto, inteligencia: Inteligencia, politica: Politica,
  ia: Ia, correlacion: Correlacion, persona: Persona,
}

export function StageView({ stageId, data, steps }) {
  const View = VIEWS[stageId]
  return View ? <View data={data} steps={steps} /> : null
}
