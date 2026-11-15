import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthorCoursesPage } from './AuthorCoursesPage'
import { setAccessToken } from '../../../services/api/client'

const summary = (id: string, title: string, workflowStatus: string, publicationStatus: string, hasUnpublishedChanges = false) => ({
  id, title, summary: 'S', coverImageUrl: null, level: 'BEGINNER', topic: { id: 'java', name: 'Java', active: true }, workflowStatus, publicationStatus, hasUnpublishedChanges,
  publishedAt: publicationStatus === 'UNPUBLISHED' ? null : '2026-11-03T00:00:00Z', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z',
})
const fetchMock = vi.fn<typeof fetch>()
let rows: ReturnType<typeof summary>[]
let failList: boolean
const calls = () => fetchMock.mock.calls.map(([url, init]) => ({ url: new URL(String(url)), method: init?.method || 'GET' }))
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ status, message: 'x', data }), { status })

async function backend(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(String(input))
  const method = init?.method || 'GET'
  if (url.pathname.endsWith('/options')) return response({ topics: { content: [{ id: 'java', name: 'Java', active: true }], hasNext: false }, tags: { content: [], hasNext: false } })
  if (url.pathname.endsWith('/history')) return response({ content: [{ id: 'h1', action: 'REQUEST_CHANGES', note: 'Bổ sung bài mở đầu', actor: { id: 'm', fullName: 'Mod A', avatarUrl: null }, fromWorkflowStatus: 'PENDING', toWorkflowStatus: 'CHANGES_REQUESTED', fromPublicationStatus: null, toPublicationStatus: null, versionNumber: null, createdAt: '2026-11-04T00:00:00Z' }], page: 0, size: 10, totalElements: 1, totalPages: 1, hasNext: false })
  if (method !== 'GET') return response(method === 'DELETE' ? null : rows[0])
  if (failList && url.searchParams.get('size') !== '1') return response(null, 503)
  const wf = url.searchParams.get('workflowStatus'), pub = url.searchParams.get('publicationStatus')
  const content = rows.filter(r => (!wf || r.workflowStatus === wf) && (!pub || r.publicationStatus === pub))
  return response({ content: url.searchParams.get('size') === '1' ? content.slice(0, 1) : content, page: 0, size: 20, totalElements: content.length, totalPages: 1, hasNext: false })
}

const renderPage = (language: 'vi' | 'en' = 'vi') => render(<MemoryRouter><AuthorCoursesPage language={language} /></MemoryRouter>)

beforeEach(() => {
  setAccessToken('t')
  rows = [summary('c1', 'Java căn bản', 'PUBLISHED', 'PUBLISHED'), summary('c2', 'Khóa chờ duyệt', 'PENDING', 'UNPUBLISHED'), summary('c3', 'Khóa nháp', 'DRAFT', 'UNPUBLISHED'), summary('c4', 'Khóa bị ẩn', 'PUBLISHED', 'HIDDEN'), summary('c5', 'Khóa đang sửa', 'DRAFT', 'PUBLISHED', true)]
  failList = false
  fetchMock.mockReset().mockImplementation(backend)
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

it('shows real counts, two status badges per row and filters by clicking a stat', async () => {
  const user = userEvent.setup()
  renderPage()
  const row = (await screen.findByText('Java căn bản')).closest('li')!
  expect(within(row).getByRole('list', { name: 'Trạng thái khóa học' }).textContent).toContain('Đang công khai')
  expect(within(screen.getByText('Khóa chờ duyệt').closest('li')!).getByRole('link', { name: 'Xem Khóa chờ duyệt' }).getAttribute('href')).toBe('/author/courses/c2/edit')
  expect(within(screen.getByText('Khóa đang sửa').closest('li')!).getByText('Có thay đổi chưa xuất bản')).toBeTruthy()
  expect(screen.getByText('Kiểm duyệt viên đã ẩn khóa học')).toBeTruthy()
  const drafts = await screen.findByRole('button', { name: /Bản nháp\s*2/ })
  await user.click(drafts)
  await waitFor(() => expect(screen.queryByText('Java căn bản')).toBeNull())
  expect(drafts.getAttribute('aria-pressed')).toBe('true')
  expect(calls().some(c => c.url.pathname === '/api/v1/author/courses' && c.url.searchParams.get('workflowStatus') === 'DRAFT' && c.url.searchParams.get('size') === '20')).toBe(true)
})

it('offers only the actions the backend accepts for each state and links to the editor and create page', async () => {
  const user = userEvent.setup()
  renderPage()
  expect(screen.getByRole('link', { name: /Tạo khóa học/ }).getAttribute('href')).toBe('/author/courses/new')
  await user.click(await screen.findByRole('button', { name: 'Thao tác khác cho Java căn bản' }))
  let menu = screen.getByRole('menu', { name: 'Thao tác khóa học' })
  expect(within(menu).getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Xem bản công khai', 'Ẩn khóa học', 'Xóa khóa học', 'Lịch sử'])
  expect(within(menu).getByRole('menuitem', { name: 'Xem bản công khai' }).getAttribute('href')).toBe('/courses/c1')
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: 'Thao tác khác cho Khóa chờ duyệt' }))
  menu = screen.getByRole('menu', { name: 'Thao tác khóa học' })
  expect(within(menu).getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Rút lại', 'Lịch sử'])
})

it('confirms a delete with the course title, calls DELETE and refreshes the list', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Thao tác khác cho Khóa nháp' }))
  await user.click(screen.getByRole('menuitem', { name: 'Xóa vĩnh viễn' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText('Khóa nháp')).toBeTruthy()
  rows = rows.filter(r => r.id !== 'c3')
  await user.click(within(dialog).getByRole('button', { name: 'Xóa vĩnh viễn' }))
  await screen.findByText('Đã xóa khóa học.')
  expect(calls().some(c => c.method === 'DELETE' && c.url.pathname === '/api/v1/author/courses/c3')).toBe(true)
  await waitFor(() => expect(screen.queryByText('Khóa nháp')).toBeNull())
})

it('opens the course history in a sheet titled for courses', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Thao tác khác cho Khóa chờ duyệt' }))
  await user.click(screen.getByRole('menuitem', { name: 'Lịch sử' }))
  const sheet = await screen.findByRole('dialog')
  expect(await within(sheet).findByText(/Bổ sung bài mở đầu/)).toBeTruthy()
  expect(within(sheet).getByText('Lịch sử khóa học')).toBeTruthy()
  expect(calls().some(c => c.url.pathname === '/api/v1/author/courses/c2/history')).toBe(true)
})

it('shows the empty state with the three steps, then an error with retry, and English copy', async () => {
  rows = []
  const user = userEvent.setup()
  const view = renderPage('en')
  expect(await screen.findByText('You have no courses yet')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Create your first course' }).getAttribute('href')).toBe('/author/courses/new')
  expect(screen.getByText('2. Add chapters/lessons')).toBeTruthy()
  view.unmount()
  failList = true
  renderPage()
  expect((await screen.findByRole('alert')).textContent).toContain('Hệ thống tạm thời gián đoạn')
  failList = false
  rows = [summary('c1', 'Java căn bản', 'PUBLISHED', 'PUBLISHED')]
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Java căn bản')).toBeTruthy()
})
