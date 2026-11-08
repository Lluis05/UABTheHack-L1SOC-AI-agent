import { MotionConfig } from 'motion/react'
import { SlideNav } from './components/shared/SlideNav'
import { useSlideNav } from './hooks/useSlideNav'
import { SLIDES } from './pages/slides'

export default function App() {
  const { index, goTo, next, prev } = useSlideNav(SLIDES.length)
  const { id, Component } = SLIDES[index]
  return (
    // reducedMotion="user": las animaciones de React Bits respetan «reducir movimiento» del sistema
    <MotionConfig reducedMotion="user">
      <main className="deck">
        <Component key={id} />
      </main>
      <SlideNav slides={SLIDES} index={index} onGo={goTo} onPrev={prev} onNext={next} />
    </MotionConfig>
  )
}
