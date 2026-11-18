import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthorExercisesPage } from './AuthorExercisesPage'
import { setAccessToken } from '../../../services/api/client'

const topic = { id: 'sql', name: 'SQL', active: true }
const row = (id: string, title: string, over: object = {}) => ({
  id, title, description: '', topic, type: 'MULTIPLE_CHOICE', difficulty: 'MEDIUM', status: 'DRAFT', aiAssisted: false, version: 1, moderationNote: null, questionCount: 12,
  publishedAt: null, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-16T10:00:00Z', ...over,
})
const page = (content: object[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1, hasNext: false })

let rows: object[]
let failNext: { code: string; status: number } | null
const fetchMock = vi.fn<typeof fetch>()
const respond = (data: unknown, status = 200) => new Response(JSON.stringify({ status, message: 'x', data }), { status })
const calls = () => fetchMock.mock.calls.map(([url, init]) => ({ url: new URL(String(url)), method: init?.method || 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : null }))
const find = (method: string, path: string) => calls().filter(c => c.method === method && c.url.pathname === `/api/v1/author/exercise-sets${path}`)

async function backend(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(String(input))
  const method = init?.method || 'GET'
  const path = url.pathname.replace('/api/v1/author/exercise-sets', '')
  if (method !== 'GET' && failNext) { const { code, status } = failNext; failNext = null; return new Response(JSON.stringify({ status, message: 'English', code, data: null }), { status }) }
  if (path === '' && method === 'GET') return respond(page(rows))
  if (method === 'DELETE') return respond(null)
  if (path.endsWith('/copy')) return respond(row('copy', 'x'), 201)
  return respond(row('x', 'x'))
}

function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}</output> }
function renderList(language: 'vi' | 'en' = 'vi') {
  return render(<MemoryRouter initialEntries={['/author/exercises']}><Routes>
    <Route path="/author/exercises" element={<AuthorExercisesPage language={language} />} />
    <Route path="/author/exercises/:id/edit" element={<Where />} /><Route path="/author/exercises/new" element={<Where />} />
  </Routes></MemoryRouter>)
}
const rowOf = async (title: string) => within((await screen.findByText(title)).closest('li') as HTMLElement)

beforeEach(() => {
  setAccessToken('t'); failNext = null
  rows = [
    row('a', 'SQL cơ bản', { status: 'PUBLISHED', publishedAt: '2026-11-10T00:00:00Z', aiAssisted: true }),
    row('b', 'Từ vựng React', { type: 'FLASHCARD', status: 'CHANGES_REQUESTED', moderationNote: 'Thẻ 3 thiếu nội dung', questionCount: 8 }),
    row('c', 'Git nâng cao', { status: 'DRAFT', questionCount: 0 }),
    row('d', 'Bộ chờ duyệt', { status: 'PENDING' }),
  ]
  fetchMock.mockReset().mockImplementation(backend); vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); setAccessToken(null); sessionStorage.clear(); vi.unstubAllGlobals() })

it('lists the sets with status, type, count, AI mark and the moderator note, and only the actions each status allows', async () => {
  renderList()
  const published = await rowOf('SQL cơ bản')
  expect(published.getByText('Đang công khai')).toBeTruthy(); expect(published.getByText('Có dùng AI')).toBeTruthy(); expect(published.getByText('Trắc nghiệm')).toBeTruthy()
  expect(published.getByRole('link', { name: /^Xem/ })).toBeTruthy()
  expect(published.getByRole('button', { name: /^Ẩn/ })).toBeTruthy(); expect(published.getByRole('button', { name: /^Tạo bản sao/ })).toBeTruthy()
  expect(published.queryByRole('button', { name: /^Xóa/ })).toBeNull() // a published set can never be deleted
  const changes = await rowOf('Từ vựng React')
  expect(changes.getByText(/Ghi chú của Moderator: “Thẻ 3 thiếu nội dung”/)).toBeTruthy(); expect(changes.getByText('8 thẻ')).toBeTruthy()
  expect(changes.getByRole('link', { name: /^Sửa/ })).toBeTruthy(); expect(changes.getByRole('button', { name: /^Xóa/ })).toBeTruthy()
  const draft = await rowOf('Git nâng cao')
  expect(draft.getByRole('button', { name: /^Xóa/ })).toBeTruthy(); expect(draft.queryByRole('button', { name: /^Ẩn/ })).toBeNull()
  const pending = await rowOf('Bộ chờ duyệt')
  expect(pending.getByRole('button', { name: /^Rút lại/ })).toBeTruthy(); expect(pending.queryByRole('button', { name: /^Xóa/ })).toBeNull()
})

it('sends the filters to the API and returns to page 0', async () => {
  const user = userEvent.setup()
  renderList()
  await screen.findByText('SQL cơ bản')
  await user.selectOptions(screen.getByLabelText('Trạng thái'), 'PENDING')
  await user.selectOptions(screen.getByLabelText('Loại'), 'FLASHCARD')
  await waitFor(() => expect(calls().at(-1)!.url.searchParams.get('type')).toBe('FLASHCARD'))
  expect(calls().at(-1)!.url.searchParams.get('status')).toBe('PENDING')
  fireEvent.change(screen.getByLabelText('Tìm theo tiêu đề'), { target: { value: 'react' } })
  await waitFor(() => expect(calls().at(-1)!.url.searchParams.get('keyword')).toBe('react'))
})

it('deletes only after confirmation and shows a server refusal as an error', async () => {
  const user = userEvent.setup()
  renderList()
  const draft = await rowOf('Git nâng cao')
  await user.click(draft.getByRole('button', { name: /^Xóa/ }))
  expect(await screen.findByText('Xóa bộ bài tập này? Không thể hoàn tác.')).toBeTruthy()
  expect(find('DELETE', '/c')).toHaveLength(0)
  failNext = { code: 'EXERCISE_NOT_DELETABLE', status: 409 }
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Xóa' }))
  expect(await screen.findByText('Không xóa được bộ đã công khai hoặc đang chờ duyệt.')).toBeTruthy()
  await user.click((await rowOf('Git nâng cao')).getByRole('button', { name: /^Xóa/ }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Xóa' }))
  expect(await screen.findByText('Đã xóa bộ bài tập.')).toBeTruthy()
  expect(find('DELETE', '/c')).toHaveLength(2)
})

it('duplicates, hides and withdraws through the matching endpoints', async () => {
  const user = userEvent.setup()
  renderList()
  const published = await rowOf('SQL cơ bản')
  await user.click(published.getByRole('button', { name: /^Tạo bản sao/ }))
  expect(await screen.findByText('Đã tạo bản sao.')).toBeTruthy()
  expect(find('POST', '/a/copy')).toHaveLength(1)
  await user.click((await rowOf('SQL cơ bản')).getByRole('button', { name: /^Ẩn/ }))
  await waitFor(() => expect(find('PATCH', '/a/visibility')[0]?.body).toEqual({ action: 'HIDE' }))
  await user.click((await rowOf('Bộ chờ duyệt')).getByRole('button', { name: /^Rút lại/ }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Rút lại' }))
  await waitFor(() => expect(find('POST', '/d/withdraw')).toHaveLength(1))
})

it('shows a rate-limit refusal of a copy and keeps the list', async () => {
  const user = userEvent.setup()
  renderList()
  failNext = { code: 'EXERCISE_RATE_LIMITED', status: 429 }
  await user.click((await rowOf('SQL cơ bản')).getByRole('button', { name: /^Tạo bản sao/ }))
  expect(await screen.findByText('Bạn thao tác quá nhanh, hãy thử lại sau.')).toBeTruthy()
  expect(screen.getByText('SQL cơ bản')).toBeTruthy()
})

it('shows the empty states, with and without filters', async () => {
  const user = userEvent.setup()
  rows = []
  renderList()
  expect(await screen.findByText('Bạn chưa có bộ bài tập nào.')).toBeTruthy()
  expect(screen.getAllByRole('link', { name: 'Tạo bộ bài tập' }).length).toBeGreaterThan(0)
  await user.selectOptions(screen.getByLabelText('Loại'), 'FLASHCARD')
  expect(await screen.findByText('Không có bộ nào khớp bộ lọc.')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Xóa lọc' }))
  expect(await screen.findByText('Bạn chưa có bộ bài tập nào.')).toBeTruthy()
})

it('shows a retry when the list fails to load', async () => {
  const user = userEvent.setup()
  fetchMock.mockImplementationOnce(async () => respond(null, 503))
  renderList()
  expect(await screen.findByText('Dịch vụ đang gián đoạn. Hãy thử lại.')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('SQL cơ bản')).toBeTruthy()
})

it('opens the editor from the row and renders English copy', async () => {
  const user = userEvent.setup()
  renderList('en')
  expect(await screen.findByRole('heading', { name: 'My exercises', level: 1 })).toBeTruthy()
  expect(screen.getAllByText('Changes requested').length).toBeGreaterThan(1)
  await user.click(screen.getByText('Git nâng cao'))
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/author/exercises/c/edit'))
})
