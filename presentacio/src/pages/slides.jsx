// Las diapositivas (3 minutos). Solo componen componentes base y compuestos; el contenido vive en config/.
import { ActorTag, Button, Slide, Video } from '../components/base'
import { PipelineExplorer } from '../components/shared/PipelineExplorer'
import cases from '../data/casos.json'
import { DEMO_VIDEO, LEVEL_STATES, LEVELS, LIMITS, LIVE_DASHBOARD_URL, PROBLEM_LINE, RESULTS } from '../config/constants'

function Demo() {
  return (
    <Slide variant="video" title="Demo">
      <Video src={DEMO_VIDEO.src} title={DEMO_VIDEO.title} fallbackHref={DEMO_VIDEO.driveUrl} />
    </Slide>
  )
}

function Cover() {
  return (
    <Slide align="center" variant="cover" title="Tarvia · analista N1 con IA">
      <ul className="motto">
        <li><ActorTag actor="llm" /> investiga</li>
        <li><ActorTag actor="policy" /> decide la severidad</li>
        <li><ActorTag actor="human" /> aprueba la contención</li>
      </ul>
      <p className="cover__problem">{PROBLEM_LINE}</p>
      <p className="cover__team">Lluis Sarries · Adrián Valverde · Marc Cantero · Izan Caballer</p>
    </Slide>
  )
}

function Pipeline() {
  return (
    <Slide variant="pipeline" title="Así tría una alerta">
      <PipelineExplorer cases={cases} />
    </Slide>
  )
}

function Results() {
  return (
    <Slide title="Medido sobre los datos">
      <ul className="results">
        {RESULTS.map(result => (
          <li key={result.label} className={`result tint--${result.actor}`}>
            <span className="result__value tabular">{result.value}</span>
            <span className="result__label">{result.label}</span>
          </li>
        ))}
      </ul>
      <ol className="levels" aria-label="Niveles del reto">
        {LEVELS.map(level => (
          <li key={level.n} className={`level level--${level.state}`}>
            <span className="level__n">{level.n}</span>
            <span>{level.title}</span>
            <span className="level__state">{LEVEL_STATES[level.state]}</span>
          </li>
        ))}
      </ol>
    </Slide>
  )
}

function Closing() {
  return (
    <Slide title="Limitaciones">
      <ul className="limits">
        {LIMITS.map(limit => <li key={limit}>{limit}</li>)}
      </ul>
      <div className="closing">
        <Button variant="primary" href={LIVE_DASHBOARD_URL}>Demo en directo</Button>
      </div>
    </Slide>
  )
}

export const SLIDES = [
  { id: 'demo', title: 'Vídeo de la demo', Component: Demo },
  { id: 'portada', title: 'Portada', Component: Cover },
  { id: 'pipeline', title: 'El pipeline', Component: Pipeline },
  { id: 'resultados', title: 'Resultados', Component: Results },
  { id: 'cierre', title: 'Limitaciones', Component: Closing },
]
