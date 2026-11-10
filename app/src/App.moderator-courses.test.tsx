import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import App from './App'
import { setAccessToken } from './services/api/client'

const fetchMock = vi.fn<typeof fetch>()
let roles: string[]
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ status, message: 'OK', data }), { status })
const profile = () => ({ id: 'u1', fullName: 'An', email: 'an@example.com', roles, phoneNumber: null, dateOfBirth: null, avatarUrl: null, createdAt: '', updatedAt: '' })
function Where() { return <output data-testid="where">{useLocation().pathname}</output> }
const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><App /><Where /></MemoryRouter>)
const courseCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/moderator/courses'))

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); localStorage.setItem('techverse-authenticated', 'true'); setAccessToken('tok')
  fetchMock.mockReset().mockImplementation(async input => {
    const path = new URL(String(input)).pathname
    if (path.endsWith('/auth/refresh')) return response({ accessToken: 'tok2', expiresAt: '', expiresIn: 900 })
    if (path === '/api/v1/users/me') return response(profile())
    if (path.endsWith('/options')) return response({ topics: { content: [], hasNext: false }, tags: { content: [], hasNext: false } })
    return response({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, hasNext: false })
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); setAccessToken(null); localStorage.clear(); vi.unstubAllGlobals() })

it('opens course moderation from the Moderator menu', async () => {
  roles = ['MODERATOR']
  const user = userEvent.setup()
  renderAt('/moderator/articles')
  await screen.findByRole('heading', { level: 1, name: 'Kiểm duyệt bài viết' })
  await user.click(screen.getByRole('link', { name: 'Kiểm duyệt khóa học' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Duyệt khóa học' })).toBeTruthy()
  expect(screen.getByTestId('where').textContent).toBe('/moderator/courses')
})

it('lets an ADMIN in only when they also have MODERATOR', async () => {
  roles = ['ADMIN', 'MODERATOR']
  renderAt('/moderator/courses')
  expect(await screen.findByRole('heading', { level: 1, name: 'Duyệt khóa học' })).toBeTruthy()
  cleanup(); fetchMock.mockClear()
  roles = ['ADMIN']
  renderAt('/moderator/courses')
  await vi.waitFor(() => expect(screen.getByTestId('where').textContent).not.toBe('/moderator/courses'))
  expect(courseCalls()).toHaveLength(0)
})

it('sends a learner or an author away from both course moderation routes', async () => {
  for (const r of [['LEARNER'], ['LEARNER', 'AUTHOR']]) for (const path of ['/moderator/courses', '/moderator/courses/c1']) {
    roles = r
    renderAt(path)
    await vi.waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/profile'))
    expect(courseCalls()).toHaveLength(0)
    cleanup()
  }
})
