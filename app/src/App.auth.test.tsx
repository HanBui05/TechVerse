import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import App from './App'
import { getAccessToken, request, setAccessToken } from './services/api/client'
import { restoreSession } from './services/authService'

const fetchMock = vi.fn<typeof fetch>()
const profile = { id: 'google-user', fullName: 'Google Learner', email: 'learner@example.com', phoneNumber: null, dateOfBirth: null, avatarUrl: null, roles: ['LEARNER'], createdAt: '', updatedAt: '' }

// Observe actual router transitions without replacing application routes.
function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return <><span data-testid="location">{location.pathname}{location.search}</span><button onClick={() => navigate('/auth/callback?status=success')}>Test Google callback</button></>
}

// Exercise the same StrictMode lifecycle as the real Vite entry point.
function renderApp(path: string) {
  return render(<StrictMode><MemoryRouter initialEntries={[path]}><App /><LocationProbe /></MemoryRouter></StrictMode>)
}

// Represent the backend envelope at the fetch boundary, not mocked auth services.
function apiResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify({ status, message: 'Response', data }), { status, headers: { 'Content-Type': 'application/json' } })
}

// Supply a fresh Google cookie exchange and the authenticated profile.
function successfulGoogleSession(roles = ['LEARNER']) {
  fetchMock.mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname
    if (path === '/api/v1/auth/refresh') return apiResponse({ accessToken: 'test-google-access', expiresAt: '', expiresIn: 900 })
    if (path === '/api/v1/users/me') return apiResponse({ ...profile, roles })
    throw new Error(`Unexpected API path: ${path}`)
  })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setAccessToken(null)
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  setAccessToken(null)
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('Google signup and login', () => {
  it.each(['/register', '/login'])('%s starts browser OAuth at the configured backend', (path) => {
    renderApp(path)
    const link = screen.getByRole('link', { name: /Google/ })
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '')
    expect(link.getAttribute('href')).toBe(`${apiBase}/oauth2/authorization/google`)
    expect(link.getAttribute('target')).not.toBe('_blank')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    [['LEARNER'], '/profile'],
    [['LEARNER', 'AUTHOR'], '/profile'],
    [['MODERATOR'], '/moderator'],
    [['ADMIN', 'MODERATOR'], '/admin'],
  ])('completes a Google session and routes %j to %s', async (roles, destination) => {
    successfulGoogleSession(roles)
    renderApp('/auth/callback?status=success')
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(destination))
    expect(getAccessToken()).toBe('test-google-access')
    expect(localStorage.getItem('techverse-authenticated')).toBe('true')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [refreshUrl, refreshOptions] = fetchMock.mock.calls[0]
    expect(String(refreshUrl)).toMatch(/\/api\/v1\/auth\/refresh$/)
    expect(refreshOptions?.method).toBe('POST')
    expect(refreshOptions?.credentials).toBe('include')
    const [, profileOptions] = fetchMock.mock.calls[1]
    expect(new Headers(profileOptions?.headers).get('Authorization')).toBe('Bearer test-google-access')
    expect(screen.getByTestId('location').textContent).not.toContain('token')
  })

  it('ignores old account state and does not bootstrap a competing session on callback', async () => {
    localStorage.setItem('techverse-authenticated', 'true')
    setAccessToken('test-old-account-access')
    successfulGoogleSession()
    renderApp('/auth/callback?status=success')
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/profile'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has('Authorization')).toBe(false)
    expect(screen.getAllByText('Google Learner').length).toBeGreaterThan(0)
  })

  it.each(['/auth/callback/', '/AUTH/CALLBACK'])('also suppresses old bootstrap for router-equivalent callback %s', async path => {
    localStorage.setItem('techverse-authenticated', 'true')
    setAccessToken('test-old-account-access')
    successfulGoogleSession()
    renderApp(`${path}?status=success`)
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/profile'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/auth\/refresh$/)
  })

  it('always verifies the exchanged Google bearer even if another token write competes', async () => {
    let finishRefresh!: (response: Response) => void
    const pendingRefresh = new Promise<Response>(resolve => { finishRefresh = resolve })
    fetchMock.mockImplementation(async input => String(input).endsWith('/auth/refresh') ? pendingRefresh : apiResponse(profile))
    renderApp('/auth/callback?status=success')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    setAccessToken('test-competing-access')
    await act(async () => { finishRefresh(apiResponse({ accessToken: 'test-google-access' })) })
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/profile'))
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('Authorization')).toBe('Bearer test-google-access')
  })

  it.each([
    ['automatic-refresh', 200], ['automatic-refresh', 401],
    ['explicit-restore', 200], ['explicit-restore', 401],
  ])('ignores late %s (HTTP %i) writes after switching to Google callback', async (mode, oldStatus) => {
    localStorage.setItem('techverse-authenticated', 'true')
    setAccessToken('test-old-account-access')
    let finishOldRefresh!: (response: Response) => void
    const pendingOldRefresh = new Promise<Response>(resolve => { finishOldRefresh = resolve })
    let refreshCount = 0
    fetchMock.mockImplementation(async (input, options) => {
      if (String(input).endsWith('/auth/refresh')) {
        refreshCount += 1
        if (refreshCount === 1) return pendingOldRefresh
        return apiResponse({ accessToken: 'test-google-access' })
      }
      const bearer = new Headers(options?.headers).get('Authorization')
      return bearer === 'Bearer test-google-access' ? apiResponse(profile) : apiResponse(null, mode === 'automatic-refresh' ? 401 : 500)
    })
    const oldWork = mode === 'automatic-refresh' ? request('/api/v1/users/me').catch(() => null) : restoreSession()
    await waitFor(() => expect(refreshCount).toBe(1))
    renderApp('/auth/callback?status=success')
    await waitFor(() => expect(getAccessToken()).toBe('test-google-access'))
    await act(async () => { finishOldRefresh(apiResponse({ accessToken: 'test-stale-restored-access' }, oldStatus)) })
    await oldWork
    expect(getAccessToken()).toBe('test-google-access')
    expect(localStorage.getItem('techverse-authenticated')).toBe('true')
    expect(screen.getByTestId('location').textContent).toBe('/profile')
    expect(refreshCount).toBe(2)
  })

  it.each([
    ['status=error&code=AUTH_SOCIAL_EMAIL_ALREADY_REGISTERED', /đăng ký bằng mật khẩu/],
    ['status=error&code=AUTH_SOCIAL_ACCOUNT_INACTIVE', /khóa/],
    ['status=error&code=AUTH_SOCIAL_PROFILE_INVALID', /xác minh/],
    ['status=error&code=OAUTH2_AUTHENTICATION_FAILED', /Google/],
    ['status=error&code=%3Cscript%3Ealert(1)%3C/script%3E', /Google/],
    ['', /không hợp lệ/],
    ['status=unknown', /không hợp lệ/],
    ['status=success&status=error', /không hợp lệ/],
    ['status=success&code=AUTH_SOCIAL_EMAIL_ALREADY_REGISTERED', /không hợp lệ/],
  ])('shows a safe callback error without using an old session: %s', async (query, message) => {
    localStorage.setItem('techverse-authenticated', 'true')
    setAccessToken('test-old-account-access')
    renderApp(`/auth/callback?${query}`)
    expect((await screen.findByRole('alert')).textContent).toMatch(message)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(localStorage.getItem('techverse-authenticated')).toBeNull()
    expect(getAccessToken()).toBeNull()
    expect(screen.getByRole('link', { name: /Google/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /mật khẩu/ }).getAttribute('href')).toBe('/login')
    expect(document.querySelector('script')).toBeNull()
  })

  it.each(['cookie', 'network', 'profile', 'invalid-token'])('does not authenticate on %s failure', async (failure) => {
    fetchMock.mockImplementation(async (input) => {
      if (failure === 'network') throw new TypeError('Failed to fetch')
      if (String(input).endsWith('/auth/refresh')) {
        if (failure === 'cookie') return apiResponse(null, 401)
        return apiResponse({ accessToken: failure === 'invalid-token' ? '' : 'test-google-access' })
      }
      return apiResponse(null, 401)
    })
    renderApp('/auth/callback?status=success')
    expect((await screen.findByRole('alert')).textContent).toMatch(/không thể|hết hạn/i)
    expect(getAccessToken()).toBeNull()
    expect(localStorage.getItem('techverse-authenticated')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(failure === 'profile' ? 2 : 1)
    expect(screen.getByTestId('location').textContent).toBe('/auth/callback?status=success')
  })

  it('ignores a URL-supplied destination and only follows profile roles', async () => {
    successfulGoogleSession()
    renderApp('/auth/callback?status=success&next=https://evil.example')
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/profile'))
  })

  it('does not commit a token before the Google profile has been verified', async () => {
    let finishProfile!: (response: Response) => void
    const pendingProfile = new Promise<Response>(resolve => { finishProfile = resolve })
    fetchMock.mockImplementation(async input => String(input).endsWith('/auth/refresh')
      ? apiResponse({ accessToken: 'test-google-access' }) : pendingProfile)
    renderApp('/auth/callback?status=success')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(getAccessToken()).toBeNull()
    expect(localStorage.getItem('techverse-authenticated')).toBeNull()
    expect(screen.getByRole('status').textContent).toMatch(/Đang xác thực/)
    await act(async () => { finishProfile(apiResponse(profile)) })
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/profile'))
    expect(getAccessToken()).toBe('test-google-access')
  })

  it('ignores late Google responses after the user leaves the callback', async () => {
    let finishProfile!: (response: Response) => void
    const pendingProfile = new Promise<Response>(resolve => { finishProfile = resolve })
    fetchMock.mockImplementation(async input => String(input).endsWith('/auth/refresh')
      ? apiResponse({ accessToken: 'test-google-access' }) : pendingProfile)
    const user = userEvent.setup()
    renderApp('/auth/callback?status=success')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await user.click(screen.getByRole('link', { name: 'TechVerse home' }))
    await act(async () => { finishProfile(apiResponse(profile)) })
    expect(getAccessToken()).toBeNull()
    expect(localStorage.getItem('techverse-authenticated')).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe('/')
  })

  it('restores the existing authenticated profile on normal page reload', async () => {
    localStorage.setItem('techverse-authenticated', 'true')
    setAccessToken('test-google-access')
    successfulGoogleSession()
    renderApp('/profile')
    expect((await screen.findAllByText('Google Learner')).length).toBeGreaterThan(0)
    expect(screen.getByTestId('location').textContent).toBe('/profile')
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/auth\/refresh$/)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1)
  })

  it('keeps normal automatic refresh single-flight when the access token expires', async () => {
    localStorage.setItem('techverse-authenticated', 'true')
    setAccessToken('test-expired-access')
    fetchMock.mockImplementation(async (input, options) => {
      if (String(input).endsWith('/auth/refresh')) return apiResponse({ accessToken: 'test-renewed-access' })
      return new Headers(options?.headers).get('Authorization') === 'Bearer test-renewed-access'
        ? apiResponse(profile) : apiResponse(null, 401)
    })
    const results = await Promise.all([request('/api/v1/users/me'), request('/api/v1/users/me')])
    expect(results).toEqual([profile, profile])
    expect(getAccessToken()).toBe('test-renewed-access')
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1)
  })

  it('keeps password registration working alongside Google', async () => {
    fetchMock.mockResolvedValue(apiResponse({}))
    const user = userEvent.setup()
    renderApp('/register')
    await user.type(screen.getByLabelText('Tên đăng nhập'), 'Local Learner')
    await user.type(screen.getByLabelText('Email'), 'local@example.com')
    await user.type(screen.getByLabelText('Mật khẩu', { exact: true }), 'Password123!')
    await user.type(screen.getByLabelText('Xác nhận mật khẩu'), 'Password123!')
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/login'))
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/auth\/register$/)
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ email: 'local@example.com', confirmPassword: 'Password123!' })
  })

  it('keeps password login and its role routing working', async () => {
    fetchMock.mockImplementation(async (input) => String(input).endsWith('/login')
      ? apiResponse({ accessToken: 'test-password-access' }) : apiResponse(profile))
    const user = userEvent.setup()
    renderApp('/login')
    await user.type(screen.getByLabelText('Email'), 'learner@example.com')
    await user.type(screen.getByLabelText('Mật khẩu', { exact: true }), 'Password123!')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/profile'))
    expect(getAccessToken()).toBe('test-password-access')
  })
})
