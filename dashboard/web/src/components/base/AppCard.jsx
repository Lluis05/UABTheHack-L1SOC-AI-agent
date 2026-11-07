import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'

// emphasis (explícita): normal | attention (algo espera a una persona)
const EMPHASIS = { normal: undefined, attention: 'warning.main' }

export default function AppCard({ title, action, emphasis = 'normal', children }) {
  return (
    <Card sx={{ borderColor: EMPHASIS[emphasis] }}>
      {title && (
        <CardHeader
          title={title}
          action={action}
          titleTypographyProps={{ variant: 'h2', component: 'h2' }}
          sx={{ pb: 0, '& .MuiCardHeader-action': { alignSelf: 'center', m: 0 } }}
        />
      )}
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>{children}</CardContent>
    </Card>
  )
}
