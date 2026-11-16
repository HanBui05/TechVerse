import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { CourseStudentsPage } from './CourseStudentsPage'
import { setAccessToken } from '../../../services/api/client'

const student = (fullName: string, completedLessons: number, lastAccessedAt: string | null = '2026-11-15T00:00:00Z') => ({ fullName, avatarUrl: null, enrolledAt: '2026-11-10T00:00:00Z', lastAccessedAt, completedLessons, totalLessons: 20 })
const fetchMock = vi.fn<typeof fetch>()
let students: ReturnType<typeof student>[]
let mode: 'ok' | 'missing' | 'invalid' | 'fail'
const response = (data: unknown, status = 200, code?: string) => new Response(JSON.stringify({ status, message: 'x', code, data }), { status })
const studentCalls = () => fetchMock.mock.calls.map(([url]) => new URL(String(url))).filter(u => u.pathname.endsWith('/students'))

async function backend(input: RequestInfo | URL) {
  const url = new URL(String(input))
  if (mode === 'missing') return response(null, 404, 'COURSE_NOT_FOUND')
  if (url.pathname.endsWith('/students')) {
    if (mode === 'invalid') return response(null, 400, 'COURSE_STUDENT_FILTER_INVALID')
    if (mode === 'fail') return response(null, 503)
    const q = url.searchParams.get('q')?.toLowerCase(), progress = url.searchParams.get('progress')
    const content = students.filter(s => (!q || s.fullName.toLowerCase().includes(q)) && (!progress || (progress === 'NOT_STARTED' ? s.completedLessons === 0 : true)))
    return response({ students: { content, page: 0, size: 20, totalElements: content.length, totalPages: 1, hasNext: false }, summary: { total: 48, notStarted: 10, completed: 12 } })
  }
  return response({ id: 'c1', title: 'Java cơ bản' })
}

const Where = () => { const l = useLocation(); return <output data-testid="where">{l.pathname + l.search}</output> }
const renderPage = (language: 'vi' | 'en' = 'vi', path = '/author/courses/c1/students') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/author/courses/:id/students" element={<><CourseStudentsPage language={language} /><Where /></>} /></Routes></MemoryRouter>)

beforeEach(() => {
  setAccessToken('t'); mode = 'ok'
  students = [student('Lê Thị B', 7), student('Trần Văn C', 0, null)]
  fetchMock.mockReset().mockImplementation(backend)
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

it('shows the course title, three totals, rows with progress and never an email', async () => {
  renderPage()
  expect(await screen.findByText('Lê Thị B')).toBeTruthy()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Java cơ bản')
  const tiles = screen.getByRole('region', { name: 'Học viên' }).textContent
  expect(tiles).toMatch(/Tổng học viên48.*Chưa học10.*Đã hoàn thành12/)
  expect(screen.getByText('7/20 bài')).toBeTruthy()
  expect(screen.getByText('Chưa học bài nào')).toBeTruthy()
  expect(screen.getByRole('progressbar', { name: /Lê Thị B/ }).getAttribute('aria-valuenow')).toBe('35')
  expect(document.body.textContent).not.toMatch(/@/)
})

it('sends each filter to the API and keeps it in the URL, resetting the page', async () => {
  const user = userEvent.setup()
  renderPage('vi', '/author/courses/c1/students?page=2')
  await screen.findByText('Lê Thị B')
  expect(studentCalls().at(-1)!.searchParams.get('page')).toBe('2')
  await user.selectOptions(screen.getByLabelText('Tiến độ'), 'NOT_STARTED')
  await waitFor(() => expect(studentCalls().at(-1)!.searchParams.get('progress')).toBe('NOT_STARTED'))
  expect(studentCalls().at(-1)!.searchParams.get('page')).toBe('0')
  await user.type(screen.getByRole('searchbox'), 'Trần')
  await waitFor(() => expect(studentCalls().at(-1)!.searchParams.get('q')).toBe('Trần'))
  expect(screen.getByTestId('where').textContent).toMatch(/progress=NOT_STARTED/)
  expect(screen.getByTestId('where').textContent).toMatch(/q=/)
})

it('tells an empty course from an empty filter, and translates to English', async () => {
  students = []
  const first = renderPage()
  expect(await screen.findByText('Khóa học chưa có học viên.')).toBeTruthy()
  first.unmount()
  renderPage('en', '/author/courses/c1/students?q=zzz')
  expect(await screen.findByText('No students match the filters.')).toBeTruthy()
})

it('shows not-found with a link back, the invalid-filter alert and a retryable load error', async () => {
  mode = 'missing'
  const first = renderPage()
  expect(await screen.findByText('Không tìm thấy khóa học')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Về danh sách' }).getAttribute('href')).toBe('/author/courses')
  first.unmount(); mode = 'invalid'
  const second = renderPage()
  expect((await screen.findByRole('alert')).textContent).toContain('Bộ lọc không hợp lệ.')
  second.unmount(); mode = 'fail'
  renderPage()
  expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeTruthy()
})

it('searches for the literal "0", and drops the old list when a later load fails', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Lê Thị B')
  await user.type(screen.getByRole('searchbox'), '0')
  await waitFor(() => expect(studentCalls().at(-1)!.searchParams.get('q')).toBe('0'))
  expect(screen.getByTestId('where').textContent).toMatch(/q=0/)
  mode = 'fail'
  await user.selectOptions(screen.getByLabelText('Tiến độ'), 'COMPLETED')
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByText('Lê Thị B')).toBeNull()
})

it('follows the URL when it changes under the page (back/forward)', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={['/author/courses/c1/students?q=L%C3%AA']}><Routes><Route path="/author/courses/:id/students" element={<><CourseStudentsPage /><Link to="?q=Tr%E1%BA%A7n">go</Link></>} /></Routes></MemoryRouter>)
  await screen.findByText('Lê Thị B')
  expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('Lê')
  await user.click(screen.getByRole('link', { name: 'go' }))
  await waitFor(() => expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('Trần'))
})
