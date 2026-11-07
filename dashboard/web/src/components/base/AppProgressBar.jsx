import LinearProgress from '@mui/material/LinearProgress'

// value 0-100. label: lo que mide, para lectores de pantalla.
export default function AppProgressBar({ value, label, tone = 'primary' }) {
  return (
    <LinearProgress variant="determinate" value={value} color={tone} aria-label={label}
                    sx={{ height: 6, borderRadius: 3, minWidth: 80 }} />
  )
}
