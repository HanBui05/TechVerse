import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthorBlogsPage } from './AuthorBlogsPage'
import { setAccessToken } from '../../services/api/client'

const base = '/api/v1/author/articles'
const summary = (id: string, title: string, workflowStatus: string, publicationStatus: string) => ({ id, title, summary: 'S', coverImageUrl: null, topic: { id: 'java', name: 'Java', active: true }, workflowStatus, publicationStatus, hasUnpublishedChanges: workflowStatus !== 'PUBLISHED', publishedAt: null, createdAt: '2026-11-01T09:00:00Z', updatedAt: '2026-11-04T10:42:00Z' })
const fetchMock = vi.fn<typeof fetch>()
let rows: ReturnType<typeof summary>[]
let failList: boolean
const calls = () => fetchMock.mock.calls.map(([url, init]) => ({ url: new URL(String(url)), method: init?.method || 'GET', body: init?.body }))
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ status, message: 'x', data }), { status })

// Backend fake: counts follow the filter, the list honours workflow/publication filters.
async function backend(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(String(input))
  const method = init?.method || 'GET'
  if (url.pathname.endsWith('/options')) return response({ topics: { content: [{ id: 'java', name: 'Java', active: true }], hasNext: false }, tags: { content: [], hasNext: false } })
  if (url.pathname.endsWith('/history')) return response({ content: [{ id: 'h1', action: 'REQUEST_CHANGES', note: 'Bổ sung ví dụ', actor: { id: 'm', fullName: 'Mod A', avatarUrl: null }, fromWorkflowStatus: 'PENDING', toWorkflowStatus: 'CHANGES_REQUESTED', fromPublicationStatus: 'PUBLISHED', toPublicationStatus: 'PUBLISHED', versionNumber: null, createdAt: '2026-11-04T10:20:00Z' }], page: 0, size: 10, totalElements: 1, totalPages: 1, hasNext: false })
  if (method !== 'GET') return response(method === 'DELETE' ? null : rows[0])
  if (failList && url.searchParams.get('size') !== '1') return response(null, 503)
  const wf = url.searchParams.get('workflowStatus'), pub = url.searchParams.get('publicationStatus')
  const content = rows.filter(r => (!wf || r.workflowStatus === wf) && (!pub || r.publicationStatus === pub))
  return response({ content: url.searchParams.get('size') === '1' ? content.slice(0, 1) : content, page: 0, size: 20, totalElements: content.length, totalPages: 1, hasNext: false })
}

function renderPage(language: 'vi' | 'en' = 'vi') {
  return render(<MemoryRouter><AuthorBlogsPage language={language} /></MemoryRouter>)
}

beforeEach(() => {
  setAccessToken('t')
  rows = [summary('a1', 'Bài công khai', 'PUBLISHED', 'PUBLISHED'), summary('a2', 'Bài chờ duyệt', 'PENDING', 'UNPUBLISHED'), summary('a3', 'Bản nháp mới', 'DRAFT', 'UNPUBLISHED'), summary('a4', 'Bài bị ẩn', 'PUBLISHED', 'HIDDEN')]
  failList = false
  fetchMock.mockReset().mockImplementation(backend)
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

it('shows real counts, two status badges per row and filters by clicking a stat', async () => {
  const user = userEvent.setup()
  renderPage()
  const row = (await screen.findByText('Bài công khai')).closest('li')!
  expect(within(row).getByRole('list', { name: 'Trạng thái bài viết' }).textContent).toContain('Đang công khai')
  expect(within(screen.getByText('Bài chờ duyệt').closest('li')!).getByRole('link', { name: 'Xem Bài chờ duyệt' }).getAttribute('href')).toBe('/author/blogs/a2/edit')
  expect(within(row).getByRole('link', { name: 'Sửa Bài công khai' })).toBeTruthy()
  expect(screen.getByText('Kiểm duyệt viên đã ẩn bài')).toBeTruthy()
  const drafts = await screen.findByRole('button', { name: /Bản nháp\s*1/ })
  await user.click(drafts)
  await waitFor(() => expect(screen.queryByText('Bài công khai')).toBeNull())
  expect(drafts.getAttribute('aria-pressed')).toBe('true')
  expect(calls().some(c => c.url.searchParams.get('workflowStatus') === 'DRAFT' && c.url.searchParams.get('size') === '20')).toBe(true)
})

it('offers only the actions the backend accepts for each state', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Thao tác khác cho Bài công khai' }))
  const menu = await screen.findByRole('dialog')
  expect(within(menu).getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Xem bản công khai', 'Ẩn bài', 'Xóa bài', 'Lịch sử'])
  expect(within(menu).getByRole('menuitem', { name: 'Xem bản công khai' }).getAttribute('href')).toBe('/blogs/a1')
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: 'Thao tác khác cho Bài chờ duyệt' }))
  expect(within(await screen.findByRole('dialog')).getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Rút lại', 'Lịch sử'])
})

it('hides an article only after AlertDialog confirmation, then reloads', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Thao tác khác cho Bài công khai' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Ẩn bài' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog.textContent).toMatch(/độc giả/i)
  const before = calls().length
  await user.click(within(dialog).getByRole('button', { name: 'Ẩn bài' }))
  await waitFor(() => expect(calls().some(c => c.method === 'PATCH' && c.url.pathname === `${base}/a1/publication`)).toBe(true))
  expect(JSON.parse(String(calls().find(c => c.method === 'PATCH')!.body))).toEqual({ action: 'HIDE' })
  await waitFor(() => expect(calls().length).toBeGreaterThan(before + 1))
})

it('warns that a never-published draft is deleted permanently', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Thao tác khác cho Bản nháp mới' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Xóa vĩnh viễn' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog.textContent).toContain('không khôi phục')
  await user.click(within(dialog).getByRole('button', { name: 'Xóa vĩnh viễn' }))
  await waitFor(() => expect(calls().some(c => c.method === 'DELETE' && c.url.pathname === `${base}/a3`)).toBe(true))
})

it('opens the history sheet with translated actions', async () => {
  const user = userEvent.setup()
  renderPage('en')
  await user.click(await screen.findByRole('button', { name: 'More actions for Bài công khai' }))
  await user.click(await screen.findByRole('menuitem', { name: 'History' }))
  const sheet = await screen.findByRole('dialog', { name: 'Article history' })
  expect(await within(sheet).findByText('Changes requested')).toBeTruthy()
  expect(within(sheet).getByText(/Bổ sung ví dụ/)).toBeTruthy()
  expect(within(sheet).queryByText('REQUEST_CHANGES')).toBeNull()
})

it('shows an onboarding empty state, and a retryable error', async () => {
  rows = []
  renderPage()
  expect(await screen.findByText('Bạn chưa có bài viết nào')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Viết bài đầu tiên' }).getAttribute('href')).toBe('/author/blogs/new')
  cleanup()
  failList = true
  rows = [summary('a1', 'Bài công khai', 'PUBLISHED', 'PUBLISHED')]
  const user = userEvent.setup()
  renderPage()
  expect((await screen.findByRole('alert')).textContent).toContain('Hệ thống tạm thời gián đoạn')
  failList = false
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Bài công khai')).toBeTruthy()
})
