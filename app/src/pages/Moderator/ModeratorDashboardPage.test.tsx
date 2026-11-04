import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModeratorDashboardPage } from './ModeratorDashboardPage'
import { setAccessToken } from '../../services/api/client'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const json = (data: unknown, status = 200) => new Response(JSON.stringify({ status, message: 'x', data }), { status })
const COUNTS: Record<string, number> = { 'workflowStatus=PENDING': 4, 'workflowStatus=CHANGES_REQUESTED': 2, 'publicationStatus=PUBLISHED': 18, 'publicationStatus=HIDDEN': 1 }

it('shows counts on both axes and the pending queue size; a failing count shows “—”', async () => {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    const key = [...url.searchParams].find(([k]) => k.endsWith('Status'))?.join('=') ?? ''
    if (key === 'publicationStatus=REMOVED') return json(null, 500)
    return json({ content: [], page: 0, size: 1, totalElements: COUNTS[key], totalPages: 1, hasNext: false })
  })
  vi.stubGlobal('fetch', fetch)
  setAccessToken('moderator')
  render(<MemoryRouter><ModeratorDashboardPage language="vi" /></MemoryRouter>)
  expect(await screen.findByText('4 bài đang chờ duyệt.')).not.toBeNull()
  const stats = screen.getByRole('region', { name: 'Bài viết cần xử lý' })
  expect(await within(stats).findByText('18')).not.toBeNull()
  for (const label of ['Chờ duyệt', 'Cần sửa', 'Đang công khai', 'Bị ẩn', 'Đã gỡ']) expect(within(stats).getByText(label)).not.toBeNull()
  expect(within(stats).getByText('—')).not.toBeNull()
  expect(fetch).toHaveBeenCalledTimes(5)
  expect(screen.getByRole('link', { name: 'Mở danh sách bài viết' }).getAttribute('href')).toBe('/moderator/articles')
})
