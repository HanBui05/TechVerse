import { StrictMode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { getAccessToken, setAccessToken } from './services/api/client'

const fetchMock = vi.fn<typeof fetch>()
const author = { id: 'approved-user', fullName: 'Approved Author', email: 'author@example.com', roles: ['LEARNER', 'AUTHOR'], phoneNumber: null, dateOfBirth: null, avatarUrl: null, createdAt: '', updatedAt: '' }

// Model the real JSON envelope at the network boundary.
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ status, message: status === 403 ? 'You do not have permission to access this resource' : 'OK', data }), { status })
}

// Reproduce F5 while the browser still holds a learner token issued before approval.
function reloadAuthorPage() {
  return render(<StrictMode><MemoryRouter initialEntries={['/author/blogs']}><App /></MemoryRouter></StrictMode>)
}

// Require the refreshed bearer for protected author resources, just as the backend does.
function authorApi(input: RequestInfo | URL, options?: RequestInit, denyOptions = false) {
  const path = new URL(String(input)).pathname
  if (path === '/api/v1/users/me') return response(author)
  const validAuthor = new Headers(options?.headers).get('Authorization') === 'Bearer test-author-access'
  if (!validAuthor || (denyOptions && path.endsWith('/options'))) return response(null, 403)
  if (path.endsWith('/options')) return response({ topics: { content: [{ id: 'java', name: 'Java Backend' }], hasNext: false }, tags: { content: [{ id: 'spring', name: 'Spring Boot' }], hasNext: false } })
  return response({ content: [], hasNext: false })
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
  const user = userEvent.setup()
  reloadAuthorPage()
  await user.click(await screen.findByRole('button', { name: '+ Tạo bài viết' }))
  expect(await screen.findByRole('option', { name: 'Java Backend' })).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Spring Boot' })).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(getAccessToken()).toBe('test-author-access')
  expect(screen.queryByText('author@example.com')).not.toBeNull()
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1)
})

// Catch regressions to native/unlabelled pagination and invalid previous-page navigation.
it('provides accessible pagination and disables navigation at empty-page boundaries', async () => {
  fetchMock.mockImplementation(async (input, options) => String(input).endsWith('/auth/refresh')
    ? response({ accessToken: 'test-author-access', expiresAt: '', expiresIn: 900 }) : authorApi(input, options))
  reloadAuthorPage()
  await screen.findByRole('button', { name: '+ Tạo bài viết' })
  expect(screen.queryByRole('navigation', { name: 'Phân trang' })).not.toBeNull()
  expect((screen.getByRole('button', { name: 'Trang trước' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Trang sau' }) as HTMLButtonElement).disabled).toBe(true)
})

it('waits for permission synchronization before requesting author resources', async () => {
  let finishRefresh!: (value: Response) => void
  const pending = new Promise<Response>(resolve => { finishRefresh = resolve })
  fetchMock.mockImplementation(async (input, options) => String(input).endsWith('/auth/refresh') ? pending : authorApi(input, options))
  reloadAuthorPage()
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/auth/refresh'))).toBe(true))
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/author/articles'))).toBe(false)
  expect(screen.queryByRole('button', { name: '+ Tạo bài viết' })).toBeNull()
  await act(async () => { finishRefresh(response({ accessToken: 'test-author-access', expiresAt: '', expiresIn: 900 })) })
  expect(await screen.findByRole('button', { name: '+ Tạo bài viết' })).toBeTruthy()
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
  expect((await screen.findByRole('alert')).textContent).toMatch(/permission/)
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1)
})
