import { NavLink } from 'react-router-dom'
import { BookOpen, FileText, ListChecks, LayoutDashboard, MessageSquareQuote, MessagesSquare, ShieldAlert, UserRound } from 'lucide-react'
import { StaffSettingsLinks } from './StaffSettingsLinks'
import { activeLink, SidebarAccount, SidebarFrame, toneText, useSidebarNav } from './Sidebar'
import type { Language } from '../../types/preferences'
import type { UserProfile } from '../../services/profileService'
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

type Props = { language: Language; profile: UserProfile | null; onLogout: () => void }
export function ModeratorSidebar({ language, profile, onLogout }: Props) {
  const vi = language === 'vi'
  const { iconOnly, close } = useSidebarNav()
  const links = [
    { path: '/moderator', end: true, icon: LayoutDashboard, tone: 'cyan', label: vi ? 'Tổng quan' : 'Overview' },
    { path: '/moderator/articles', end: false, icon: FileText, tone: 'green', label: vi ? 'Kiểm duyệt bài viết' : 'Review articles' },
    { path: '/moderator/courses', end: false, icon: BookOpen, tone: 'blue', label: vi ? 'Kiểm duyệt khóa học' : 'Review courses' },
    { path: '/moderator/exercises', end: false, icon: ListChecks, tone: 'violet', label: vi ? 'Kiểm duyệt bài tập' : 'Review exercises' },
    { path: '/moderator/interview-questions', end: false, icon: MessageSquareQuote, tone: 'sky', label: vi ? 'Câu hỏi phỏng vấn' : 'Interview questions' },
    { path: '/moderator/reports', end: false, icon: ShieldAlert, tone: 'rose', label: vi ? 'Báo cáo vi phạm' : 'Reports' },
    { path: '/forum', end: false, icon: MessagesSquare, tone: 'cyan', label: vi ? 'Hỏi đáp' : 'Q&A' },
    { path: '/profile', end: false, icon: UserRound, tone: 'amber', label: vi ? 'Thông tin cá nhân' : 'Profile' },
  ]
  return <SidebarFrame mobileTitle={vi ? 'Kiểm duyệt' : 'Moderation'} toggleLabel={iconOnly ? 'Expand menu' : 'Collapse menu'} closeLabel="Close menu" footer={<SidebarAccount profile={profile} onLogout={onLogout} logoutLabel={vi ? 'Đăng xuất' : 'Log out'} />}>
    <SidebarGroup>
      <SidebarGroupLabel className="uppercase tracking-[.05em]">{vi ? 'KIỂM DUYỆT' : 'MODERATION'}</SidebarGroupLabel>
      <SidebarMenu>
        {links.map(({ path, end, icon: Icon, tone, label }) => <SidebarMenuItem key={path}><SidebarMenuButton asChild tooltip={label} className={activeLink}><NavLink to={path} end={end} onClick={close}><Icon className={toneText[tone]} data-tone={tone} /><span>{label}</span></NavLink></SidebarMenuButton></SidebarMenuItem>)}
      </SidebarMenu>
    </SidebarGroup>
    <StaffSettingsLinks language={language} />
  </SidebarFrame>
}
