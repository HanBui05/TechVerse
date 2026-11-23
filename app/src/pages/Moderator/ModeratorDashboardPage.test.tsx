import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ModeratorDashboardPage } from './ModeratorDashboardPage'
import { setAccessToken } from '../../services/api/client'
import type { ModeratorDashboard } from '../../types/dashboard'

afterEach(() => {
  cleanup()
  setAccessToken(null)
  vi.unstubAllGlobals()
})

const json = (data: unknown, status = 200, code?: string) =>
  new Response(JSON.stringify({ status, code, message: 'Dashboard retrieved', data }), { status })

const FULL_MOD: ModeratorDashboard = {
  pending: {
    articles: 4,
    courses: 2,
    exerciseSets: 5,
    interviewQuestions: 7,
  },
  reports: {
    open: 3,
    hiddenPosts: 1,
  },
}

it('fetches GET /api/v1/moderator/dashboard once, renders the 6 queue links with their counts and queue card, and never shows revenue', async () => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) => json(FULL_MOD))
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('moderator')

  render(<MemoryRouter><ModeratorDashboardPage language="vi" /></MemoryRouter>)

  expect(await screen.findByText('4 bài đang chờ duyệt.')).toBeTruthy()

  // Only 1 API call to /api/v1/moderator/dashboard (no longer 5 calls from useArticleStats)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/api/v1/moderator/dashboard')

  const expectedLinks: [RegExp, string][] = [
    [/Bài viết chờ duyệt.*4/, '/moderator/articles'],
    [/Khóa học chờ duyệt.*2/, '/moderator/courses'],
    [/Bộ bài tập chờ duyệt.*5/, '/moderator/exercises'],
    [/Câu hỏi phỏng vấn chờ duyệt.*7/, '/moderator/interview-questions'],
    [/Báo cáo chờ xử lý.*3/, '/moderator/reports'],
    [/Nội dung đang ẩn.*1/, '/moderator/reports?tab=hidden'],
  ]
  for (const [labelRegex, href] of expectedLinks) {
    const link = screen.getByRole('link', { name: labelRegex })
    expect(link.getAttribute('href')).toBe(href)
  }

  expect(screen.getByRole('link', { name: 'Mở danh sách bài viết' }).getAttribute('href')).toBe('/moderator/articles')

  // Never contains any revenue or order labels/numbers
  for (const forbidden of [/Doanh thu/i, /Revenue/i, /Tổng thu/i, /Nền tảng giữ/i, /Tác giả nhận/i, /Đơn đã thanh toán/i, /₫/]) {
    expect(screen.queryByText(forbidden)).toBeNull()
  }
})

it('shows "—" and an error alert with Retry when the request fails, and recovers on retry', async () => {
  let shouldFail = true
  const fetchMock = vi.fn(async () => (shouldFail ? json(null, 500, 'INTERNAL_ERROR') : json(FULL_MOD)))
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('moderator')
  const user = userEvent.setup()

  render(<MemoryRouter><ModeratorDashboardPage language="vi" /></MemoryRouter>)

  const alert = await screen.findByRole('alert')
  expect(within(alert).getByText('Không tải được số liệu. Hãy thử lại.')).toBeTruthy()
  expect(screen.getAllByText('—')).toHaveLength(6)
  expect(screen.getByText('Xem và xử lý các bài viết được gửi từ tác giả.')).toBeTruthy()

  shouldFail = false
  await user.click(within(alert).getByRole('button', { name: 'Thử lại' }))

  expect(await screen.findByText('4 bài đang chờ duyệt.')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('charts pending work by queue, largest first, without hidden content, and hides the chart on error', async () => {
  let fail = false
  vi.stubGlobal('fetch', vi.fn(async () => (fail ? json(null, 500, 'INTERNAL_ERROR') : json(FULL_MOD))))
  setAccessToken('mod-token')
  const user = userEvent.setup()

  render(<MemoryRouter><ModeratorDashboardPage language="vi" /></MemoryRouter>)

  const chart = await screen.findByRole('img', { name: /^Việc đang chờ theo hàng đợi:/ })
  expect(chart.getAttribute('aria-label')).toBe('Việc đang chờ theo hàng đợi: Câu hỏi phỏng vấn 7, Bộ bài tập 5, Bài viết 4, Báo cáo 3, Khóa học 2')

  fail = true
  await user.click(screen.getByRole('button', { name: 'Tải lại' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('img', { name: /^Việc đang chờ theo hàng đợi/ })).toBeNull()
})
