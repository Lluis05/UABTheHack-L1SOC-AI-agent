import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import AppIcon from './AppIcon.jsx'

// onChange recibe el valor, no el evento. rows > 0: multilínea. width: ancho fijo. icon: icono al final (p. ej. search).
// variant (explícita): text | code (JSON, IDs: monoespaciada y sin corrector)
// Siempre con label visible (web-design-guidelines: los controles de formulario necesitan etiqueta).
const VARIANTS = {
  text: {},
  code: { spellCheck: false, translate: 'no', InputProps: { sx: (t) => t.typography.mono } },
}

export default function AppTextField({ value, onChange, label, name, rows, variant = 'text', width, icon, ...rest }) {
  const end = icon ? { endAdornment: <InputAdornment position="end"><AppIcon name={icon} /></InputAdornment> } : {}
  return (
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      label={label}
      name={name}
      multiline={Boolean(rows)}
      minRows={rows}
      fullWidth={!width}
      sx={width ? { width } : undefined}
      {...VARIANTS[variant]}
      InputProps={{ ...VARIANTS[variant].InputProps, ...end }}
      {...rest}
    />
  )
}
