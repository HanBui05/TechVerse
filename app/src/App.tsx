import { useCallback, useEffect, useState } from 'react'
import { Link, matchPath, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Menu, Moon } from 'lucide-react'
import { Brand } from './components/brand/Brand'
import { Sidebar } from './components/layout/Sidebar'
import { ModeratorSidebar } from './components/layout/ModeratorSidebar'
import { copy } from './data/i18n'
import { HomePage } from './pages/Home/HomePage'
import { BlogsPage, BlogDetailPage } from './pages/Blogs/BlogsPage'
import { LanguagePage } from './pages/Settings/LanguagePage'
import { ThemePage } from './pages/Settings/ThemePage'
import { LoginPage } from './pages/Login/LoginPage'
import { GoogleCallbackPage } from './pages/Login/GoogleCallbackPage'
import { ForgotPasswordPage } from './pages/Login/ForgotPasswordPage'
import { RegisterPage } from './pages/Register/RegisterPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ProfilePage } from './pages/Profile/ProfilePage'
import { AvatarUpload } from './pages/Profile/AvatarUpload'
import { AdminDashboardPage } from './pages/Admin/AdminDashboardPage'
import { AuthorApplicationsPage } from './pages/Admin/AuthorApplicationsPage'
import { AdminUsersPage } from './pages/Admin/AdminUsersPage'
import { TaxonomyPage } from './pages/Admin/TaxonomyPage'
import { AuthorApplyPage } from './pages/Author/AuthorApplyPage'
import { AuthorBlogsPage } from './pages/Author/AuthorBlogsPage'
import { ModeratorDashboardPage } from './pages/Moderator/ModeratorDashboardPage'
import { ModeratorArticlesPage } from './pages/Moderator/ModeratorArticlesPage'
import type { Language, Theme } from './types/preferences'
import { login as loginWithApi, logout as logoutFromApi, logoutAll as logoutAllFromApi, restoreSession, type GoogleSession } from './services/authService'
import { setAccessToken } from './services/api/client'
import { register as registerWithApi } from './services/registerService'
import { getMyProfile, type UserProfile } from './services/profileService'

function AuthRoute({ authenticated, children }: { authenticated: boolean; children: ReactNode }) {
  return authenticated ? children : <Navigate to="/login" replace />
}

function RoleRoute({ authenticated, roles, allowed, children }: { authenticated: boolean; roles: string[]; allowed: string[]; children: ReactNode }) {
  if (!authenticated) return <Navigate to="/login" replace />
  if (roles.length === 0) return <main className="page-content placeholder-page"><p>Đang kiểm tra quyền truy cập...</p></main>
  return roles.some(role => allowed.includes(role)) ? children : <Navigate to="/profile" replace />
}

export default function App() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('techverse-sidebar') === 'collapsed')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('techverse-theme') as Theme) === 'light' ? 'light' : 'dark')
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('techverse-language') as Language) === 'en' ? 'en' : 'vi')
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem('techverse-authenticated') === 'true')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const isGoogleCallback = Boolean(matchPath('/auth/callback', location.pathname))
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/forgot-password' || isGoogleCallback
  const isModeratorPage = location.pathname === '/moderator' || location.pathname.startsWith('/moderator/')
  const t = copy[language]
  useEffect(() => { localStorage.setItem('techverse-theme', theme); document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => { localStorage.setItem('techverse-language', language); document.documentElement.lang = language }, [language])
  useEffect(() => {
    if (!authenticated || isGoogleCallback || profile) return
    let cancelled = false
    // On F5, renew permission claims before publishing the profile or mounting protected pages.
    const restore = async () => {
      const session = await restoreSession()
      if (cancelled) return
      if (!session) {
        if (!cancelled) {
          localStorage.removeItem('techverse-authenticated')
          setAuthenticated(false)
          setProfile(null)
        }
        return
      }
      try {
        const nextProfile = await getMyProfile()
        if (!cancelled) setProfile(nextProfile)
      } catch {
        if (!cancelled) {
          setAccessToken(null)
          localStorage.removeItem('techverse-authenticated')
          setAuthenticated(false)
          setProfile(null)
        }
      }
    }
    void restore()
    return () => { cancelled = true }
  }, [authenticated, isGoogleCallback, profile])
  const toggleSidebar = () => setCollapsed(value => { localStorage.setItem('techverse-sidebar', value ? 'expanded' : 'collapsed'); return !value })
  // Share verified profile state and role routing between password login and Google login.
  const acceptProfile = useCallback((nextProfile: UserProfile) => {
    setProfile(nextProfile)
    localStorage.setItem('techverse-authenticated', 'true')
    setAuthenticated(true)
    return nextProfile.roles.includes('ADMIN') ? '/admin' : nextProfile.roles.includes('MODERATOR') ? '/moderator' : '/profile'
  }, [])
  // A callback must start clean, even when another account was previously signed in in this tab.
  const resetGoogleSession = useCallback(() => {
    setAccessToken(null)
    localStorage.removeItem('techverse-authenticated')
    setAuthenticated(false)
    setProfile(null)
  }, [])
  // Commit tokens only after both cookie exchange and identity lookup succeeded on the active callback.
  const acceptGoogleSession = useCallback((session: GoogleSession) => {
    setAccessToken(session.accessToken)
    return acceptProfile(session.profile)
  }, [acceptProfile])
  // Keep password login on its existing API while using the same role destination rules.
  const login = async (email: string, password: string) => { await loginWithApi({ email, password }); return acceptProfile(await getMyProfile()) }
  const register = async (data: { fullName: string; email: string; password: string; confirmPassword: string }) => { await registerWithApi(data) }
  const logout = async () => {
    try {
      await logoutFromApi()
    } finally {
      localStorage.removeItem('techverse-authenticated')
      setAuthenticated(false)
      setProfile(null)
      navigate('/login', { replace: true })
    }
  }
  const logoutAll = async () => {
    if (!window.confirm(language === 'vi' ? 'Đăng xuất khỏi tất cả thiết bị?' : 'Log out from all devices?')) return
    try { await logoutAllFromApi(); localStorage.removeItem('techverse-authenticated'); setAuthenticated(false); setProfile(null); navigate('/login', { replace: true }) }
    catch (error) { window.alert(error instanceof Error ? error.message : 'Không thể đăng xuất khỏi tất cả thiết bị.') }
  }
  return <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''} ${isAuthPage ? 'login-mode' : ''}`}>
    {!isAuthPage && (authenticated && profile?.roles.includes('MODERATOR') && (isModeratorPage || !profile.roles.includes('ADMIN')) ? <ModeratorSidebar collapsed={collapsed} onToggle={toggleSidebar} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} language={language} profile={profile} onLogout={logout} /> : <Sidebar collapsed={collapsed} onToggle={toggleSidebar} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} language={language} t={t} authenticated={authenticated} roles={profile?.roles || []} profile={profile} onLogout={logout} />)}
    {!isAuthPage && <header className="mobile-topbar"><button className="icon-button" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button><Brand /><Link className="icon-button" to="/settings/theme" aria-label="Theme settings"><Moon size={18} /></Link></header>}
    {authenticated && !profile && !isAuthPage
      ? <main className="page-content placeholder-page"><p role="status">Đang đồng bộ phiên đăng nhập và quyền truy cập...</p></main>
      : <Routes>
      <Route path="/" element={<HomePage t={t} />} />
      <Route path="/blogs" element={<AuthRoute authenticated={authenticated}><BlogsPage /></AuthRoute>} />
      <Route path="/blogs/:id" element={<AuthRoute authenticated={authenticated}><BlogDetailPage /></AuthRoute>} />
      <Route path="/login" element={<LoginPage t={t} onLogin={login} />} />
      <Route path="/register" element={<RegisterPage t={t} onRegister={register} />} />
      <Route path="/auth/callback" element={<GoogleCallbackPage key={location.search} onAuthenticated={acceptGoogleSession} onResetSession={resetGoogleSession} />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/profile" element={<AuthRoute authenticated={authenticated}><ProfilePage language={language} profile={profile} onLogout={logout} onProfileChange={setProfile} /><AvatarUpload profile={profile} onProfileChange={setProfile} language={language} /><div className="page-content logout-all-panel"><button className="button button-outline" onClick={() => void logoutAll()}>{language === 'vi' ? 'Đăng xuất khỏi tất cả thiết bị' : 'Log out from all devices'}</button></div></AuthRoute>} />
      <Route path="/admin" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><AdminDashboardPage language={language} /></RoleRoute>} />
      <Route path="/moderator" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['MODERATOR']}><ModeratorDashboardPage language={language} /></RoleRoute>} />
      <Route path="/moderator/articles" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['MODERATOR']}><ModeratorArticlesPage language={language} /></RoleRoute>} />
      <Route path="/admin/author-applications" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><AuthorApplicationsPage language={language} /></RoleRoute>} />
      <Route path="/admin/users" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><AdminUsersPage language={language} /></RoleRoute>} />
      <Route path="/admin/topics" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><TaxonomyPage kind="topics" language={language} /></RoleRoute>} />
      <Route path="/admin/tags" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><TaxonomyPage kind="tags" language={language} /></RoleRoute>} />
      <Route path="/author/apply" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['LEARNER']}><AuthorApplyPage /></RoleRoute>} />
      <Route path="/author/blogs" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><AuthorBlogsPage language={language} /></RoleRoute>} />
      <Route path="/settings/theme" element={<ThemePage theme={theme} setTheme={setTheme} t={t} />} />
      <Route path="/settings/language" element={<LanguagePage language={language} setLanguage={setLanguage} t={t} />} />
      <Route path="*" element={<PlaceholderPage t={t} language={language} />} />
    </Routes>}
  </div>
}
