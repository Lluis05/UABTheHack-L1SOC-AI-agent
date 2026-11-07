import Alert from '@mui/material/Alert'

// tone: error | warning | info | success. Los errores se anuncian al momento a los lectores de pantalla
// (role=alert); el resto, sin interrumpir (role=status, que implica aria-live polite).
export default function AppAlert({ tone = 'info', children }) {
  return (
    <Alert severity={tone} variant="outlined" role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </Alert>
  )
}
