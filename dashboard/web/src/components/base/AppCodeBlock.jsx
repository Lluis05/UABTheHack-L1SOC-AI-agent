import Box from '@mui/material/Box'

// Texto preformateado (logs). Se pinta como texto, nunca como HTML: puede contener datos del atacante.
export default function AppCodeBlock({ children }) {
  return (
    <Box
      component="pre"
      sx={(t) => ({
        ...t.typography.mono, m: 0, p: 1, bgcolor: 'background.default', borderRadius: 1,
        overflow: 'auto', maxHeight: t.layout.logMaxHeight,
      })}
    >
      {children}
    </Box>
  )
}
