import { request } from './api/client'

export type RegisterData = { fullName: string; email: string; password: string; confirmPassword: string }
export async function register(data: RegisterData) { return request('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(data) }) }
