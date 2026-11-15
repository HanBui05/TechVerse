import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CourseLessonPage } from './CourseLessonPage'
import { setAccessToken } from '../../services/api/client'
import { detail, json, learning, lessonOf } from './fixtures'
import type { PublicLesson } from '../../types/courses'

afterEach(() => { cleanup(); setAccessToken(null); localStorage.clear(); vi.unstubAllGlobals() })

const calls = (fetch: ReturnType<typeof vi.fn>) => fetch.mock.calls.map(([input, init]) => `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`)
function mockApi(lesson: () => Response, completion: () => Response = () => json(learning)) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname
    if (path.endsWith('/completion')) return completion()
    return path.includes('/lessons/') ? lesson() : json(detail())
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const renderPage = (authenticated = true, lessonId = 'l2') => render(<MemoryRouter initialEntries={[`/courses/c1/lessons/${lessonId}`]}><Routes>
  <Route path="/courses/:courseId/lessons/:lessonId" element={<CourseLessonPage language="vi" authenticated={authenticated} />} /></Routes></MemoryRouter>)
const ok = (over: Partial<PublicLesson> = {}) => () => json(lessonOf('l2', over))

it('embeds the video on youtube-nocookie only, with a title and no YouTube link', async () => {
  mockApi(ok({ lesson: { ...lessonOf('l2').lesson, video: { provider: 'YOUTUBE', videoId: 'dQw4w9WgXcQ' } } }))
  renderPage()
  const frame = await screen.findByTitle('Video: Cài đặt')
  expect(frame.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  expect(frame.getAttribute('sandbox')).toBeTruthy()
  expect(document.querySelector('a[href*="youtube.com"], a[href*="youtu.be"]')).toBeNull()
})

it('renders Markdown with a table of contents built from its headings', async () => {
  mockApi(ok())
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'Cài đặt' })
  const toc = await screen.findAllByRole('navigation', { name: 'Mục lục' })
  expect(within(toc[0]).getByRole('link', { name: 'Mở đầu' }).getAttribute('href')).toBe('#mo-dau')
  expect(within(toc[0]).getByRole('link', { name: 'Chi tiết' })).toBeTruthy()
})

it('toggles completion with PUT then DELETE, updates progress and announces it', async () => {
  const fetch = mockApi(ok(), () => json({ ...learning, progress: { completed: 2, total: 3, percent: 66 }, completedLessonIds: ['l1', 'l2'] }))
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Hoàn thành bài học' }))
  expect(await screen.findByRole('button', { name: 'Đánh dấu chưa hoàn thành' })).toBeTruthy()
  expect(screen.getByText('Đã hoàn thành, 2/3 bài')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Đánh dấu chưa hoàn thành' }))
  expect(calls(fetch).filter(c => c.includes('completion'))).toEqual(['PUT /api/v1/courses/c1/lessons/l2/completion', 'DELETE /api/v1/courses/c1/lessons/l2/completion'])
})

it('keeps the server state and shows the error when completion fails', async () => {
  mockApi(ok(), () => json(null, 409, 'COURSE_ENROLLMENT_REQUIRED'))
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Hoàn thành bài học' }))
  expect(await screen.findByText('Hãy bắt đầu khóa học trước.')).toBeTruthy()
})

it('links previous/next across chapters, and searches and collapses the curriculum', async () => {
  mockApi(ok())
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'Cài đặt' })
  expect(screen.getByRole('link', { name: 'Bài trước: Giới thiệu' }).getAttribute('href')).toBe('/courses/c1/lessons/l1')
  expect(screen.getByRole('link', { name: 'Bài tiếp theo: Lớp và đối tượng' }).getAttribute('href')).toBe('/courses/c1/lessons/l3')
  const tree = screen.getByRole('navigation', { name: 'Nội dung khóa học' })
  const search = screen.getByLabelText('Tìm bài học')
  await user.type(search, 'lớp')
  expect(within(tree).queryByText(/Cài đặt/)).toBeNull()
  expect(within(tree).getByText(/Lớp và đối tượng/)).toBeTruthy()
  await user.clear(search)
  await user.type(search, 'zzz')
  expect(within(tree).getByText('Không có bài khớp')).toBeTruthy()
  await user.clear(search)
  await user.click(within(tree).getByRole('button', { name: /Làm quen/ }))
  expect(within(tree).queryByText(/Giới thiệu/)).toBeNull()
})

it('shows the locked card with the curriculum on LESSON_PREVIEW_ONLY, and a start prompt on a preview as Guest', async () => {
  mockApi(() => json(null, 403, 'LESSON_PREVIEW_ONLY'))
  const view = renderPage(false, 'l3')
  expect(await screen.findByText('Hãy đăng nhập và bắt đầu khóa học để xem bài này.')).toBeTruthy()
  expect(screen.getAllByRole('button', { name: /Lớp và đối tượng/ }).length).toBeGreaterThan(0)
  view.unmount()
  mockApi(ok({ viewer: { enrolled: false, canStart: true }, learning: null, lesson: { ...lessonOf('l1').lesson, preview: true } }))
  renderPage(false, 'l1')
  expect(await screen.findByText('Bắt đầu khóa học để học tiếp và lưu tiến độ.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Hoàn thành bài học' })).toBeNull()
})

it('reloads as enrolled when starting on the lesson that is already open', async () => {
  let started = false
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname
    if (init?.method === 'POST') { started = true; return json({ ...learning, continueLesson: { id: 'l1', title: 'Giới thiệu', chapterId: 'ch1' } }) }
    if (path.includes('/lessons/')) return json(started ? lessonOf('l1') : lessonOf('l1', { viewer: { enrolled: false, canStart: true }, learning: null, lesson: { ...lessonOf('l1').lesson, preview: true } }))
    return json(detail())
  })
  vi.stubGlobal('fetch', fetch)
  const user = userEvent.setup()
  renderPage(true, 'l1')
  await user.click(await screen.findByRole('button', { name: 'Bắt đầu học' }))
  expect(await screen.findByRole('button', { name: /Hoàn thành bài học|Đánh dấu chưa hoàn thành/ })).toBeTruthy()
})

it('shows not-found for a missing lesson', async () => {
  mockApi(() => json(null, 404, 'LESSON_NOT_FOUND'))
  renderPage()
  expect(await screen.findByText('Không tìm thấy khóa học hoặc bài học.')).toBeTruthy()
})
