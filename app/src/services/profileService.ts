import { request } from './api/client'

export type UserProfile = { id: string; fullName: string; email: string; phoneNumber: string | null; dateOfBirth: string | null; avatarUrl: string | null; roles: string[]; createdAt: string; updatedAt: string; hasLocalPassword: boolean }
export type UpdateProfile = { fullName?: string; phoneNumber?: string | null; dateOfBirth?: string | null }
export type AuthorReview = { decision: string; reviewNote: string | null; applicationVersion: number; bioSnapshot: string; expertiseSnapshot: string; portfolioUrlSnapshot: string | null; reviewedAt: string }
export type AuthorProfile = { applicationStatus: string; profile: { id: string; bio: string; expertise: string; portfolioUrl: string | null; status: string; version: number; reviewNote: string | null; reviewedAt: string | null; suspensionReason: string | null; suspendedAt: string | null; restorationNote: string | null; restoredAt: string | null; createdAt: string; updatedAt: string } | null; reviewHistory: AuthorReview[] }

export const getMyProfile = () => request<UserProfile>('/api/v1/users/me')
export const updateMyProfile = (data: UpdateProfile) => request<UserProfile>('/api/v1/users/me', { method: 'PATCH', body: JSON.stringify(data) })
export const changeMyPassword = (data: { currentPassword: string; newPassword: string; confirmPassword: string }) => request<void>('/api/v1/users/me/password', { method: 'PATCH', body: JSON.stringify(data) })
export const getMyAuthorProfile = () => request<AuthorProfile>('/api/v1/author-profiles/me')
export const applyAuthorProfile = (data: { bio: string; expertise: string; portfolioUrl?: string }) => request('/api/v1/author-profiles/me', { method: 'POST', body: JSON.stringify(data) })
export const resubmitAuthorProfile = (data: { bio: string; expertise: string; portfolioUrl?: string; expectedVersion: number }) => request('/api/v1/author-profiles/me/resubmit', { method: 'PATCH', body: JSON.stringify(data) })
