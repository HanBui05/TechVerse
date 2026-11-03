import { NavLink } from 'react-router-dom'
import { BookOpen, FileText, House, LayoutDashboard, Tag, UserCheck, Users } from 'lucide-react'
import type { Language } from '../../types/preferences'
import { StaffSettingsLinks } from './StaffSettingsLinks'
import { activeLink, SidebarAccount, SidebarFrame, toneText, useSidebarNav } from './Sidebar'
import type { UserProfile } from '../../services/profileService'
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

type Props = { language: Language; profile: UserProfile | null; onLogout: () => void; isModerator?: boolean }
const groups = [
  { label: { vi: 'Tổng quan', en: 'Overview' }, items: [
    { label: { vi: 'Trang chủ', en: 'Dashboard' }, path: '/admin', icon: LayoutDashboard, tone: 'cyan' },
    { label: { vi: 'Về trang người dùng', en: 'User website' }, path: '/', icon: House, tone: 'blue' },
  ] },
  { label: { vi: 'Người dùng', en: 'Users' }, items: [
    { label: { vi: 'Hồ sơ tác giả', en: 'Author applications' }, path: '/admin/author-applications', icon: UserCheck, tone: 'violet' },
    { label: { vi: 'Quản lý người dùng', en: 'Manage users' }, path: '/admin/users', icon: Users, tone: 'rose' },
  ] },
  { label: { vi: 'Nội dung', en: 'Content' }, items: [
    { label: { vi: 'Chủ đề', en: 'Topics' }, path: '/admin/topics', icon: BookOpen, tone: 'amber' },
    { label: { vi: 'Thẻ', en: 'Tags' }, path: '/admin/tags', icon: Tag, tone: 'green' },
  ] },
]

export function AdminSidebar({ language, profile, onLogout, isModerator = false }: Props) {
  const { close } = useSidebarNav()
  const review = language === 'vi' ? 'Kiểm duyệt bài viết' : 'Review articles'
  return <SidebarFrame mobileTitle="Admin management" toggleLabel="Toggle admin menu" closeLabel="Close admin menu" footer={<SidebarAccount profile={profile} onLogout={onLogout} logoutLabel={language === 'vi' ? 'Đăng xuất' : 'Log out'} />}>
    {isModerator && <SidebarGroup><SidebarMenu><SidebarMenuItem><SidebarMenuButton asChild tooltip={review} className={activeLink}><NavLink to="/moderator/articles" onClick={close}><FileText className={toneText.green} data-tone="green" /><span>{review}</span></NavLink></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarGroup>}
    {groups.map(group => <SidebarGroup key={group.label.en}>
      <SidebarGroupLabel className="uppercase tracking-[.05em]">{group.label[language]}</SidebarGroupLabel>
      <SidebarMenu>
        {group.items.map(({ label, path, icon: Icon, tone }) => <SidebarMenuItem key={path}><SidebarMenuButton asChild tooltip={label[language]} className={activeLink}><NavLink to={path} end={path === '/admin' || path === '/'} onClick={close}><Icon className={toneText[tone]} data-tone={tone} /><span>{label[language]}</span></NavLink></SidebarMenuButton></SidebarMenuItem>)}
      </SidebarMenu>
    </SidebarGroup>)}
    <StaffSettingsLinks language={language} />
  </SidebarFrame>
}
