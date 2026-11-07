import Avatar from '@mui/material/Avatar'
import ButtonBase from '@mui/material/ButtonBase'

const AVATAR_SIZE = 34

// Avatar circular clicable (perfil). Sin iniciales muestra "?" para invitar a identificarse.
export default function AppAvatar({ initials, label, onClick }) {
  return (
    <ButtonBase onClick={onClick} aria-label={label} title={label}
                sx={{ borderRadius: '50%', '&:focus-visible': { outline: 2, outlineStyle: 'solid', outlineColor: 'primary.main', outlineOffset: 2 } }}>
      <Avatar sx={{
        width: AVATAR_SIZE, height: AVATAR_SIZE, fontSize: 13, fontWeight: 700,
        bgcolor: initials ? 'human.main' : 'surface.main', color: initials ? 'human.contrastText' : 'text.secondary',
      }}>
        {initials || '?'}
      </Avatar>
    </ButtonBase>
  )
}
