import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AdminRevenuePage } from './AdminRevenuePage'
import { setAccessToken } from '../../../services/api/client'
import { json, page } from '../../Courses/fixtures'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

// Server numbers are printed as given; none of them equals a sum of the rows shown.
const totals = { itemCount: 12, grossAmount: 4200000, platformAmount: 840000, authorAmount: 3360000 }
const ledger = { earnedAmount: 9000000, paidOutAmount: 6500000, owedAmount: 2500000 }
const row = { courseId: 'c1', courseTitle: 'Java cơ bản', authorId: 'a1', authorName: 'Nguyễn Văn A', itemCount: 8, grossAmount: 2800000, platformAmount: 560000, authorAmount: 2240000 }
const body = (rows = [row]) => ({ totals, ledger, courses: page(rows, 3) })

const serve = (handler: () => Response = () => json(body())) => {
  const mock = vi.fn(async (_input: RequestInfo | URL) => handler())
  vi.stubGlobal('fetch', mock)
  return mock
}
const calls = (mock: ReturnType<typeof serve>) => mock.mock.calls.map(c => new URL(String(c[0])))
const show = (initial = '/admin/revenue') => render(<MemoryRouter initialEntries={[initial]}><AdminRevenuePage language="vi" /></MemoryRouter>)

it('prints the filtered totals, the all-time ledger and each course row with its author', async () => {
  const mock = serve()
  show('/admin/revenue?page=1')
  expect(screen.getByRole('status', { name: 'Đang tải doanh thu...' })).toBeTruthy()
  expect(await screen.findByText(/Java cơ bản/)).toBeTruthy()
  expect(screen.getByText('Đơn đã trả').nextElementSibling?.textContent).toBe('12')
  expect(screen.getByText('Tổng thu', { selector: 'dt' }).nextElementSibling?.textContent).toMatch(/4\.200\.000/)
  expect(screen.getByText('Hoa hồng sàn', { selector: 'dt' }).nextElementSibling?.textContent).toMatch(/840\.000/)
  expect(screen.getByText('Phần tác giả', { selector: 'dt' }).nextElementSibling?.textContent).toMatch(/3\.360\.000/)
  expect(screen.getByText(/Nguyễn Văn A/)).toBeTruthy()
  expect(screen.getByText(/8 lượt/)).toBeTruthy()
  expect(screen.getByText(/2\.240\.000/)).toBeTruthy()
  // The three all-time tiles are links to the payouts page.
  for (const [name, value] of [['Tác giả được hưởng', /9\.000\.000/], ['Đã chi', /6\.500\.000/], ['Còn nợ', /2\.500\.000/]] as const) {
    const link = screen.getByRole('link', { name: new RegExp(name) })
    expect(link.getAttribute('href')).toBe('/admin/payouts')
    expect(link.textContent).toMatch(value)
  }
  expect(calls(mock)[0].pathname).toBe('/api/v1/admin/revenue')
  expect(calls(mock)[0].searchParams.get('page')).toBe('1')
  expect(screen.getByRole('navigation', { name: 'Phân trang' })).toBeTruthy()
})

it('sends the date range from the URL, blocks from > to client-side, and can clear the filter', async () => {
  const mock = serve()
  const user = userEvent.setup()
  show('/admin/revenue?from=2026-11-01&to=2026-11-15')
  await screen.findByText(/Java cơ bản/)
  expect(calls(mock)[0].searchParams.get('from')).toBe('2026-11-01')
  expect(calls(mock)[0].searchParams.get('to')).toBe('2026-11-15')
  await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
  await waitFor(() => { const last = calls(mock).at(-1)!.searchParams; expect(last.has('from')).toBe(false); expect(last.has('to')).toBe(false) })
  cleanup()
  const blocked = serve()
  show('/admin/revenue?from=2026-11-15&to=2026-11-01')
  expect(await screen.findByText('Khoảng ngày không hợp lệ.')).toBeTruthy()
  expect(blocked).not.toHaveBeenCalled()
})

it('shows the range-specific empty state for a filter and the plain one without', async () => {
  serve(() => json(body([])))
  show('/admin/revenue?from=2026-11-01')
  expect(await screen.findByText('Không có lượt bán nào trong khoảng đã chọn.')).toBeTruthy()
  cleanup()
  serve(() => json(body([])))
  show()
  expect(await screen.findByText('Chưa có doanh thu')).toBeTruthy()
})

it('shows a load error with a retry that reloads, and the server message for a bad range', async () => {
  let fail = true
  serve(() => fail ? json(null, 500, 'INTERNAL') : json(body()))
  const user = userEvent.setup()
  show()
  expect(await screen.findByRole('alert')).toBeTruthy()
  fail = false
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText(/Java cơ bản/)).toBeTruthy()
  cleanup()
  serve(() => json(null, 400, 'REVENUE_FILTER_INVALID'))
  show()
  expect(await screen.findByText('Khoảng ngày không hợp lệ.')).toBeTruthy()
})
