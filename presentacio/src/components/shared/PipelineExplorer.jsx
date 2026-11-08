import { useMemo, useState } from 'react'
import { ActorTag, Button, Mono, Panel } from '../base'
import { TraceLog } from './TraceLog'
import { StageEvidence } from './StageEvidence'
import { useTraceReplay } from '../../hooks/useTraceReplay'
import { groupTrace, totalMs, formatMs } from '../../utils/trace'
import { FALLBACK_STAGE, STAGES } from '../../config/constants'

function CaseTabs({ cases, selected, onSelect }) {
  return (
    <div className="cases" role="tablist" aria-label="Caso real">
      {cases.map(c => (
        <button
          key={c.key}
          type="button"
          role="tab"
          className="case-tab"
          aria-selected={c.key === selected}
          onClick={() => onSelect(c.key)}
        >
          <span>{c.label}</span>
          <span className="case-tab__kind">{c.kind} · <Mono>{c.alert_id}</Mono></span>
        </button>
      ))}
    </div>
  )
}

function Rail({ groups, current, onSelect }) {
  return (
    <ol className="rail" aria-label="Etapas del pipeline">
      {STAGES.map((stage, i) => {
        const steps = groups[stage.id]
        return (
          <li key={stage.id}>
            <button
              type="button"
              className={`rail__step tint--${stage.actor}`}
              aria-current={i === current ? 'step' : undefined}
              data-state={i < current ? 'done' : undefined}
              onClick={() => onSelect(i)}
            >
              <span className="rail__n">{i + 1}</span>
              <span className="rail__name">{stage.title}</span>
              <span className="rail__time">{steps.length ? formatMs(totalMs(steps)) : 'humano'}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** El pipeline paso a paso sobre una ejecución real: qué hace cada etapa, qué consultó y qué decidió. */
export function PipelineExplorer({ cases }) {
  const [caseKey, setCaseKey] = useState(cases[0].key)
  const [current, setCurrent] = useState(0)
  const data = cases.find(c => c.key === caseKey)
  const groups = useMemo(() => groupTrace(data.trace, STAGES, FALLBACK_STAGE), [data])
  const stage = STAGES[current]
  const steps = groups[stage.id]
  const replay = useTraceReplay(steps, `${caseKey}-${stage.id}`)

  const selectCase = key => {
    setCaseKey(key)
    setCurrent(0)
  }

  return (
    <>
      <CaseTabs cases={cases} selected={caseKey} onSelect={selectCase} />
      <Rail groups={groups} current={current} onSelect={setCurrent} />
      <div className="stage">
        <div>
          <div className="stage__head">
            <h3 className="stage__title">{current + 1}. {stage.title}</h3>
            <ActorTag actor={stage.actor} withHint />
          </div>
          <p className="stage__what">{stage.what}</p>
          <span className="stage__module">{stage.module}</span>
          <div className="stage__controls">
            <Button onClick={() => setCurrent(i => i - 1)} disabled={current === 0}>Etapa anterior</Button>
            <Button variant="primary" onClick={() => setCurrent(i => i + 1)} disabled={current === STAGES.length - 1}>
              Siguiente etapa
            </Button>
            {steps.length > 1 ? (
              <Button variant="ghost" onClick={replay.playing ? replay.stop : replay.play}>
                {replay.playing ? 'Parar' : 'Reproducir consultas'}
              </Button>
            ) : null}
          </div>
          <p className="muted">
            Triaje completo de este caso: <span className="tabular">{data.ticket.triage_seconds} s</span>, en directo y sin caché.
          </p>
        </div>
        <div>
          {steps.length ? (
            <Panel title={`Consultas reales de esta etapa (${steps.length})`}>
              <TraceLog steps={steps} visible={replay.visible} />
            </Panel>
          ) : null}
          <StageEvidence stageId={stage.id} data={data} />
        </div>
      </div>
    </>
  )
}
