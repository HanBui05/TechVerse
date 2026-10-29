import { NavLink } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileText, Home, LayoutDashboard, LogOut, UserRound, X } from 'lucide-react'
import { Brand } from '../brand/Brand'
import type { Language } from '../../types/preferences'
import type { UserProfile } from '../../services/profileService'

type Props = { collapsed: boolean; onToggle: () => void; mobileOpen: boolean; onMobileClose: () => void; language: Language; profile: UserProfile | null; onLogout: () => void }
export function ModeratorSidebar({ collapsed, onToggle, mobileOpen, onMobileClose, language, profile, onLogout }: Props) {
  const vi = language === 'vi'
  return <><div className={`mobile-scrim ${mobileOpen ? 'is-visible' : ''}`} onClick={onMobileClose} /><aside className={`sidebar moderator-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
    <div className="moderator-sidebar-header"><Brand compact={collapsed} /><button className="icon-button moderator-toggle desktop-only" onClick={onToggle} aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}>{collapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}</button><button className="icon-button mobile-only" onClick={onMobileClose} aria-label="Close menu"><X size={19} /></button></div>
    <nav className="moderator-nav"><span className="moderator-nav-label">{vi ? 'KIỂM DUYỆT' : 'MODERATION'}</span><NavLink to="/moderator" end onClick={onMobileClose} className={({ isActive }) => `moderator-nav-link ${isActive ? 'is-active' : ''}`} title={vi ? 'Tổng quan' : 'Overview'}><LayoutDashboard size={19} /><span>{vi ? 'Tổng quan' : 'Overview'}</span></NavLink><NavLink to="/moderator/articles" onClick={onMobileClose} className={({ isActive }) => `moderator-nav-link ${isActive ? 'is-active' : ''}`} title={vi ? 'Kiểm duyệt bài viết' : 'Review articles'}><FileText size={19} /><span>{vi ? 'Kiểm duyệt bài viết' : 'Review articles'}</span></NavLink><NavLink to="/" onClick={onMobileClose} className="moderator-nav-link" title={vi ? 'Về trang người dùng' : 'User website'}><Home size={19} /><span>{vi ? 'Về trang người dùng' : 'User website'}</span></NavLink><NavLink to="/profile" onClick={onMobileClose} className="moderator-nav-link" title={vi ? 'Thông tin cá nhân' : 'Profile'}><UserRound size={19} /><span>{vi ? 'Thông tin cá nhân' : 'Profile'}</span></NavLink></nav>
    <div className="moderator-account"><div className="moderator-avatar">{profile?.fullName?.trim().charAt(0).toUpperCase() || 'M'}</div><div className="moderator-account-copy"><strong>{profile?.fullName || 'Moderator'}</strong><small>{profile?.email || 'Moderator'}</small></div><button className="icon-button" onClick={onLogout} aria-label={vi ? 'Đăng xuất' : 'Log out'}><LogOut size={18} /></button></div>
  </aside></>
}
