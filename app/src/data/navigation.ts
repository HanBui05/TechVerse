import { Dumbbell, FileText, GraduationCap, House, Languages, MessageCircle, MessageSquareQuote, MessagesSquare, Settings, Sun } from 'lucide-react'

// `tone` picks a token colour for the menu icon (see `.nav-icon[data-tone]` in sidebar.css).
export const navItems = [
  { label: { vi: 'Trang chủ', en: 'Home' }, path: '/', icon: House, tone: 'blue' },
  { label: { vi: 'Bài viết', en: 'Articles' }, path: '/blogs', icon: FileText, tone: 'green' },
  { label: { vi: 'Khóa học', en: 'Courses' }, path: '/courses', icon: GraduationCap, tone: 'cyan' },
  { label: { vi: 'Luyện tập', en: 'Practice' }, path: '/practice', icon: Dumbbell, tone: 'amber' },
  { label: { vi: 'Ôn phỏng vấn', en: 'Interview prep' }, path: '/interview', icon: MessageSquareQuote, tone: 'purple' },
  { label: { vi: 'Hỏi đáp', en: 'Q&A' }, path: '/forum', icon: MessagesSquare, tone: 'sky' },
]

// Reader-only entry rendered right after `navItems` when signed in as a Reader account.
export const messagingNavItem = {
  label: { vi: 'Tin nhắn', en: 'Messages' },
  path: '/messages',
  icon: MessageCircle,
  tone: 'rose',
} as const

export const settingsItems = [
  { path: '/settings/theme', icon: Sun, key: 'appearance', tone: 'amber' },
  { path: '/settings/language', icon: Languages, key: 'language', tone: 'green' },
]

export { Settings }
