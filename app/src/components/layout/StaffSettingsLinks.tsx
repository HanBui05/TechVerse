import { Languages, Palette } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import type { Language } from '../../types/preferences'
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { activeLink } from './Sidebar'

// Giữ cài đặt chung luôn có thể truy cập từ cả workspace Admin và Moderator.
export function StaffSettingsLinks({ language, onNavigate }: { language: Language; onNavigate: () => void }) {
  const vi = language === 'vi'
  const links = [
    { path: '/settings/theme', label: vi ? 'Giao diện' : 'Appearance', icon: Palette },
    { path: '/settings/language', label: vi ? 'Ngôn ngữ' : 'Language', icon: Languages },
  ]
  return <SidebarGroup className="mt-auto">
    <SidebarGroupLabel className="uppercase tracking-[.05em]">{vi ? 'Cài đặt' : 'Settings'}</SidebarGroupLabel>
    <SidebarMenu>
      {links.map(({ path, label, icon: Icon }) => <SidebarMenuItem key={path}><SidebarMenuButton asChild tooltip={label} className={activeLink}><NavLink to={path} aria-label={label} onClick={onNavigate}><Icon aria-hidden="true" /><span>{label}</span></NavLink></SidebarMenuButton></SidebarMenuItem>)}
    </SidebarMenu>
  </SidebarGroup>
}
