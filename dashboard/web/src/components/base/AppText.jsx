import Typography from '@mui/material/Typography'

// variant (explícita, sin booleanos): title | heading | body | strong | caption | mono | metric
// tone: muted | error | success | primary | warning. as: elemento HTML (p. ej. "span" para texto en línea).
const VARIANTS = {
  title: 'h1', heading: 'h2', body: 'body2', strong: 'strong', caption: 'caption', mono: 'mono', metric: 'metric',
}
const TONES = {
  muted: 'text.secondary', error: 'error.main', success: 'success.main', primary: 'primary.main', warning: 'warning.main',
}
// Los identificadores no se traducen (web-design-guidelines: translate="no" en tokens de código)
const NO_TRANSLATE = new Set(['mono'])

export default function AppText({ variant = 'body', tone, as, children, ...rest }) {
  return (
    <Typography
      variant={VARIANTS[variant]}
      color={TONES[tone]}
      component={as}
      translate={NO_TRANSLATE.has(variant) ? 'no' : undefined}
      {...rest}
    >
      {children}
    </Typography>
  )
}
