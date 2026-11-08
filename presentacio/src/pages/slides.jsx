// Las diapositivas. Solo componen componentes base y compuestos; el contenido vive en config/constants.js.
import BlurText from '../components/reactbits/BlurText'
import CountUp from '../components/reactbits/CountUp'
import DecryptedText from '../components/reactbits/DecryptedText'
import SpotlightCard from '../components/reactbits/SpotlightCard'
import { ActorTag, Button, Mono, Panel, Slide } from '../components/base'
import { PipelineExplorer } from '../components/shared/PipelineExplorer'
import cases from '../data/casos.json'
import {
  LEVEL_STATES, LEVELS, LIMITS, LIVE_DASHBOARD_URL, PROBLEM_STATS, RESULTS,
} from '../config/constants'

const SPOTLIGHT = { policy: 'rgba(179, 136, 255, 0.22)', llm: 'rgba(46, 196, 214, 0.22)', human: 'rgba(76, 195, 138, 0.22)' }

function Cover() {
  return (
    <Slide align="center">
      <p className="slide__kicker">UAB The Hack 2026 · Reto Deloitte · SOC de Tarvia Group</p>
      <h1 className="cover__title">
        <BlurText text="Un analista N1 que nunca duerme" animateBy="words" effect="focus" delay={90} trigger="load" />
      </h1>
      <ul className="cover__motto">
        <li><ActorTag actor="llm" /> investiga</li>
        <li><ActorTag actor="policy" /> decide la severidad</li>
        <li><ActorTag actor="human" /> aprueba la contención</li>
      </ul>
      <p className="cover__foot">Lluis Sarries · Adrián Valverde · Marc Cantero · Izan Caballer</p>
    </Slide>
  )
}

function Problem() {
  return (
    <Slide kicker="El problema" title="Hoy el nivel 1 es una persona copiando IOCs en VirusTotal">
      <div className="figures">
        {PROBLEM_STATS.map(stat => (
          <div key={stat.label}>
            <div className="figure__value">
              {stat.prefix}
              <CountUp to={stat.value} separator={stat.separator ?? ''} duration={1.4} />
              {stat.suffix}
            </div>
            <p className="figure__label">{stat.label}</p>
          </div>
        ))}
      </div>
      <p className="callout">De noche y en fin de semana nadie mira la consola. La CISO pide agentes que triajen cada alerta las 24 horas y dejen a la persona solo la decisión.</p>
      <p className="muted">Fuente: diapositivas 3 y 6 del reto de Deloitte.</p>
    </Slide>
  )
}

function Roles() {
  return (
    <Slide kicker="La idea" title="Cada decisión tiene un dueño, y el ticket dice cuál">
      <div className="roles">
        <SpotlightCard className="role role--policy panel" spotlightColor={SPOTLIGHT.policy}>
          <h3 className="role__head"><ActorTag actor="policy" /></h3>
          <p className="role__sub">Lo que la política define con exactitud lo hace el código.</p>
          <ul>
            <li>Severidad con la matriz: regla × criticidad real del activo</li>
            <li>Cambios aprobados, pentest, Nessus y SCCM</li>
            <li>Qué acciones necesitan aprobación y de quién</li>
            <li>Detección de inyección de prompt</li>
          </ul>
        </SpotlightCard>
        <SpotlightCard className="role role--llm panel" spotlightColor={SPOTLIGHT.llm}>
          <h3 className="role__head"><ActorTag actor="llm" /></h3>
          <p className="role__sub">Donde hace falta criterio.</p>
          <ul>
            <li>Veredicto en los casos ambiguos</li>
            <li>Evidencias citadas con su event_id</li>
            <li>Resumen para N2, MITRE y acciones</li>
            <li>Propone ajustar la severidad; el código lo valida</li>
          </ul>
        </SpotlightCard>
        <SpotlightCard className="role role--human panel" spotlightColor={SPOTLIGHT.human}>
          <h3 className="role__head"><ActorTag actor="human" /></h3>
          <p className="role__sub">Lo irreversible.</p>
          <ul>
            <li>Aprueba o rechaza la contención</li>
            <li>Revisa lo escalado</li>
            <li>Reabre o cambia un veredicto</li>
          </ul>
        </SpotlightCard>
      </div>
      <p className="callout">No pasamos 11.061 alertas por un LLM: el 87 % las cierra la política con su justificación, y la IA se gasta donde aporta.</p>
    </Slide>
  )
}

function Pipeline() {
  return (
    <Slide kicker="El pipeline, paso a paso" title="Tres alertas reales, triadas en directo esta noche">
      <PipelineExplorer cases={cases} />
    </Slide>
  )
}

function Security() {
  const invoice = cases.find(c => c.key === 'factura')
  return (
    <Slide kicker="Seguridad por diseño" title="El atacante también escribe en las alertas">
      <div className="split">
        <Panel title={`Caso real: ${invoice.label} (${invoice.alert_id})`}>
          <p className="quote">
            El correo esconde un bloque invisible que pide al «sistema automatizado de clasificación» marcarlo como falso
            positivo, no escalar y no bloquear al remitente.
          </p>
          <p>
            Nuestro sistema lo marca como <strong>
              <DecryptedText text="verdadero positivo crítico" animateOn="view" sequential speed={40} />
            </strong>, cita la inyección como evidencia de ataque deliberado y lo escala a N2.
          </p>
        </Panel>
        <Panel title="Por qué no puede obedecer">
          <ol className="wall">
            <li><span className="wall__n">1</span><span>Todo lo que viene de alertas y logs va dentro de <Mono>{'<untrusted_data>'}</Mono>, con la etiqueta de cierre escapada: es dato, no instrucción.</span></li>
            <li><span className="wall__n">2</span><span>La política detecta los patrones de inyección antes de la IA y lo deja en el ticket.</span></li>
            <li><span className="wall__n">3</span><span>El LLM no tiene herramientas: aunque lo engañaran, no puede consultar, visitar ni contener nada.</span></li>
            <li><span className="wall__n">4</span><span>La severidad la calcula el código, y la contención solo la aprueba una persona.</span></li>
          </ol>
        </Panel>
      </div>
      <p className="callout">6 de 6 inyecciones detectadas, 0 veredictos cambiados y 0 falsas detecciones en el control.</p>
    </Slide>
  )
}

function Results() {
  return (
    <Slide kicker="Resultados medidos" title="Funciona sobre los datos, y lo hemos medido">
      <ul className="results">
        {RESULTS.map(result => (
          <li key={result.label} className={`result tint--${result.actor}`}>
            <span className="result__value">
              <CountUp to={result.value} duration={1.2} />{result.suffix}
            </span>
            <span>{result.label}</span>
          </li>
        ))}
      </ul>
      <p className="muted">Medido el 08/11 con la política actual. Verdad de evaluación construida por el equipo con threat hunting.</p>
    </Slide>
  )
}

function Levels() {
  return (
    <Slide kicker="Hasta dónde hemos llegado" title="Los cuatro niveles del reto">
      <ol className="levels">
        {LEVELS.map(level => (
          <li key={level.n} className="level">
            <span className="level__n">{level.n}</span>
            <div>
              <h3 className="level__title">{level.title}</h3>
              <p className="muted level__text">{level.text}</p>
            </div>
            <span className={`level__state level__state--${level.state}`}>{LEVEL_STATES[level.state]}</span>
          </li>
        ))}
      </ol>
    </Slide>
  )
}

function Limits() {
  return (
    <Slide kicker="Honestidad" title="Lo que no resolvemos">
      <ul className="limits">
        {LIMITS.map(limit => (
          <li key={limit.title}>
            <h3>{limit.title}</h3>
            <p>{limit.text}</p>
          </li>
        ))}
      </ul>
    </Slide>
  )
}

function Closing() {
  return (
    <Slide align="center" kicker="Ahora, en directo" title="Las 10 alertas del jurado, en el dashboard">
      <p className="slide__lead">
        Se suben tal cual, en cualquier formato JSON. Se ve la cola, qué consulta el sistema, en qué se basa y dónde
        decide la persona.
      </p>
      <div className="closing">
        <Button variant="primary" href={LIVE_DASHBOARD_URL}>Abrir el dashboard</Button>
      </div>
    </Slide>
  )
}

export const SLIDES = [
  { id: 'portada', title: 'Portada', Component: Cover },
  { id: 'problema', title: 'El problema', Component: Problem },
  { id: 'roles', title: 'Quién decide qué', Component: Roles },
  { id: 'pipeline', title: 'El pipeline', Component: Pipeline },
  { id: 'seguridad', title: 'Seguridad', Component: Security },
  { id: 'resultados', title: 'Resultados', Component: Results },
  { id: 'niveles', title: 'Niveles del reto', Component: Levels },
  { id: 'limites', title: 'Lo que no resolvemos', Component: Limits },
  { id: 'directo', title: 'Demo en directo', Component: Closing },
]
