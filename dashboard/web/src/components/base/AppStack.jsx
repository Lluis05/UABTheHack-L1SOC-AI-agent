import Stack from '@mui/material/Stack'

// Disposición en fila o columna con separación del tema (gap en unidades del tema).
// direction: column | row. wrap: las filas pueden partirse. grow: ocupa el espacio sobrante.
export default function AppStack({ direction = 'column', gap = 1, wrap = false, align, justify, grow = false, children }) {
  const row = direction === 'row'
  return (
    <Stack
      direction={direction}
      spacing={gap}
      useFlexGap
      flexWrap={wrap ? 'wrap' : 'nowrap'}
      alignItems={align ?? (row ? 'center' : 'stretch')}
      justifyContent={justify}
      flexGrow={grow ? 1 : undefined}
      minWidth={0}
    >
      {children}
    </Stack>
  )
}
