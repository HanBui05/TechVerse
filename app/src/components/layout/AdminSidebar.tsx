import { NavLink } from 'react-router-dom'
import { BookOpen, FileText, KeyRound, LayoutDashboard, UserCheck, Users } from 'lucide-react'
import type { Language } from '../../types/preferences'
import { StaffSettingsLinks } from './StaffSettingsLinks'
import { activeLink, SidebarAccount, SidebarFrame, useSidebarNav } from './Sidebar'
import type { UserProfile } from '../../services/profileService'
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

type Props = { language: Language; profile: UserProfile | null; onLogout: () => void; isModerator?: boolean }
const groups = [
  { label: { vi: 'Tổng quan', en: 'Overview' }, items: [
    { label: { vi: 'Trang chủ', en: 'Dashboard' }, path: '/admin', icon: LayoutDashboard },
    { label: { vi: 'Về trang người dùng', en: 'User website' }, path: '/', icon: Users },
  ] },
  { label: { vi: 'Người dùng & học viên', en: 'Users & learners' }, items: [
    { label: { vi: 'Hồ sơ tác giả', en: 'Author applications' }, path: '/admin/author-applications', icon: UserCheck },
    { label: { vi: 'Quản lý người dùng', en: 'Manage users' }, path: '/admin/users', icon: UserCheck },
  ] },
  { label: { vi: 'Bài giảng & học tập', en: 'Lessons & learning' }, items: [
    { label: { vi: 'Chủ đề', en: 'Topics' }, path: '/admin/topics', icon: BookOpen },
    { label: { vi: 'Thẻ', en: 'Tags' }, path: '/admin/tags', icon: KeyRound },
  ] },
]

export function AdminSidebar({ language, profile, onLogout, isModerator = false }: Props) {
  const { close } = useSidebarNav()
  const review = language === 'vi' ? 'Kiểm duyệt bài viết' : 'Review articles'
  return <SidebarFrame mobileTitle="Admin management" toggleLabel="Toggle admin menu" closeLabel="Close admin menu" footer={<SidebarAccount profile={profile} onLogout={onLogout} logoutLabel={language === 'vi' ? 'Đăng xuất' : 'Log out'} />}>
    {isModerator && <SidebarGroup><SidebarMenu><SidebarMenuItem><SidebarMenuButton asChild tooltip={review} className={activeLink}><NavLink to="/moderator/articles" onClick={close}><FileText /><span>{review}</span></NavLink></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarGroup>}
    {groups.map(group => <SidebarGroup key={group.label.en}>
      <SidebarGroupLabel className="uppercase tracking-[.05em]">{group.label[language]}</SidebarGroupLabel>
      <SidebarMenu>
        {group.items.map(({ label, path, icon: Icon }) => <SidebarMenuItem key={path}><SidebarMenuButton asChild tooltip={label[language]} className={activeLink}><NavLink to={path} end={path === '/admin' || path === '/'} onClick={close}><Icon /><span>{label[language]}</span></NavLink></SidebarMenuButton></SidebarMenuItem>)}
      </SidebarMenu>
    </SidebarGroup>)}
    <StaffSettingsLinks language={language} onNavigate={close} />
  </SidebarFrame>
}
