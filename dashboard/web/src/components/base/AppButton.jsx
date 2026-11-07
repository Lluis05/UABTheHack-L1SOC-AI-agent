import Button from '@mui/material/Button'

// variant: primary (acción principal) | secondary | link
const VARIANTS = {
  primary: { variant: 'contained', color: 'primary' },
  secondary: { variant: 'outlined', color: 'inherit' },
  link: { variant: 'text', color: 'primary' },
}

export default function AppButton({ variant = 'secondary', children, ...rest }) {
  return <Button {...VARIANTS[variant]} {...rest}>{children}</Button>
}
