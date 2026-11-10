import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import App from './App'
import { LoginPage } from './pages/Login/LoginPage'
import { copy } from './data/i18n'
import { setAccessToken } from './services/api/client'
import { detail, json, options, page, summary } from './pages/Courses/fixtures'

const fetchMock = vi.fn<typeof fetch>()
let roles: string[] = []
const profile = () => ({ id: 'u1', fullName: 'An', email: 'an@example.com', roles, phoneNumber: null, dateOfBirth: null, avatarUrl: null, createdAt: '', updatedAt: '' })
function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}</output> }
const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><App /><Where /></MemoryRouter>)
const courseCalls = () => fetchMock.mock.calls.filter(([url]) => /\/api\/v1\/(courses|me\/courses)/.test(String(url)))

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setAccessToken(null)
  fetchMock.mockReset().mockImplementation(async input => {
    const path = new URL(String(input)).pathname
    if (path.endsWith('/auth/refresh')) return json({ accessToken: 'tok2', expiresAt: '', expiresIn: 900 })
    if (path === '/api/v1/users/me') return json(profile())
    if (path.endsWith('/options')) return json(options)
    if (path === '/api/v1/courses/c1') return json(detail())
    if (path === '/api/v1/me/courses') return json(page([]))
    return json(page([summary]))
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); setAccessToken(null); localStorage.clear(); vi.unstubAllGlobals() })

it('lets a Guest open the catalog and an overview without signing in, with the learning frame instead of the app Sidebar', async () => {
  renderAt('/courses')
  expect(await screen.findByRole('link', { name: 'Java cơ bản' })).toBeTruthy()
  expect(screen.getByTestId('where').textContent).toBe('/courses')
  cleanup()
  renderAt('/courses/c1')
  expect(await screen.findByRole('heading', { level: 1, name: 'Java cơ bản' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  expect(screen.getByRole('navigation', { name: 'Nội dung khóa học' })).toBeTruthy()
})

it('sends a Guest from My courses to login, and shows the Courses and My courses links to a Learner', async () => {
  renderAt('/me/courses')
  await vi.waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/login'))
  cleanup()
  roles = ['LEARNER']
  localStorage.setItem('techverse-authenticated', 'true'); setAccessToken('tok')
  renderAt('/courses')
  expect(await screen.findByRole('link', { name: 'Java cơ bản' })).toBeTruthy()
  expect(screen.getAllByRole('link', { name: 'Khóa học của tôi' }).length).toBeGreaterThan(0)
  expect(screen.getAllByRole('link', { name: 'Khóa học' }).some(link => link.getAttribute('href') === '/courses')).toBe(true)
})

it('keeps management accounts out of the Reader course routes without calling the learning API', async () => {
  for (const [r, home] of [[['MODERATOR'], '/moderator'], [['ADMIN'], '/admin']] as const) for (const path of ['/courses', '/courses/c1', '/courses/c1/lessons/l1', '/me/courses']) {
    roles = [...r]
    localStorage.setItem('techverse-authenticated', 'true'); setAccessToken('tok')
    fetchMock.mockClear()
    renderAt(path)
    await vi.waitFor(() => expect(screen.getByTestId('where').textContent).toBe(home))
    expect(courseCalls()).toHaveLength(0)
    cleanup()
  }
})

const loginAt = (returnTo: unknown, destination = '/') => render(<MemoryRouter initialEntries={[{ pathname: '/login', state: { returnTo } }]}><Routes>
  <Route path="/login" element={<LoginPage t={copy.vi} onLogin={async () => destination} />} /><Route path="*" element={<Where />} /></Routes></MemoryRouter>)
async function submitLogin() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(copy.vi.email), 'an@example.com')
  await user.type(screen.getByPlaceholderText(copy.vi.password), 'secret')
  await user.click(screen.getByRole('button', { name: copy.vi.login }))
}

it('returns a Reader to the course page they came from, but never to an unlisted path', async () => {
  loginAt('/courses/c1/lessons/l2')
  await submitLogin()
  expect((await screen.findByTestId('where')).textContent).toBe('/courses/c1/lessons/l2')
  cleanup()
  loginAt('//evil.example.com')
  await submitLogin()
  expect((await screen.findByTestId('where')).textContent).toBe('/')
  cleanup()
  loginAt('/courses/c1', '/moderator')
  await submitLogin()
  expect((await screen.findByTestId('where')).textContent).toBe('/moderator')
})
