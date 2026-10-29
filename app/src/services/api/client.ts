const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

type ApiEnvelope<T> = { status: number; message: string; data: T }

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

let accessToken = sessionStorage.getItem('techverse-access-token')
let refreshing: Promise<string | null> | null = null

export function setAccessToken(token: string | null) { accessToken = token; if (token) sessionStorage.setItem('techverse-access-token', token); else sessionStorage.removeItem('techverse-access-token') }
export function getAccessToken() { return accessToken }

async function refreshAccessToken() {
  if (!refreshing) refreshing = fetch(`${API_BASE_URL}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include' }).then(async response => { if (!response.ok) throw new ApiError('Session expired', response.status); const body = await response.json() as ApiEnvelope<{ accessToken: string }>; setAccessToken(body.data.accessToken); return body.data.accessToken }).catch(() => { setAccessToken(null); return null }).finally(() => { refreshing = null })
  return refreshing
}

export async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: 'include' })
  if (response.status === 401 && retry && !path.includes('/auth/refresh')) { const token = await refreshAccessToken(); if (token) return request<T>(path, options, false) }
  const body = await response.json().catch(() => null) as ApiEnvelope<T> | null
  if (!response.ok) throw new ApiError(body?.message || 'Request failed', response.status)
  return body?.data as T
}
