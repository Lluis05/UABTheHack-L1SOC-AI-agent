import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import BoltOutlined from '@mui/icons-material/BoltOutlined'
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline'
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import CrisisAlertOutlined from '@mui/icons-material/CrisisAlertOutlined'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import DoNotDisturbOnOutlined from '@mui/icons-material/DoNotDisturbOnOutlined'
import DoneRounded from '@mui/icons-material/DoneRounded'
import FileUploadOutlined from '@mui/icons-material/FileUploadOutlined'
import FilterAltOffOutlined from '@mui/icons-material/FilterAltOffOutlined'
import FilterListRounded from '@mui/icons-material/FilterListRounded'
import GavelOutlined from '@mui/icons-material/GavelOutlined'
import GppBadOutlined from '@mui/icons-material/GppBadOutlined'
import GppMaybeOutlined from '@mui/icons-material/GppMaybeOutlined'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded'
import HourglassEmptyRounded from '@mui/icons-material/HourglassEmptyRounded'
import HubOutlined from '@mui/icons-material/HubOutlined'
import InboxOutlined from '@mui/icons-material/InboxOutlined'
import KeyboardOutlined from '@mui/icons-material/KeyboardOutlined'
import ManageSearchRounded from '@mui/icons-material/ManageSearchRounded'
import OpenInFullRounded from '@mui/icons-material/OpenInFullRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import ShieldOutlined from '@mui/icons-material/ShieldOutlined'
import TaskAltRounded from '@mui/icons-material/TaskAltRounded'
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded'
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined'

// Catálogo cerrado de iconos: el resto de la app los pide por nombre y nunca importa @mui/icons-material.
const ICONS = {
  actions: BoltOutlined,
  authorized: VerifiedUserOutlined,
  back: ArrowBackRounded,
  chat: ChatBubbleOutline,
  chevronLeft: ChevronLeftRounded,
  chevronRight: ChevronRightRounded,
  close: CloseRounded,
  closedTicket: TaskAltRounded,
  containment: ShieldOutlined,
  dismiss: DoNotDisturbOnOutlined,
  done: DoneRounded,
  escalation: TrendingUpRounded,
  evidence: ManageSearchRounded,
  expand: OpenInFullRounded,
  filter: FilterListRounded,
  filterOff: FilterAltOffOutlined,
  help: HelpOutlineRounded,
  incidents: CrisisAlertOutlined,
  keyboard: KeyboardOutlined,
  mitre: AccountTreeOutlined,
  pending: HourglassEmptyRounded,
  people: GroupsOutlined,
  queue: InboxOutlined,
  rules: GavelOutlined,
  search: SearchRounded,
  severity: GppMaybeOutlined,
  summary: DescriptionOutlined,
  threat: GppBadOutlined,
  trace: HubOutlined,
  upload: FileUploadOutlined,
}

const SIZES = { small: 18, medium: 22 }
const TONES = { muted: 'text.secondary', primary: 'primary.main', inherit: 'inherit' }

// size: small | medium. tone: muted | primary | inherit (el color del botón) | cualquier clave de la paleta (policy, llm...)
export default function AppIcon({ name, size = 'small', tone = 'muted' }) {
  const Icon = ICONS[name]
  return <Icon aria-hidden="true" sx={{ fontSize: SIZES[size], color: TONES[tone] ?? `${tone}.main`, flexShrink: 0 }} />
}
