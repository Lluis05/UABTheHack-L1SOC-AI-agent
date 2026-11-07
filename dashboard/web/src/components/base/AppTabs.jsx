import Badge from '@mui/material/Badge'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'

// items: [{value, label, badge?}]
export default function AppTabs({ items, value, onChange }) {
  return (
    <Tabs value={value} onChange={(_, v) => onChange(v)} variant="scrollable" allowScrollButtonsMobile>
      {items.map((it) => (
        <Tab
          key={it.value}
          value={it.value}
          label={it.badge ? <Badge color="warning" badgeContent={it.badge} sx={{ pr: 1.5 }}>{it.label}</Badge> : it.label}
        />
      ))}
    </Tabs>
  )
}
