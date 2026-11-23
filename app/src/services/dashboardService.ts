import { request } from './api/client'
import type { AdminDashboard, ModeratorDashboard } from '../types/dashboard'

export const dashboard = {
  admin: () => request<AdminDashboard>('/api/v1/admin/dashboard'),
  moderator: () => request<ModeratorDashboard>('/api/v1/moderator/dashboard'),
}
