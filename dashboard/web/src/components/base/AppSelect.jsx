import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'

// options: [{value, label}]. emptyLabel: texto de la opción "sin filtro" (valor ''). label siempre visible.
// width: ancho fijo; sin él ocupa todo el ancho.
export default function AppSelect({ value, onChange, options, label, emptyLabel, width }) {
  return (
    <TextField
      select
      fullWidth={!width}
      sx={width ? { width } : undefined}
      value={value}
      label={label}
      onChange={(e) => onChange(e.target.value)}
      SelectProps={{ displayEmpty: Boolean(emptyLabel) }}
      InputLabelProps={emptyLabel ? { shrink: true } : undefined}
    >
      {emptyLabel && <MenuItem value="">{emptyLabel}</MenuItem>}
      {options.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
    </TextField>
  )
}
