import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { OrderDetailPage } from './OrderDetailPage'
import { OrdersPage } from './OrdersPage'
import { setAccessToken } from '../../services/api/client'
import { json, order, page } from '../Courses/fixtures'
import type { CourseOrder } from '../../types/courses'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const QR = { bankId: '970415', accountNo: '0123456789', accountName: 'NGUYEN VAN A', amount: 350000, content: 'TV000000000123', imageUrl: 'https://img.vietqr.io/image/970415-0123456789-compact2.png?amount=350000&addInfo=TV000000000123' }
const orderOf = (over: Partial<CourseOrder> = {}) => ({ ...order, vietQr: QR, ...over }) as CourseOrder
const Where = () => <p data-testid="where">{useLocation().pathname}</p>
const detail = (initial = '/me/orders/TV000000000123') => render(<MemoryRouter initialEntries={[initial]}>
  <Routes><Route path="/me/orders/:orderCode" element={<OrderDetailPage language="vi" />} /><Route path="*" element={<p>other</p>} /></Routes><Where /></MemoryRouter>)
const calls = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${new URL(String(url)).pathname}`)

it('shows the transfer details from the API, a dynamic QR image and the pending state', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json(orderOf())))
  detail()
  expect(screen.getByRole('status', { name: 'Đang tải đơn hàng...' })).toBeTruthy()
  expect(await screen.findByRole('heading', { name: /TV000000000123/ })).toBeTruthy()
  expect(screen.getAllByText('Chờ Admin xác nhận chuyển khoản').length).toBeGreaterThan(0)
  expect(screen.getByText('0123456789')).toBeTruthy()
  expect(screen.getByText('NGUYEN VAN A')).toBeTruthy()
  expect(screen.getByText('970415')).toBeTruthy()
  expect(screen.getByText(/350\.000/, { selector: 'dd' })).toBeTruthy()
  const img = screen.getByRole('img', { name: 'Mã VietQR đơn TV000000000123' })
  expect(img.getAttribute('src')).toBe(QR.imageUrl)
  expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
  expect(screen.getByText(/không được hoàn tiền/)).toBeTruthy()
})

it('copies the account number, the plain amount and the transfer note', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json(orderOf())))
  const user = userEvent.setup()
  detail()
  await screen.findByText('0123456789')
  await user.click(screen.getByRole('button', { name: 'Sao chép Số tài khoản' }))
  expect(await navigator.clipboard.readText()).toBe('0123456789')
  await user.click(screen.getByRole('button', { name: 'Sao chép Số tiền' }))
  expect(await navigator.clipboard.readText()).toBe('350000')
  await user.click(screen.getByRole('button', { name: 'Sao chép Nội dung' }))
  expect(await navigator.clipboard.readText()).toBe('TV000000000123')
})

it('keeps the transfer details when the QR fails to load and retries the image on request', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json(orderOf())))
  const user = userEvent.setup()
  detail()
  fireEvent.error(await screen.findByRole('img', { name: 'Mã VietQR đơn TV000000000123' }))
  expect(screen.getByText('Không tải được QR; dùng thông tin chuyển khoản bên dưới.')).toBeTruthy()
  expect(screen.queryByRole('img', { name: /VietQR/ })).toBeNull()
  expect(screen.getByText('0123456789')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Tải lại ảnh' }))
  expect(screen.getByRole('img', { name: 'Mã VietQR đơn TV000000000123' })).toBeTruthy()
})

it('shows the QR fallback and no empty table when the backend sends no VietQR or an unsafe image URL', async () => {
  const fetchMock = vi.fn(async () => json(orderOf({ vietQr: null })))
  vi.stubGlobal('fetch', fetchMock)
  const view = detail()
  expect(await screen.findByText('Không tải được QR; dùng thông tin chuyển khoản bên dưới.')).toBeTruthy()
  expect(screen.queryByText('Số tài khoản')).toBeNull()
  view.unmount()
  fetchMock.mockImplementation(async () => json(orderOf({ vietQr: { ...QR, imageUrl: 'javascript:alert(1)' } })))
  detail()
  expect(await screen.findByText('Không tải được QR; dùng thông tin chuyển khoản bên dưới.')).toBeTruthy()
  expect(screen.getByText('0123456789')).toBeTruthy()
})

it('does not treat a return URL or a refresh as success: only the server status counts, and refresh is user-triggered', async () => {
  const fetchMock = vi.fn(async () => json(orderOf()))
  vi.stubGlobal('fetch', fetchMock)
  const user = userEvent.setup()
  detail('/me/orders/TV000000000123?status=PAID&code=00&cancel=false')
  await screen.findByRole('heading', { name: /TV000000000123/ })
  expect(screen.queryByText(/Đã nhận tiền/)).toBeNull()
  expect(screen.queryByRole('link', { name: 'Vào học' })).toBeNull()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fetchMock.mockImplementation(async () => json(orderOf({ status: 'PAID', paidAt: '2026-11-15T03:00:00Z', vietQr: null })))
  await user.click(screen.getByRole('button', { name: 'Làm mới trạng thái' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Đã nhận tiền')
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('link', { name: 'Vào học' }).getAttribute('href')).toBe('/courses/c1')
  expect(screen.queryByText('0123456789')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Tôi đã chuyển khoản' })).toBeNull()
})

it('reports the transfer once: the time and the wait copy replace the button', async () => {
  const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => json(init?.method === 'POST' ? orderOf({ transferReportedAt: '2026-11-15T03:00:00Z' }) : orderOf()))
  vi.stubGlobal('fetch', fetchMock)
  const user = userEvent.setup()
  detail()
  await user.click(await screen.findByRole('button', { name: 'Tôi đã chuyển khoản' }))
  expect(await screen.findByText(/Đã báo cho Admin lúc .+; quyền học được mở sau khi Admin đối chiếu\./)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Tôi đã chuyển khoản' })).toBeNull()
  expect(calls(fetchMock)).toEqual(['GET /api/v1/orders/TV000000000123', 'POST /api/v1/orders/TV000000000123/transfer-report'])
  expect(screen.getByText('0123456789')).toBeTruthy()
})

it('maps a 409 report error to its sentence and reloads the order; a 429 keeps the button', async () => {
  let reply = () => json(null, 409, 'ORDER_TRANSFER_REPORT_NOT_ALLOWED')
  const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => init?.method === 'POST' ? reply() : json(orderOf()))
  vi.stubGlobal('fetch', fetchMock)
  const user = userEvent.setup()
  detail()
  await user.click(await screen.findByRole('button', { name: 'Tôi đã chuyển khoản' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Đơn này không cần báo chuyển khoản.')
  await waitFor(() => expect(calls(fetchMock).filter(c => c.startsWith('GET')).length).toBe(2))
  reply = () => json(null, 429, 'ORDER_RATE_LIMITED')
  await user.click(screen.getByRole('button', { name: 'Tôi đã chuyển khoản' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Bạn thao tác quá nhanh'))
  expect(screen.getByRole('button', { name: 'Tôi đã chuyển khoản' })).toBeTruthy()
})

it('an expired order still shows the QR and details, allows reporting, and Buy again opens the new order', async () => {
  const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => init?.method === 'POST' && String(url).endsWith('/orders') ? json(orderOf({ orderCode: 'TV000000000124' })) : json(orderOf({ status: 'EXPIRED' })))
  vi.stubGlobal('fetch', fetchMock)
  const user = userEvent.setup()
  detail()
  expect((await screen.findByRole('alert')).textContent).toContain('Đơn đã hết hạn; liên hệ Admin nếu đã chuyển khoản.')
  expect(screen.getByRole('img', { name: 'Mã VietQR đơn TV000000000123' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Tôi đã chuyển khoản' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Mua lại khóa học' }))
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/me/orders/TV000000000124'))
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ courseId: 'c1' })
})

it('drops the old order at once when Buy again opens a new one, so its QR cannot be paired with the new code', async () => {
  let release: () => void = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
    if (init?.method === 'POST') return json(orderOf({ orderCode: 'TV000000000124' }))
    if (String(url).endsWith('TV000000000124')) { await gate; return json(orderOf({ orderCode: 'TV000000000124' })) }
    return json(orderOf({ status: 'EXPIRED' }))
  }))
  const user = userEvent.setup()
  detail()
  await user.click(await screen.findByRole('button', { name: 'Mua lại khóa học' }))
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/me/orders/TV000000000124'))
  expect(screen.getByRole('status', { name: 'Đang tải đơn hàng...' })).toBeTruthy()
  expect(screen.queryByRole('img', { name: /VietQR/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Tôi đã chuyển khoản' })).toBeNull()
  release()
  expect(await screen.findByRole('heading', { name: /TV000000000124/ })).toBeTruthy()
})

it('locks refresh while a transfer report is in flight, so a late report reply cannot undo a newer status', async () => {
  let release: () => void = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
    if (init?.method === 'POST') { await gate; return json(orderOf({ transferReportedAt: '2026-11-15T03:00:00Z' })) }
    return json(orderOf())
  }))
  const user = userEvent.setup()
  detail()
  await user.click(await screen.findByRole('button', { name: 'Tôi đã chuyển khoản' }))
  expect((screen.getByRole('button', { name: 'Làm mới trạng thái' }) as HTMLButtonElement).disabled).toBe(true)
  release()
  expect(await screen.findByText(/Đã báo cho Admin lúc/)).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Làm mới trạng thái' }) as HTMLButtonElement).disabled).toBe(false)
})

it('a failed or cancelled order has no QR, says it is invalid and offers Buy again', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json(orderOf({ status: 'CANCELLED', vietQr: null }))))
  detail()
  expect((await screen.findByRole('alert')).textContent).toContain('Đơn này không còn hiệu lực.')
  expect(screen.queryByText(/Không tải được QR/)).toBeNull()
  expect(screen.getByRole('button', { name: 'Mua lại khóa học' })).toBeTruthy()
})

it('shows a pending order that was already reported without the report button', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json(orderOf({ transferReportedAt: '2026-11-15T03:00:00Z' }))))
  detail()
  expect(await screen.findByText(/Đã báo cho Admin lúc/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Tôi đã chuyển khoản' })).toBeNull()
})

it('uses the not-found state for another buyer’s order and a retryable error for server failures', async () => {
  let mode: 'missing' | 'fail' | 'ok' = 'missing'
  vi.stubGlobal('fetch', vi.fn(async () => mode === 'missing' ? json(null, 404, 'ORDER_NOT_FOUND') : mode === 'fail' ? json(null, 500, 'INTERNAL_ERROR') : json(orderOf())))
  const user = userEvent.setup()
  const view = detail()
  expect(await screen.findByText('Không tìm thấy đơn.')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Đơn hàng của tôi' }).getAttribute('href')).toBe('/me/orders')
  view.unmount()
  mode = 'fail'
  detail()
  const retry = await screen.findByRole('button', { name: 'Thử lại' })
  mode = 'ok'
  await user.click(retry)
  expect(await screen.findByRole('heading', { name: /TV000000000123/ })).toBeTruthy()
})

const row = (over: Partial<CourseOrder> = {}) => orderOf({ vietQr: null, ...over })
const list = (initial = '/me/orders') => render(<MemoryRouter initialEntries={[initial]}><OrdersPage language="vi" /></MemoryRouter>)

it('lists orders newest first with status, reported badge and the right action per row', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json(page([
    row({ transferReportedAt: '2026-11-15T03:00:00Z' }),
    row({ orderCode: 'TV000000000098', courseId: 'c2', courseTitle: 'React cơ bản', status: 'PAID', paidAt: '2026-11-10T00:00:00Z' }),
    row({ orderCode: 'TV000000000071', status: 'EXPIRED' }),
  ]))))
  list()
  await screen.findByText('Hết hạn')
  const rows = screen.getAllByRole('listitem')
  expect(rows).toHaveLength(3)
  expect(within(rows[0]).getByText('Chờ Admin xác nhận chuyển khoản')).toBeTruthy()
  expect(within(rows[0]).getByText('Đã báo chuyển khoản')).toBeTruthy()
  expect(within(rows[0]).getByRole('link', { name: /Xem đơn/ }).getAttribute('href')).toBe('/me/orders/TV000000000123')
  expect(within(rows[1]).getByText('Đã nhận tiền')).toBeTruthy()
  expect(within(rows[1]).getByRole('link', { name: /Vào học/ }).getAttribute('href')).toBe('/courses/c2')
  expect(within(rows[2]).getByText('Hết hạn')).toBeTruthy()
  expect(within(rows[2]).getByRole('link', { name: /Xem đơn/ }).getAttribute('href')).toBe('/me/orders/TV000000000071')
})

it('shows loading, the empty state with Explore courses, a retryable error and the requested page', async () => {
  let mode: 'empty' | 'fail' | 'ok' = 'empty'
  const fetchMock = vi.fn(async (_url: unknown) => mode === 'empty' ? json(page([])) : mode === 'fail' ? json(null, 500, 'INTERNAL_ERROR') : json(page([row()], 3)))
  vi.stubGlobal('fetch', fetchMock)
  const user = userEvent.setup()
  const view = list()
  expect(screen.getByRole('status', { name: 'Đang tải đơn hàng...' })).toBeTruthy()
  expect(await screen.findByText('Bạn chưa có đơn hàng nào')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Khám phá khóa học' }).getAttribute('href')).toBe('/courses')
  view.unmount()
  mode = 'fail'
  list('/me/orders?page=1')
  expect(new URL(String(fetchMock.mock.calls.at(-1)?.[0])).searchParams.get('page')).toBe('1')
  const retry = await screen.findByRole('button', { name: 'Thử lại' })
  mode = 'ok'
  await user.click(retry)
  expect(await screen.findByText(/Java cơ bản/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Trang 3' })).toBeTruthy()
})
