import Button from '@mui/material/Button'

// Botón que abre el selector de ficheros y devuelve el texto del fichero elegido.
export default function AppFileButton({ label, accept, onText }) {
  async function handle(e) {
    const file = e.target.files?.[0]
    if (file) onText(await file.text(), file.name)
  }
  return (
    <Button variant="outlined" color="inherit" component="label">
      {label}
      <input hidden type="file" accept={accept} onChange={handle} />
    </Button>
  )
}
