import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes, useLocation } from 'react-router-dom'
import { AuthorInterviewQuestionsPage } from './AuthorInterviewQuestionsPage'
import { InterviewQuestionEditorPage } from './InterviewQuestionEditorPage'
import { setAccessToken } from '../../../services/api/client'
import type { InterviewQuestion } from '../../../types/interview'

const topic = { id: '11111111-1111-1111-1111-111111111111', name: 'SQL', active: true }
const makeQuestion = (id: string, question: string, over: Partial<InterviewQuestion> = {}): InterviewQuestion => ({
  id,
  topic,
  level: 'MEDIUM',
  question,
  sampleAnswer: 'Đáp án mẫu chi tiết cho câu hỏi phỏng vấn này với đầy đủ ý chính.',
  hint: 'Gợi ý ngắn gọn.',
  status: 'DRAFT',
  aiAssisted: false,
  version: 2,
  moderationNote: null,
  publishedAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-18T10:00:00Z',
  ...over,
})

const page = (content: InterviewQuestion[]) => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: 1,
  hasNext: false,
})

let rows: InterviewQuestion[]
let currentItem: InterviewQuestion
let failNext: { code: string; status: number; headers?: Record<string, string> } | null
const fetchMock = vi.fn<typeof fetch>()
const respond = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ status, message: 'ok', data }), { status, headers })

const calls = () =>
  fetchMock.mock.calls.map(([url, init]) => ({
    url: new URL(String(url)),
    method: init?.method || 'GET',
    body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
  }))
const find = (method: string, path: string) =>
  calls().filter(c => c.method === method && c.url.pathname === `/api/v1/author/interview-questions${path}`)

async function backend(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(String(input))
  const method = init?.method || 'GET'
  if (url.pathname === '/api/v1/author/ai/quota') {
    return respond({
      outline: { limit: 10, remaining: 10 },
      draft: { limit: 5, remaining: 5 },
      exercise: { limit: 10, remaining: 8 },
      interviewDraft: { limit: 10, remaining: 7 },
    })
  }
  const path = url.pathname.replace('/api/v1/author/interview-questions', '')
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null
  if (path === '/options') return respond([topic])
  if (method !== 'GET' && failNext) {
    const { code, status, headers } = failNext
    failNext = null
    return new Response(JSON.stringify({ status, message: 'English error', code, data: null }), { status, headers })
  }
  if (path === '' && method === 'GET') return respond(page(rows))
  if (path === '' && method === 'POST') {
    currentItem = makeQuestion('new-1', body.question, {
      level: body.level,
      sampleAnswer: body.sampleAnswer,
      hint: body.hint,
      version: 0,
    })
    return respond(currentItem, 201)
  }
  if (path === '/ai/drafts' && method === 'POST') {
    const d1 = makeQuestion('ai-1', 'Câu hỏi AI tạo số 1 về transaction?', { aiAssisted: true })
    const d2 = makeQuestion('ai-2', 'Câu hỏi AI tạo số 2 về deadlock?', { aiAssisted: true })
    rows = [d1, d2, ...rows]
    return respond({ questions: [d1, d2], requested: body.count }, 200, {
      'X-AI-Quota-Limit': '10',
      'X-AI-Quota-Remaining': '6',
    })
  }
  if (path === '/q1' && method === 'GET') return respond(currentItem)
  if (path === '/q1' && method === 'PATCH') {
    currentItem = {
      ...currentItem,
      question: body.question ?? currentItem.question,
      sampleAnswer: body.sampleAnswer ?? currentItem.sampleAnswer,
      hint: body.hint ?? currentItem.hint,
      level: body.level ?? currentItem.level,
      version: currentItem.version + 1,
    }
    return respond(currentItem)
  }
  if (path.endsWith('/submit')) {
    currentItem = { ...currentItem, status: 'PENDING', version: currentItem.version + 1 }
    return respond(currentItem)
  }
  if (path.endsWith('/withdraw')) {
    currentItem = { ...currentItem, status: 'DRAFT', version: currentItem.version + 1 }
    return respond(currentItem)
  }
  if (path.endsWith('/visibility')) {
    currentItem = { ...currentItem, status: body.action === 'HIDE' ? 'AUTHOR_HIDDEN' : 'PUBLISHED' }
    return respond(currentItem)
  }
  if (path.endsWith('/copy')) {
    return respond(makeQuestion('copy-1', `${currentItem.question} (bản sao)`), 201)
  }
  if (method === 'DELETE') return respond(null)
  return respond(null, 404)
}

function Where() {
  const l = useLocation()
  return <output data-testid="where">{l.pathname}</output>
}

function renderList(language: 'vi' | 'en' = 'vi') {
  return render(
    <MemoryRouter initialEntries={['/author/interview-questions']}>
      <Routes>
        <Route path="/author/interview-questions" element={<AuthorInterviewQuestionsPage language={language} />} />
        <Route path="/author/interview-questions/new" element={<Where />} />
        <Route path="/author/interview-questions/:id/edit" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderEditor(path: string, language: 'vi' | 'en' = 'vi') {
  const pageEl = (
    <>
      <InterviewQuestionEditorPage language={language} />
      <Where />
    </>
  )
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/author/interview-questions/new" element={pageEl} />
        <Route path="/author/interview-questions/:id/edit" element={pageEl} />
        <Route path="/author/interview-questions" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

const rowOf = async (question: string) => within((await screen.findByText(question)).closest('li') as HTMLElement)

beforeEach(() => {
  setAccessToken('tok')
  failNext = null
  currentItem = makeQuestion('q1', 'Giải thích cơ chế ACID trong cơ sở dữ liệu?')
  rows = [
    makeQuestion('a', 'Giải thích chỉ mục B-Tree trong SQL?', { status: 'PUBLISHED', publishedAt: '2026-11-10T00:00:00Z', aiAssisted: true }),
    makeQuestion('b', 'Sự khác biệt giữa INNER JOIN và LEFT JOIN?', { status: 'CHANGES_REQUESTED', moderationNote: 'Bổ sung ví dụ thực tế' }),
    makeQuestion('c', 'Cơ chế MVCC hoạt động như thế nào?', { status: 'DRAFT' }),
    makeQuestion('d', 'Khi nào nên dùng Denormalization?', { status: 'PENDING' }),
  ]
  fetchMock.mockReset().mockImplementation(backend)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  setAccessToken(null)
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

it('lists author questions with status, level, AI badge, moderator note and allowed actions per state', async () => {
  renderList()
  const pub = await rowOf('Giải thích chỉ mục B-Tree trong SQL?')
  expect(pub.getByText('Đang công khai')).toBeTruthy()
  expect(pub.getByText('Có dùng AI')).toBeTruthy()
  expect(pub.getByRole('link', { name: /^Xem/ })).toBeTruthy()
  expect(pub.getByRole('button', { name: /^Ẩn/ })).toBeTruthy()
  expect(pub.getByRole('button', { name: /^Tạo bản sao/ })).toBeTruthy()
  expect(pub.queryByRole('button', { name: /^Xóa/ })).toBeNull()

  const changes = await rowOf('Sự khác biệt giữa INNER JOIN và LEFT JOIN?')
  expect(changes.getByText(/Ghi chú của Moderator: “Bổ sung ví dụ thực tế”/)).toBeTruthy()
  expect(changes.getByRole('link', { name: /^Sửa/ })).toBeTruthy()
  expect(changes.getByRole('button', { name: /^Xóa/ })).toBeTruthy()

  const pending = await rowOf('Khi nào nên dùng Denormalization?')
  expect(pending.getByRole('button', { name: /^Rút lại/ })).toBeTruthy()
  expect(pending.queryByRole('button', { name: /^Xóa/ })).toBeNull()
})

it('duplicates, hides, withdraws and deletes after confirmation', async () => {
  const user = userEvent.setup()
  renderList()
  const pub = await rowOf('Giải thích chỉ mục B-Tree trong SQL?')
  await user.click(pub.getByRole('button', { name: /^Tạo bản sao/ }))
  expect(await screen.findByText('Đã tạo bản sao.')).toBeTruthy()
  expect(find('POST', '/a/copy')).toHaveLength(1)

  await user.click((await rowOf('Giải thích chỉ mục B-Tree trong SQL?')).getByRole('button', { name: /^Ẩn/ }))
  await waitFor(() => expect(find('PATCH', '/a/visibility')[0]?.body).toEqual({ action: 'HIDE' }))

  await user.click((await rowOf('Cơ chế MVCC hoạt động như thế nào?')).getByRole('button', { name: /^Xóa/ }))
  expect(await screen.findByText('Xóa câu hỏi phỏng vấn này? Không thể hoàn tác.')).toBeTruthy()
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Xóa' }))
  expect(await screen.findByText('Đã xóa câu hỏi phỏng vấn.')).toBeTruthy()
  expect(find('DELETE', '/c')).toHaveLength(1)
})

it('opens the AI dialog, validates input, creates draft questions, highlights them in the list, and handles AI errors & quota exhaustion', async () => {
  const user = userEvent.setup()
  renderList()
  await screen.findByText('Giải thích chỉ mục B-Tree trong SQL?')

  await user.click(screen.getByRole('button', { name: 'Tạo bằng AI' }))
  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByText('Còn 7/10 lượt hôm nay')).toBeTruthy()

  fireEvent.change(within(dialog).getByLabelText('Yêu cầu'), { target: { value: 'x'.repeat(501) } })
  expect(within(dialog).getByText('Yêu cầu tối đa 500 ký tự.')).toBeTruthy()
  await user.click(within(dialog).getByRole('button', { name: 'Tạo bằng AI' }))
  expect(find('POST', '/ai/drafts')).toHaveLength(0)

  fireEvent.change(within(dialog).getByLabelText('Yêu cầu'), { target: { value: 'Tập trung transaction và khóa' } })
  failNext = { code: 'AI_OUTPUT_INVALID', status: 422 }
  await user.click(within(dialog).getByRole('button', { name: 'Tạo bằng AI' }))
  expect(await within(dialog).findByText('AI trả về nội dung không dùng được. Hãy thử lại.')).toBeTruthy()

  await user.click(within(dialog).getByRole('button', { name: 'Tạo bằng AI' }))
  expect(await screen.findByText('AI tạo được 2/3 câu, đã lưu thành bản nháp. Hãy kiểm tra trước khi gửi duyệt.')).toBeTruthy()
  const newRow = await rowOf('Câu hỏi AI tạo số 1 về transaction?')
  expect(newRow.getByText('Mới tạo')).toBeTruthy()
  expect(newRow.getByText('Có dùng AI')).toBeTruthy()

  // Reopen dialog and test quota exhaustion
  await user.click(screen.getByRole('button', { name: 'Tạo bằng AI' }))
  const dialog2 = await screen.findByRole('dialog')
  failNext = { code: 'AI_QUOTA_EXCEEDED', status: 429, headers: { 'X-AI-Quota-Limit': '10', 'X-AI-Quota-Remaining': '0' } }
  await user.click(within(dialog2).getByRole('button', { name: 'Tạo bằng AI' }))
  expect(await within(dialog2).findAllByText('Bạn đã dùng hết lượt AI hôm nay.')).toHaveLength(2)
  expect((within(dialog2).getByRole('button', { name: 'Tạo bằng AI' }) as HTMLButtonElement).disabled).toBe(true)
})

it('creates a new question, previews Markdown live, updates with version and submits for review', async () => {
  const user = userEvent.setup()
  renderEditor('/author/interview-questions/new')
  await screen.findByRole('option', { name: 'SQL' })

  await user.click(screen.getByRole('button', { name: 'Lưu' }))
  expect(screen.getByText('Hãy chọn chủ đề.')).toBeTruthy()
  expect(screen.getByText('Câu hỏi cần từ 10 đến 1.000 ký tự.')).toBeTruthy()
  expect(screen.getByText('Đáp án mẫu cần từ 20 đến 5.000 ký tự.')).toBeTruthy()

  await user.selectOptions(screen.getByLabelText(/Chủ đề/), topic.id)
  fireEvent.change(screen.getByLabelText(/Câu hỏi/), { target: { value: 'Giải thích **Clustered Index** và **Non-clustered Index**?' } })
  fireEvent.change(screen.getByLabelText(/Đáp án mẫu/), { target: { value: 'Clustered Index sắp xếp vật lý dữ liệu trong bảng, còn Non-clustered Index giữ con trỏ.' } })
  fireEvent.change(screen.getByLabelText(/Gợi ý/), { target: { value: 'So sánh số lượng mỗi bảng.' } })

  // Preview pane renders Markdown
  const preview = screen.getByRole('region', { name: 'Xem trước' })
  expect(within(preview).getByText('Clustered Index')).toBeTruthy()

  await user.click(screen.getByRole('button', { name: 'Lưu' }))
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/author/interview-questions/new-1/edit'))
  expect(find('POST', '')[0].body).toEqual({
    topicId: topic.id,
    level: 'MEDIUM',
    question: 'Giải thích **Clustered Index** và **Non-clustered Index**?',
    sampleAnswer: 'Clustered Index sắp xếp vật lý dữ liệu trong bảng, còn Non-clustered Index giữ con trỏ.',
    hint: 'So sánh số lượng mỗi bảng.',
  })

  await user.click(screen.getByRole('button', { name: 'Gửi duyệt' }))
  expect(await screen.findByText('Gửi câu hỏi phỏng vấn này để Moderator duyệt?')).toBeTruthy()
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Gửi duyệt' }))
  expect(await screen.findByText('Đã gửi duyệt.')).toBeTruthy()
  expect(find('POST', '/new-1/submit')).toHaveLength(1)
  expect(screen.getByText('Câu hỏi đang chờ duyệt. Hãy rút lại nếu muốn chỉnh sửa.')).toBeTruthy()
})

it('shows read-only state for PUBLISHED questions, duplicates to edit, and handles INTERVIEW_VERSION_CONFLICT', async () => {
  const user = userEvent.setup()
  currentItem = makeQuestion('q1', 'Câu hỏi đã công khai?', { status: 'PUBLISHED', publishedAt: '2026-11-10T00:00:00Z' })
  renderEditor('/author/interview-questions/q1/edit')
  expect(await screen.findByText('Câu hỏi đang ở trạng thái không sửa được. Hãy tạo bản sao nếu muốn chỉnh sửa.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^Lưu/ })).toBeNull()
  expect((screen.getByLabelText(/Câu hỏi/) as HTMLTextAreaElement).disabled).toBe(true)

  await user.click(screen.getByRole('button', { name: 'Tạo bản sao' }))
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/author/interview-questions/copy-1/edit'))

  cleanup()
  currentItem = makeQuestion('q1', 'Câu hỏi đang soạn?', { status: 'DRAFT', version: 4 })
  renderEditor('/author/interview-questions/q1/edit')
  await screen.findByRole('heading', { name: 'Câu hỏi đang soạn?' })
  fireEvent.change(screen.getByLabelText(/Câu hỏi/), { target: { value: 'Câu hỏi đã chỉnh sửa mới?' } })
  failNext = { code: 'INTERVIEW_VERSION_CONFLICT', status: 409 }
  await user.click(screen.getByRole('button', { name: /^Lưu/ }))
  expect(await screen.findByText('Câu hỏi đã được sửa ở nơi khác. Hãy tải lại trước khi lưu.')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Tải lại' }))
  await waitFor(() => expect((screen.getByLabelText(/Câu hỏi/) as HTMLTextAreaElement).value).toBe('Câu hỏi đang soạn?'))
})

it('warns before leaving with unsaved changes and lets the author stay or leave', async () => {
  const user = userEvent.setup()
  const router = createMemoryRouter(
    [
      { path: '/author/interview-questions/:id/edit', element: <InterviewQuestionEditorPage language="vi" /> },
      { path: '/author/interview-questions', element: <Where /> },
    ],
    { initialEntries: ['/author/interview-questions/q1/edit'] },
  )
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { name: 'Giải thích cơ chế ACID trong cơ sở dữ liệu?' })
  fireEvent.change(screen.getByLabelText(/Câu hỏi/), { target: { value: 'Giải thích cơ chế ACID đã sửa nhưng chưa lưu?' } })
  void router.navigate('/author/interview-questions')
  expect(await screen.findByText('Bạn có thay đổi chưa lưu. Rời trang?')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Ở lại' }))
  expect(router.state.location.pathname).toBe('/author/interview-questions/q1/edit')
  void router.navigate('/author/interview-questions')
  await user.click(await screen.findByRole('button', { name: 'Rời trang' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/author/interview-questions'))
})
