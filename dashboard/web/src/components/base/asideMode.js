import { createContext } from 'react'

// Cómo se muestra la tercera columna de AppSplit: como columna fija o dentro de un cajón superpuesto.
// AppSidePanel lo lee para adaptar su marco y su alto.
export const ASIDE_MODE = { COLUMN: 'column', DRAWER: 'drawer' }
export const AsideModeContext = createContext(ASIDE_MODE.COLUMN)
