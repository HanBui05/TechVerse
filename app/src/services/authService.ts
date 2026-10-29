import { request, setAccessToken } from './api/client'

export type LoginResponse = { accessToken: string; expiresAt: string; expiresIn: number }
export type LoginCredentials = { email: string; password: string }

export async function login(credentials: LoginCredentials) { const result = await request<LoginResponse>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(credentials) }); setAccessToken(result.accessToken); return result }
export async function logout() { try { await request<void>('/api/v1/auth/logout', { method: 'POST' }) } finally { setAccessToken(null) } }
export async function logoutAll() { await request<void>('/api/v1/auth/logout-all', { method: 'POST' }); setAccessToken(null) }
export async function restoreSession() { return request<LoginResponse>('/api/v1/auth/refresh', { method: 'POST' }).then(result => { setAccessToken(result.accessToken); return result }).catch(() => { setAccessToken(null); return null }) }
