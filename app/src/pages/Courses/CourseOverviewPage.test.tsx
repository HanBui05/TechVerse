import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { CourseOverviewPage } from './CourseOverviewPage'
import { setAccessToken } from '../../services/api/client'
import { detail, json, learning, order } from './fixtures'
import type { PublicCourseDetail } from '../../types/courses'

afterEach(() => { cleanup(); setAccessToken(null); localStorage.clear(); vi.unstubAllGlobals() })

function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}</output> }
function mockApi(response: () => Response, start: () => Response = () => json(learning)) {
  const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => init?.method === 'POST' ? start() : response())
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const renderPage = (authenticated = false) => render(<MemoryRouter initialEntries={['/courses/c1']}><Routes>
  <Route path="/courses/:id" element={<CourseOverviewPage language="vi" authenticated={authenticated} />} />
  <Route path="/courses/:courseId/lessons/:lessonId" element={<Where />} /><Route path="/login" element={<Where />} /></Routes></MemoryRouter>)
const ok = (over: Partial<PublicCourseDetail> = {}) => () => json(detail(over))

it('shows the info card, description and an accordion that expands and collapses all', async () => {
  mockApi(ok())
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByRole('heading', { level: 1, name: 'Java cơ bản' })).toBeTruthy()
  expect(screen.getByText('2 chương')).toBeTruthy()
  expect(screen.getByText('3 bài học')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Bạn sẽ học' })).toBeTruthy()
  const content = screen.getByRole('region', { name: /Nội dung khóa học/ })
  expect(within(content).queryByText(/Lớp và đối tượng/)).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Mở rộng tất cả' }))
  expect(within(content).getByText(/Lớp và đối tượng/)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Thu gọn tất cả' }))
  expect(within(content).queryByText(/Giới thiệu/)).toBeNull()
})

it('opens a preview lesson without calling /start', async () => {
  const fetch = mockApi(ok())
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'Java cơ bản' })
  await user.click(screen.getByRole('link', { name: 'Học thử' }))
  expect(screen.getByTestId('where').textContent).toBe('/courses/c1/lessons/l1')
  expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
})

it('asks a Guest to sign in, and starts a signed-in Learner then opens the continue lesson', async () => {
  mockApi(ok())
  const user = userEvent.setup()
  const guest = renderPage(false)
  await user.click(await screen.findByRole('button', { name: 'Bắt đầu học' }))
  expect(await screen.findByText('Đăng nhập để bắt đầu khóa học.')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  expect(screen.getByTestId('where').textContent).toBe('/login')
  guest.unmount()
  const fetch = mockApi(ok())
  renderPage(true)
  await user.click(await screen.findByRole('button', { name: 'Bắt đầu học' }))
  await vi.waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/courses/c1/lessons/l2'))
  expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
})

it('shows Continue learning and progress when enrolled, and the author note for the owner', async () => {
  mockApi(ok({ viewer: { enrolled: true, canStart: true }, learning }))
  const view = renderPage(true)
  const link = await screen.findByRole('link', { name: /Tiếp tục học: Cài đặt/ })
  expect(link.getAttribute('href')).toBe('/courses/c1/lessons/l2')
  expect(screen.getAllByRole('progressbar', { name: 'Tiến độ khóa học' })[0].getAttribute('aria-valuenow')).toBe('33')
  view.unmount()
  mockApi(ok({ viewer: { enrolled: false, canStart: false } }))
  renderPage(true)
  expect(await screen.findAllByText('Bạn là tác giả khóa này — chỉ xem bài học thử.')).not.toHaveLength(0)
  expect(screen.queryByRole('button', { name: 'Bắt đầu học' })).toBeNull()
})

it('hides hidden or removed courses behind the same not-found, and shows a retryable error otherwise', async () => {
  mockApi(() => json(null, 404, 'COURSE_NOT_FOUND'))
  const view = renderPage()
  expect(await screen.findByText('Không tìm thấy khóa học hoặc bài học.')).toBeTruthy()
  view.unmount()
  mockApi(() => json(null, 500, 'INTERNAL_ERROR'))
  renderPage()
  expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeTruthy()
})

// Task 2a: a paid course sells instead of starting.
const paid = (over: Partial<PublicCourseDetail> = {}) => ok({ priceAmount: 350000, ...over })
const orderCalls = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.filter(([input]) => new URL(String(input)).pathname === '/api/v1/orders')
const renderPaid = (authenticated: boolean) => render(<MemoryRouter initialEntries={['/courses/c1']}><Routes>
  <Route path="/courses/:id" element={<CourseOverviewPage language="vi" authenticated={authenticated} />} />
  <Route path="/me/orders/:orderCode" element={<Where />} /><Route path="/login" element={<Where />} /></Routes></MemoryRouter>)

it('shows Free on a free course and the price with Buy and the no-refund note on a paid one, never Start', async () => {
  mockApi(ok())
  const free = renderPage(true)
  expect(await screen.findByText('Miễn phí')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Bắt đầu học' })).toBeTruthy()
  free.unmount()
  mockApi(paid())
  renderPage(true)
  expect(await screen.findByText(/^350\.000\s₫$/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Mua khóa học' })).toBeTruthy()
  expect(screen.getByText('Khóa học đã mua không được hoàn tiền.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Bắt đầu học' })).toBeNull()
})

it('asks a Guest to sign in before buying and calls no order endpoint', async () => {
  const fetch = mockApi(paid())
  const user = userEvent.setup()
  renderPaid(false)
  await user.click(await screen.findByRole('button', { name: 'Mua khóa học' }))
  expect(await screen.findByText('Đăng nhập để mua khóa học.')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  expect(screen.getByTestId('where').textContent).toBe('/login')
  expect(orderCalls(fetch)).toHaveLength(0)
})

it('POSTs only the course id on Buy and opens the order it returns', async () => {
  const fetch = mockApi(paid(), () => json(order, 201))
  const user = userEvent.setup()
  renderPaid(true)
  await user.click(await screen.findByRole('button', { name: 'Mua khóa học' }))
  await vi.waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/me/orders/TV000000000123'))
  const [[, init]] = orderCalls(fetch)
  expect(init?.method).toBe('POST')
  expect(JSON.parse(String(init?.body))).toEqual({ courseId: 'c1' })
  expect(fetch.mock.calls.some(([input]) => new URL(String(input)).pathname.endsWith('/start'))).toBe(false)
})

it.each([
  ['ORDER_ALREADY_ENROLLED', 409, 'Bạn đã có quyền học khóa này. Hãy tải lại trang.'],
  ['ORDER_COURSE_UNAVAILABLE', 409, 'Không thể mua khóa học này.'],
  ['PAYMENT_UNAVAILABLE', 503, 'Thanh toán tạm thời không khả dụng.'],
  ['ORDER_RATE_LIMITED', 429, 'Bạn thao tác quá nhanh, hãy thử lại sau.'],
  ['COURSE_NOT_FOUND', 404, 'Không tìm thấy khóa học hoặc bài học.'],
])('shows the %s sentence under the button and lets the Learner try again', async (code, status, text) => {
  const fetch = mockApi(paid(), () => json(null, status, code))
  const user = userEvent.setup()
  renderPaid(true)
  await user.click(await screen.findByRole('button', { name: 'Mua khóa học' }))
  expect((await screen.findByRole('alert')).textContent).toBe(text)
  expect((screen.getByRole('button', { name: 'Mua khóa học' }) as HTMLButtonElement).disabled).toBe(false)
  expect(orderCalls(fetch)).toHaveLength(1)
})

it('opens the buy dialog from a locked lesson instead of starting the course', async () => {
  const fetch = mockApi(paid(), () => json(order, 201))
  const user = userEvent.setup()
  renderPaid(true)
  await user.click((await screen.findAllByRole('button', { name: /Cài đặt/ }))[0])
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('Hãy mua khóa học để tiếp tục.')).toBeTruthy()
  expect(orderCalls(fetch)).toHaveLength(0)
  await user.click(within(dialog).getByRole('button', { name: 'Mua khóa học' }))
  await vi.waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/me/orders/TV000000000123'))
  expect(fetch.mock.calls.some(([input]) => new URL(String(input)).pathname.endsWith('/start'))).toBe(false)
})

it('offers the owner of a paid course no Buy button, and an enrolled buyer Continue', async () => {
  mockApi(paid({ viewer: { enrolled: false, canStart: false } }))
  const owner = renderPaid(true)
  expect((await screen.findAllByText('Bạn là tác giả khóa này — chỉ xem bài học thử.')).length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: 'Mua khóa học' })).toBeNull()
  owner.unmount()
  mockApi(paid({ viewer: { enrolled: true, canStart: true }, learning }))
  renderPaid(true)
  expect(await screen.findByRole('link', { name: /Tiếp tục học: Cài đặt/ })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Mua khóa học' })).toBeNull()
})
