import { afterEach, expect, it, vi } from 'vitest'
import { setAccessToken } from './api/client'
import { dashboard } from './dashboardService'

afterEach(() => {
  setAccessToken(null)
  vi.unstubAllGlobals()
})

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ status, message: 'Dashboard retrieved', data }), { status })

it('calls GET /api/v1/admin/dashboard and unwraps the envelope', async () => {
  const payload = {
    users: { total: 10, active: 9, locked: 1, newLast7Days: 2 },
  }
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) => json(payload))
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('admin-token')

  const result = await dashboard.admin()
  expect(result).toEqual(payload)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/api/v1/admin/dashboard')
})

it('calls GET /api/v1/moderator/dashboard and unwraps the envelope', async () => {
  const payload = {
    pending: { articles: 3, courses: 1, exerciseSets: 2, interviewQuestions: 4 },
    reports: { open: 5, hiddenPosts: 1 },
  }
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) => json(payload))
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('mod-token')

  const result = await dashboard.moderator()
  expect(result).toEqual(payload)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/api/v1/moderator/dashboard')
})
