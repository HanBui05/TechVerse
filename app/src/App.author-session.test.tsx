import { StrictMode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import App from './App'
import { getAccessToken, setAccessToken } from './services/api/client'

const fetchMock = vi.fn<typeof fetch>()
const author = { id: 'approved-user', fullName: 'Approved Author', email: 'author@example.com', roles: ['LEARNER', 'AUTHOR'], phoneNumber: null, dateOfBirth: null, avatarUrl: null, createdAt: '', updatedAt: '' }

// Model the real JSON envelope at the network boundary.
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ status, message: status === 403 ? 'You do not have permission to access this resource' : 'OK', data }), { status })
}

// Reproduce F5 while the browser still holds a learner token issued before approval.
function reloadAuthorPage(path = '/author/blogs') {
  return render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>)
}

// Require the refreshed bearer for protected author resources, just as the backend does.
function authorApi(input: RequestInfo | URL, options?: RequestInit, denyArticles = false) {
  const path = new URL(String(input)).pathname
  if (path === '/api/v1/users/me') return response(author)
  const validAuthor = new Headers(options?.headers).get('Authorization') === 'Bearer test-author-access'
  if (!validAuthor || (denyArticles && path.startsWith('/api/v1/author/articles'))) return response(null, 403)
  if (path.endsWith('/options')) return response({ topics: { content: [{ id: 'java', name: 'Java Backend' }], hasNext: false }, tags: { content: [{ id: 'spring', name: 'Spring Boot' }], hasNext: false } })
  return response({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, hasNext: false })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('techverse-authenticated', 'true')
  setAccessToken('test-learner-access')
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => { cleanup(); setAccessToken(null); localStorage.clear(); vi.unstubAllGlobals() })

it('F5 after approval loads author topics and tags using refreshed permissions without another login', async () => {
  fetchMock.mockImplementation(async (input, options) => String(input).endsWith('/auth/refresh')
    ? response({ accessToken: 'test-author-access', expiresAt: '', expiresIn: 900 }) : authorApi(input, options))
  reloadAuthorPage('/author/blogs/new')
  expect(await screen.findByRole('option', { name: 'Java Backend' })).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Spring Boot' })).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(getAccessToken()).toBe('test-author-access')
  expect(screen.queryByText('author@example.com')).not.toBeNull()
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1)
})

// The workspace links into the editor routes, which App must declare for Authors.
it('opens the editor from the workspace through the App routes', async () => {
  fetchMock.mockImplementation(async (input, options) => String(input).endsWith('/auth/refresh')
    ? response({ accessToken: 'test-author-access', expiresAt: '', expiresIn: 900 }) : authorApi(input, options))
  const user = userEvent.setup()
  reloadAuthorPage()
  await user.click(await screen.findByRole('link', { name: 'Viết bài đầu tiên' }))
  expect(await screen.findByRole('heading', { name: 'Viết bài mới' })).toBeTruthy()
})

it('waits for permission synchronization before requesting author resources', async () => {
  let finishRefresh!: (value: Response) => void
  const pending = new Promise<Response>(resolve => { finishRefresh = resolve })
  fetchMock.mockImplementation(async (input, options) => String(input).endsWith('/auth/refresh') ? pending : authorApi(input, options))
  reloadAuthorPage()
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/auth/refresh'))).toBe(true))
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/author/articles'))).toBe(false)
  expect(screen.queryByRole('link', { name: 'Viết bài mới' })).toBeNull()
  await act(async () => { finishRefresh(response({ accessToken: 'test-author-access', expiresAt: '', expiresIn: 900 })) })
  expect(await screen.findByRole('link', { name: 'Viết bài mới' })).toBeTruthy()
})

it('does not open author resources when the refresh session has expired', async () => {
  fetchMock.mockImplementation(async (input, options) => String(input).endsWith('/auth/refresh') ? response(null, 401) : authorApi(input, options))
  reloadAuthorPage()
  expect(await screen.findByRole('heading', { name: 'Chào mừng trở lại!' })).toBeTruthy()
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/author/articles'))).toBe(false)
  expect(getAccessToken()).toBeNull()
})

it('preserves real 403 errors without a refresh retry loop', async () => {
  fetchMock.mockImplementation(async (input, options) => String(input).endsWith('/auth/refresh')
    ? response({ accessToken: 'test-author-access', expiresAt: '', expiresIn: 900 }) : authorApi(input, options, true))
  reloadAuthorPage()
  expect((await screen.findByRole('alert')).textContent).toContain('Bạn không có quyền thực hiện thao tác này.')
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1)
})

// Approval happens in another session: F5 on /profile must pick up AUTHOR without leaving the page.
it('F5 on /profile after approval switches the sidebar to author blogs and stays on /profile', async () => {
  fetchMock.mockImplementation(async (input, options) => String(input).endsWith('/auth/refresh')
    ? response({ accessToken: 'test-author-access', expiresAt: '', expiresIn: 900 }) : authorApi(input, options))
  let path = ''
  function Where() { path = useLocation().pathname; return null }
  render(<StrictMode><MemoryRouter initialEntries={['/profile']}><App /><Where /></MemoryRouter></StrictMode>)
  const link = await screen.findByRole('link', { name: 'Tác giả' })
  expect(link.getAttribute('href')).toBe('/author/blogs')
  expect(path).toBe('/profile')
  expect(screen.queryByRole('heading', { name: 'Chào mừng trở lại!' })).toBeNull()
  expect(getAccessToken()).toBe('test-author-access')
})

it('routes /author/blogs/ai to the AI page for an AUTHOR and away for a non-author', async () => {
  fetchMock.mockImplementation(async (input, options) => String(input).endsWith('/auth/refresh')
    ? response({ accessToken: 'test-author-access', expiresAt: '', expiresIn: 900 }) : authorApi(input, options))
  reloadAuthorPage('/author/blogs/ai')
  expect(await screen.findByRole('heading', { name: 'Tạo bài bằng AI' })).toBeTruthy()
  cleanup()
  fetchMock.mockImplementation(async input => new URL(String(input)).pathname === '/api/v1/users/me' ? response({ ...author, roles: ['LEARNER'] }) : response(null, 403))
  reloadAuthorPage('/author/blogs/ai')
  await waitFor(() => expect(screen.queryByText('Đang kiểm tra quyền truy cập...')).toBeNull())
  expect(screen.queryByRole('heading', { name: 'Tạo bài bằng AI' })).toBeNull()
})
