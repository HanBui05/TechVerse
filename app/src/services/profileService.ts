import { request } from './api/client'

export type UserProfile = { id: string; fullName: string; email: string; phoneNumber: string | null; dateOfBirth: string | null; avatarUrl: string | null; roles: string[]; createdAt: string; updatedAt: string }
export type UpdateProfile = { fullName?: string; phoneNumber?: string | null; dateOfBirth?: string | null }
export type AuthorProfile = { applicationStatus: string; profile: { id: string; bio: string; expertise: string; portfolioUrl: string | null; status: string; version: number; reviewNote: string | null } | null }

export const getMyProfile = () => request<UserProfile>('/api/v1/users/me')
export const updateMyProfile = (data: UpdateProfile) => request<UserProfile>('/api/v1/users/me', { method: 'PATCH', body: JSON.stringify(data) })
export const getMyAuthorProfile = () => request<AuthorProfile>('/api/v1/author-profiles/me')
export const applyAuthorProfile = (data: { bio: string; expertise: string; portfolioUrl?: string }) => request('/api/v1/author-profiles/me', { method: 'POST', body: JSON.stringify(data) })
export const resubmitAuthorProfile = (data: { bio: string; expertise: string; portfolioUrl?: string; expectedVersion: number }) => request('/api/v1/author-profiles/me/resubmit', { method: 'PATCH', body: JSON.stringify(data) })
