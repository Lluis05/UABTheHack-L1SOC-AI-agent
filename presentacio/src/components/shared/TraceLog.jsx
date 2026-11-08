import { formatMs } from '../../utils/trace'
import { TRACE_HIT_PATTERN } from '../../config/constants'

/** Las consultas reales que hizo el sistema en esta etapa: fuente, qué preguntó, qué obtuvo y cuánto tardó. */
export function TraceLog({ steps, visible = steps.length, emptyText = 'Esta etapa no consulta nada.' }) {
  if (steps.length === 0) return <p className="trace__empty">{emptyText}</p>
  return (
    <ol className="trace" aria-live="polite">
      {steps.slice(0, visible).map((step, i) => (
        <li
          key={`${step.step}-${i}`}
          className={`trace__row${TRACE_HIT_PATTERN.test(step.result ?? '') ? ' trace__row--hit' : ''}`}
        >
          <span className="trace__source">{step.source}</span>
          <span className="trace__body">
            {step.result}
            <br />
            <span className="trace__query" translate="no">{step.query}</span>
          </span>
          <span className="trace__ms">{formatMs(step.ms)}</span>
        </li>
      ))}
    </ol>
  )
}
