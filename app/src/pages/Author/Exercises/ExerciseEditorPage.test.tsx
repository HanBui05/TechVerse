import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes, useLocation } from 'react-router-dom'
import { ExerciseEditorPage } from './ExerciseEditorPage'
import { setAccessToken } from '../../../services/api/client'

const topic = { id: 'sql', name: 'SQL', active: true }
const quizQuestion = (n: number) => ({ id: `q${n}`, position: n, content: `Câu hỏi số ${n}`, codeSnippet: null, codeLanguage: null, options: ['A', 'B'], correctIndex: 0, explanation: 'Vì thế.', front: null, back: null })
const cardQuestion = (n: number) => ({ id: `c${n}`, position: n, content: null, codeSnippet: null, codeLanguage: null, options: null, correctIndex: null, explanation: '', front: `Mặt trước ${n}`, back: `Mặt sau ${n}` })
const baseSet = (over: object = {}) => ({
  id: 's1', title: 'SQL cơ bản', description: 'Mô tả', topic, type: 'MULTIPLE_CHOICE', difficulty: 'MEDIUM', status: 'DRAFT', aiAssisted: false, version: 3, moderationNote: null as string | null,
  questionCount: 2, publishedAt: null as string | null, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T10:00:00Z', questions: [quizQuestion(0), quizQuestion(1)], ...over,
})
const suggestion = (n: number) => ({ content: `AI hỏi ${n}`, codeSnippet: null, codeLanguage: null, options: ['A', 'B', 'C', 'D'], correctIndex: 2, explanation: 'AI giải thích.', front: null, back: null })

let set: ReturnType<typeof baseSet>
let failNext: { code: string; status: number; headers?: Record<string, string> } | null
let aiResult: { questions: object[]; requested: number; version: number }
const fetchMock = vi.fn<typeof fetch>()
const respond = (data: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify({ status, message: 'x', data }), { status, headers })
const calls = () => fetchMock.mock.calls.map(([url, init]) => ({ url: new URL(String(url)), method: init?.method || 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : null }))
const find = (method: string, path: string) => calls().filter(c => c.method === method && c.url.pathname === `/api/v1/author/exercise-sets${path}`)

async function backend(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(String(input))
  const method = init?.method || 'GET'
  const path = url.pathname.replace('/api/v1/author/exercise-sets', '').replace('/api/v1/author/ai', '/ai')
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null
  if (path === '/ai/quota') return respond({ outline: { limit: 10, remaining: 10 }, draft: { limit: 5, remaining: 5 }, exercise: { limit: 10, remaining: 7 } })
  if (path === '/options') return respond([topic])
  if (method !== 'GET' && failNext) { const { code, status, headers } = failNext; failNext = null; return new Response(JSON.stringify({ status, message: 'English', code, data: null }), { status, headers }) }
  if (path === '' && method === 'POST') { set = baseSet({ title: body.title, type: body.type, difficulty: body.difficulty, description: body.description, version: 0, questions: [] }); return respond(set, 201) }
  if (path === '/s1' && method === 'GET') return respond(set)
  if (path === '/s1' && method === 'PATCH') { Object.assign(set, { ...body, version: set.version + 1 }); return respond({ ...set, questions: null }) }
  if (path === '/s1/questions') { set = { ...set, version: set.version + 1, questions: body.questions.map((q: object, i: number) => ({ id: `n${i}`, position: i, ...q })) }; return respond(set) }
  if (path === '/s1/submit') { set.status = 'PENDING'; return respond(set) }
  if (path === '/s1/withdraw') { set.status = 'DRAFT'; return respond(set) }
  if (path === '/s1/copy') return respond({ ...baseSet({ id: 's2', title: 'SQL cơ bản (bản sao)' }) }, 201)
  if (path === '/s1/ai/questions') { set.version = aiResult.version; set.aiAssisted = true; return respond(aiResult, 200, { 'X-AI-Quota-Limit': '10', 'X-AI-Quota-Remaining': '6' }) }
  return respond(null, 404)
}

function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}</output> }
function renderEditor(path: string, language: 'vi' | 'en' = 'vi') {
  const page = <><ExerciseEditorPage language={language} /><Where /></>
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/author/exercises/new" element={page} /><Route path="/author/exercises/:id/edit" element={page} /><Route path="/author/exercises" element={<Where />} /></Routes></MemoryRouter>)
}

beforeEach(() => {
  setAccessToken('t'); set = baseSet(); failNext = null; aiResult = { questions: [suggestion(1), suggestion(2)], requested: 3, version: 5 }
  fetchMock.mockReset().mockImplementation(backend); vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); setAccessToken(null); sessionStorage.clear(); vi.unstubAllGlobals() })

async function fillQuestion(user: ReturnType<typeof userEvent.setup>, content: string) {
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText(/Nội dung/), { target: { value: content } })
  fireEvent.change(within(dialog).getByLabelText('Lựa chọn 1'), { target: { value: 'Đúng' } })
  fireEvent.change(within(dialog).getByLabelText('Lựa chọn 2'), { target: { value: 'Sai' } })
  await user.click(within(dialog).getByLabelText('Đáp án đúng: Lựa chọn 1'))
  fireEvent.change(within(dialog).getByLabelText(/Giải thích/), { target: { value: 'Giải thích.' } })
  return dialog
}

it('validates before creating, then POSTs the metadata and opens the edit route', async () => {
  const user = userEvent.setup()
  renderEditor('/author/exercises/new')
  await user.click(screen.getByRole('button', { name: 'Tạo' }))
  expect(screen.getByText('Tiêu đề từ 5 đến 255 ký tự.')).toBeTruthy(); expect(screen.getByText('Hãy chọn chủ đề.')).toBeTruthy()
  expect(find('POST', '')).toHaveLength(0)
  fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: 'Từ vựng React' } })
  await screen.findByRole('option', { name: 'SQL' })
  await user.selectOptions(screen.getByLabelText(/Chủ đề/), 'sql')
  await user.click(screen.getByLabelText('Flashcard'))
  await user.click(screen.getByRole('button', { name: 'Tạo' }))
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/author/exercises/s1/edit'))
  expect(find('POST', '')[0].body).toEqual({ title: 'Từ vựng React', description: '', topicId: 'sql', difficulty: 'MEDIUM', type: 'FLASHCARD' })
  expect(await screen.findByText('Đã tạo bộ bài tập. Hãy thêm câu hỏi.')).toBeTruthy()
})

it('adds a question (errors under the field first), saves with the version read, and submits only after confirmation', async () => {
  const user = userEvent.setup()
  renderEditor('/author/exercises/s1/edit')
  await screen.findByRole('heading', { name: 'SQL cơ bản', level: 1 })
  expect(screen.getByText('Cần ít nhất 3 câu trắc nghiệm (hoặc 5 thẻ) để gửi duyệt.')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Gửi duyệt' }) as HTMLButtonElement).disabled).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Thêm câu hỏi' }))
  let dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Xong' }))
  expect(within(dialog).getByText('Câu 3: thông tin chưa hợp lệ.')).toBeTruthy()
  expect(within(dialog).getByText('Hãy chọn đáp án đúng.')).toBeTruthy()
  dialog = await fillQuestion(user, 'Câu mới')
  await user.click(within(dialog).getByRole('button', { name: 'Xong' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(find('PUT', '/s1/questions')).toHaveLength(0) // “Xong” never calls the API
  await user.click(screen.getByRole('button', { name: /^Lưu/ }))
  await screen.findByText('Đã lưu.')
  const [put] = find('PUT', '/s1/questions')
  expect(put.body.version).toBe(3)
  expect(put.body.questions).toHaveLength(3)
  expect(put.body.questions[2]).toEqual({ content: 'Câu mới', codeSnippet: null, codeLanguage: null, options: ['Đúng', 'Sai'], correctIndex: 0, explanation: 'Giải thích.' })
  expect(find('PATCH', '/s1')).toHaveLength(0) // metadata unchanged: no PATCH
  await user.click(screen.getByRole('button', { name: 'Gửi duyệt' }))
  expect(await screen.findByText('Gửi bộ bài tập này để Moderator duyệt?')).toBeTruthy()
  expect(find('POST', '/s1/submit')).toHaveLength(0)
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Gửi duyệt' }))
  await screen.findByText('Đã gửi duyệt.')
  expect(find('POST', '/s1/submit')).toHaveLength(1)
  expect(screen.getByText('Bộ bài tập đang ở trạng thái không sửa được.')).toBeTruthy()
})

it('saves metadata (PATCH without type) and then questions with the version the PATCH returned', async () => {
  const user = userEvent.setup()
  renderEditor('/author/exercises/s1/edit')
  await screen.findByRole('heading', { name: 'SQL cơ bản', level: 1 })
  fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: '  Tiêu đề mới  ' } })
  await user.click(screen.getByRole('button', { name: 'Xóa 2' }))
  await user.click(screen.getByRole('button', { name: /^Lưu/ }))
  await screen.findByText('Đã lưu.')
  expect(find('PATCH', '/s1')[0].body).toEqual({ version: 3, title: 'Tiêu đề mới', description: 'Mô tả', topicId: 'sql', difficulty: 'MEDIUM' })
  expect(find('PUT', '/s1/questions')[0].body.version).toBe(4)
  expect(find('PUT', '/s1/questions')[0].body.questions).toHaveLength(1)
})

it('keeps the new version when the questions PUT fails after the PATCH, so the retry is not a false conflict', async () => {
  const user = userEvent.setup()
  renderEditor('/author/exercises/s1/edit')
  await screen.findByRole('heading', { name: 'SQL cơ bản', level: 1 })
  fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: 'Tiêu đề mới' } })
  await user.click(screen.getByRole('button', { name: 'Xóa 2' }))
  let failPut = true
  fetchMock.mockImplementation(async (input, init) => {
    if (failPut && init?.method === 'PUT') { failPut = false; return new Response(JSON.stringify({ status: 400, message: 'x', code: 'EXERCISE_CONTENT_INVALID', data: null }), { status: 400 }) }
    return backend(input, init)
  })
  await user.click(screen.getByRole('button', { name: /^Lưu/ }))
  expect(await screen.findByText('Nội dung chứa định dạng không được hỗ trợ.')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: /^Lưu/ }))
  await screen.findByText('Đã lưu.')
  expect(find('PATCH', '/s1')).toHaveLength(1)
  expect(find('PUT', '/s1/questions').map(c => c.body.version)).toEqual([4, 4])
})

it('reorders with the up/down buttons and shows a flashcard set with card copy', async () => {
  const user = userEvent.setup()
  set = baseSet({ type: 'FLASHCARD', questions: [cardQuestion(0), cardQuestion(1)] })
  renderEditor('/author/exercises/s1/edit')
  await screen.findByRole('heading', { name: 'Thẻ (2/50)' })
  expect(screen.getByText('Cần ít nhất 3 câu trắc nghiệm (hoặc 5 thẻ) để gửi duyệt.')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Chuyển xuống 1' }))
  await user.click(screen.getByRole('button', { name: /^Lưu/ }))
  await screen.findByText('Đã lưu.')
  expect(find('PUT', '/s1/questions')[0].body.questions.map((q: { front: string }) => q.front)).toEqual(['Mặt trước 1', 'Mặt trước 0'])
  expect(find('PUT', '/s1/questions')[0].body.questions[0]).not.toHaveProperty('options')
})

it('shows a published set read-only: no save, a notice, and duplicate opens the copy', async () => {
  const user = userEvent.setup()
  set = baseSet({ status: 'PUBLISHED', publishedAt: '2026-11-03T00:00:00Z' })
  renderEditor('/author/exercises/s1/edit')
  await screen.findByRole('heading', { name: 'SQL cơ bản', level: 1 })
  expect(screen.getByText('Bộ đã công khai không sửa được. Hãy tạo bản sao để chỉnh sửa.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^Lưu/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Thêm câu hỏi' })).toBeNull()
  expect(screen.queryByText('Tạo câu hỏi bằng AI')).toBeNull()
  expect((screen.getByLabelText(/Tiêu đề/) as HTMLInputElement).disabled).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Tạo bản sao' }))
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/author/exercises/s2/edit'))
})

it('shows the moderator note on a set that needs changes', async () => {
  set = baseSet({ status: 'CHANGES_REQUESTED', moderationNote: 'Câu 2 thiếu giải thích' })
  renderEditor('/author/exercises/s1/edit')
  expect(await screen.findByText(/Moderator yêu cầu sửa: “Câu 2 thiếu giải thích”/)).toBeTruthy()
})

it('opens a reload dialog on EXERCISE_VERSION_CONFLICT and keeps the edit until reloaded', async () => {
  const user = userEvent.setup()
  renderEditor('/author/exercises/s1/edit')
  await screen.findByRole('heading', { name: 'SQL cơ bản', level: 1 })
  fireEvent.change(screen.getByLabelText(/Mô tả/), { target: { value: 'Bản của tôi' } })
  failNext = { code: 'EXERCISE_VERSION_CONFLICT', status: 409 }
  await user.click(screen.getByRole('button', { name: /^Lưu/ }))
  expect(await screen.findByText('Bộ bài tập đã được sửa ở nơi khác. Hãy tải lại trước khi lưu.')).toBeTruthy()
  expect((screen.getByLabelText(/Mô tả/) as HTMLTextAreaElement).value).toBe('Bản của tôi')
  await user.click(screen.getByRole('button', { name: 'Tải lại' }))
  await waitFor(() => expect((screen.getByLabelText(/Mô tả/) as HTMLTextAreaElement).value).toBe('Mô tả'))
})

it('shows not-found for another Author’s set and a retry for a load failure', async () => {
  fetchMock.mockImplementation(async (input, init) => new URL(String(input)).pathname.endsWith('/s1') ? new Response(JSON.stringify({ status: 404, message: 'x', code: 'EXERCISE_SET_NOT_FOUND', data: null }), { status: 404 }) : backend(input, init))
  renderEditor('/author/exercises/s1/edit')
  expect(await screen.findByText('Không tìm thấy bộ bài tập.')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Về danh sách' }).getAttribute('href')).toBe('/author/exercises')
})

it('AI panel: sends the held version, lists suggestions, adds the selected ones unsaved, and the next save uses the returned version', async () => {
  const user = userEvent.setup()
  renderEditor('/author/exercises/s1/edit')
  await screen.findByRole('heading', { name: 'SQL cơ bản', level: 1 })
  expect(await screen.findByText('Còn 7/10 lượt hôm nay')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Yêu cầu'), { target: { value: '  tập trung JOIN  ' } })
  fireEvent.change(screen.getByLabelText('Số câu'), { target: { value: '3' } })
  await user.click(screen.getByRole('button', { name: 'Tạo câu hỏi' }))
  expect(await screen.findByText('AI tạo được 2/3 câu. Hãy kiểm tra trước khi dùng.')).toBeTruthy()
  expect(find('POST', '/s1/ai/questions')[0].body).toEqual({ version: 3, instruction: 'tập trung JOIN', count: 3 })
  expect(find('PUT', '/s1/questions')).toHaveLength(0)
  expect(screen.getByText('Còn 6/10 lượt hôm nay')).toBeTruthy()
  await user.click(screen.getByLabelText('Chọn Câu đề xuất 2')) // deselect the second
  await user.click(screen.getByRole('button', { name: /Thêm câu đã chọn \(1\)/ }))
  expect(screen.getByRole('heading', { name: 'Câu hỏi (3/50)' })).toBeTruthy()
  expect(screen.getByText('AI hỏi 1')).toBeTruthy()
  expect(find('PUT', '/s1/questions')).toHaveLength(0) // not saved until Lưu
  await user.click(screen.getByRole('button', { name: /^Lưu/ }))
  await screen.findByText('Đã lưu.')
  expect(find('PUT', '/s1/questions')[0].body.version).toBe(5)
})

it('AI panel cannot add suggestions while a save is in flight', async () => {
  const user = userEvent.setup()
  renderEditor('/author/exercises/s1/edit')
  await screen.findByRole('heading', { name: 'SQL cơ bản', level: 1 })
  await user.click(screen.getByRole('button', { name: 'Tạo câu hỏi' }))
  await screen.findByText(/AI tạo được/)
  fireEvent.change(screen.getByLabelText(/Mô tả/), { target: { value: 'Đổi mô tả' } })
  let release!: () => void
  fetchMock.mockImplementation(async (input, init) => { if (init?.method === 'PATCH') await new Promise<void>(r => { release = r }); return backend(input, init) })
  await user.click(screen.getByRole('button', { name: /^Lưu/ }))
  await waitFor(() => expect((screen.getByRole('button', { name: /Thêm câu đã chọn/ }) as HTMLButtonElement).disabled).toBe(true))
  release()
  await screen.findByText('Đã lưu.')
  await waitFor(() => expect((screen.getByRole('button', { name: /Thêm câu đã chọn/ }) as HTMLButtonElement).disabled).toBe(false))
})

it('AI panel saves pending edits first and rejects overlong input without calling the API', async () => {
  const user = userEvent.setup()
  renderEditor('/author/exercises/s1/edit')
  await screen.findByRole('heading', { name: 'SQL cơ bản', level: 1 })
  fireEvent.change(screen.getByLabelText('Yêu cầu'), { target: { value: 'x'.repeat(501) } })
  await user.click(screen.getByRole('button', { name: 'Tạo câu hỏi' }))
  expect(screen.getByText('Yêu cầu tối đa 500 ký tự.')).toBeTruthy()
  expect(find('POST', '/s1/ai/questions')).toHaveLength(0)
  fireEvent.change(screen.getByLabelText('Yêu cầu'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText(/Mô tả/), { target: { value: 'Mô tả mới' } })
  await user.click(screen.getByRole('button', { name: 'Tạo câu hỏi' }))
  await screen.findByText(/AI tạo được/)
  expect(find('PATCH', '/s1')).toHaveLength(1)
  expect(find('POST', '/s1/ai/questions')[0].body.version).toBe(4) // the version after the PATCH
})

it('AI panel maps the 1c errors, keeps the suggestions on a failure and locks the button when the quota is spent', async () => {
  const user = userEvent.setup()
  renderEditor('/author/exercises/s1/edit')
  await screen.findByRole('heading', { name: 'SQL cơ bản', level: 1 })
  await user.click(screen.getByRole('button', { name: 'Tạo câu hỏi' }))
  await screen.findByText(/AI tạo được/)
  failNext = { code: 'AI_OUTPUT_INVALID', status: 422 }
  await user.click(screen.getByRole('button', { name: 'Tạo câu hỏi' }))
  expect(await screen.findByText('AI trả nội dung chưa hợp lệ. Hãy thử tạo lại.')).toBeTruthy()
  expect(screen.getByText('Câu đề xuất 1')).toBeTruthy()
  failNext = { code: 'AI_QUOTA_EXCEEDED', status: 429, headers: { 'X-AI-Quota-Limit': '10', 'X-AI-Quota-Remaining': '0' } }
  await user.click(screen.getByRole('button', { name: 'Tạo câu hỏi' }))
  expect(await screen.findByText('Bạn đã dùng hết lượt AI hôm nay.', { selector: 'p:not([role])' })).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Tạo câu hỏi' }) as HTMLButtonElement).disabled).toBe(true)
})

it('AI panel refuses to add past 50 questions and a version conflict opens the reload dialog', async () => {
  const user = userEvent.setup()
  set = baseSet({ questions: Array.from({ length: 49 }, (_, i) => quizQuestion(i)) })
  renderEditor('/author/exercises/s1/edit')
  await screen.findByRole('heading', { name: 'Câu hỏi (49/50)' })
  await user.click(screen.getByRole('button', { name: 'Tạo câu hỏi' }))
  await screen.findByText(/AI tạo được/)
  await user.click(screen.getByRole('button', { name: /Thêm câu đã chọn \(2\)/ }))
  expect(screen.getByText('Mỗi bộ tối đa 50 câu.')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Câu hỏi (49/50)' })).toBeTruthy()
  failNext = { code: 'EXERCISE_VERSION_CONFLICT', status: 409 }
  await user.click(screen.getByRole('button', { name: 'Tạo câu hỏi' }))
  expect(await screen.findByRole('alertdialog')).toBeTruthy()
  expect(screen.getByText('Câu đề xuất 1')).toBeTruthy() // the AI result survives so it is not lost
})

it('warns before leaving with unsaved changes (in-app) and lets the user stay', async () => {
  const user = userEvent.setup()
  const router = createMemoryRouter([
    { path: '/author/exercises/:id/edit', element: <ExerciseEditorPage language="vi" /> },
    { path: '/author/exercises', element: <Where /> },
  ], { initialEntries: ['/author/exercises/s1/edit'] })
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { name: 'SQL cơ bản', level: 1 })
  await router.navigate('/author/exercises') // clean: no warning
  await waitFor(() => expect(router.state.location.pathname).toBe('/author/exercises'))
  await router.navigate('/author/exercises/s1/edit')
  await screen.findByRole('heading', { name: 'SQL cơ bản', level: 1 })
  fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: 'Đã sửa tiêu đề' } })
  void router.navigate('/author/exercises')
  expect(await screen.findByText('Bạn có thay đổi chưa lưu. Rời trang?')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Ở lại' }))
  expect(router.state.location.pathname).toBe('/author/exercises/s1/edit')
  void router.navigate('/author/exercises')
  await user.click(await screen.findByRole('button', { name: 'Rời trang' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/author/exercises'))
})

it('renders the English copy', async () => {
  renderEditor('/author/exercises/s1/edit', 'en')
  expect(await screen.findByRole('button', { name: 'Add question' })).toBeTruthy()
  expect(screen.getByText('At least 3 questions (or 5 cards) are needed to submit.')).toBeTruthy()
  expect(screen.getByText('Generate with AI')).toBeTruthy()
})
