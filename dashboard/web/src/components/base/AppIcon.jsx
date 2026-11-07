import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined'
import BoltOutlined from '@mui/icons-material/BoltOutlined'
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline'
import CloseRounded from '@mui/icons-material/CloseRounded'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import FilterListRounded from '@mui/icons-material/FilterListRounded'
import GavelOutlined from '@mui/icons-material/GavelOutlined'
import GppMaybeOutlined from '@mui/icons-material/GppMaybeOutlined'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import HubOutlined from '@mui/icons-material/HubOutlined'
import ManageSearchRounded from '@mui/icons-material/ManageSearchRounded'
import OpenInFullRounded from '@mui/icons-material/OpenInFullRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded'

// Catálogo cerrado de iconos: el resto de la app los pide por nombre y nunca importa @mui/icons-material.
const ICONS = {
  actions: BoltOutlined,
  chat: ChatBubbleOutline,
  close: CloseRounded,
  escalation: TrendingUpRounded,
  evidence: ManageSearchRounded,
  expand: OpenInFullRounded,
  filter: FilterListRounded,
  mitre: AccountTreeOutlined,
  people: GroupsOutlined,
  rules: GavelOutlined,
  search: SearchRounded,
  severity: GppMaybeOutlined,
  summary: DescriptionOutlined,
  trace: HubOutlined,
}

const SIZES = { small: 18, medium: 22 }
const TONES = { muted: 'text.secondary', primary: 'primary.main', inherit: 'inherit' }

// size: small | medium. tone: muted | primary | inherit (el color del botón) | cualquier clave de la paleta (policy, llm...)
export default function AppIcon({ name, size = 'small', tone = 'muted' }) {
  const Icon = ICONS[name]
  return <Icon aria-hidden="true" sx={{ fontSize: SIZES[size], color: TONES[tone] ?? `${tone}.main`, flexShrink: 0 }} />
}
