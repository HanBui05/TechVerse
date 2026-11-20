import { Dumbbell, FileText, GraduationCap, House, Languages, MessageSquareQuote, Settings, Sun } from 'lucide-react'

// `tone` picks a token colour for the menu icon (see `.nav-icon[data-tone]` in sidebar.css).
export const navItems = [
  { label: { vi: 'Trang chủ', en: 'Home' }, path: '/', icon: House, tone: 'blue' },
  { label: { vi: 'Bài viết', en: 'Articles' }, path: '/blogs', icon: FileText, tone: 'green' },
  { label: { vi: 'Khóa học', en: 'Courses' }, path: '/courses', icon: GraduationCap, tone: 'cyan' },
  { label: { vi: 'Luyện tập', en: 'Practice' }, path: '/practice', icon: Dumbbell, tone: 'amber' },
  { label: { vi: 'Ôn phỏng vấn', en: 'Interview prep' }, path: '/interview', icon: MessageSquareQuote, tone: 'purple' },
]

export const settingsItems = [
  { path: '/settings/theme', icon: Sun, key: 'appearance', tone: 'amber' },
  { path: '/settings/language', icon: Languages, key: 'language', tone: 'green' },
]

export { Settings }
