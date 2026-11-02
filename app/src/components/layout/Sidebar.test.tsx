import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { copy } from '../../data/i18n'
import type { UserProfile } from '../../services/profileService'

const profile: UserProfile = { id: 'current-user', fullName: 'Nguyễn Minh An', email: 'minhan@example.com', avatarUrl: 'https://example.com/my-avatar.png', phoneNumber: null, dateOfBirth: null, roles: ['LEARNER', 'AUTHOR'], createdAt: '', updatedAt: '', hasLocalPassword: true }
const props = { collapsed: false, onToggle: vi.fn(), mobileOpen: false, onMobileClose: vi.fn(), language: 'vi' as const, t: copy.vi, authenticated: true, roles: profile.roles, onLogout: vi.fn() }

afterEach(cleanup)

// Catch hardcoded account details and stale avatar/name after profile edits.
it('shows the authenticated profile and updates account identity when the profile changes', () => {
  const { rerender } = render(<MemoryRouter><Sidebar {...props} profile={profile} /></MemoryRouter>)
  expect(screen.queryByText('minhan@example.com')).not.toBeNull()
  expect(screen.getByRole('img', { name: 'Ảnh đại diện Nguyễn Minh An' }).getAttribute('src')).toBe(profile.avatarUrl)
  rerender(<MemoryRouter><Sidebar {...props} profile={{ ...profile, fullName: 'Minh An', avatarUrl: 'https://example.com/new-avatar.png' }} /></MemoryRouter>)
  expect(screen.getByRole('img', { name: 'Ảnh đại diện Minh An' }).getAttribute('src')).toBe('https://example.com/new-avatar.png')
  expect(screen.queryByText('TechVerse User')).toBeNull()
})

it('shows the real admin identity rather than demo admin details', () => {
  render(<MemoryRouter><Sidebar {...props} roles={['ADMIN']} profile={profile} /></MemoryRouter>)
  expect(screen.queryByText('minhan@example.com')).not.toBeNull()
  expect(screen.queryByText('admin@techverse.local')).toBeNull()
})

it('falls back to initials when the avatar fails and retries a newly changed URL', () => {
  const { rerender } = render(<MemoryRouter><Sidebar {...props} profile={profile} /></MemoryRouter>)
  fireEvent.error(screen.getByRole('img', { name: 'Ảnh đại diện Nguyễn Minh An' }))
  expect(screen.queryByText('NA')).not.toBeNull()
  rerender(<MemoryRouter><Sidebar {...props} profile={{ ...profile, avatarUrl: 'https://example.com/retry.png' }} /></MemoryRouter>)
  expect(screen.queryByRole('img', { name: 'Ảnh đại diện Nguyễn Minh An' })).not.toBeNull()
})

const hrefs = () => screen.queryAllByRole('link').map(link => link.getAttribute('href') ?? '')
const deadUserPaths = /^\/(challenges|leaderboard|courses|resources|interview|questions|about|messages|notifications|premium|payments|learning\/)/
const deadAdminPaths = /^\/admin\/(roles|logins|login-analytics|active-users|streaks|subscriptions|payments|courses|certificates|exercises|interview-questions|question-contributions|qa-challenges|comments)$/

// Menu entries without a real route led to the "under development" page; only real routes may stay.
it('lists only routable entries in the learner sidebar', () => {
  render(<MemoryRouter><Sidebar {...props} profile={profile} /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Cài đặt' }))
  expect(hrefs().filter(href => deadUserPaths.test(href))).toEqual([])
  for (const name of ['Trang chủ', 'Bài viết', 'Author', 'Thông tin cá nhân']) expect(screen.queryByRole('link', { name })).not.toBeNull()
  for (const text of ['Tiến độ của tôi', 'Premium & thanh toán', 'Nhận thông báo', 'Giới thiệu']) expect(screen.queryByText(text)).toBeNull()
})

it('lists only routable entries for a signed-out visitor', () => {
  render(<MemoryRouter><Sidebar {...props} authenticated={false} roles={[]} profile={null} /></MemoryRouter>)
  expect(hrefs().filter(href => deadUserPaths.test(href))).toEqual([])
  expect(screen.queryByRole('link', { name: 'Bài viết' })).not.toBeNull()
})

it('lists only routable entries in the admin sidebar and keeps the moderator link', () => {
  render(<MemoryRouter><Sidebar {...props} roles={['ADMIN', 'MODERATOR']} profile={profile} /></MemoryRouter>)
  expect(hrefs().filter(href => deadAdminPaths.test(href))).toEqual([])
  for (const name of ['Trang chủ', 'Về trang người dùng', 'Hồ sơ tác giả', 'Quản lý người dùng', 'Chủ đề', 'Thẻ', 'Kiểm duyệt bài viết']) expect(screen.queryByRole('link', { name })).not.toBeNull()
})

it('keeps settings collapsed until opened, unless the current page is a settings page', () => {
  render(<MemoryRouter><Sidebar {...props} profile={profile} /></MemoryRouter>)
  const trigger = screen.getByRole('button', { name: 'Cài đặt' })
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByRole('link', { name: 'Giao diện' })).toBeNull()
  fireEvent.click(trigger)
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  expect(screen.queryByRole('link', { name: 'Giao diện' })).not.toBeNull()
  cleanup()
  render(<MemoryRouter initialEntries={['/settings/language']}><Sidebar {...props} profile={profile} /></MemoryRouter>)
  expect(screen.queryByRole('link', { name: 'Ngôn ngữ' })).not.toBeNull()
})

it('gives each main menu icon its own colour tone', () => {
  render(<MemoryRouter><Sidebar {...props} profile={profile} /></MemoryRouter>)
  const tones = Array.from(document.querySelectorAll('.sidebar-nav > .nav-item svg.nav-icon')).map(icon => icon.getAttribute('data-tone'))
  expect(tones.length).toBeGreaterThanOrEqual(4)
  expect(tones.every(Boolean)).toBe(true)
  expect(new Set(tones).size).toBe(tones.length)
})

it('opens settings when client-side navigation enters a settings page without remounting', () => {
  function GoToLanguage() { const navigate = useNavigate(); return <button onClick={() => navigate('/settings/language')}>go</button> }
  render(<MemoryRouter><Sidebar {...props} profile={profile} /><GoToLanguage /></MemoryRouter>)
  expect(screen.queryByRole('link', { name: 'Ngôn ngữ' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'go' }))
  expect(screen.getByRole('button', { name: 'Cài đặt' }).getAttribute('aria-expanded')).toBe('true')
  expect(screen.queryByRole('link', { name: 'Ngôn ngữ' })).not.toBeNull()
})
