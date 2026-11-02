import { NavLink } from 'react-router-dom'
import { BookOpen, ChevronDown, FileText, KeyRound, LayoutDashboard, LogIn, UserCheck, Users, X } from 'lucide-react'
import type { Language } from '../../types/preferences'
import { Brand } from '../brand/Brand'
import { AccountIdentity } from './AccountIdentity'
import { StaffSettingsLinks } from './StaffSettingsLinks'
import type { UserProfile } from '../../services/profileService'

type Props = { collapsed: boolean; onToggle: () => void; mobileOpen: boolean; onMobileClose: () => void; language: Language; profile: UserProfile | null; onLogout: () => void; isModerator?: boolean }
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

export function AdminSidebar({ collapsed, onToggle, mobileOpen, onMobileClose, language, profile, onLogout, isModerator = false }: Props) {
  return <><div className={`mobile-scrim ${mobileOpen ? 'is-visible' : ''}`} onClick={onMobileClose} /><aside className={`sidebar admin-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
    <div className="admin-sidebar-header"><Brand compact={collapsed} /><button className="admin-sidebar-close mobile-only" onClick={onMobileClose} aria-label="Close admin menu"><X size={19} /></button><button className="admin-sidebar-collapse desktop-only" onClick={onToggle} aria-label="Toggle admin menu"><ChevronDown size={17} /></button></div>
    <nav className="admin-sidebar-nav">{isModerator && <NavLink to="/moderator/articles" onClick={onMobileClose} className="admin-nav-link" title={language === 'vi' ? 'Kiểm duyệt bài viết' : 'Review articles'}><FileText size={17} /><span>{language === 'vi' ? 'Kiểm duyệt bài viết' : 'Review articles'}</span></NavLink>}{groups.map(group => <section className="admin-nav-group" key={group.label.en}><div className="admin-nav-group-title"><span>{group.label[language]}</span><ChevronDown size={14} /></div>{group.items.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} end={path === '/admin' || path === '/'} onClick={onMobileClose} className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}><Icon size={17} /><span>{label[language]}</span></NavLink>)}</section>)}</nav>
    <StaffSettingsLinks language={language} onNavigate={onMobileClose} />
    <div className="admin-sidebar-account"><AccountIdentity profile={profile} /><button onClick={onLogout} aria-label={language === 'vi' ? 'Đăng xuất' : 'Log out'}><LogIn size={17} /></button></div>
  </aside></>
}
