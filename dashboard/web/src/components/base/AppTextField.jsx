import TextField from '@mui/material/TextField'

// onChange recibe el valor, no el evento. rows > 0: multilínea. width: ancho fijo.
// variant (explícita): text | code (JSON, IDs: monoespaciada y sin corrector)
// Siempre con label visible (web-design-guidelines: los controles de formulario necesitan etiqueta).
const VARIANTS = {
  text: {},
  code: { spellCheck: false, translate: 'no', InputProps: { sx: (t) => t.typography.mono } },
}

export default function AppTextField({ value, onChange, label, name, rows, variant = 'text', width, ...rest }) {
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
      {...rest}
    />
  )
}
