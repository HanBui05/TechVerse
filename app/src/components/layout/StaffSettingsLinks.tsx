import { Languages, Palette } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import type { Language } from '../../types/preferences'

// Giữ cài đặt chung luôn có thể truy cập từ cả workspace Admin và Moderator.
export function StaffSettingsLinks({ language, onNavigate }: { language: Language; onNavigate: () => void }) {
  const vi = language === 'vi'
  const links = [
    { path: '/settings/theme', label: vi ? 'Giao diện' : 'Appearance', icon: Palette },
    { path: '/settings/language', label: vi ? 'Ngôn ngữ' : 'Language', icon: Languages },
  ]
  return <div className="staff-settings"><span className="staff-settings-title">{vi ? 'Cài đặt' : 'Settings'}</span>
    {links.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} title={label} aria-label={label} onClick={onNavigate} className={({ isActive }) => `staff-settings-link ${isActive ? 'is-active' : ''}`}><Icon size={17} aria-hidden="true" /><span>{label}</span></NavLink>)}
  </div>
}
