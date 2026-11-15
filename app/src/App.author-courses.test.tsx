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

it('serves the three course routes to an AUTHOR and keeps the article routes as they were', async () => {
  roles = ['LEARNER', 'AUTHOR']
  renderAt('/author/courses')
  expect(await screen.findByRole('heading', { name: 'Khóa học của tôi' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Tác giả' }).getAttribute('aria-expanded')).toBe('true')
  cleanup()
  renderAt('/author/courses/new')
  expect(await screen.findByRole('heading', { name: 'Tạo khóa học' })).toBeTruthy()
  cleanup()
  renderAt('/author/blogs')
  expect(await screen.findByRole('heading', { name: 'Bài viết của tôi' })).toBeTruthy()
  expect((await screen.findByRole('link', { name: 'Viết bài đầu tiên' })).getAttribute('href')).toBe('/author/blogs/new')
})

it('opens the course workspace from the Author menu and the editor from “Tạo khóa học”', async () => {
  roles = ['LEARNER', 'AUTHOR']
  const user = userEvent.setup()
  renderAt('/author/blogs')
  await screen.findByRole('heading', { name: 'Bài viết của tôi' })
  await user.click(screen.getByRole('link', { name: 'Khóa học' }))
  expect(await screen.findByRole('heading', { name: 'Khóa học của tôi' })).toBeTruthy()
  await user.click(screen.getByRole('link', { name: /Tạo khóa học đầu tiên/ }))
  expect(await screen.findByRole('heading', { name: 'Tạo khóa học' })).toBeTruthy()
  expect(screen.getByTestId('where').textContent).toBe('/author/courses/new')
})

it('sends a plain learner away from every Author course route and shows them no Author menu', async () => {
  roles = ['LEARNER']
  for (const path of ['/author/courses', '/author/courses/new', '/author/courses/c1/edit']) {
    renderAt(path)
    await screen.findByTestId('where')
    await vi.waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/profile'))
    expect(screen.queryByRole('button', { name: 'Tác giả' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Tác giả' }).getAttribute('href')).toBe('/author/apply')
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/author/courses'))).toBe(false)
    cleanup()
  }
})
