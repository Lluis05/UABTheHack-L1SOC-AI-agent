import { Button } from '../base'

/** Barra inferior: anterior, un punto por diapositiva, siguiente. También se navega con el teclado. */
export function SlideNav({ slides, index, onGo, onPrev, onNext }) {
  return (
    <nav className="nav" aria-label="Diapositivas">
      <Button variant="ghost" onClick={onPrev} disabled={index === 0} aria-label="Diapositiva anterior">Anterior</Button>
      <span className="nav__title">{slides[index].title}</span>
      <div className="nav__dots">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            className="nav__dot"
            aria-label={`${i + 1}. ${slide.title}`}
            aria-current={i === index ? 'step' : undefined}
            onClick={() => onGo(i)}
          />
        ))}
      </div>
      <span className="nav__count tabular">{index + 1}/{slides.length}</span>
      <Button onClick={onNext} disabled={index === slides.length - 1} aria-label="Diapositiva siguiente">Siguiente</Button>
    </nav>
  )
}
