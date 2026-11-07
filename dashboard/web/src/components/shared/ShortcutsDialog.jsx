import { AppButton, AppChip, AppDialog, AppStack, AppText } from '../base'
import { SHORTCUTS } from '../../config/constants.js'

// Ayuda de atajos de teclado (se abre con «?» o desde el perfil)
export default function ShortcutsDialog({ open, onClose }) {
  return (
    <AppDialog open={open} onClose={onClose} title="Atajos de teclado" actions={<AppButton onClick={onClose}>Cerrar</AppButton>}>
      <AppStack gap={1}>
        {SHORTCUTS.map((s) => (
          <AppStack key={s.label} direction="row" gap={1.5}>
            <AppStack direction="row" gap={0.5}>
              {s.keys.map((k) => <AppChip key={k} label={k} variant="code" />)}
            </AppStack>
            <AppText>{s.label}</AppText>
          </AppStack>
        ))}
        <AppText variant="caption" tone="muted">No funcionan mientras escribes en un campo o con un diálogo abierto.</AppText>
      </AppStack>
    </AppDialog>
  )
}
