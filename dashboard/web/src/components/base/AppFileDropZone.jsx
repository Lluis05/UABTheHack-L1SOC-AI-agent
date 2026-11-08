import { useState } from 'react'
import Box from '@mui/material/Box'
import AppFileButton from './AppFileButton.jsx'
import AppIcon from './AppIcon.jsx'
import AppText from './AppText.jsx'

// Zona para soltar un fichero (arrastrar y soltar) con el botón «Elegir fichero» dentro.
// Devuelve el texto del fichero igual que AppFileButton: onText(texto, nombre). status: línea bajo el botón.
export default function AppFileDropZone({ label, buttonLabel, accept, onText, status }) {
  const [over, setOver] = useState(false)

  function allowDrop(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setOver(true)
  }
  async function drop(e) {
    e.preventDefault()
    setOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onText(await file.text(), file.name)
  }

  return (
    <Box
      onDragEnter={allowDrop} onDragOver={allowDrop} onDragLeave={() => setOver(false)} onDrop={drop}
      sx={(t) => ({
        height: t.layout.dropZoneHeight, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 1, p: 2, textAlign: 'center', borderRadius: 1,
        border: '1px dashed', borderColor: over ? 'primary.main' : 'divider',
        bgcolor: over ? t.palette.surface.selected : 'transparent',
        transition: t.transitions.create(['border-color', 'background-color'], { duration: t.transitions.duration.shortest }),
      })}
    >
      <AppIcon name="upload" size="medium" tone={over ? 'primary' : 'muted'} />
      <AppText tone="muted">{label}</AppText>
      <AppFileButton label={buttonLabel} accept={accept} onText={onText} />
      {status ? <AppText tone="muted" role="status">{status}</AppText> : null}
    </Box>
  )
}
