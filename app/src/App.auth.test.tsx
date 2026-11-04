import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import App from './App'
import { getAccessToken, request, setAccessToken } from './services/api/client'
import { restoreSession } from './services/authService'
import { isEmail } from './components/auth/AuthLayout'

describe('isEmail', () => {
  it.each(['user@example..com', 'user@.example.com', 'user@example.com.', 'user@-example.com', 'user name@example.com', 'user..name@example.com', '.user@example.com', 'user.@example.com', `${'a'.repeat(65)}@example.com`, 'user@', '@example.com', `${'a'.repeat(243)}@example.com`])('rejects %s', value => expect(isEmail(value)).toBe(false))
  it.each(['user@example.com', 'first.last+tag@sub.example.co', 'user@localhost'])('accepts %s', value => expect(isEmail(value)).toBe(true))
})

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
    [['LEARNER'], '/'],
    [['LEARNER', 'AUTHOR'], '/'],
    [['MODERATOR'], '/moderator'],
    [['ADMIN', 'MODERATOR'], '/admin'],
  ])('completes a Google session and routes %j to %s', async (roles, destination) => {
    successfulGoogleSession(roles)
    renderApp('/auth/callback?status=success')
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(destination))
    expect(getAccessToken()).toBe('test-google-access')
    expect(localStorage.getItem('techverse-authenticated')).toBe('true')
    // Only the session bootstrap counts: a landing page may load its own data (the Moderator dashboard loads its counts).
    expect(fetchMock.mock.calls.filter(([url]) => /\/api\/v1\/(auth|users)\//.test(String(url)))).toHaveLength(2)
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
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has('Authorization')).toBe(false)
    expect(screen.getAllByText('Google Learner').length).toBeGreaterThan(0)
  })

  it.each(['/auth/callback/', '/AUTH/CALLBACK'])('also suppresses old bootstrap for router-equivalent callback %s', async path => {
    localStorage.setItem('techverse-authenticated', 'true')
    setAccessToken('test-old-account-access')
    successfulGoogleSession()
    renderApp(`${path}?status=success`)
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'))
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
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'))
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
    expect(screen.getByTestId('location').textContent).toBe('/')
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
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'))
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
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'))
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

  it('keeps password login and its role routing working for moderators', async () => {
    fetchMock.mockImplementation(async (input) => String(input).endsWith('/login')
      ? apiResponse({ accessToken: 'test-password-access' }) : apiResponse({ ...profile, roles: ['MODERATOR'] }))
    const user = userEvent.setup()
    renderApp('/login')
    await user.type(screen.getByLabelText('Email'), 'mod@example.com')
    await user.type(screen.getByLabelText('Mật khẩu', { exact: true }), 'Password123!')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/moderator'))
  })

  it('keeps password login and its role routing working', async () => {
    fetchMock.mockImplementation(async (input) => String(input).endsWith('/login')
      ? apiResponse({ accessToken: 'test-password-access' }) : apiResponse(profile))
    const user = userEvent.setup()
    renderApp('/login')
    await user.type(screen.getByLabelText('Email'), 'learner@example.com')
    await user.type(screen.getByLabelText('Mật khẩu', { exact: true }), 'Password123!')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'))
    expect(getAccessToken()).toBe('test-password-access')
  })
})

const alerts = {
  vi: {
    login: 'Không thể đăng nhập. Vui lòng kiểm tra lại thông tin.',
    register: 'Không thể tạo tài khoản. Vui lòng kiểm tra lại thông tin.',
    system: 'Hệ thống tạm thời chưa thể xử lý yêu cầu. Vui lòng thử lại sau.',
  },
  en: {
    login: 'Unable to log in. Please review your information and try again.',
    register: 'Unable to create your account. Please review your information and try again.',
    system: 'The system cannot process your request right now. Please try again later.',
  },
}
const labels = {
  vi: { name: 'Tên đăng nhập', email: 'Email', password: 'Mật khẩu', confirm: 'Xác nhận mật khẩu', login: 'Đăng nhập', register: 'Tạo tài khoản', show: 'Hiện mật khẩu', hide: 'Ẩn mật khẩu' },
  en: { name: 'Username', email: 'Email', password: 'Password', confirm: 'Confirm password', login: 'Log in', register: 'Create account', show: 'Show password', hide: 'Hide password' },
}
type Lang = keyof typeof labels
type User = ReturnType<typeof userEvent.setup>

// Fill the register form; each field defaults to a valid value unless overridden.
async function fillRegister(user: User, lang: Lang, values: Partial<Record<'name' | 'email' | 'password' | 'confirm', string>> = {}) {
  const data = { name: 'Local Learner', email: 'local@example.com', password: 'Password123!', ...values }
  const filled = { ...data, confirm: values.confirm ?? data.password }
  for (const key of ['name', 'email', 'password', 'confirm'] as const) {
    const field = screen.getByLabelText(labels[lang][key], { exact: true })
    // Typing 150+ characters key by key times out under a loaded suite; paste long values instead.
    if (filled[key].length > 20) { await user.click(field); await user.paste(filled[key]) }
    else await user.type(field, filled[key])
  }
}

async function fillLogin(user: User, lang: Lang, email = 'learner@example.com', password = 'Password123!') {
  if (email) await enter(user, screen.getByLabelText(labels[lang].email), email)
  if (password) await enter(user, screen.getByLabelText(labels[lang].password, { exact: true }), password)
}
// Long strings are pasted: typing 255 characters alone nears the 5 s test timeout.
async function enter(user: User, field: HTMLElement, value: string) {
  if (value.length <= 20) return user.type(field, value)
  await user.click(field)
  await user.paste(value)
}

// Answer the submitting endpoint with a status (or network failure) carrying a backend message that must never be shown.
function failingApi(endpoint: 'login' | 'register', outcome: number | 'network') {
  fetchMock.mockImplementation(async input => {
    const path = new URL(String(input)).pathname
    if (path === '/api/v1/auth/refresh') return apiResponse(null, 401)
    if (path !== `/api/v1/auth/${endpoint}`) throw new Error(`Unexpected API path: ${path}`)
    if (outcome === 'network') throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify({ status: outcome, message: 'BACKEND_SECRET_MESSAGE', data: null }), { status: outcome, headers: { 'Content-Type': 'application/json' } })
  })
}

function expectNoBackendMessage() {
  expect(document.body.textContent).not.toContain('BACKEND_SECRET_MESSAGE')
  expect(document.body.textContent).not.toContain('Failed to fetch')
}

describe('Auth layout and tabs', () => {
  it('shares one mounted layout between login and register tabs', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    // The tab nav survives the route change; the form panel (its heading) remounts.
    const tabs = screen.getByRole('navigation', { name: 'Đăng nhập hoặc đăng ký' })
    const panel = screen.getByRole('heading', { level: 1 })
    expect(screen.getByRole('link', { name: 'Đăng nhập' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Đăng ký' }).getAttribute('aria-current')).toBeNull()
    await user.click(screen.getByRole('link', { name: 'Đăng ký' }))
    expect(screen.getByTestId('location').textContent).toBe('/register')
    expect(screen.getByRole('link', { name: 'Đăng ký' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Đăng nhập' }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Đăng nhập hoặc đăng ký' })).toBe(tabs)
    expect(screen.getByRole('heading', { level: 1 })).not.toBe(panel)
    await user.click(screen.getByRole('link', { name: 'Đăng nhập ngay' }))
    expect(screen.getByTestId('location').textContent).toBe('/login')
    await user.click(screen.getByRole('link', { name: 'Đăng ký ngay' }))
    expect(screen.getByTestId('location').textContent).toBe('/register')
  })

  it.each([
    ['vi', '/login', 'Chào mừng trở lại!', 'trở lại!'],
    ['vi', '/register', 'Tạo tài khoản', 'tài khoản'],
    ['en', '/login', 'Welcome back!', 'back!'],
    ['en', '/register', 'Create an account', 'account'],
  ])('%s %s heading keeps its copy with an accented part', (lang, path, title, accent) => {
    localStorage.setItem('techverse-language', lang)
    renderApp(path)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toBe(title)
    expect(heading.querySelector('span')?.textContent).toBe(accent)
  })

  it.each([['vi', '/login'], ['vi', '/register'], ['en', '/login'], ['en', '/register']] as const)('%s %s shows visible labels and disables native validation', (lang, path) => {
    localStorage.setItem('techverse-language', lang)
    renderApp(path)
    expect(document.querySelector('form')?.noValidate).toBe(true)
    const keys = path === '/login' ? ['email', 'password'] as const : ['name', 'email', 'password', 'confirm'] as const
    for (const key of keys) {
      const label = [...document.querySelectorAll('label')].find(item => item.textContent === labels[lang][key])
      expect(label, labels[lang][key]).toBeTruthy()
      expect(label?.classList.contains('sr-only')).toBe(false)
    }
  })
})

describe('Auth local validation', () => {
  it.each([
    ['invalid email', { email: 'not-an-email' }, ['email']],
    ['email over 254 characters', { email: `${'a'.repeat(243)}@example.com` }, ['email']],
    ['full name over 150 characters', { name: 'a'.repeat(151) }, ['name']],
    ['blank full name', { name: '   ' }, ['name']],
    ['password under 8 characters', { password: 'Pass12!' }, ['password']],
    ['password over 72 characters', { password: 'a'.repeat(73) }, ['password']],
    ['password over 72 UTF-8 bytes (25 × ệ)', { password: 'ệ'.repeat(25) }, ['password']],
    ['mismatched confirmation', { confirm: 'Password999!' }, ['confirm']],
  ] as const)('register blocks %s without a request', async (_case, values, invalid) => {
    const user = userEvent.setup()
    renderApp('/register')
    await fillRegister(user, 'vi', values)
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe(alerts.vi.register)
    expect(alert.id).toBeTruthy()
    for (const key of ['name', 'email', 'password', 'confirm'] as const) {
      const field = screen.getByLabelText(labels.vi[key], { exact: true })
      if ((invalid as readonly string[]).includes(key)) {
        expect(field.getAttribute('aria-invalid'), key).toBe('true')
        expect(field.getAttribute('aria-describedby'), key).toBe(alert.id)
      } else expect(field.getAttribute('aria-invalid'), key).toBeNull()
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('register blocks an empty form and marks every field', async () => {
    const user = userEvent.setup()
    renderApp('/register')
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe(alerts.vi.register)
    for (const key of ['name', 'email', 'password', 'confirm'] as const) {
      expect(screen.getByLabelText(labels.vi[key], { exact: true }).getAttribute('aria-describedby'), key).toBe(alert.id)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('login leaves email format to the backend so existing Unicode emails can still sign in', async () => {
    failingApi('login', 401)
    const user = userEvent.setup()
    renderApp('/login')
    await fillLogin(user, 'vi', 'user@münchen.de')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    await screen.findByRole('alert')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).email).toBe('user@münchen.de')
  })

  it.each([
    ['empty form', '', '', ['email', 'password']],
    ['email over 254 characters', `${'a'.repeat(243)}@example.com`, 'Password123!', ['email']],
  ] as const)('login blocks %s without a request', async (_case, email, password, invalid) => {
    const user = userEvent.setup()
    renderApp('/login')
    await fillLogin(user, 'vi', email, password)
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe(alerts.vi.login)
    for (const key of ['email', 'password'] as const) {
      const field = screen.getByLabelText(labels.vi[key], { exact: true })
      expect(field.getAttribute('aria-describedby'), key).toBe((invalid as readonly string[]).includes(key) ? alert.id : null)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['vi', 'en'] as const)('local validation alerts follow the %s language', async lang => {
    localStorage.setItem('techverse-language', lang)
    const user = userEvent.setup()
    renderApp('/register')
    await user.click(screen.getByRole('button', { name: labels[lang].register }))
    expect(screen.getByRole('alert').textContent).toBe(alerts[lang].register)
    cleanup()
    renderApp('/login')
    await user.click(screen.getByRole('button', { name: labels[lang].login }))
    expect(screen.getByRole('alert').textContent).toBe(alerts[lang].login)
  })
})

describe('Auth API alerts', () => {
  const outcomes: [number | 'network', 'info' | 'system'][] = [[400, 'info'], [401, 'info'], [409, 'info'], ['network', 'system'], [429, 'system'], [500, 'system'], [503, 'system'], [418, 'system']]
  const cases = (['vi', 'en'] as const).flatMap(lang => outcomes.map(([outcome, kind]) => [lang, outcome, kind] as const))

  it.each(cases)('login %s %s shows the %s alert', async (lang, outcome, kind) => {
    localStorage.setItem('techverse-language', lang)
    failingApi('login', outcome)
    const user = userEvent.setup()
    renderApp('/login')
    await fillLogin(user, lang)
    await user.click(screen.getByRole('button', { name: labels[lang].login }))
    expect((await screen.findByRole('alert')).textContent).toBe(kind === 'info' ? alerts[lang].login : alerts[lang].system)
    expectNoBackendMessage()
    expect(screen.getByTestId('location').textContent).toBe('/login')
  })

  it.each(cases)('register %s %s shows the %s alert', async (lang, outcome, kind) => {
    localStorage.setItem('techverse-language', lang)
    failingApi('register', outcome)
    const user = userEvent.setup()
    renderApp('/register')
    await fillRegister(user, lang)
    await user.click(screen.getByRole('button', { name: labels[lang].register }))
    expect((await screen.findByRole('alert')).textContent).toBe(kind === 'info' ? alerts[lang].register : alerts[lang].system)
    expectNoBackendMessage()
    expect(screen.getByTestId('location').textContent).toBe('/register')
  })

  it('login 401 tries one failing refresh and then shows the same alert for any credential mistake', async () => {
    failingApi('login', 401)
    const user = userEvent.setup()
    renderApp('/login')
    await fillLogin(user, 'vi', 'unknown@example.com', 'Password123!')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect((await screen.findByRole('alert')).textContent).toBe(alerts.vi.login)
    const paths = fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)
    expect(paths).toEqual(['/api/v1/auth/login', '/api/v1/auth/refresh'])
    expect(fetchMock.mock.calls[1][1]?.method).toBe('POST')
    expect(getAccessToken()).toBeNull()
  })

  it('register 409 does not hint that the account already exists', async () => {
    failingApi('register', 409)
    const user = userEvent.setup()
    renderApp('/register')
    await fillRegister(user, 'vi')
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
    expect((await screen.findByRole('alert')).textContent).toBe(alerts.vi.register)
    expect(document.body.textContent).not.toMatch(/tồn tại|already/i)
  })
})

describe('Forgot password', () => {
  it.each([
    ['vi', 'network', alerts.vi.system], ['vi', 400, 'Không thể thực hiện yêu cầu. Vui lòng kiểm tra lại thông tin.'],
    ['en', 500, alerts.en.system], ['en', 400, 'Unable to process the request. Please review your information and try again.'],
  ] as const)('%s %s shows a localized alert instead of the raw error', async (lang, outcome, message) => {
    localStorage.setItem('techverse-language', lang)
    fetchMock.mockImplementation(async () => {
      if (outcome === 'network') throw new TypeError('Failed to fetch')
      return new Response(JSON.stringify({ status: outcome, message: 'BACKEND_SECRET_MESSAGE', data: null }), { status: outcome, headers: { 'Content-Type': 'application/json' } })
    })
    const user = userEvent.setup()
    renderApp('/forgot-password')
    await user.type(screen.getByLabelText('Email'), 'learner@example.com')
    await user.click(screen.getByRole('button', { name: lang === 'vi' ? 'Tiếp tục' : 'Continue' }))
    expect((await screen.findByRole('alert')).textContent).toBe(message)
    expectNoBackendMessage()
  })

  it('follows the English language setting', async () => {
    localStorage.setItem('techverse-language', 'en')
    fetchMock.mockResolvedValue(apiResponse(null))
    const user = userEvent.setup()
    renderApp('/forgot-password')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Recover your password')
    expect(screen.getByRole('link', { name: /Back to log in/ }).getAttribute('href')).toBe('/login')
    await user.type(screen.getByLabelText('Email'), 'learner@example.com')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByLabelText('OTP code')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Khôi phục|Tiếp tục|Mã OTP/)
  })

  it('keeps the three-step reset flow inside the shared auth card', async () => {
    fetchMock.mockImplementation(async input => String(input).endsWith('/verify-reset-otp') ? apiResponse({ resetToken: 'reset-token' }) : apiResponse(null))
    const user = userEvent.setup()
    renderApp('/forgot-password')
    expect(screen.getByRole('main').querySelector('[data-slot="card"]')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Quay lại đăng nhập/ }).getAttribute('href')).toBe('/login')
    await user.type(screen.getByLabelText('Email'), 'learner@example.com')
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    await user.type(await screen.findByLabelText('Mã OTP'), '123456')
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    await user.type(await screen.findByLabelText('Mật khẩu mới'), 'Password123!')
    await user.type(screen.getByLabelText('Xác nhận mật khẩu'), 'Password123!')
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    expect(await screen.findByText(/Mật khẩu đã được cập nhật/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Đăng nhập' }).getAttribute('href')).toBe('/login')
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual(['/api/v1/auth/forgot-password', '/api/v1/auth/verify-reset-otp', '/api/v1/auth/reset-password'])
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({ resetToken: 'reset-token', newPassword: 'Password123!', confirmPassword: 'Password123!' })
  })
})

describe('Auth password visibility and payload', () => {
  it.each(['vi', 'en'] as const)('register eye toggle (%s) only controls the password field', async lang => {
    localStorage.setItem('techverse-language', lang)
    const user = userEvent.setup()
    renderApp('/register')
    const password = screen.getByLabelText(labels[lang].password, { exact: true })
    const confirm = screen.getByLabelText(labels[lang].confirm, { exact: true })
    expect(screen.getAllByRole('button', { name: labels[lang].show })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: labels[lang].show }))
    expect(password.getAttribute('type')).toBe('text')
    expect(confirm.getAttribute('type')).toBe('password')
    await user.click(screen.getByRole('button', { name: labels[lang].hide }))
    expect(password.getAttribute('type')).toBe('password')
    expect(confirm.getAttribute('type')).toBe('password')
  })

  it.each(['vi', 'en'] as const)('login eye toggle (%s) still works with localized labels', async lang => {
    localStorage.setItem('techverse-language', lang)
    const user = userEvent.setup()
    renderApp('/login')
    const password = screen.getByLabelText(labels[lang].password, { exact: true })
    await user.click(screen.getByRole('button', { name: labels[lang].show }))
    expect(password.getAttribute('type')).toBe('text')
    await user.click(screen.getByRole('button', { name: labels[lang].hide }))
    expect(password.getAttribute('type')).toBe('password')
  })

  it('register sends exactly the four existing fields', async () => {
    fetchMock.mockResolvedValue(apiResponse({}))
    const user = userEvent.setup()
    renderApp('/register')
    await fillRegister(user, 'vi')
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/login'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ fullName: 'Local Learner', email: 'local@example.com', password: 'Password123!', confirmPassword: 'Password123!' })
  })
})

describe('Profile logout from all devices', () => {
  it('clears the session and returns to /login only after the dialog is confirmed and the API succeeds', async () => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute('open') }
    localStorage.setItem('techverse-authenticated', 'true')
    fetchMock.mockImplementation(async input => {
      const path = new URL(String(input)).pathname
      if (path === '/api/v1/auth/refresh') return apiResponse({ accessToken: 'test-access' })
      if (path === '/api/v1/users/me') return apiResponse({ ...profile, hasLocalPassword: true })
      if (path === '/api/v1/auth/logout-all') return apiResponse(null)
      throw new Error(`Unexpected API path: ${path}`)
    })
    const user = userEvent.setup()
    renderApp('/profile')
    await user.click(await screen.findByRole('button', { name: 'Đăng xuất khỏi tất cả thiết bị' }))
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/auth/logout-all'))).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Đăng xuất tất cả' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/login'))
    expect(localStorage.getItem('techverse-authenticated')).toBeNull()
  })
})
