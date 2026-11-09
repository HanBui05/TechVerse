import { useCallback, useEffect, useState } from 'react'
import { Link, matchPath, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Menu, Moon } from 'lucide-react'
import { Brand } from './components/brand/Brand'
import { Sidebar } from './components/layout/Sidebar'
import { ModeratorSidebar } from './components/layout/ModeratorSidebar'
import { AdminSidebar } from './components/layout/AdminSidebar'
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { copy } from './data/i18n'
import { HomePage } from './pages/Home/HomePage'
import { BlogsPage } from './pages/Blogs/BlogsPage'
import { BlogDetailPage } from './pages/Blogs/BlogDetailPage'
import { SavedArticlesPage } from './pages/Blogs/SavedArticlesPage'
import { LanguagePage } from './pages/Settings/LanguagePage'
import { ThemePage } from './pages/Settings/ThemePage'
import { AuthLayout } from './components/auth/AuthLayout'
import { LoginPage } from './pages/Login/LoginPage'
import { GoogleCallbackPage } from './pages/Login/GoogleCallbackPage'
import { ForgotPasswordPage } from './pages/Login/ForgotPasswordPage'
import { RegisterPage } from './pages/Register/RegisterPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ProfilePage } from './pages/Profile/ProfilePage'
import { AdminDashboardPage } from './pages/Admin/AdminDashboardPage'
import { AuthorApplicationsPage } from './pages/Admin/AuthorApplicationsPage'
import { AdminUsersPage } from './pages/Admin/AdminUsersPage'
import { TaxonomyPage } from './pages/Admin/TaxonomyPage'
import { AuthorApplyPage } from './pages/Author/AuthorApplyPage'
import { AuthorBlogsPage } from './pages/Author/AuthorBlogsPage'
import { ArticleEditorPage } from './pages/Author/ArticleEditorPage'
import { AiArticlePage } from './pages/Author/AiArticlePage'
import { AuthorCoursesPage } from './pages/Author/Courses/AuthorCoursesPage'
import { CourseEditorPage } from './pages/Author/Courses/CourseEditorPage'
import { ModeratorDashboardPage } from './pages/Moderator/ModeratorDashboardPage'
import { ModeratorArticlesPage } from './pages/Moderator/ModeratorArticlesPage'
import { ModeratorArticleDetailPage } from './pages/Moderator/ModeratorArticleDetailPage'
import type { Language, Theme } from './types/preferences'
import { login as loginWithApi, logout as logoutFromApi, logoutAll as logoutAllFromApi, restoreSession, type GoogleSession } from './services/authService'
import { setAccessToken } from './services/api/client'
import { register as registerWithApi } from './services/registerService'
import { getMyProfile, type UserProfile } from './services/profileService'

function AuthRoute({ authenticated, children }: { authenticated: boolean; children: ReactNode }) {
  return authenticated ? children : <Navigate to="/login" replace />
}

/** Dashboard of a management account (ADMIN wins over MODERATOR); null for Reader accounts. */
const managerHome = (roles: string[]) => roles.includes('ADMIN') ? '/admin' : roles.includes('MODERATOR') ? '/moderator' : null

// Reader routes (/, /blogs, /blogs/:id, /me/saved-articles) are not for management accounts; /profile and /settings/* stay shared.
function ReaderRoute({ roles, children }: { roles: string[]; children: ReactNode }) {
  const home = managerHome(roles)
  return home ? <Navigate to={home} replace /> : children
}

const LOADING_MAIN = 'tw-page flex min-h-svh flex-col items-center justify-center p-10 text-center text-muted-foreground'

function RoleRoute({ authenticated, roles, allowed, children }: { authenticated: boolean; roles: string[]; allowed: string[]; children: ReactNode }) {
  if (!authenticated) return <Navigate to="/login" replace />
  if (roles.length === 0) return <main className={LOADING_MAIN}><p>Đang kiểm tra quyền truy cập...</p></main>
  return roles.some(role => allowed.includes(role)) ? children : <Navigate to="/profile" replace />
}

export default function App() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('techverse-sidebar') === 'collapsed')
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
  const setSidebarOpen = useCallback((open: boolean) => { localStorage.setItem('techverse-sidebar', open ? 'expanded' : 'collapsed'); setCollapsed(!open) }, [])
  // Share verified profile state and role routing between password login and Google login.
  const acceptProfile = useCallback((nextProfile: UserProfile) => {
    setProfile(nextProfile)
    localStorage.setItem('techverse-authenticated', 'true')
    setAuthenticated(true)
    return managerHome(nextProfile.roles) ?? '/'
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
  // Confirmation and errors live in the profile dialog; a failure must reject so the dialog stays open.
  const logoutAll = async () => {
    await logoutAllFromApi()
    localStorage.removeItem('techverse-authenticated')
    setAuthenticated(false)
    setProfile(null)
    navigate('/login', { replace: true })
  }
  const roles = profile?.roles || []
  // Hides every saved control/link and never calls the saved API; the backend (Task 1d) still enforces it.
  const canSave = !managerHome(roles)
  const routes = authenticated && !profile && !isAuthPage
      ? <main className={LOADING_MAIN}><p role="status">Đang đồng bộ phiên đăng nhập và quyền truy cập...</p></main>
      : <Routes>
      <Route path="/" element={<ReaderRoute roles={roles}><HomePage t={t} /></ReaderRoute>} />
      <Route path="/blogs" element={<AuthRoute authenticated={authenticated}><ReaderRoute roles={roles}><BlogsPage language={language} canSave={canSave} /></ReaderRoute></AuthRoute>} />
      <Route path="/blogs/:id" element={<AuthRoute authenticated={authenticated}><ReaderRoute roles={roles}><BlogDetailPage language={language} canSave={canSave} /></ReaderRoute></AuthRoute>} />
      <Route path="/me/saved-articles" element={<AuthRoute authenticated={authenticated}><ReaderRoute roles={roles}><SavedArticlesPage language={language} /></ReaderRoute></AuthRoute>} />
      <Route element={<AuthLayout t={t} />}>
        <Route path="/login" element={<LoginPage t={t} onLogin={login} />} />
        <Route path="/register" element={<RegisterPage t={t} onRegister={register} />} />
      </Route>
      <Route path="/auth/callback" element={<GoogleCallbackPage key={location.search} onAuthenticated={acceptGoogleSession} onResetSession={resetGoogleSession} />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage t={t} />} />
      <Route path="/profile" element={<AuthRoute authenticated={authenticated}>{profile && <ProfilePage language={language} profile={profile} onLogout={logout} onLogoutAll={logoutAll} onProfileChange={setProfile} />}</AuthRoute>} />
      <Route path="/admin" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><AdminDashboardPage language={language} /></RoleRoute>} />
      <Route path="/moderator" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['MODERATOR']}><ModeratorDashboardPage language={language} /></RoleRoute>} />
      <Route path="/moderator/articles" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['MODERATOR']}><ModeratorArticlesPage language={language} /></RoleRoute>} />
      <Route path="/moderator/articles/:id" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['MODERATOR']}><ModeratorArticleDetailPage language={language} /></RoleRoute>} />
      <Route path="/admin/author-applications" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><AuthorApplicationsPage language={language} /></RoleRoute>} />
      <Route path="/admin/users" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><AdminUsersPage language={language} /></RoleRoute>} />
      <Route path="/admin/topics" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><TaxonomyPage kind="topics" language={language} /></RoleRoute>} />
      <Route path="/admin/tags" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><TaxonomyPage kind="tags" language={language} /></RoleRoute>} />
      <Route path="/author/apply" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['LEARNER']}><AuthorApplyPage language={language} /></RoleRoute>} />
      <Route path="/author/blogs" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><AuthorBlogsPage language={language} /></RoleRoute>} />
      {/* Same element type on both paths: after the first auto-save /new → /:id/edit keeps editor state. */}
      <Route path="/author/blogs/ai" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><AiArticlePage language={language} /></RoleRoute>} />
      <Route path="/author/blogs/new" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><ArticleEditorPage language={language} /></RoleRoute>} />
      <Route path="/author/blogs/:id/edit" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><ArticleEditorPage language={language} /></RoleRoute>} />
      <Route path="/author/courses" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><AuthorCoursesPage language={language} /></RoleRoute>} />
      {/* Same element type on both paths: after the first create /new → /:id/edit keeps editor state. */}
      <Route path="/author/courses/new" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><CourseEditorPage language={language} /></RoleRoute>} />
      <Route path="/author/courses/:id/edit" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><CourseEditorPage language={language} /></RoleRoute>} />
      <Route path="/settings/theme" element={<ThemePage theme={theme} setTheme={setTheme} t={t} />} />
      <Route path="/settings/language" element={<LanguagePage language={language} setLanguage={setLanguage} t={t} />} />
      <Route path="*" element={<PlaceholderPage t={t} language={language} />} />
    </Routes>
  if (isAuthPage) return <div className="min-h-svh">{routes}</div>
  const sidebar = authenticated && roles.includes('MODERATOR') && (isModeratorPage || !roles.includes('ADMIN'))
    ? <ModeratorSidebar language={language} profile={profile} onLogout={logout} />
    : roles.includes('ADMIN')
      ? <AdminSidebar language={language} profile={profile} onLogout={logout} isModerator={roles.includes('MODERATOR')} />
      : <Sidebar language={language} t={t} authenticated={authenticated} roles={roles} profile={profile} onLogout={logout} />
  // SidebarProvider is controlled by techverse-sidebar; its sidebar-gap reserves the desktop width, so pages need no margin.
  return <SidebarProvider open={!collapsed} onOpenChange={setSidebarOpen}>
    {sidebar}
    <div className="flex min-w-0 flex-1 flex-col">
      <MobileTopbar />
      {routes}
    </div>
  </SidebarProvider>
}

// Mobile-only bar (< md): opens the sidebar sheet; the sheet itself handles focus, Escape and overlay.
function MobileTopbar() {
  const { setOpenMobile } = useSidebar()
  const { pathname } = useLocation()
  // Any navigation (menu link, logo, account link) closes the mobile sheet.
  useEffect(() => { setOpenMobile(false) }, [pathname, setOpenMobile])
  return <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-sidebar px-4 md:hidden">
    <Button variant="ghost" size="icon" onClick={() => setOpenMobile(true)} aria-label="Open menu"><Menu /></Button>
    <Brand compact />
    <Button asChild variant="ghost" size="icon"><Link to="/settings/theme" aria-label="Theme settings"><Moon /></Link></Button>
  </header>
}
