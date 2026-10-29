import { NavLink } from 'react-router-dom'
import { Activity, BarChart3, BookOpen, ChevronDown, FileQuestion, FileText, GraduationCap, KeyRound, LayoutDashboard, LogIn, MessageSquare, Monitor, ShieldCheck, TrendingUp, UserCheck, Users, Wallet, X } from 'lucide-react'
import type { Language } from '../../types/preferences'
import { Brand } from '../brand/Brand'

type Props = { collapsed: boolean; onToggle: () => void; mobileOpen: boolean; onMobileClose: () => void; language: Language; onLogout: () => void; isModerator?: boolean }
const groups = [
  { label: { vi: 'Tổng quan', en: 'Overview' }, items: [
    { label: { vi: 'Trang chủ', en: 'Dashboard' }, path: '/admin', icon: LayoutDashboard },
    { label: { vi: 'Về trang người dùng', en: 'User website' }, path: '/', icon: Users },
  ] },
  { label: { vi: 'Người dùng & học viên', en: 'Users & learners' }, items: [
    { label: { vi: 'Hồ sơ Author', en: 'Author applications' }, path: '/admin/author-applications', icon: UserCheck },
    { label: { vi: 'Quản lý người dùng', en: 'Manage users' }, path: '/admin/users', icon: UserCheck },
    { label: { vi: 'Quản lý Role', en: 'Manage roles' }, path: '/admin/roles', icon: ShieldCheck },
    { label: { vi: 'Quản lý đăng nhập', en: 'Login management' }, path: '/admin/logins', icon: Monitor },
    { label: { vi: 'Phân tích đăng nhập', en: 'Login analytics' }, path: '/admin/login-analytics', icon: BarChart3 },
    { label: { vi: 'Người dùng hoạt động', en: 'Active users' }, path: '/admin/active-users', icon: Activity },
    { label: { vi: 'Quản lý User Streak', en: 'User streaks' }, path: '/admin/streaks', icon: TrendingUp },
    { label: { vi: 'Quản lý Subscriptions', en: 'Subscriptions' }, path: '/admin/subscriptions', icon: KeyRound },
    { label: { vi: 'Thanh toán', en: 'Payments' }, path: '/admin/payments', icon: Wallet },
  ] },
  { label: { vi: 'Bài giảng & học tập', en: 'Lessons & learning' }, items: [
    { label: { vi: 'Chủ đề', en: 'Topics' }, path: '/admin/topics', icon: BookOpen },
    { label: { vi: 'Thẻ', en: 'Tags' }, path: '/admin/tags', icon: KeyRound },
    { label: { vi: 'Khóa học', en: 'Courses' }, path: '/admin/courses', icon: BookOpen },
    { label: { vi: 'Quản lý chứng chỉ', en: 'Certificates' }, path: '/admin/certificates', icon: GraduationCap },
    { label: { vi: 'Bài tập', en: 'Exercises' }, path: '/admin/exercises', icon: FileText },
    { label: { vi: 'Câu hỏi phỏng vấn', en: 'Interview questions' }, path: '/admin/interview-questions', icon: FileQuestion },
    { label: { vi: 'Đóng góp câu hỏi', en: 'Question contributions' }, path: '/admin/question-contributions', icon: MessageSquare },
    { label: { vi: 'Quản lý Q&A & Thách thức', en: 'Q&A & challenges' }, path: '/admin/qa-challenges', icon: FileQuestion },
    { label: { vi: 'Bình luận', en: 'Comments' }, path: '/admin/comments', icon: MessageSquare },
  ] },
]

export function AdminSidebar({ collapsed, onToggle, mobileOpen, onMobileClose, language, onLogout, isModerator = false }: Props) {
  return <><div className={`mobile-scrim ${mobileOpen ? 'is-visible' : ''}`} onClick={onMobileClose} /><aside className={`sidebar admin-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
    <div className="admin-sidebar-header"><Brand compact={collapsed} /><button className="admin-sidebar-close mobile-only" onClick={onMobileClose} aria-label="Close admin menu"><X size={19} /></button><button className="admin-sidebar-collapse desktop-only" onClick={onToggle} aria-label="Toggle admin menu"><ChevronDown size={17} /></button></div>
    <nav className="admin-sidebar-nav">{isModerator && <NavLink to="/moderator/articles" onClick={onMobileClose} className="admin-nav-link" title={language === 'vi' ? 'Kiểm duyệt bài viết' : 'Review articles'}><FileText size={17} /><span>{language === 'vi' ? 'Kiểm duyệt bài viết' : 'Review articles'}</span></NavLink>}{groups.map(group => <section className="admin-nav-group" key={group.label.en}><div className="admin-nav-group-title"><span>{group.label[language]}</span><ChevronDown size={14} /></div>{group.items.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} end={path === '/admin' || path === '/'} onClick={onMobileClose} className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}><Icon size={17} /><span>{label[language]}</span></NavLink>)}</section>)}</nav>
    <div className="admin-sidebar-account"><div className="admin-account-avatar">A</div><div className="admin-account-copy"><strong>TechVerse Admin</strong><small>admin@techverse.local</small></div><button onClick={onLogout} aria-label="Log out"><LogIn size={17} /></button></div>
  </aside></>
}
