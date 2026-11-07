import Stack from '@mui/material/Stack'

// Disposición en fila o columna con separación del tema (gap en unidades del tema).
// direction: column | row. wrap: las filas pueden partirse. grow: ocupa el espacio sobrante (y deja que sus hijos hagan scroll propio).
// basis: ancho base antes de crecer (con wrap, por debajo de él el bloque baja a la línea siguiente)
export default function AppStack({ direction = 'column', gap = 1, wrap = false, align, justify, grow = false, basis, children }) {
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
      flexBasis={basis}
      minWidth={0}
      minHeight={grow ? 0 : undefined}
    >
      {children}
    </Stack>
  )
}
