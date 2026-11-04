import { NavLink } from 'react-router-dom'
import { FileText, LayoutDashboard, UserRound } from 'lucide-react'
import { StaffSettingsLinks } from './StaffSettingsLinks'
import { activeLink, SidebarAccount, SidebarFrame, useSidebarNav } from './Sidebar'
import type { Language } from '../../types/preferences'
import type { UserProfile } from '../../services/profileService'
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

type Props = { language: Language; profile: UserProfile | null; onLogout: () => void }
export function ModeratorSidebar({ language, profile, onLogout }: Props) {
  const vi = language === 'vi'
  const { iconOnly, close } = useSidebarNav()
  const links = [
    { path: '/moderator', end: true, icon: LayoutDashboard, label: vi ? 'Tổng quan' : 'Overview' },
    { path: '/moderator/articles', end: false, icon: FileText, label: vi ? 'Kiểm duyệt bài viết' : 'Review articles' },
    { path: '/profile', end: false, icon: UserRound, label: vi ? 'Thông tin cá nhân' : 'Profile' },
  ]
  return <SidebarFrame mobileTitle={vi ? 'Kiểm duyệt' : 'Moderation'} toggleLabel={iconOnly ? 'Expand menu' : 'Collapse menu'} closeLabel="Close menu" footer={<SidebarAccount profile={profile} onLogout={onLogout} logoutLabel={vi ? 'Đăng xuất' : 'Log out'} />}>
    <SidebarGroup>
      <SidebarGroupLabel className="uppercase tracking-[.05em]">{vi ? 'KIỂM DUYỆT' : 'MODERATION'}</SidebarGroupLabel>
      <SidebarMenu>
        {links.map(({ path, end, icon: Icon, label }) => <SidebarMenuItem key={path}><SidebarMenuButton asChild tooltip={label} className={activeLink}><NavLink to={path} end={end} onClick={close}><Icon /><span>{label}</span></NavLink></SidebarMenuButton></SidebarMenuItem>)}
      </SidebarMenu>
    </SidebarGroup>
    <StaffSettingsLinks language={language} />
  </SidebarFrame>
}
