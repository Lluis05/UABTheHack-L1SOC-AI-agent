import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'

// Carga: filas con la forma del contenido que viene (la página no salta cuando llegan los datos)
export default function AppSkeletonRows({ rows = 8, height = 38, label = 'Cargando' }) {
  return (
    <Stack spacing={0.75} aria-busy="true" aria-label={label} role="status">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} variant="rounded" height={height} animation="wave" />)}
    </Stack>
  )
}
