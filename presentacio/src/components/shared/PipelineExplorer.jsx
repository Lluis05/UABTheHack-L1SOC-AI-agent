import { useMemo, useState } from 'react'
import { ActorTag, Button, Mono } from '../base'
import { StageView } from './StageView'
import { usePipelinePlayer } from '../../hooks/usePipelinePlayer'
import { cumulativeMs, formatMs, groupTrace, totalMs } from '../../utils/trace'
import { ACTORS, FALLBACK_STAGE, PLAY_STAGE_MS, STAGES } from '../../config/constants'

function CaseTabs({ cases, selected, onSelect }) {
  return (
    <div className="cases" role="tablist" aria-label="Caso real">
      {cases.map(c => (
        <button key={c.key} type="button" role="tab" className="case-tab" aria-selected={c.key === selected}
          onClick={() => onSelect(c.key)}>
          <span className="case-tab__name">{c.label}</span>
          <span className="case-tab__kind">{c.kind}</span>
        </button>
      ))}
    </div>
  )
}

/** El recorrido: 7 nodos unidos por una línea que se va llenando, cada uno con el color de quién decide. */
function Track({ groups, current, onSelect }) {
  return (
    <ol className="track" aria-label="Etapas del pipeline">
      {STAGES.map((stage, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'pending'
        const steps = groups[stage.id]
        return (
          <li key={stage.id} className={`track__stage tint--${stage.actor}`} data-state={state}>
            <button type="button" className="track__node" aria-current={state === 'active' ? 'step' : undefined}
              aria-label={`${i + 1}. ${stage.title} (${ACTORS[stage.actor].label})`} onClick={() => onSelect(i)}>
              {i + 1}
            </button>
            <span className="track__name">{stage.title}</span>
            <span className="track__meta">
              {steps.length ? `${steps.length} · ${formatMs(totalMs(steps))}` : 'humano'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Legend() {
  return (
    <div className="legend" aria-label="Quién decide">
      {Object.keys(ACTORS).map(actor => <ActorTag key={actor} actor={actor} withHint />)}
    </div>
  )
}

/** El pipeline paso a paso sobre una ejecución real: qué hace cada etapa, qué consultó y qué decidió. */
export function PipelineExplorer({ cases }) {
  const [caseKey, setCaseKey] = useState(cases[0].key)
  const player = usePipelinePlayer(STAGES.length, PLAY_STAGE_MS)
  const data = cases.find(c => c.key === caseKey)
  const groups = useMemo(() => groupTrace(data.trace, STAGES, FALLBACK_STAGE), [data])
  const elapsed = useMemo(() => cumulativeMs(STAGES, groups), [groups])
  const stage = STAGES[player.current]

  const selectCase = key => {
    setCaseKey(key)
    player.select(0)
  }

  return (
    <div className="pipeline">
      <div className="pipeline__bar">
        <CaseTabs cases={cases} selected={caseKey} onSelect={selectCase} />
        <div className="pipeline__play">
          <span className="clock tabular" aria-live="off">
            {formatMs(elapsed[player.current])}
            <small> acumulado</small>
          </span>
          <Button variant="primary" onClick={player.playing ? player.stop : player.play}>
            {player.playing ? 'Parar' : 'Reproducir triaje'}
          </Button>
        </div>
      </div>

      <Track groups={groups} current={player.current} onSelect={player.select} />
      <Legend />

      {/* key: al cambiar de etapa o de caso se vuelve a montar y los elementos entran de nuevo */}
      <div className={`stage tint--${stage.actor}`} key={`${caseKey}-${stage.id}`}>
        <div className="stage__head">
          <h3 className="stage__title">{stage.title}</h3>
          <ActorTag actor={stage.actor} />
          <p className="stage__what">{stage.what}</p>
        </div>
        <div className="stage__body">
          <StageView stageId={stage.id} data={data} steps={groups[stage.id]} />
        </div>
        <div className="stage__nav">
          <Button variant="ghost" onClick={() => player.select(player.current - 1)} disabled={player.current === 0}>
            Anterior
          </Button>
          <span className="muted"><Mono>{data.alert_id}</Mono></span>
          <Button onClick={() => player.select(player.current + 1)} disabled={player.current === STAGES.length - 1}>
            Siguiente etapa
          </Button>
        </div>
      </div>
    </div>
  )
}
