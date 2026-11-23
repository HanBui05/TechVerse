import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, matchPath, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { ComponentType, ReactNode } from 'react'
import { Menu, Moon } from 'lucide-react'
import { Brand } from './components/brand/Brand'
import { Sidebar } from './components/layout/Sidebar'
import { ModeratorSidebar } from './components/layout/ModeratorSidebar'
import { AdminSidebar } from './components/layout/AdminSidebar'
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { copy } from './data/i18n'
import { HomePage } from './pages/Home/HomePage'
import { AuthLayout } from './components/auth/AuthLayout'
import type { Language, Theme } from './types/preferences'
import { login as loginWithApi, logout as logoutFromApi, logoutAll as logoutAllFromApi, restoreSession, type GoogleSession } from './services/authService'
import { setAccessToken } from './services/api/client'
import { register as registerWithApi } from './services/registerService'
import { getMyProfile, type UserProfile } from './services/profileService'

// Pages export by name; each lazy page becomes its own chunk, so the first visit loads only the shell and its route.
function lazyPage<K extends string, M extends Record<K, ComponentType<any>>>(load: () => Promise<M>, name: K) {
  return lazy(() => loadPage(load, name))
}

const CHUNK_RELOAD = 'techverse-chunk-reload'
// A redeploy deletes old chunks: reload once to fetch the new index.html; a second failure in a row (offline) reaches the router error screen.
export function loadPage<K extends string, M extends Record<K, unknown>>(load: () => Promise<M>, name: K, reload = () => window.location.reload()) {
  return load().then(module => {
    sessionStorage.removeItem(CHUNK_RELOAD)
    return { default: module[name] }
  }, (error: unknown) => {
    if (sessionStorage.getItem(CHUNK_RELOAD)) throw error
    sessionStorage.setItem(CHUNK_RELOAD, '1')
    reload()
    return new Promise<never>(() => {})
  })
}

const BlogsPage = lazyPage(() => import('./pages/Blogs/BlogsPage'), 'BlogsPage')
const BlogDetailPage = lazyPage(() => import('./pages/Blogs/BlogDetailPage'), 'BlogDetailPage')
const SavedArticlesPage = lazyPage(() => import('./pages/Blogs/SavedArticlesPage'), 'SavedArticlesPage')
const CoursesPage = lazyPage(() => import('./pages/Courses/CoursesPage'), 'CoursesPage')
const CourseOverviewPage = lazyPage(() => import('./pages/Courses/CourseOverviewPage'), 'CourseOverviewPage')
const CourseLessonPage = lazyPage(() => import('./pages/Courses/CourseLessonPage'), 'CourseLessonPage')
const MyCoursesPage = lazyPage(() => import('./pages/Courses/MyCoursesPage'), 'MyCoursesPage')
const PracticeListPage = lazyPage(() => import('./pages/Practice/PracticeListPage'), 'PracticeListPage')
const PracticeIntroPage = lazyPage(() => import('./pages/Practice/PracticeIntroPage'), 'PracticeIntroPage')
const PracticeAttemptPage = lazyPage(() => import('./pages/Practice/PracticeAttemptPage'), 'PracticeAttemptPage')
const PracticeAttemptReviewPage = lazyPage(() => import('./pages/Practice/PracticeHistoryPage'), 'PracticeAttemptReviewPage')
const PracticeHistoryPage = lazyPage(() => import('./pages/Practice/PracticeHistoryPage'), 'PracticeHistoryPage')
const InterviewListPage = lazyPage(() => import('./pages/Interview/InterviewListPage'), 'InterviewListPage')
const InterviewDetailPage = lazyPage(() => import('./pages/Interview/InterviewDetailPage'), 'InterviewDetailPage')
const ForumListPage = lazyPage(() => import('./pages/Forum/ForumListPage'), 'ForumListPage')
const ForumQuestionEditorPage = lazyPage(() => import('./pages/Forum/ForumQuestionEditorPage'), 'ForumQuestionEditorPage')
const ForumQuestionDetailPage = lazyPage(() => import('./pages/Forum/ForumQuestionDetailPage'), 'ForumQuestionDetailPage')
const MessagesPage = lazyPage(() => import('./pages/Messages/MessagesPage'), 'MessagesPage')
const OrdersPage = lazyPage(() => import('./pages/Payments/OrdersPage'), 'OrdersPage')
const OrderDetailPage = lazyPage(() => import('./pages/Payments/OrderDetailPage'), 'OrderDetailPage')
const LanguagePage = lazyPage(() => import('./pages/Settings/LanguagePage'), 'LanguagePage')
const ThemePage = lazyPage(() => import('./pages/Settings/ThemePage'), 'ThemePage')
const LoginPage = lazyPage(() => import('./pages/Login/LoginPage'), 'LoginPage')
const GoogleCallbackPage = lazyPage(() => import('./pages/Login/GoogleCallbackPage'), 'GoogleCallbackPage')
const ForgotPasswordPage = lazyPage(() => import('./pages/Login/ForgotPasswordPage'), 'ForgotPasswordPage')
const RegisterPage = lazyPage(() => import('./pages/Register/RegisterPage'), 'RegisterPage')
const PlaceholderPage = lazyPage(() => import('./pages/PlaceholderPage'), 'PlaceholderPage')
const ProfilePage = lazyPage(() => import('./pages/Profile/ProfilePage'), 'ProfilePage')
const AdminDashboardPage = lazyPage(() => import('./pages/Admin/AdminDashboardPage'), 'AdminDashboardPage')
const AuthorApplicationsPage = lazyPage(() => import('./pages/Admin/AuthorApplicationsPage'), 'AuthorApplicationsPage')
const AdminUsersPage = lazyPage(() => import('./pages/Admin/AdminUsersPage'), 'AdminUsersPage')
const TaxonomyPage = lazyPage(() => import('./pages/Admin/TaxonomyPage'), 'TaxonomyPage')
const AdminOrdersPage = lazyPage(() => import('./pages/Admin/Orders/AdminOrdersPage'), 'AdminOrdersPage')
const AdminRevenuePage = lazyPage(() => import('./pages/Admin/Revenue/AdminRevenuePage'), 'AdminRevenuePage')
const AdminPayoutsPage = lazyPage(() => import('./pages/Admin/Payouts/AdminPayoutsPage'), 'AdminPayoutsPage')
const AdminCommissionPage = lazyPage(() => import('./pages/Admin/Commission/AdminCommissionPage'), 'AdminCommissionPage')
const AuthorRevenuePage = lazyPage(() => import('./pages/Author/Revenue/AuthorRevenuePage'), 'AuthorRevenuePage')
const AuthorApplyPage = lazyPage(() => import('./pages/Author/AuthorApplyPage'), 'AuthorApplyPage')
const AuthorBlogsPage = lazyPage(() => import('./pages/Author/AuthorBlogsPage'), 'AuthorBlogsPage')
const ArticleEditorPage = lazyPage(() => import('./pages/Author/ArticleEditorPage'), 'ArticleEditorPage')
const AiArticlePage = lazyPage(() => import('./pages/Author/AiArticlePage'), 'AiArticlePage')
const AuthorCoursesPage = lazyPage(() => import('./pages/Author/Courses/AuthorCoursesPage'), 'AuthorCoursesPage')
const CourseEditorPage = lazyPage(() => import('./pages/Author/Courses/CourseEditorPage'), 'CourseEditorPage')
const CourseStudentsPage = lazyPage(() => import('./pages/Author/Courses/CourseStudentsPage'), 'CourseStudentsPage')
const AuthorExercisesPage = lazyPage(() => import('./pages/Author/Exercises/AuthorExercisesPage'), 'AuthorExercisesPage')
const ExerciseEditorPage = lazyPage(() => import('./pages/Author/Exercises/ExerciseEditorPage'), 'ExerciseEditorPage')
const AuthorInterviewQuestionsPage = lazyPage(() => import('./pages/Author/InterviewQuestions/AuthorInterviewQuestionsPage'), 'AuthorInterviewQuestionsPage')
const InterviewQuestionEditorPage = lazyPage(() => import('./pages/Author/InterviewQuestions/InterviewQuestionEditorPage'), 'InterviewQuestionEditorPage')
const ModeratorDashboardPage = lazyPage(() => import('./pages/Moderator/ModeratorDashboardPage'), 'ModeratorDashboardPage')
const ModeratorArticlesPage = lazyPage(() => import('./pages/Moderator/ModeratorArticlesPage'), 'ModeratorArticlesPage')
const ModeratorArticleDetailPage = lazyPage(() => import('./pages/Moderator/ModeratorArticleDetailPage'), 'ModeratorArticleDetailPage')
const ModeratorCoursesPage = lazyPage(() => import('./pages/Moderator/Courses/ModeratorCoursesPage'), 'ModeratorCoursesPage')
const ModeratorCourseDetailPage = lazyPage(() => import('./pages/Moderator/Courses/ModeratorCourseDetailPage'), 'ModeratorCourseDetailPage')
const ModeratorExercisesPage = lazyPage(() => import('./pages/Moderator/Exercises/ModeratorExercisesPage'), 'ModeratorExercisesPage')
const ModeratorExerciseDetailPage = lazyPage(() => import('./pages/Moderator/Exercises/ModeratorExerciseDetailPage'), 'ModeratorExerciseDetailPage')
const ModeratorInterviewQuestionsPage = lazyPage(() => import('./pages/Moderator/InterviewQuestions/ModeratorInterviewQuestionsPage'), 'ModeratorInterviewQuestionsPage')
const ModeratorInterviewQuestionDetailPage = lazyPage(() => import('./pages/Moderator/InterviewQuestions/ModeratorInterviewQuestionDetailPage'), 'ModeratorInterviewQuestionDetailPage')
const ModeratorReportsPage = lazyPage(() => import('./pages/Moderator/Reports/ModeratorReportsPage'), 'ModeratorReportsPage')

function AuthRoute({ authenticated, returnTo, children }: { authenticated: boolean; returnTo?: string; children: ReactNode }) {
  return authenticated ? children : <Navigate to="/login" replace state={returnTo ? { returnTo } : undefined} />
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
      : <Suspense fallback={<main className={LOADING_MAIN} aria-busy="true"><Skeleton className="h-8 w-full max-w-md" /></main>}><Routes>
      <Route path="/" element={<ReaderRoute roles={roles}><HomePage t={t} /></ReaderRoute>} />
      <Route path="/blogs" element={<AuthRoute authenticated={authenticated}><ReaderRoute roles={roles}><BlogsPage language={language} canSave={canSave} /></ReaderRoute></AuthRoute>} />
      <Route path="/blogs/:id" element={<AuthRoute authenticated={authenticated}><ReaderRoute roles={roles}><BlogDetailPage language={language} canSave={canSave} /></ReaderRoute></AuthRoute>} />
      <Route path="/me/saved-articles" element={<AuthRoute authenticated={authenticated}><ReaderRoute roles={roles}><SavedArticlesPage language={language} /></ReaderRoute></AuthRoute>} />
      <Route path="/courses" element={<ReaderRoute roles={roles}><CoursesPage language={language} authenticated={authenticated} /></ReaderRoute>} />
      <Route path="/courses/:id" element={<ReaderRoute roles={roles}><CourseOverviewPage language={language} authenticated={authenticated} currentUserId={profile?.id} /></ReaderRoute>} />
      <Route path="/courses/:courseId/lessons/:lessonId" element={<ReaderRoute roles={roles}><CourseLessonPage language={language} authenticated={authenticated} /></ReaderRoute>} />
      <Route path="/me/courses" element={<AuthRoute authenticated={authenticated} returnTo="/me/courses"><ReaderRoute roles={roles}><MyCoursesPage language={language} /></ReaderRoute></AuthRoute>} />
      <Route path="/practice" element={<ReaderRoute roles={roles}><PracticeListPage language={language} authenticated={authenticated} /></ReaderRoute>} />
      <Route path="/practice/:id" element={<ReaderRoute roles={roles}><PracticeIntroPage language={language} authenticated={authenticated} /></ReaderRoute>} />
      <Route path="/practice/:id/attempt" element={<AuthRoute authenticated={authenticated} returnTo={location.pathname}><ReaderRoute roles={roles}><PracticeAttemptPage language={language} /></ReaderRoute></AuthRoute>} />
      <Route path="/me/practice" element={<AuthRoute authenticated={authenticated} returnTo="/me/practice"><ReaderRoute roles={roles}><PracticeHistoryPage language={language} /></ReaderRoute></AuthRoute>} />
      <Route path="/me/practice/:attemptId" element={<AuthRoute authenticated={authenticated} returnTo={location.pathname}><ReaderRoute roles={roles}><PracticeAttemptReviewPage language={language} /></ReaderRoute></AuthRoute>} />
      <Route path="/interview" element={<ReaderRoute roles={roles}><InterviewListPage language={language} authenticated={authenticated} /></ReaderRoute>} />
      <Route path="/interview/:id" element={<ReaderRoute roles={roles}><InterviewDetailPage language={language} authenticated={authenticated} /></ReaderRoute>} />
      <Route path="/forum" element={<ForumListPage language={language} authenticated={authenticated} />} />
      <Route path="/forum/new" element={<AuthRoute authenticated={authenticated} returnTo="/forum/new"><ForumQuestionEditorPage language={language} /></AuthRoute>} />
      <Route path="/forum/:id" element={<ForumQuestionDetailPage language={language} authenticated={authenticated} isModerator={roles.includes('MODERATOR')} />} />
      <Route path="/forum/:id/edit" element={<AuthRoute authenticated={authenticated} returnTo={location.pathname}><ForumQuestionEditorPage language={language} /></AuthRoute>} />
      <Route path="/messages" element={<AuthRoute authenticated={authenticated} returnTo="/messages"><ReaderRoute roles={roles}><MessagesPage language={language} /></ReaderRoute></AuthRoute>} />
      <Route path="/messages/:id" element={<AuthRoute authenticated={authenticated} returnTo={location.pathname}><ReaderRoute roles={roles}><MessagesPage language={language} /></ReaderRoute></AuthRoute>} />
      <Route path="/me/orders" element={<AuthRoute authenticated={authenticated} returnTo="/me/orders"><ReaderRoute roles={roles}><OrdersPage language={language} /></ReaderRoute></AuthRoute>} />
      <Route path="/me/orders/:orderCode" element={<AuthRoute authenticated={authenticated} returnTo={location.pathname}><ReaderRoute roles={roles}><OrderDetailPage language={language} /></ReaderRoute></AuthRoute>} />
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
      <Route path="/moderator/courses" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['MODERATOR']}><ModeratorCoursesPage language={language} /></RoleRoute>} />
      <Route path="/moderator/courses/:id" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['MODERATOR']}><ModeratorCourseDetailPage language={language} /></RoleRoute>} />
      <Route path="/moderator/exercises" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['MODERATOR']}><ModeratorExercisesPage language={language} /></RoleRoute>} />
      <Route path="/moderator/exercises/:id" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['MODERATOR']}><ModeratorExerciseDetailPage language={language} /></RoleRoute>} />
      <Route path="/moderator/interview-questions" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['MODERATOR']}><ModeratorInterviewQuestionsPage language={language} /></RoleRoute>} />
      <Route path="/moderator/interview-questions/:id" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['MODERATOR']}><ModeratorInterviewQuestionDetailPage language={language} /></RoleRoute>} />
      <Route path="/moderator/reports" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['MODERATOR']}><ModeratorReportsPage language={language} /></RoleRoute>} />
      <Route path="/admin/author-applications" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><AuthorApplicationsPage language={language} /></RoleRoute>} />
      <Route path="/admin/users" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><AdminUsersPage language={language} /></RoleRoute>} />
      <Route path="/admin/topics" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><TaxonomyPage kind="topics" language={language} /></RoleRoute>} />
      <Route path="/admin/tags" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><TaxonomyPage kind="tags" language={language} /></RoleRoute>} />
      <Route path="/admin/orders" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><AdminOrdersPage language={language} /></RoleRoute>} />
      <Route path="/admin/commission" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><AdminCommissionPage language={language} /></RoleRoute>} />
      <Route path="/admin/revenue" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><AdminRevenuePage language={language} /></RoleRoute>} />
      <Route path="/admin/payouts" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['ADMIN']}><AdminPayoutsPage language={language} /></RoleRoute>} />
      <Route path="/author/revenue" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><AuthorRevenuePage language={language} /></RoleRoute>} />
      <Route path="/author/apply" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['LEARNER']}><AuthorApplyPage language={language} /></RoleRoute>} />
      <Route path="/author/blogs" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><AuthorBlogsPage language={language} /></RoleRoute>} />
      {/* Same element type on both paths: after the first auto-save /new → /:id/edit keeps editor state. */}
      <Route path="/author/blogs/ai" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><AiArticlePage language={language} /></RoleRoute>} />
      <Route path="/author/blogs/new" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><ArticleEditorPage language={language} /></RoleRoute>} />
      <Route path="/author/blogs/:id/edit" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><ArticleEditorPage language={language} /></RoleRoute>} />
      <Route path="/author/courses" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><AuthorCoursesPage language={language} /></RoleRoute>} />
      {/* Same element type on both paths: after the first create /new → /:id/edit keeps editor state. */}
      <Route path="/author/courses/new" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><CourseEditorPage language={language} /></RoleRoute>} />
      <Route path="/author/courses/:id/students" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><CourseStudentsPage language={language} /></RoleRoute>} />
      <Route path="/author/exercises" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><AuthorExercisesPage language={language} /></RoleRoute>} />
      <Route path="/author/exercises/new" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><ExerciseEditorPage language={language} /></RoleRoute>} />
      <Route path="/author/exercises/:id/edit" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><ExerciseEditorPage language={language} /></RoleRoute>} />
      <Route path="/author/interview-questions" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><AuthorInterviewQuestionsPage language={language} /></RoleRoute>} />
      <Route path="/author/interview-questions/new" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><InterviewQuestionEditorPage language={language} /></RoleRoute>} />
      <Route path="/author/interview-questions/:id/edit" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><InterviewQuestionEditorPage language={language} /></RoleRoute>} />
      <Route path="/author/courses/:id/edit" element={<RoleRoute authenticated={authenticated} roles={profile?.roles || []} allowed={['AUTHOR']}><CourseEditorPage language={language} /></RoleRoute>} />
      <Route path="/settings/theme" element={<ThemePage theme={theme} setTheme={setTheme} t={t} />} />
      <Route path="/settings/language" element={<LanguagePage language={language} setLanguage={setLanguage} t={t} />} />
      <Route path="*" element={<PlaceholderPage t={t} language={language} />} />
    </Routes></Suspense>
  // The learning frame has its own top bar and curriculum: no app Sidebar or mobile bar around it.
  const isLearningFrame = Boolean(matchPath('/courses/:id', location.pathname) || matchPath('/courses/:courseId/lessons/:lessonId', location.pathname))
  if (isAuthPage || (isLearningFrame && !roles.some(role => role === 'ADMIN' || role === 'MODERATOR'))) return <div className="min-h-svh">{routes}</div>
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
