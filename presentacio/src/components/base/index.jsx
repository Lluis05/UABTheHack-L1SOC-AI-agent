// Componentes base: las piezas mínimas con nuestros estilos. Las pantallas y los compuestos usan solo estos.
import { ACTORS } from '../../config/constants'

export function Slide({ title, kicker, lead, align = 'top', titleAs: Title = 'h2', children }) {
  return (
    <section className={`slide${align === 'center' ? ' slide--center' : ''}`} aria-label={title}>
      {kicker ? <p className="slide__kicker">{kicker}</p> : null}
      {title ? <Title className="slide__title">{title}</Title> : null}
      {lead ? <p className="slide__lead">{lead}</p> : null}
      {children}
    </section>
  )
}

export function ActorTag({ actor, withHint = false }) {
  const info = ACTORS[actor]
  return (
    <span className={`actor actor--${actor}`}>
      {info.label}
      {withHint ? <span className="actor__hint">· {info.hint}</span> : null}
    </span>
  )
}

export function Severity({ level }) {
  return <span className={`sev sev--${level}`} translate="no">{level}</span>
}

/** Identificadores, IOCs y rutas: van en mono y no se traducen. */
export function Mono({ children }) {
  return <span className="mono" translate="no">{children}</span>
}

export function Button({ variant = 'default', href, children, ...props }) {
  const className = `btn${variant === 'default' ? '' : ` btn--${variant}`}`
  if (href) return <a className={className} href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>
  return <button type="button" className={className} {...props}>{children}</button>
}

export function Panel({ title, tint, children }) {
  return (
    <div className={`panel${tint ? ` tint--${tint}` : ''}`}>
      {title ? <h4 className="panel__title">{title}</h4> : null}
      {children}
    </div>
  )
}

export function KeyValue({ rows }) {
  return (
    <dl className="kv">
      {rows.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => (
        <div key={key} className="kv__row">
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
