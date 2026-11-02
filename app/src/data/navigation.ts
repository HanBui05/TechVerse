import { FileText, House, Languages, Settings, Sun } from 'lucide-react'

// `tone` picks a token colour for the menu icon (see `.nav-icon[data-tone]` in sidebar.css).
export const navItems = [
  { label: { vi: 'Trang chủ', en: 'Home' }, path: '/', icon: House, tone: 'blue' },
  { label: { vi: 'Bài viết', en: 'Articles' }, path: '/blogs', icon: FileText, tone: 'green' },
]

export const settingsItems = [
  { path: '/settings/theme', icon: Sun, key: 'appearance', tone: 'amber' },
  { path: '/settings/language', icon: Languages, key: 'language', tone: 'green' },
]

export { Settings }
