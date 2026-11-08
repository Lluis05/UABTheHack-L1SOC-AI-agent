// Lo que produce cada etapa con el caso real elegido. Un componente por etapa; StageEvidence elige cuál.
import { KeyValue, Mono, Panel, Severity } from '../base'
import { SEVERITIES, VERDICTS } from '../../config/constants'
import { severityShift, splitActions } from '../../utils/trace'

function entityList(entities = {}) {
  const hosts = (entities.hosts ?? []).map(h => [h.hostname, h.ip].filter(Boolean).join(' · '))
  const users = (entities.users ?? []).map(u => u.upn ?? u.display_name)
  const files = (entities.files ?? []).map(f => f.name)
  return [...users, ...hosts, ...files, ...(entities.ips ?? []), ...(entities.domains ?? [])]
}

function AlertInput({ data }) {
  const { alert } = data
  return (
    <Panel title="Alerta que llega del SIEM">
      <KeyValue rows={[
        ['Regla', <><Mono>{alert.rule_id}</Mono> {alert.rule_name}</>],
        ['Producto', alert.source_product],
        ['Severidad de la regla', <Severity level={alert.severity} />],
        ['MITRE', alert.mitre ? <><Mono>{alert.mitre.technique_id}</Mono> {alert.mitre.technique}</> : null],
        ['Qué dice', alert.description],
        ['Entidades', <Mono>{entityList(alert.entities).join(' · ')}</Mono>],
      ]}
      />
    </Panel>
  )
}

function PolicyDecision({ data }) {
  const sev = data.policy_severity
  const suggestion = sev.suggestion ?? {}
  return (
    <>
      <Panel title="Matriz de severidad (política del SOC, §2)" tint="policy">
        <div className="math">
          <span className="math__box"><small>regla</small><Severity level={sev.rule_severity} /></span>
          <span className="math__op">×</span>
          <span className="math__box"><small>criticidad de {sev.criticality_source}</small>{sev.max_criticality}</span>
          <span className="math__op">=</span>
          <span className="math__box"><small>la política dice</small><Severity level={sev.final} /></span>
        </div>
      </Panel>
      <Panel title={`Reglas aplicadas (${data.policy_hits.length})`} tint="policy">
        <ul className="list">
          {data.policy_hits.slice(0, 5).map((hit, i) => (
            <li key={`${hit.rule}-${i}`}><Mono>{hit.rule}</Mono> · {hit.detail}</li>
          ))}
        </ul>
      </Panel>
      <p className="note tint--policy">
        {suggestion.decisive
          ? `La política tiene una explicación inequívoca (${VERDICTS[suggestion.verdict] ?? suggestion.verdict}). En modo normal el ticket sale aquí, sin gastar IA; en directo, la IA lo razona igualmente.`
          : 'La política no es concluyente: el caso pasa a la IA.'}
      </p>
    </>
  )
}

function AiVerdict({ data }) {
  const { ticket } = data
  const review = ticket.x_review ?? {}
  const shift = severityShift(SEVERITIES, data.policy_severity.final, ticket.severity)
  return (
    <>
      <Panel title="Veredicto de la IA" tint="llm">
        <div className="verdict">
          <span className="verdict__label">{VERDICTS[ticket.verdict] ?? ticket.verdict}</span>
          <span className="muted tabular">confianza {Math.round((ticket.confidence ?? 0) * 100)} %</span>
          <Severity level={ticket.severity} />
        </div>
        <p>{ticket.summary}</p>
      </Panel>
      <Panel title="Evidencias citadas (event_id reales, comprobados por el revisor)" tint="llm">
        <ul className="list">
          {ticket.evidence.slice(0, 4).map(ev => (
            <li key={ev.event_id}><Mono>{ev.event_id}</Mono> · {ev.finding}</li>
          ))}
        </ul>
      </Panel>
      {ticket.x_injection?.detected ? (
        <p className="note note--alert">
          <strong>Inyección detectada y no obedecida.</strong> {ticket.x_injection.notes}
        </p>
      ) : null}
      {shift !== 0 ? (
        <p className="note tint--policy">
          La IA propuso {shift > 0 ? 'subir' : 'bajar'} la severidad y el código lo validó: {ticket.severity_rationale}
        </p>
      ) : null}
      {review.agrees !== undefined ? (
        <p className="note tint--llm">
          Revisor crítico: {review.agrees ? 'de acuerdo' : 'en desacuerdo'} · {review.evidence_checked} evidencias comprobadas, {review.evidence_removed?.length ?? 0} eliminadas.
        </p>
      ) : null}
    </>
  )
}

function Correlation({ data }) {
  const id = data.ticket.x_incident_id
  return (
    <p className="note tint--policy">
      {id
        ? <>La alerta se une al incidente <Mono>{id}</Mono>: otras alertas comparten sus entidades en días cercanos.</>
        : 'No comparte entidades con otras alertas abiertas: queda como ticket suelto.'}
    </p>
  )
}

function HumanDecision({ data }) {
  const { ticket } = data
  const { needsApproval, direct } = splitActions(ticket.recommended_actions)
  return (
    <>
      <Panel title="Lo que la IA propone y quién debe aprobarlo" tint="human">
        {[...needsApproval, ...direct].slice(0, 5).map((action, i) => (
          <div className="action" key={`${action.action}-${i}`}>
            <span><span className="action__name">{action.action}</span> <Mono>{action.target}</Mono></span>
            <span className={`action__who actor actor--${action.requires_approval ? 'human' : 'data'}`}>
              {action.requires_approval ? `Aprueba: ${action.x_approvers.join(' + ')}` : 'Lo puede hacer el N1'}
            </span>
            <span className="action__why">{action.justification}</span>
          </div>
        ))}
      </Panel>
      <Panel title="Contención en la API simulada" tint="human">
        <ol className="flow">
          <li>La persona aprueba en el dashboard</li>
          <li><Mono>POST /approvals</Mono></li>
          <li><Mono>approval_token</Mono></li>
          <li><Mono>POST /containment</Mono></li>
          <li>Registro</li>
        </ol>
      </Panel>
      <p className="note tint--human">
        {ticket.escalation?.escalate
          ? <>Escalado a {ticket.escalation.to}.</>
          : 'No se escala: el ticket se cierra con su justificación, y una persona puede reabrirlo desde el dashboard.'}
      </p>
    </>
  )
}

const BY_STAGE = {
  entrada: AlertInput,
  politica: PolicyDecision,
  ia: AiVerdict,
  correlacion: Correlation,
  persona: HumanDecision,
}

export function StageEvidence({ stageId, data }) {
  const Component = BY_STAGE[stageId]
  return Component ? <Component data={data} /> : null
}
