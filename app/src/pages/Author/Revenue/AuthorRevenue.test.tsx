import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthorRevenuePage } from './AuthorRevenuePage'
import { setAccessToken } from '../../../services/api/client'
import { json, page } from '../../Courses/fixtures'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

// Totals deliberately do not equal the sum of the rows shown: the page must print the server numbers, never add them up.
const totals = { itemCount: 12, grossAmount: 4200000, platformAmount: 840000, authorAmount: 3360000, paidOutAmount: 2000000, balanceAmount: 1360000 }
const item = { courseId: 'c1', courseTitle: 'Spring Boot từ A đến Z', paidAt: '2026-11-15T03:42:00Z', unitPriceAmount: 350000, commissionRateBps: 2000, commissionAmount: 70000, authorNetAmount: 280000 }
const row = { courseId: 'c1', courseTitle: 'Java cơ bản', itemCount: 8, grossAmount: 2800000, platformAmount: 560000, authorAmount: 2240000 }
const account = { bankId: '970436', bankName: 'Vietcombank', accountNo: '0123456789', accountName: 'NGUYEN VAN A', updatedAt: '2026-11-10T00:00:00Z' }
const view = (a: unknown = null) => ({ account: a, banks: [{ id: '970436', name: 'Vietcombank' }, { id: '970415', name: 'VietinBank' }] })
const payout = { amount: 1360000, bankReference: 'FT26319', accountNo: '6789', createdAt: '2026-11-15T03:42:00Z' }

type Handlers = { revenue: () => Response | Promise<Response>; courses: () => Response; account: () => Response; save: (body: unknown) => Response; payouts: () => Response }
const defaults: Handlers = { revenue: () => json({ totals, items: page([item], 3) }), courses: () => json(page([row])), account: () => json(view(account)), save: () => json(view(account)), payouts: () => json(page([payout])) }
function serve(over: Partial<Handlers> = {}) {
  const h = { ...defaults, ...over }
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const { pathname } = new URL(String(input))
    if (pathname.endsWith('/revenue/courses')) return h.courses()
    if (pathname.endsWith('/revenue')) return h.revenue()
    if (pathname.endsWith('/payout-account')) return init?.method === 'PUT' ? h.save(JSON.parse(String(init.body))) : h.account()
    return h.payouts()
  })
  vi.stubGlobal('fetch', mock)
  return mock
}
const calls = (mock: ReturnType<typeof serve>, suffix: string) => mock.mock.calls.map(c => new URL(String(c[0]))).filter(u => u.pathname.endsWith(suffix))
const show = (initial = '/author/revenue') => render(<MemoryRouter initialEntries={[initial]}><AuthorRevenuePage language="vi" /></MemoryRouter>)

it('prints the four filtered totals, the two all-time totals and every item from its own snapshot, without buyers', async () => {
  const mock = serve()
  show('/author/revenue?page=1')
  expect(screen.getByRole('status', { name: 'Đang tải doanh thu...' })).toBeTruthy()
  expect(await screen.findByText('Spring Boot từ A đến Z')).toBeTruthy()
  expect(screen.getByText('12')).toBeTruthy()
  expect(screen.getByText(/4\.200\.000/)).toBeTruthy(); expect(screen.getByText(/840\.000/, { selector: 'dd' })).toBeTruthy(); expect(screen.getByText(/3\.360\.000/)).toBeTruthy()
  expect(screen.getByText('Đã nhận').nextElementSibling?.textContent).toMatch(/2\.000\.000/)
  expect(screen.getByText('Chờ chi').nextElementSibling?.textContent).toMatch(/1\.360\.000/)
  expect(screen.getByText('Tính trên toàn bộ thời gian, không theo bộ lọc.')).toBeTruthy()
  expect(screen.getByText(/Giá 350\.000.*Nền tảng giữ 20% \(70\.000.*Bạn nhận 280\.000/)).toBeTruthy()
  expect(document.body.textContent).not.toMatch(/người mua/i)
  expect(calls(mock, '/revenue')[0].searchParams.get('page')).toBe('1')
  expect(screen.getByRole('navigation', { name: 'Phân trang' })).toBeTruthy()
})

it('shows the plain empty state without filters and the range-specific one with a date filter', async () => {
  const empty = () => json({ totals: { ...totals, itemCount: 0 }, items: page([]) })
  serve({ revenue: empty })
  show()
  expect(await screen.findByText('Chưa có doanh thu')).toBeTruthy()
  cleanup()
  serve({ revenue: empty })
  show('/author/revenue?from=2026-11-01')
  expect(await screen.findByText('Không có lượt bán nào trong khoảng đã chọn.')).toBeTruthy()
})

it('shows a load error with retry, and the permission message on 403', async () => {
  let status = 500
  serve({ revenue: () => status === 200 ? json({ totals, items: page([item]) }) : json(null, status, status === 403 ? 'ACCESS_DENIED' : 'INTERNAL') })
  const user = userEvent.setup()
  show()
  expect(await screen.findByRole('alert')).toBeTruthy()
  status = 403
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Bạn không có quyền thực hiện thao tác này.')).toBeTruthy()
  status = 200
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Spring Boot từ A đến Z')).toBeTruthy()
})

it('sends the URL date range to the API, clears it, and blocks from > to on the client', async () => {
  const mock = serve()
  const user = userEvent.setup()
  show('/author/revenue?from=2026-11-01&to=2026-11-16')
  await screen.findByText('Spring Boot từ A đến Z')
  const last = () => calls(mock, '/revenue').at(-1)!.searchParams
  expect([last().get('from'), last().get('to')]).toEqual(['2026-11-01', '2026-11-16'])
  expect(screen.getByRole('button', { name: /Từ ngày.*01\/11\/2026/ })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
  await waitFor(() => expect(last().get('from')).toBeNull()); expect(last().get('to')).toBeNull()
  cleanup()
  const blocked = serve()
  show('/author/revenue?from=2026-11-16&to=2026-11-01')
  expect(await screen.findByText('Khoảng ngày không hợp lệ.')).toBeTruthy()
  expect(calls(blocked, '/revenue')).toHaveLength(0)
})

it('hides the previous totals and rows while a new filter is loading', async () => {
  let release: (r: Response) => void = () => {}
  let first = true
  serve({ revenue: () => { if (first) { first = false; return json({ totals, items: page([item]) }) } return new Promise<Response>(resolve => { release = resolve }) } })
  const user = userEvent.setup()
  show('/author/revenue?from=2026-11-01')
  await screen.findByText('Spring Boot từ A đến Z')
  await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
  expect(await screen.findByRole('status', { name: 'Đang tải doanh thu...' })).toBeTruthy()
  expect(screen.queryByText('Spring Boot từ A đến Z')).toBeNull(); expect(screen.queryByText('Tính trên toàn bộ thời gian, không theo bộ lọc.')).toBeNull()
  release(json({ totals, items: page([item]) }))
  expect(await screen.findByText('Spring Boot từ A đến Z')).toBeTruthy()
})

it('filters by course from the By course tab and the label can be removed', async () => {
  const mock = serve()
  const user = userEvent.setup()
  show()
  await screen.findByText('Spring Boot từ A đến Z')
  await user.click(screen.getByRole('tab', { name: 'Theo khóa' }))
  await user.click(await screen.findByRole('button', { name: /Java cơ bản/ }))
  expect(await screen.findByText('Spring Boot từ A đến Z')).toBeTruthy()
  expect(screen.getByRole('tab', { name: 'Lượt bán', selected: true })).toBeTruthy()
  expect(calls(mock, '/revenue').at(-1)!.searchParams.get('courseId')).toBe('c1')
  expect(screen.getByText('Đang lọc: Java cơ bản')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Gỡ bộ lọc khóa' }))
  await waitFor(() => expect(calls(mock, '/revenue').at(-1)!.searchParams.get('courseId')).toBeNull())
  expect(screen.queryByText(/Đang lọc/)).toBeNull()
})

it('asks for a bank account when none is set, saves it from the form and shows it on the Payouts tab', async () => {
  let saved: unknown = null
  let current: unknown = null
  const mock = serve({ account: () => json(view(current)), save: body => { saved = body; current = account; return json(view(account)) } })
  const user = userEvent.setup()
  show()
  expect(await screen.findByText('Hãy khai tài khoản ngân hàng để nhận doanh thu.')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Khai tài khoản' }))
  const form = await screen.findByRole('dialog')
  await user.selectOptions(within(form).getByLabelText('Ngân hàng'), '970436')
  await user.type(within(form).getByLabelText('Số tài khoản'), '0123456789')
  await user.type(within(form).getByLabelText('Chủ tài khoản'), 'nguyen van a')
  await user.click(within(form).getByRole('button', { name: 'Lưu' }))
  expect(await screen.findByText('Đã lưu tài khoản nhận tiền.')).toBeTruthy()
  expect(saved).toEqual({ bankId: '970436', accountNo: '0123456789', accountName: 'nguyen van a' })
  expect(screen.queryByText('Hãy khai tài khoản ngân hàng để nhận doanh thu.')).toBeNull()
  await user.click(screen.getByRole('tab', { name: 'Chi trả' }))
  expect(await screen.findByText('NGUYEN VAN A')).toBeTruthy(); expect(screen.getByText('Vietcombank')).toBeTruthy()
  expect(calls(mock, '/payout-account').length).toBeGreaterThan(1)
})

it('rejects a malformed account number on the client and shows the server error inside the form', async () => {
  const mock = serve({ account: () => json(view(null)), save: () => json(null, 400, 'PAYOUT_ACCOUNT_INVALID') })
  const user = userEvent.setup()
  show()
  await user.click(await screen.findByRole('button', { name: 'Khai tài khoản' }))
  const form = await screen.findByRole('dialog')
  await user.selectOptions(within(form).getByLabelText('Ngân hàng'), '970436')
  await user.type(within(form).getByLabelText('Số tài khoản'), '12')
  await user.type(within(form).getByLabelText('Chủ tài khoản'), 'A')
  await user.click(within(form).getByRole('button', { name: 'Lưu' }))
  expect(await within(form).findByText('Thông tin tài khoản không hợp lệ.')).toBeTruthy()
  expect(mock.mock.calls.some(c => (c[1] as RequestInit | undefined)?.method === 'PUT')).toBe(false)
  await user.clear(within(form).getByLabelText('Số tài khoản'))
  await user.type(within(form).getByLabelText('Số tài khoản'), '0123456789')
  await user.click(within(form).getByRole('button', { name: 'Lưu' }))
  await waitFor(() => expect(mock.mock.calls.some(c => (c[1] as RequestInit | undefined)?.method === 'PUT')).toBe(true))
  expect(await within(form).findByText('Thông tin tài khoản không hợp lệ.')).toBeTruthy()
})

it('lists payouts with the masked account and shows the empty history copy', async () => {
  const mock = serve()
  const user = userEvent.setup()
  show()
  await user.click(await screen.findByRole('tab', { name: 'Chi trả' }))
  expect(await screen.findByText(/FT26319.*6789/)).toBeTruthy()
  expect(screen.getByText('Nền tảng chuyển khoản thủ công; thời gian nhận tùy đợt chi.')).toBeTruthy()
  expect(calls(mock, '/payouts')[0].searchParams.get('page')).toBe('0')
  cleanup()
  serve({ payouts: () => json(page([])) })
  show('/author/revenue?tab=payouts')
  expect(await screen.findByText('Chưa có khoản chi nào.')).toBeTruthy()
})
