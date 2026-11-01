import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { copy } from '../../data/i18n'
import type { UserProfile } from '../../services/profileService'

const profile: UserProfile = { id: 'current-user', fullName: 'Nguyễn Minh An', email: 'minhan@example.com', avatarUrl: 'https://example.com/my-avatar.png', phoneNumber: null, dateOfBirth: null, roles: ['LEARNER', 'AUTHOR'], createdAt: '', updatedAt: '' }
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
