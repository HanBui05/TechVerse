import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { CourseOverviewPage } from './CourseOverviewPage'
import { setAccessToken } from '../../services/api/client'
import { detail, json, learning } from './fixtures'
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
