import { API_BASE_URL, getSessionVersion, request, setAccessToken, setAccessTokenIfCurrent } from './api/client'
import type { UserProfile } from './profileService'

export type LoginResponse = { accessToken: string; expiresAt: string; expiresIn: number }
export type LoginCredentials = { email: string; password: string }
export type GoogleSession = { accessToken: string; profile: UserProfile }
export const GOOGLE_AUTH_URL = `${API_BASE_URL}/oauth2/authorization/google`
let sessionRestoration: { version: number; promise: Promise<LoginResponse | null> } | null = null

// Exchange the HttpOnly Google refresh cookie, then verify its identity before committing any UI session.
export async function completeGoogleSignIn(): Promise<GoogleSession> {
  const session = await request<LoginResponse>('/api/v1/auth/refresh', { method: 'POST' }, false)
  if (typeof session?.accessToken !== 'string' || !session.accessToken.trim()) {
    throw new Error('Invalid Google session')
  }
  // Use this exchange's access token explicitly; never fall back to an older browser session.
  const profile = await request<UserProfile>('/api/v1/users/me', {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  }, false)
  if (!profile?.id || !Array.isArray(profile.roles) || !profile.roles.every(role => typeof role === 'string')) {
    throw new Error('Invalid Google profile')
  }
  return { accessToken: session.accessToken, profile }
}

export async function login(credentials: LoginCredentials) { const result = await request<LoginResponse>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(credentials) }); setAccessToken(result.accessToken); return result }
export async function logout() { try { await request<void>('/api/v1/auth/logout', { method: 'POST' }) } finally { setAccessToken(null) } }
export async function logoutAll() { await request<void>('/api/v1/auth/logout-all', { method: 'POST' }); setAccessToken(null) }
// Refresh once per concurrent page bootstrap so F5 receives current database roles, even in StrictMode.
export async function restoreSession() {
  const version = getSessionVersion()
  if (sessionRestoration?.version === version) return sessionRestoration.promise
  const promise = request<LoginResponse>('/api/v1/auth/refresh', { method: 'POST' })
    .then(result => {
      if (typeof result?.accessToken !== 'string' || !result.accessToken) throw new Error('Invalid session')
      return setAccessTokenIfCurrent(result.accessToken, version) ? result : null
    })
    .catch(() => { setAccessTokenIfCurrent(null, version); return null })
    .finally(() => { if (sessionRestoration?.promise === promise) sessionRestoration = null })
  sessionRestoration = { version, promise }
  return promise
}
