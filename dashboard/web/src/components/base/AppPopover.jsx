import Popover from '@mui/material/Popover'

const POPOVER_WIDTH = 300

// Panel flotante anclado a un elemento. Abierto mientras anchor no sea nulo.
export default function AppPopover({ anchor, onClose, children }) {
  return (
    <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={onClose}
             anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
             slotProps={{ paper: { variant: 'outlined', sx: { p: 2, mt: 1, width: POPOVER_WIDTH } } }}>
      {children}
    </Popover>
  )
}
