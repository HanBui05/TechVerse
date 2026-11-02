import { FileText, House, Languages, Settings, Sun } from 'lucide-react'

export const navItems = [
  { label: { vi: 'Trang chủ', en: 'Home' }, path: '/', icon: House },
  { label: { vi: 'Bài viết', en: 'Articles' }, path: '/blogs', icon: FileText },
]

export const settingsItems = [
  { path: '/settings/theme', icon: Sun, key: 'appearance' },
  { path: '/settings/language', icon: Languages, key: 'language' },
]

export { Settings }
