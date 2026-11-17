import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AdminOrdersPage } from './AdminOrdersPage'
import { setAccessToken } from '../../../services/api/client'
import { json, page } from '../../Courses/fixtures'
import type { AdminOrder } from '../../../types/courses'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const base: AdminOrder = {
  orderCode: 'TV000000000123', buyerId: 'u1', buyerName: 'Nguyễn Văn B', buyerEmail: 'b@mail.com', courseId: 'c1', courseTitle: 'Spring Boot từ A đến Z', amount: 350000, currency: 'VND',
  status: 'PENDING', createdAt: '2026-11-15T03:00:00Z', expiresAt: '2026-11-16T03:00:00Z', paidAt: null, transferReportedAt: null, needsReconciliation: false, reconciledAt: null, payments: [],
  provider: 'MANUAL', amountPaid: null,
}
const payosOrder: AdminOrder = { ...base, orderCode: 'TV000000000150', provider: 'PAYOS', amountPaid: 200000 }
const dup: AdminOrder = { ...base, orderCode: 'TV000000000098', courseTitle: 'React cơ bản', status: 'PAID', paidAt: '2026-11-15T04:00:00Z', needsReconciliation: true,
  payments: [{ reference: 'ABC123', amount: 350000, source: 'MANUAL', confirmedAt: '2026-11-15T04:00:00Z' }, { reference: 'XYZ999', amount: 350000, source: 'MANUAL', confirmedAt: '2026-11-15T05:00:00Z' }] }

type Handler = (url: URL, init?: RequestInit) => Response
const stub = (handler: Handler) => { const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => handler(new URL(String(url)), init)); vi.stubGlobal('fetch', fetchMock); return fetchMock }
const listOf = (...items: AdminOrder[]) => json(page(items))
const gets = (fetchMock: ReturnType<typeof stub>) => fetchMock.mock.calls.filter(([, init]) => !init?.method).map(([url]) => new URL(String(url)))
const posts = (fetchMock: ReturnType<typeof stub>) => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url, init]) => ({ path: new URL(String(url)).pathname, body: JSON.parse(String(init?.body)) }))
const show = (initial = '/admin/orders') => render(<MemoryRouter initialEntries={[initial]}><AdminOrdersPage language="vi" /></MemoryRouter>)

it('labels the source of every order; a payOS order shows what payOS received and opens a check-only sheet', async () => {
  stub(() => listOf(payosOrder, base))
  const user = userEvent.setup()
  show()
  await screen.findByText(/TV000000000150/)
  const rows = screen.getAllByRole('listitem')
  expect(within(rows[0]).getByText('payOS')).toBeTruthy()
  expect(within(rows[0]).getByText(/^payOS đã nhận 200\.000.₫ \/ 350\.000.₫$/)).toBeTruthy()
  expect(within(rows[1]).getByText('Chuyển khoản tay')).toBeTruthy()
  expect(within(rows[1]).getByRole('button', { name: 'Đối chiếu & xác nhận' })).toBeTruthy()
  await user.click(within(rows[0]).getByRole('button', { name: 'Xem · Kiểm tra' }))
  const sheet = await screen.findByRole('dialog', { name: /Đơn TV000000000150/ })
  expect(within(sheet).getByText('Đơn payOS không xác nhận tay; hãy bấm kiểm tra với payOS.')).toBeTruthy()
  expect(within(sheet).getByText(/payOS đã nhận 200\.000/)).toBeTruthy()
  expect(within(sheet).queryByLabelText(/Số tiền trên sao kê/)).toBeNull()
  expect(within(sheet).queryByRole('button', { name: 'Kiểm tra lại…' })).toBeNull()
})

it('checks a payOS order with the server: the sheet shows the returned order, stays open and the list reloads', async () => {
  let synced = false
  const fetchMock = stub((url, init) => init?.method === 'POST' ? (synced = true, json({ ...payosOrder, status: 'PAID', paidAt: '2026-11-16T03:00:00Z', amountPaid: 350000 })) : synced ? listOf() : listOf(payosOrder))
  const user = userEvent.setup()
  show()
  await user.click(await screen.findByRole('button', { name: 'Xem · Kiểm tra' }))
  const sheet = await screen.findByRole('dialog')
  await user.click(within(sheet).getByRole('button', { name: 'Kiểm tra với payOS' }))
  expect(await within(sheet).findByText('Đã ghi nhận thanh toán.')).toBeTruthy()
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url]) => new URL(String(url)).pathname)).toEqual(['/api/v1/admin/orders/TV000000000150/sync'])
  await waitFor(() => expect(gets(fetchMock).length).toBe(2))
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(within(screen.getByRole('dialog')).getByText('Đã nhận tiền')).toBeTruthy()
  expect(within(screen.getByRole('dialog')).queryByText(/payOS đã nhận/)).toBeNull()
})

it.each([
  [json({ ...payosOrder }), 'Chưa ghi nhận thanh toán.'],
  [json(null, 503, 'PAYMENT_PROVIDER_UNAVAILABLE'), 'Cổng thanh toán tạm thời không phản hồi; hãy thử lại.'],
  [json(null, 409, 'PAYMENT_STATE_INVALID'), 'Đơn này không thanh toán qua payOS.'],
])('reports the payOS check result in the sheet (%#)', async (reply, text) => {
  stub((url, init) => init?.method === 'POST' ? reply.clone() : listOf(payosOrder))
  const user = userEvent.setup()
  show()
  await user.click(await screen.findByRole('button', { name: 'Xem · Kiểm tra' }))
  const sheet = await screen.findByRole('dialog')
  await user.click(within(sheet).getByRole('button', { name: 'Kiểm tra với payOS' }))
  expect(await within(sheet).findByText(text)).toBeTruthy()
})

it('lists pending orders by default with buyer, amount and the transfer-reported label that is not a confirmation', async () => {
  const fetchMock = stub(() => listOf({ ...base, transferReportedAt: '2026-11-15T03:50:00Z' }))
  show()
  expect(screen.getByRole('status', { name: 'Đang tải đơn hàng...' })).toBeTruthy()
  expect(await screen.findByText(/TV000000000123/)).toBeTruthy()
  expect(screen.getByText(/Spring Boot từ A đến Z/)).toBeTruthy()
  expect(screen.getByText(/Nguyễn Văn B/)).toBeTruthy(); expect(screen.getByText(/b@mail\.com/)).toBeTruthy()
  expect(screen.getByText(/350\.000/)).toBeTruthy()
  expect(screen.getByText(/Người học đã báo chuyển khoản/).getAttribute('title')).toBe('Cần kiểm tra sao kê trước khi xác nhận.')
  expect(screen.getByRole('button', { name: 'Đối chiếu & xác nhận' })).toBeTruthy()
  expect(gets(fetchMock)[0].searchParams.get('status')).toBe('PENDING')
})

it('sends only the chosen filters, resets the page and can clear them', async () => {
  const fetchMock = stub(url => url.searchParams.has('code') ? listOf() : listOf(base))
  const user = userEvent.setup()
  show('/admin/orders?page=2')
  await screen.findByText(/TV000000000123/)
  expect(gets(fetchMock)[0].searchParams.get('page')).toBe('2')
  await user.click(screen.getByRole('checkbox', { name: 'Đã báo chuyển khoản' }))
  await waitFor(() => expect(gets(fetchMock).at(-1)!.searchParams.get('transferReported')).toBe('true'))
  expect(gets(fetchMock).at(-1)!.searchParams.get('page')).toBe('0')
  await user.click(screen.getByRole('checkbox', { name: 'Cần đối chiếu' }))
  await waitFor(() => expect(gets(fetchMock).at(-1)!.searchParams.get('needsReconciliation')).toBe('true'))
  await user.selectOptions(screen.getByLabelText('Trạng thái'), 'ALL')
  await waitFor(() => expect(gets(fetchMock).at(-1)!.searchParams.has('status')).toBe(false))
  fireEvent.change(screen.getByLabelText('Mã đơn'), { target: { value: ' TV000000000123 ' } })
  await user.type(screen.getByLabelText('Mã đơn'), '{Enter}')
  await waitFor(() => expect(gets(fetchMock).at(-1)!.searchParams.get('code')).toBe('TV000000000123'))
  await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
  await waitFor(() => { const last = gets(fetchMock).at(-1)!.searchParams; expect(last.get('status')).toBe('PENDING'); expect(last.has('code')).toBe(false); expect(last.has('transferReported')).toBe(false); expect(last.has('needsReconciliation')).toBe(false) })
})

it('shows the empty state with a way to clear the filters, and an error with retry', async () => {
  let fail = true
  stub(() => fail ? json(null, 500, 'INTERNAL') : listOf())
  const user = userEvent.setup()
  show()
  expect(await screen.findByRole('alert')).toBeTruthy()
  fail = false
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Không có đơn phù hợp')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Xóa bộ lọc' })).toBeTruthy()
})

it('confirms after a re-check dialog: amount prefilled from the order, exact body, list reloaded from the server', async () => {
  let confirmed = false
  const fetchMock = stub((url, init) => init?.method === 'POST' ? (confirmed = true, json({ ...base, status: 'PAID', needsReconciliation: false })) : confirmed ? listOf() : listOf(base))
  const user = userEvent.setup()
  show()
  await user.click(await screen.findByRole('button', { name: 'Đối chiếu & xác nhận' }))
  const sheet = await screen.findByRole('dialog', { name: /Xác nhận đơn TV000000000123/ })
  const amount = within(sheet).getByLabelText(/Số tiền trên sao kê/) as HTMLInputElement
  expect(amount.value).toBe('350000')
  const review = within(sheet).getByRole('button', { name: 'Kiểm tra lại…' }) as HTMLButtonElement
  expect(review.disabled).toBe(true)
  await user.type(within(sheet).getByLabelText(/Mã giao dịch sao kê/), '  FT2611150001 ')
  expect(review.disabled).toBe(false)
  await user.click(review)
  const check = await screen.findByRole('alertdialog')
  expect(check.textContent).toMatch(/350\.000/); expect(check.textContent).toContain('TV000000000123'); expect(check.textContent).toContain('FT2611150001')
  expect(posts(fetchMock)).toHaveLength(0)
  await user.click(within(check).getByRole('button', { name: 'Xác nhận đã nhận tiền' }))
  expect(await screen.findByText('Đã ghi nhận thanh toán.')).toBeTruthy()
  expect(posts(fetchMock)).toEqual([{ path: '/api/v1/admin/orders/TV000000000123/confirm', body: { amount: 350000, bankReference: 'FT2611150001' } }])
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(gets(fetchMock).length).toBeGreaterThanOrEqual(2)
  expect(await screen.findByText('Không có đơn phù hợp')).toBeTruthy()
})

it('blocks a bad statement amount or reference on the client and never posts', async () => {
  const fetchMock = stub(() => listOf(base))
  const user = userEvent.setup()
  show()
  await user.click(await screen.findByRole('button', { name: 'Đối chiếu & xác nhận' }))
  const sheet = await screen.findByRole('dialog')
  const amount = within(sheet).getByLabelText(/Số tiền trên sao kê/)
  await user.type(within(sheet).getByLabelText(/Mã giao dịch sao kê/), 'FT1')
  for (const bad of ['abc', '0', '1.5', '-3', '']) {
    await user.clear(amount); if (bad) await user.type(amount, bad)
    expect((within(sheet).getByRole('button', { name: 'Kiểm tra lại…' }) as HTMLButtonElement).disabled).toBe(true)
  }
  expect(within(sheet).getByText('Số tiền phải là số nguyên dương.')).toBeTruthy()
  expect(posts(fetchMock)).toHaveLength(0)
})

it.each([
  ['PAYMENT_AMOUNT_MISMATCH', 'Số tiền không khớp đơn; hãy đối chiếu sao kê.'],
  ['PAYMENT_REFERENCE_CONFLICT', 'Mã giao dịch đã được dùng hoặc không khớp.'],
  ['PAYMENT_INVALID', 'Thông tin đối chiếu không hợp lệ.'],
  ['ORDER_NOT_FOUND', 'Không tìm thấy đơn.'],
])('keeps the sheet and the typed values on %s and does not retry', async (code, text) => {
  const fetchMock = stub((url, init) => init?.method === 'POST' ? json(null, code === 'ORDER_NOT_FOUND' ? 404 : code === 'PAYMENT_INVALID' ? 400 : 409, code) : listOf(base))
  const user = userEvent.setup()
  show()
  await user.click(await screen.findByRole('button', { name: 'Đối chiếu & xác nhận' }))
  const sheet = await screen.findByRole('dialog', { name: /Xác nhận đơn/ })
  await user.clear(within(sheet).getByLabelText(/Số tiền trên sao kê/)); await user.type(within(sheet).getByLabelText(/Số tiền trên sao kê/), '340000')
  await user.type(within(sheet).getByLabelText(/Mã giao dịch sao kê/), 'FT9')
  await user.click(within(sheet).getByRole('button', { name: 'Kiểm tra lại…' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Xác nhận đã nhận tiền' }))
  expect(await within(await screen.findByRole('dialog', { name: /Xác nhận đơn/ })).findByText(text)).toBeTruthy()
  expect((screen.getByLabelText(/Số tiền trên sao kê/) as HTMLInputElement).value).toBe('340000')
  expect((screen.getByLabelText(/Mã giao dịch sao kê/) as HTMLInputElement).value).toBe('FT9')
  expect(posts(fetchMock)).toHaveLength(1)
})

it('offers a reload on PAYMENT_STATE_INVALID', async () => {
  const fetchMock = stub((url, init) => init?.method === 'POST' ? json(null, 409, 'PAYMENT_STATE_INVALID') : listOf(base))
  const user = userEvent.setup()
  show()
  await user.click(await screen.findByRole('button', { name: 'Đối chiếu & xác nhận' }))
  const sheet = await screen.findByRole('dialog', { name: /Xác nhận đơn/ })
  await user.type(within(sheet).getByLabelText(/Mã giao dịch sao kê/), 'FT1')
  await user.click(within(sheet).getByRole('button', { name: 'Kiểm tra lại…' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Xác nhận đã nhận tiền' }))
  const before = gets(fetchMock).length
  await user.click(await within(sheet).findByRole('button', { name: 'Tải lại' }))
  await waitFor(() => expect(gets(fetchMock).length).toBe(before + 1))
})

it('flags a duplicate payment, lists the payments and closes the flag with the number of payments the admin reviewed', async () => {
  let closed = false
  const fetchMock = stub((url, init) => init?.method === 'POST' ? (closed = true, json({ ...dup, needsReconciliation: false, reconciledAt: '2026-11-15T06:00:00Z' })) : listOf(closed ? { ...dup, needsReconciliation: false, reconciledAt: '2026-11-15T06:00:00Z' } : dup))
  const user = userEvent.setup()
  show('/admin/orders?status=ALL')
  expect(await screen.findByText('Có khoản thanh toán trùng cần đối chiếu')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Đối chiếu & xác nhận' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Xem · Đối chiếu' }))
  const sheet = await screen.findByRole('dialog')
  expect(within(sheet).getByText(/ABC123/)).toBeTruthy(); expect(within(sheet).getByText(/XYZ999/)).toBeTruthy()
  expect(within(sheet).getByText(/không hoàn tiền trong sản phẩm/)).toBeTruthy()
  await user.click(within(sheet).getByRole('button', { name: 'Đóng cờ đối chiếu' }))
  const check = await screen.findByRole('alertdialog')
  expect(check.textContent).toContain('2 khoản')
  await user.click(within(check).getByRole('button', { name: 'Đánh dấu đã đối chiếu' }))
  expect(await screen.findByText('Đã đối chiếu.')).toBeTruthy()
  expect(posts(fetchMock)).toEqual([{ path: '/api/v1/admin/orders/TV000000000098/reconcile', body: { paymentCount: 2 } }])
  await waitFor(() => expect(screen.queryByText('Có khoản thanh toán trùng cần đối chiếu')).toBeNull())
})

it.each([['PAYMENT_RECONCILIATION_STALE', 'Có khoản thanh toán mới; hãy xem lại danh sách.'], ['PAYMENT_RECONCILIATION_NOT_REQUIRED', 'Không có khoản cần đối chiếu.']])('on %s shows the message and reloads the sheet data from the server', async (code, text) => {
  const fetchMock = stub((url, init) => init?.method === 'POST' ? json(null, 409, code) : listOf(dup))
  const user = userEvent.setup()
  show('/admin/orders?status=ALL')
  await user.click(await screen.findByRole('button', { name: 'Xem · Đối chiếu' }))
  const sheet = await screen.findByRole('dialog')
  const before = gets(fetchMock).length
  await user.click(within(sheet).getByRole('button', { name: 'Đóng cờ đối chiếu' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Đánh dấu đã đối chiếu' }))
  expect(await within(sheet).findByText(text)).toBeTruthy()
  await waitFor(() => expect(gets(fetchMock).length).toBe(before + 1))
  expect(screen.getByRole('dialog')).toBeTruthy()
})

it('can record an extra duplicate payment on a flagged PAID order and tells the admin it needs reconciliation', async () => {
  const fetchMock = stub((url, init) => init?.method === 'POST' ? json({ ...dup, needsReconciliation: true }) : listOf(dup))
  const user = userEvent.setup()
  show('/admin/orders?status=ALL')
  await user.click(await screen.findByRole('button', { name: 'Xem · Đối chiếu' }))
  const sheet = await screen.findByRole('dialog')
  await user.type(within(sheet).getByLabelText(/Mã giao dịch sao kê/), 'NEW1')
  await user.click(within(sheet).getByRole('button', { name: 'Kiểm tra lại…' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Xác nhận đã nhận tiền' }))
  expect(await screen.findByText('Đã ghi nhận; cần đối chiếu khoản thanh toán trùng.')).toBeTruthy()
  expect(posts(fetchMock)[0].body).toEqual({ amount: 350000, bankReference: 'NEW1' })
})

it.each([
  ['just paid', { ...dup, needsReconciliation: false, reconciledAt: null, payments: dup.payments.slice(0, 1) }],
  ['already reconciled', { ...dup, needsReconciliation: false, reconciledAt: '2026-11-15T06:00:00Z' }],
])('lets the admin record a first duplicate payment on a PAID order that is %s, without a close-flag action', async (_, paid) => {
  const fetchMock = stub((url, init) => init?.method === 'POST' ? json({ ...paid, needsReconciliation: true }) : listOf(paid, { ...base, orderCode: 'TV000000000200', status: 'EXPIRED' }))
  const user = userEvent.setup()
  show('/admin/orders?status=ALL')
  await screen.findByText(/TV000000000098/)
  expect(screen.getAllByRole('button', { name: 'Đối chiếu & xác nhận' })).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Xem · Đối chiếu' }))
  const sheet = await screen.findByRole('dialog', { name: /Đối chiếu đơn TV000000000098/ })
  expect(within(sheet).getByText(/ABC123/)).toBeTruthy()
  expect(within(sheet).queryByRole('button', { name: 'Đóng cờ đối chiếu' })).toBeNull()
  expect(within(sheet).queryByText(/không hoàn tiền trong sản phẩm/)).toBeNull()
  await user.type(within(sheet).getByLabelText(/Mã giao dịch sao kê/), 'NEW2')
  await user.click(within(sheet).getByRole('button', { name: 'Kiểm tra lại…' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Xác nhận đã nhận tiền' }))
  expect(await screen.findByText('Đã ghi nhận; cần đối chiếu khoản thanh toán trùng.')).toBeTruthy()
  expect(posts(fetchMock)).toEqual([{ path: '/api/v1/admin/orders/TV000000000098/confirm', body: { amount: 350000, bankReference: 'NEW2' } }])
})
