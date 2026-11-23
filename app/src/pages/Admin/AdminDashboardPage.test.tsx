import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AdminDashboardPage, useDashboardData } from './AdminDashboardPage'
import { dashboard } from '../../services/dashboardService'
import { setAccessToken } from '../../services/api/client'
import type { AdminDashboard } from '../../types/dashboard'

afterEach(() => {
  cleanup()
  setAccessToken(null)
  vi.unstubAllGlobals()
})

const json = (data: unknown, status = 200, code?: string) =>
  new Response(JSON.stringify({ status, code, message: 'Dashboard retrieved', data }), { status })

const FULL_ADMIN: AdminDashboard = {
  users: { total: 1248, active: 1210, locked: 38, newLast7Days: 64 },
  authors: { approved: 86, suspended: 3, pendingApplications: 4 },
  content: { articles: 342, courses: 28, exerciseSets: 45, interviewQuestions: 190, forumQuestions: 512 },
  orders: { awaitingConfirmation: 2, needsReconciliation: 1 },
  revenue: {
    allTime: { paidOrders: 128, grossAmount: 45600000, platformAmount: 9120000, authorAmount: 36480000 },
    last30Days: { paidOrders: 19, grossAmount: 6850000, platformAmount: 1370000, authorAmount: 5480000 },
  },
}

it('shows loading skeletons inside labeled tiles, then renders all counts, revenue table, action links, and keeps the 4 admin area shortcuts', async () => {
  let resolveFetch!: (res: Response) => void
  const fetchMock = vi.fn(() => new Promise<Response>(r => { resolveFetch = r }))
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('admin-token')

  render(<MemoryRouter><AdminDashboardPage language="vi" /></MemoryRouter>)

  // While loading: section heading & tile labels are already rendered, refresh is disabled
  expect(screen.getByRole('heading', { level: 2, name: 'Số liệu' })).toBeTruthy()
  expect(screen.getByText('Tổng người dùng')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Tải lại' }) as HTMLButtonElement).disabled).toBe(true)

  // Existing 4 admin shortcuts are immediately usable
  for (const [name, href] of [
    ['Hồ sơ tác giả', '/admin/author-applications'],
    ['Quản lý người dùng', '/admin/users'],
    ['Chủ đề', '/admin/topics'],
    ['Thẻ', '/admin/tags'],
  ] as const) {
    expect(screen.getByRole('link', { name: new RegExp(name) }).getAttribute('href')).toBe(href)
  }

  resolveFetch(json(FULL_ADMIN))

  // Numbers appear formatted by locale
  expect(await screen.findByText('1.248')).toBeTruthy()
  expect(screen.getByText('1.210')).toBeTruthy()
  expect(screen.getByText('38')).toBeTruthy()
  expect(screen.getByText('64')).toBeTruthy()
  expect(screen.getByText('86')).toBeTruthy()
  expect(screen.getByText('342')).toBeTruthy()
  expect(screen.getByText('512')).toBeTruthy()

  // 3 actionable links with accessible name reading both label and count
  const pendingAppsLink = screen.getByRole('link', { name: /Hồ sơ chờ duyệt.*4/ })
  expect(pendingAppsLink.getAttribute('href')).toBe('/admin/author-applications')

  const awaitingOrdersLink = screen.getByRole('link', { name: /Đơn chờ xác nhận.*2/ })
  // ALL: the count includes reported EXPIRED orders, which the default PENDING filter would hide.
  expect(awaitingOrdersLink.getAttribute('href')).toBe('/admin/orders?status=ALL&transferReported=true')

  const reconcileOrdersLink = screen.getByRole('link', { name: /Đơn cần đối chiếu.*1/ })
  expect(reconcileOrdersLink.getAttribute('href')).toBe('/admin/orders?status=ALL&needsReconciliation=true')

  // Revenue table: All time and Last 30 days with paidOrders and VND amounts
  const table = screen.getByRole('table')
  expect(within(table).getByText('Toàn thời gian')).toBeTruthy()
  expect(within(table).getByText('30 ngày qua')).toBeTruthy()
  expect(within(table).getByText('128')).toBeTruthy()
  expect(within(table).getByText('19')).toBeTruthy()
  expect(within(table).getByText(/45\.600\.000\s*₫/)).toBeTruthy()
  expect(within(table).getByText(/9\.120\.000\s*₫/)).toBeTruthy()
  expect(within(table).getByText(/36\.480\.000\s*₫/)).toBeTruthy()
  expect(within(table).getByText(/6\.850\.000\s*₫/)).toBeTruthy()
})

it('shows "—" and an error banner with Retry when loading fails, and recovers on retry', async () => {
  let shouldFail = true
  const fetchMock = vi.fn(async () => (shouldFail ? json(null, 500, 'INTERNAL_ERROR') : json(FULL_ADMIN)))
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('admin-token')
  const user = userEvent.setup()

  render(<MemoryRouter><AdminDashboardPage language="vi" /></MemoryRouter>)

  const alert = await screen.findByRole('alert')
  expect(within(alert).getByText('Không tải được số liệu. Hãy thử lại.')).toBeTruthy()
  expect(screen.getAllByText('—').length).toBeGreaterThan(5)

  shouldFail = false
  await user.click(within(alert).getByRole('button', { name: 'Thử lại' }))

  expect(await screen.findByText('1.248')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('hides missing groups and missing sub-fields instead of rendering 0', async () => {
  const partial: AdminDashboard = {
    users: { total: 50, active: 48 }, // locked and newLast7Days omitted
    // authors group completely omitted
    content: { articles: 12, courses: 5 }, // exerciseSets, interviewQuestions, forumQuestions omitted
    // orders omitted
    revenue: {
      allTime: { paidOrders: 10, grossAmount: 2000000 }, // platformAmount, authorAmount omitted; last30Days omitted
    },
  }
  vi.stubGlobal('fetch', vi.fn(async () => json(partial)))
  setAccessToken('admin-token')

  render(<MemoryRouter><AdminDashboardPage language="vi" /></MemoryRouter>)

  expect(await screen.findByText('50')).toBeTruthy()
  expect(screen.getByText('Tổng người dùng')).toBeTruthy()
  expect(screen.getByText('Đang hoạt động')).toBeTruthy()

  // Omitted sub-fields in users & content are not rendered
  expect(screen.queryByText('Đã khóa')).toBeNull()
  expect(screen.queryByText('Mới trong 7 ngày')).toBeNull()
  expect(screen.queryByText('Bộ bài tập')).toBeNull()
  expect(screen.queryByText('Câu hỏi phỏng vấn')).toBeNull()
  expect(screen.queryByText('Câu hỏi diễn đàn')).toBeNull()

  // Omitted group "Tác giả" and its tiles are not rendered
  expect(screen.queryByRole('heading', { level: 3, name: 'Tác giả' })).toBeNull()
  expect(screen.queryByText('Tác giả đã duyệt')).toBeNull()
  expect(screen.queryByText('Hồ sơ chờ duyệt')).toBeNull()

  // Omitted revenue period "30 ngày qua" and omitted columns "Nền tảng giữ" / "Tác giả nhận" are not rendered
  expect(screen.getByText('Toàn thời gian')).toBeTruthy()
  expect(screen.queryByText('30 ngày qua')).toBeNull()
  expect(screen.queryByText('Nền tảng giữ')).toBeNull()
  expect(screen.queryByText('Tác giả nhận')).toBeNull()
})

it('leaves a revenue cell empty, not "—", when only one period has that field', async () => {
  const partial: AdminDashboard = {
    revenue: {
      allTime: { paidOrders: 10, platformAmount: 400000 },
      last30Days: { paidOrders: 2 },
    },
  }
  vi.stubGlobal('fetch', vi.fn(async () => json(partial)))
  setAccessToken('admin-token')

  render(<MemoryRouter><AdminDashboardPage language="vi" /></MemoryRouter>)

  const table = await screen.findByRole('table')
  expect(within(table).getByText('Nền tảng giữ')).toBeTruthy()
  const last30 = within(table).getByRole('row', { name: /30 ngày qua/ })
  expect(within(last30).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['2', ''])
  expect(within(table).queryByText('—')).toBeNull()
})

it('keeps current numbers and disables Refresh with spinner while reloading, and only the newest request round may write', async () => {
  let call = 0
  let resolveReload!: (res: Response) => void

  const fetchMock = vi.fn(() => {
    call++
    if (call === 1) return Promise.resolve(json(FULL_ADMIN))
    return new Promise<Response>(r => { resolveReload = r })
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('admin-token')
  const user = userEvent.setup()

  render(<MemoryRouter><AdminDashboardPage language="vi" /></MemoryRouter>)
  expect(await screen.findByText('1.248')).toBeTruthy()

  // Click Refresh (call 2 starts): old number 1.248 stays on screen (no skeleton fallback), button is disabled
  const refreshBtn = screen.getByRole('button', { name: 'Tải lại' }) as HTMLButtonElement
  await user.click(refreshBtn)
  expect(screen.getByText('1.248')).toBeTruthy()
  expect(document.querySelector('[data-slot="stat-skeleton"]')).toBeNull()
  expect(refreshBtn.disabled).toBe(true)

  resolveReload(json({ ...FULL_ADMIN, users: { total: 3000, active: 2900, locked: 100, newLast7Days: 80 } }))
  expect(await screen.findByText('3.000')).toBeTruthy()
  expect(refreshBtn.disabled).toBe(false)

  // Verify out-of-order concurrent reloads: an older request resolving after a newer one never overwrites it
  let resolveOlder!: (res: Response) => void
  let resolveNewer!: (res: Response) => void
  let hookCall = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      hookCall++
      if (hookCall === 1) return new Promise<Response>(r => { resolveOlder = r })
      return new Promise<Response>(r => { resolveNewer = r })
    }),
  )

  const { result } = renderHook(() => useDashboardData(dashboard.admin))
  // Trigger a second reload before the first finishes
  act(() => {
    result.current.reload()
  })
  expect(hookCall).toBe(2)

  // Newer request (round 2) finishes first
  await act(async () => {
    resolveNewer(json({ users: { total: 5000 } }))
  })
  await waitFor(() => expect(result.current.data?.users?.total).toBe(5000))

  // Older request (round 1) finishes late -> ignored
  await act(async () => {
    resolveOlder(json({ users: { total: 1111 } }))
  })
  expect(result.current.data?.users?.total).toBe(5000)
})

it('supports English copy and formatting and ignores stale overlapping responses', async () => {
  let call = 0
  let resolveFirst!: (res: Response) => void
  const fetchMock = vi.fn(() => {
    call++
    if (call === 1) {
      return new Promise<Response>(r => { resolveFirst = r })
    }
    return Promise.resolve(
      json({
        ...FULL_ADMIN,
        users: { total: 2500, active: 2400, locked: 100, newLast7Days: 99 },
      }),
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('admin-token')

  const { rerender } = render(<MemoryRouter><AdminDashboardPage language="vi" /></MemoryRouter>)
  // Before call 1 finishes, a new load is triggered (e.g. language switch or refresh)
  rerender(<MemoryRouter><AdminDashboardPage language="en" /></MemoryRouter>)

  // Call 1 resolves with 1248, then if we trigger refresh in English (call 2 -> 2500) before a slower call resolves:
  resolveFirst(json(FULL_ADMIN))
  expect(await screen.findByText('1,248')).toBeTruthy()
  expect(screen.getByRole('heading', { level: 2, name: 'Overview' })).toBeTruthy()
  expect(screen.getByText('Total users')).toBeTruthy()
  expect(screen.getByText('Orders awaiting confirmation')).toBeTruthy()
  expect(screen.getByRole('link', { name: /Author applications/ }).getAttribute('href')).toBe('/admin/author-applications')

  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(await screen.findByText('2,500')).toBeTruthy()
})
