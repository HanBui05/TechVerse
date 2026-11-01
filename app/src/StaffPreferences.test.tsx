import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { setAccessToken } from './services/api/client'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('techverse-authenticated', 'true'); setAccessToken('test-staff'); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => { cleanup(); setAccessToken(null); localStorage.clear(); vi.unstubAllGlobals(); fetchMock.mockReset() })

// Verify both staff layouts expose the existing settings and persist real preference changes.
it.each(['ADMIN', 'MODERATOR'])('%s can change theme and language from its own sidebar', async role => {
  fetchMock.mockImplementation(async input => {
    const path = new URL(String(input)).pathname
    const data = path.endsWith('/auth/refresh') ? { accessToken: 'staff-refreshed', expiresIn: 900 }
      : path.endsWith('/users/me') ? { id: 'staff', fullName: 'Nhân viên', email: 'staff@example.com', roles: [role], avatarUrl: null, phoneNumber: null, dateOfBirth: null, createdAt: '', updatedAt: '' }
      : { content: [], hasNext: false, totalElements: 0 }
    return new Response(JSON.stringify({ status: 200, message: 'OK', data }))
  })
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={[role === 'ADMIN' ? '/admin/users' : '/moderator/articles']}><App /></MemoryRouter>)
  await screen.findByText('staff@example.com')
  expect(screen.queryByRole('link', { name: 'Giao diện' })).not.toBeNull()
  await user.click(screen.getByRole('link', { name: 'Giao diện' }))
  await user.click(screen.getByRole('button', { name: /^Sáng/ }))
  await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'))
  expect(localStorage.getItem('techverse-theme')).toBe('light')
  await user.click(screen.getByRole('link', { name: 'Ngôn ngữ' }))
  await user.click(screen.getByRole('button', { name: /English EN/ }))
  await waitFor(() => expect(document.documentElement.lang).toBe('en'))
  expect(screen.queryByRole('link', { name: 'Appearance' })).not.toBeNull()
  expect(localStorage.getItem('techverse-language')).toBe('en')
})
