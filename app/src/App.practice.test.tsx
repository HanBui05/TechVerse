import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import App from './App'
import { setAccessToken } from './services/api/client'
import { json, page, set } from './pages/Practice/fixtures'
// App lazy-loads pages; load them up front so a cold module transform does not eat the waitFor budget.
import.meta.glob(['./pages/**/*.tsx', '!./pages/**/*.test.tsx'], { eager: true })

const fetchMock = vi.fn<typeof fetch>()
let roles: string[] = []
const profile = () => ({ id: 'u1', fullName: 'An', email: 'an@example.com', roles, phoneNumber: null, dateOfBirth: null, avatarUrl: null, createdAt: '', updatedAt: '' })
function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}</output> }
const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><App /><Where /></MemoryRouter>)
const practiceCalls = () => fetchMock.mock.calls.filter(([url]) => /\/api\/v1\/(exercise-sets|me\/exercise-attempts)/.test(String(url)))

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setAccessToken(null)
  fetchMock.mockReset().mockImplementation(async input => {
    const path = new URL(String(input)).pathname
    if (path.endsWith('/auth/refresh')) return json({ accessToken: 'tok2', expiresAt: '', expiresIn: 900 })
    if (path === '/api/v1/users/me') return json(profile())
    if (path === '/api/v1/exercise-sets/options') return json([])
    if (path === '/api/v1/exercise-sets') return json(page([set()]))
    return json(page([]))
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); setAccessToken(null); localStorage.clear(); vi.unstubAllGlobals() })

it('lets a Guest open the catalogue but sends attempt, history and review pages to login', async () => {
  renderAt('/practice')
  expect(await screen.findByRole('link', { name: /SQL cơ bản/ })).toBeTruthy()
  expect(screen.getByTestId('where').textContent).toBe('/practice')
  for (const path of ['/practice/s1/attempt', '/me/practice', '/me/practice/a1']) {
    cleanup()
    renderAt(path)
    await vi.waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/login'))
  }
})

it('shows a Learner the Practice link in the sidebar and the history link on the catalogue', async () => {
  roles = ['LEARNER']
  localStorage.setItem('techverse-authenticated', 'true'); setAccessToken('tok')
  renderAt('/practice')
  expect(await screen.findByRole('link', { name: /SQL cơ bản/ })).toBeTruthy()
  expect(screen.getAllByRole('link', { name: 'Luyện tập' }).some(link => link.getAttribute('href') === '/practice')).toBe(true)
  expect(await screen.findByRole('link', { name: 'Lịch sử luyện tập' })).toBeTruthy()
})

it('keeps management accounts out of the Reader practice routes without calling the practice API', async () => {
  for (const [r, home] of [[['MODERATOR'], '/moderator'], [['ADMIN'], '/admin']] as const) for (const path of ['/practice', '/practice/s1', '/practice/s1/attempt', '/me/practice', '/me/practice/a1']) {
    roles = [...r]
    localStorage.setItem('techverse-authenticated', 'true'); setAccessToken('tok')
    fetchMock.mockClear()
    renderAt(path)
    await vi.waitFor(() => expect(screen.getByTestId('where').textContent).toBe(home))
    expect(practiceCalls()).toHaveLength(0)
    cleanup()
  }
})
