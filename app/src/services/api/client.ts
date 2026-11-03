export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '')

type ApiEnvelope<T> = { status: number; message: string; code?: string; data: T }

export class ApiError extends Error {
  status: number
  // Backend ErrorCode (e.g. TOPIC_EXISTED); the UI translates by code because `message` is always English.
  code?: string
  constructor(message: string, status: number, code?: string) { super(message); this.status = status; this.code = code }
}

let accessToken = sessionStorage.getItem('techverse-access-token')
let sessionVersion = 0
let refreshing: { version: number; promise: Promise<string | null> } | null = null

// Persist a token without changing the identity boundary of the current browser session.
function storeAccessToken(token: string | null) {
  accessToken = token
  if (token) sessionStorage.setItem('techverse-access-token', token)
  else sessionStorage.removeItem('techverse-access-token')
}

// Explicit login/logout/callback resets invalidate asynchronous writes from the previous session.
export function setAccessToken(token: string | null) { sessionVersion += 1; storeAccessToken(token) }
// Let background session restoration capture the identity boundary it belongs to.
export function getSessionVersion() { return sessionVersion }
// A late refresh may neither overwrite nor clear credentials belonging to a newer login.
export function setAccessTokenIfCurrent(token: string | null, expectedVersion: number) {
  if (sessionVersion !== expectedVersion) return false
  storeAccessToken(token)
  return true
}
// Expose the current in-memory bearer to existing session-aware UI callers.
export function getAccessToken() { return accessToken }

// Single-flight automatic renewal is scoped to a session, not shared with a subsequent login.
async function refreshAccessToken() {
  const version = sessionVersion
  if (refreshing?.version === version) return refreshing.promise
  const promise = fetch(`${API_BASE_URL}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async response => {
      if (!response.ok) throw new ApiError('Session expired', response.status)
      const body = await response.json() as ApiEnvelope<{ accessToken: string }>
      if (typeof body?.data?.accessToken !== 'string' || !body.data.accessToken) throw new ApiError('Invalid session', 401)
      return setAccessTokenIfCurrent(body.data.accessToken, version) ? body.data.accessToken : null
    })
    .catch(() => { setAccessTokenIfCurrent(null, version); return null })
    .finally(() => { if (refreshing?.promise === promise) refreshing = null })
  refreshing = { version, promise }
  return promise
}

// Send credentialed API requests, respecting explicit bearers and canceling stale-session renewals.
export async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const version = sessionVersion
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (accessToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: 'include' })
  if (response.status === 401 && retry && !path.includes('/auth/refresh')) {
    if (version !== sessionVersion) throw new ApiError('Session changed', 401)
    const token = await refreshAccessToken()
    if (token && version === sessionVersion) return request<T>(path, options, false)
  }
  const body = await response.json().catch(() => null) as ApiEnvelope<T> | null
  if (!response.ok) throw new ApiError(body?.message || 'Request failed', response.status, body?.code)
  return body?.data as T
}
