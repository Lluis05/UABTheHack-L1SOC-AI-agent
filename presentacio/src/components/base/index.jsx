// Componentes base: las piezas mínimas con nuestros estilos. Las pantallas y los compuestos usan solo estos.
import { useState } from 'react'
import { ACTORS } from '../../config/constants'

export function Slide({ title, kicker, align = 'top', variant, children }) {
  const classes = ['slide', align === 'center' ? 'slide--center' : '', variant ? `slide--${variant}` : '']
  return (
    <section className={classes.filter(Boolean).join(' ')} aria-label={title}>
      {kicker ? <p className="slide__kicker">{kicker}</p> : null}
      {title ? <h2 className="slide__title">{title}</h2> : null}
      {children}
    </section>
  )
}

export function ActorTag({ actor, withHint = false }) {
  const info = ACTORS[actor]
  return (
    <span className={`actor actor--${actor}`}>
      {info.label}
      {withHint ? <span className="actor__hint">{info.hint}</span> : null}
    </span>
  )
}

export function Severity({ level, size }) {
  return <span className={`sev sev--${level}${size ? ` sev--${size}` : ''}`} translate="no">{level}</span>
}

/** Identificadores, IOCs y rutas: van en mono y no se traducen. */
export function Mono({ children, title }) {
  return <span className="mono" translate="no" title={title}>{children}</span>
}

/** Etiqueta compacta. `tone`: neutral, good, warn, bad o un actor (policy, llm, human). */
export function Chip({ tone = 'neutral', label, title, mono = false, children }) {
  return (
    <span className={`chip chip--${tone}`} title={title}>
      {label ? <span className="chip__label">{label}</span> : null}
      {mono ? <Mono>{children}</Mono> : children}
    </span>
  )
}

export function Button({ variant = 'default', href, children, ...props }) {
  const className = `btn${variant === 'default' ? '' : ` btn--${variant}`}`
  if (href) return <a className={className} href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>
  return <button type="button" className={className} {...props}>{children}</button>
}

/** Vídeo local junto a index.html. Si el fichero no está (no se versiona), enlaza a la copia en la nube. */
export function Video({ src, title, fallbackHref }) {
  const [missing, setMissing] = useState(false)
  if (missing) {
    return (
      <div className="video video--missing">
        <p>No está el fichero <Mono>{src}</Mono> junto a la presentación.</p>
        <Button variant="primary" href={fallbackHref}>Ver el vídeo</Button>
      </div>
    )
  }
  return (
    <video className="video" src={src} title={title} controls playsInline preload="metadata"
      onError={() => setMissing(true)} />
  )
}
