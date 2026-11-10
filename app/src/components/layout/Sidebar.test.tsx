import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { ModeratorSidebar } from './ModeratorSidebar'
import { AdminSidebar } from './AdminSidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import App from '../../App'
import { copy } from '../../data/i18n'
import type { UserProfile } from '../../services/profileService'

const profile: UserProfile = { id: 'current-user', fullName: 'Nguyễn Minh An', email: 'minhan@example.com', avatarUrl: 'https://example.com/my-avatar.png', phoneNumber: null, dateOfBirth: null, roles: ['LEARNER', 'AUTHOR'], createdAt: '', updatedAt: '', hasLocalPassword: true }
const props = { language: 'vi' as const, t: copy.vi, authenticated: true, roles: profile.roles, onLogout: vi.fn() }
const width = window.innerWidth

// Sidebars read collapse/mobile state from the shadcn SidebarProvider that App controls.
function Shell({ children, open = true, onOpenChange = vi.fn(), route = '/' }: { children: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void; route?: string }) {
  return <MemoryRouter initialEntries={[route]}><SidebarProvider open={open} onOpenChange={onOpenChange}>{children}</SidebarProvider></MemoryRouter>
}

afterEach(() => { cleanup(); window.innerWidth = width; localStorage.clear() })

// Catch hardcoded account details and stale avatar/name after profile edits.
it('shows the authenticated profile and updates account identity when the profile changes', () => {
  const { rerender } = render(<Shell><Sidebar {...props} profile={profile} /></Shell>)
  expect(screen.queryByText('minhan@example.com')).not.toBeNull()
  expect(screen.getByRole('img', { name: 'Ảnh đại diện Nguyễn Minh An' }).getAttribute('src')).toBe(profile.avatarUrl)
  rerender(<Shell><Sidebar {...props} profile={{ ...profile, fullName: 'Minh An', avatarUrl: 'https://example.com/new-avatar.png' }} /></Shell>)
  expect(screen.getByRole('img', { name: 'Ảnh đại diện Minh An' }).getAttribute('src')).toBe('https://example.com/new-avatar.png')
  expect(screen.queryByText('TechVerse User')).toBeNull()
})

it('shows the real admin identity rather than demo admin details', () => {
  render(<Shell><AdminSidebar language="vi" profile={profile} onLogout={props.onLogout} /></Shell>)
  expect(screen.queryByText('minhan@example.com')).not.toBeNull()
  expect(screen.queryByText('admin@techverse.local')).toBeNull()
})

it('falls back to initials when the avatar fails and retries a newly changed URL', () => {
  const { rerender } = render(<Shell><Sidebar {...props} profile={profile} /></Shell>)
  fireEvent.error(screen.getByRole('img', { name: 'Ảnh đại diện Nguyễn Minh An' }))
  expect(screen.queryByText('NA')).not.toBeNull()
  rerender(<Shell><Sidebar {...props} profile={{ ...profile, avatarUrl: 'https://example.com/retry.png' }} /></Shell>)
  expect(screen.queryByRole('img', { name: 'Ảnh đại diện Nguyễn Minh An' })).not.toBeNull()
})

const hrefs = () => screen.queryAllByRole('link').map(link => link.getAttribute('href') ?? '')
const deadUserPaths = /^\/(challenges|leaderboard|resources|interview|questions|about|messages|notifications|premium|payments|learning\/)/
const deadAdminPaths = /^\/admin\/(roles|logins|login-analytics|active-users|streaks|subscriptions|payments|courses|certificates|exercises|interview-questions|question-contributions|qa-challenges|comments)$/

// Menu entries without a real route led to the "under development" page; only real routes may stay.
it('lists only routable entries in the learner sidebar', () => {
  render(<Shell><Sidebar {...props} profile={profile} /></Shell>)
  fireEvent.click(screen.getByRole('button', { name: 'Cài đặt' }))
  expect(hrefs().filter(href => deadUserPaths.test(href))).toEqual([])
  for (const name of ['Trang chủ', 'Bài viết', 'Thông tin cá nhân']) expect(screen.queryByRole('link', { name })).not.toBeNull()
  for (const text of ['Tiến độ của tôi', 'Premium & thanh toán', 'Nhận thông báo', 'Giới thiệu']) expect(screen.queryByText(text)).toBeNull()
})

it('groups the Author links under a collapsed “Tác giả” menu, opens it on /author/* and keeps non-Authors on the apply link', () => {
  render(<Shell><Sidebar {...props} profile={profile} /></Shell>)
  const toggle = screen.getByRole('button', { name: 'Tác giả' })
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(hrefs()).not.toContain('/author/courses')
  fireEvent.click(toggle)
  expect(screen.getByRole('link', { name: 'Bài viết của tôi' }).getAttribute('href')).toBe('/author/blogs')
  expect(hrefs()).toContain('/author/courses')
  expect(screen.queryByText(/Doanh thu/)).toBeNull()
  cleanup()
  render(<Shell route="/author/courses"><Sidebar {...props} profile={profile} /></Shell>)
  expect(screen.getByRole('button', { name: 'Tác giả' }).getAttribute('aria-expanded')).toBe('true')
  expect(screen.getAllByRole('link', { name: 'Khóa học' }).find(link => link.getAttribute('href') === '/author/courses')?.getAttribute('aria-current')).toBe('page')
  cleanup()
  render(<Shell><Sidebar {...props} roles={['LEARNER']} profile={{ ...profile, roles: ['LEARNER'] }} /></Shell>)
  expect(screen.getByRole('link', { name: 'Tác giả' }).getAttribute('href')).toBe('/author/apply')
  expect(hrefs()).not.toContain('/author/courses')
})

it('lists only routable entries for a signed-out visitor', () => {
  render(<Shell><Sidebar {...props} authenticated={false} roles={[]} profile={null} /></Shell>)
  expect(hrefs().filter(href => deadUserPaths.test(href))).toEqual([])
  expect(screen.queryByRole('link', { name: 'Bài viết' })).not.toBeNull()
  expect(hrefs()).toContain('/courses')
  expect(hrefs()).not.toContain('/me/courses')
})

it('lists only routable entries in the admin sidebar and keeps the moderator link', () => {
  render(<Shell><AdminSidebar language="vi" profile={profile} onLogout={props.onLogout} isModerator /></Shell>)
  expect(hrefs().filter(href => deadAdminPaths.test(href))).toEqual([])
  for (const name of ['Trang chủ', 'Hồ sơ tác giả', 'Quản lý người dùng', 'Chủ đề', 'Thẻ', 'Kiểm duyệt bài viết']) expect(screen.queryByRole('link', { name })).not.toBeNull()
})

// Management accounts are redirected away from Reader routes, so neither staff sidebar links back to them.
it.each([
  ['admin', <AdminSidebar language="vi" profile={profile} onLogout={props.onLogout} isModerator />],
  ['moderator', <ModeratorSidebar language="vi" profile={profile} onLogout={props.onLogout} />],
])('%s sidebar has no “User website” link', (_, sidebar) => {
  render(<Shell>{sidebar}</Shell>)
  expect(screen.queryByRole('link', { name: 'Về trang người dùng' })).toBeNull()
  expect(within(screen.getByRole('navigation')).queryAllByRole('link').map(link => link.getAttribute('href'))).not.toContain('/')
})

it('puts “Saved articles” in the fixed “My corner” group; “Author” stays in the main group', () => {
  render(<Shell route="/me/saved-articles"><Sidebar {...props} profile={profile} /></Shell>)
  const group = screen.getByText('Góc của tôi').closest('[data-sidebar="group"]') as HTMLElement
  const saved = within(group).getByRole('link', { name: 'Bài đã lưu' })
  expect(saved.getAttribute('href')).toBe('/me/saved-articles')
  expect(saved.getAttribute('aria-current')).toBe('page')
  expect(within(group).queryByRole('button')).toBeNull()
  expect(within(group).queryByRole('link', { name: 'Tác giả' })).toBeNull()
  cleanup()
  render(<Shell><Sidebar {...props} authenticated={false} roles={[]} profile={null} /></Shell>)
  expect(screen.queryByText('Góc của tôi')).toBeNull()
  cleanup()
  // Session restore: signed in but roles not loaded yet — a management account must never flash the link.
  render(<Shell><Sidebar {...props} roles={[]} profile={null} /></Shell>)
  expect(screen.queryByRole('link', { name: 'Bài đã lưu' })).toBeNull()
  cleanup()
  render(<Shell><Sidebar {...props} roles={['LEARNER', 'MODERATOR']} profile={profile} /></Shell>)
  expect(screen.queryByRole('link', { name: 'Bài đã lưu' })).toBeNull()
})

// Staff sidebars match the user sidebar: coloured icons, settings collapsed until opened or visited.
it.each([
  ['admin', <AdminSidebar language="vi" profile={profile} onLogout={props.onLogout} isModerator />],
  ['moderator', <ModeratorSidebar language="vi" profile={profile} onLogout={props.onLogout} />],
])('%s sidebar keeps settings collapsed until opened', (_, sidebar) => {
  render(<Shell>{sidebar}</Shell>)
  const trigger = screen.getByRole('button', { name: 'Cài đặt' })
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByRole('link', { name: 'Giao diện' })).toBeNull()
  fireEvent.click(trigger)
  expect(screen.queryByRole('link', { name: 'Giao diện' })).not.toBeNull()
  cleanup()
  render(<Shell route="/settings/theme">{sidebar}</Shell>)
  expect(screen.queryByRole('link', { name: 'Ngôn ngữ' })).not.toBeNull()
})

it('colours every admin menu icon and drops labels of features that do not exist', () => {
  render(<Shell><AdminSidebar language="vi" profile={profile} onLogout={props.onLogout} isModerator /></Shell>)
  const links = within(screen.getByRole('navigation')).getAllByRole('link')
  expect(links.length).toBeGreaterThanOrEqual(6)
  for (const link of links) expect(link.querySelector('svg[data-tone]')).not.toBeNull()
  for (const text of [/học viên/i, /bài giảng/i, /learners/i, /lessons/i]) expect(screen.queryByText(text)).toBeNull()
})

it('keeps settings collapsed until opened, unless the current page is a settings page', () => {
  render(<Shell><Sidebar {...props} profile={profile} /></Shell>)
  const trigger = screen.getByRole('button', { name: 'Cài đặt' })
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByRole('link', { name: 'Giao diện' })).toBeNull()
  fireEvent.click(trigger)
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  expect(screen.queryByRole('link', { name: 'Giao diện' })).not.toBeNull()
  cleanup()
  render(<Shell route="/settings/language"><Sidebar {...props} profile={profile} /></Shell>)
  expect(screen.queryByRole('link', { name: 'Ngôn ngữ' })).not.toBeNull()
})

it('gives each main menu icon its own colour tone', () => {
  render(<Shell><Sidebar {...props} profile={profile} /></Shell>)
  const tones = Array.from(screen.getByRole('navigation').querySelectorAll('svg[data-tone]')).map(icon => icon.getAttribute('data-tone'))
  expect(tones.length).toBeGreaterThanOrEqual(4)
  // The main group (Home, Articles, Courses, Author) keeps distinct tones; later groups may reuse one.
  expect(new Set(tones.slice(0, 4)).size).toBe(4)
})

it('marks the current route as active', () => {
  render(<Shell route="/blogs"><Sidebar {...props} profile={profile} /></Shell>)
  expect(screen.getByRole('link', { name: 'Bài viết' }).getAttribute('aria-current')).toBe('page')
  expect(screen.getByRole('link', { name: 'Trang chủ' }).getAttribute('aria-current')).toBeNull()
})

it('opens settings when client-side navigation enters a settings page without remounting', () => {
  function GoToLanguage() { const navigate = useNavigate(); return <button onClick={() => navigate('/settings/language')}>go</button> }
  render(<Shell><Sidebar {...props} profile={profile} /><GoToLanguage /></Shell>)
  expect(screen.queryByRole('link', { name: 'Ngôn ngữ' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'go' }))
  expect(screen.getByRole('button', { name: 'Cài đặt' }).getAttribute('aria-expanded')).toBe('true')
  expect(screen.queryByRole('link', { name: 'Ngôn ngữ' })).not.toBeNull()
})

it('hides the brand wordmark and settings links while collapsed', () => {
  render(<Shell open={false} route="/settings/theme"><Sidebar {...props} profile={profile} /></Shell>)
  expect(screen.getByRole('button', { name: 'Expand menu' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'TechVerse home' }).textContent).toBe('')
  expect(screen.queryByRole('link', { name: 'Giao diện' })).toBeNull()
})

it.each([
  ['user', <Sidebar {...props} profile={profile} />, 'Collapse menu', 'Log out'],
  ['admin', <AdminSidebar language="vi" profile={profile} onLogout={props.onLogout} />, 'Toggle admin menu', 'Đăng xuất'],
  ['moderator', <ModeratorSidebar language="vi" profile={profile} onLogout={props.onLogout} />, 'Collapse menu', 'Đăng xuất'],
])('%s sidebar collapses through the provider and logs out', async (_, sidebar, toggleName, logoutName) => {
  const onOpenChange = vi.fn()
  props.onLogout.mockClear()
  render(<Shell onOpenChange={onOpenChange}>{sidebar}</Shell>)
  await userEvent.click(screen.getByRole('button', { name: toggleName }))
  expect(onOpenChange).toHaveBeenCalledWith(false)
  await userEvent.click(screen.getByRole('button', { name: logoutName }))
  expect(props.onLogout).toHaveBeenCalledTimes(1)
})

it('persists the collapsed state in techverse-sidebar and restores it on reload', async () => {
  const { unmount } = render(<MemoryRouter initialEntries={['/settings/theme']}><App /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Collapse menu' }))
  expect(localStorage.getItem('techverse-sidebar')).toBe('collapsed')
  expect(document.cookie).not.toContain('sidebar_state')
  unmount()
  render(<MemoryRouter initialEntries={['/settings/theme']}><App /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Expand menu' }))
  expect(localStorage.getItem('techverse-sidebar')).toBe('expanded')
})

it('opens the mobile menu as a sheet and closes it after navigating', async () => {
  window.innerWidth = 500
  render(<MemoryRouter initialEntries={['/settings/theme']}><App /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Open menu' }))
  const sheet = screen.getByRole('dialog')
  await userEvent.click(within(sheet).getByRole('link', { name: 'Ngôn ngữ' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('button', { name: 'Open menu' })).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Open menu' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close menu' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('closes the mobile sheet when navigating through the brand logo', async () => {
  window.innerWidth = 500
  render(<MemoryRouter initialEntries={['/settings/theme']}><App /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Open menu' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'TechVerse home' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('expands a collapsed sidebar and shows the settings links when the settings icon is clicked', async () => {
  const onOpenChange = vi.fn()
  render(<Shell open={false} onOpenChange={onOpenChange}><Sidebar {...props} profile={profile} /></Shell>)
  await userEvent.click(screen.getByRole('button', { name: 'Cài đặt' }))
  expect(onOpenChange).toHaveBeenCalledWith(true)
  expect(screen.getByRole('button', { name: 'Cài đặt' }).getAttribute('aria-expanded')).toBe('true')
})
