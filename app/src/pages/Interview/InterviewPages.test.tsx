import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import App from '../../App'
import { InterviewListPage } from './InterviewListPage'
import { InterviewDetailPage } from './InterviewDetailPage'
import { setAccessToken } from '../../services/api/client'
import type { PublishedInterviewQuestion } from '../../types/interview'

afterEach(() => {
  cleanup()
  setAccessToken(null)
  localStorage.clear()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

const json = (data: unknown, status = 200, code?: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ status, code, message: 'English message', data }), { status, headers })

const page = (content: unknown[], totalElements = content.length) => ({
  content,
  page: 0,
  size: 12,
  totalElements,
  totalPages: 1,
  hasNext: false,
})

const publishedQuestion = (over: Partial<PublishedInterviewQuestion> = {}): PublishedInterviewQuestion => ({
  id: 'q1',
  topic: { id: 'sql', name: 'SQL' },
  level: 'MEDIUM',
  question: 'Giải thích cơ chế ACID trong cơ sở dữ liệu quan hệ?',
  author: { id: 'a1', fullName: 'Nguyễn A', avatarUrl: null },
  publishedAt: '2026-11-15T00:00:00Z',
  hasHint: true,
  viewer: { reviewed: false, saved: false },
  ...over,
})

function Where() {
  const l = useLocation()
  return (
    <output data-testid="where">
      {l.pathname}
      {l.search}
      {l.state ? JSON.stringify(l.state) : ''}
    </output>
  )
}

const renderList = (path = '/interview', authenticated = false) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/interview" element={<InterviewListPage language="vi" authenticated={authenticated} />} />
        <Route path="/interview/:id" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

const renderDetail = (authenticated = false, path = '/interview/q1') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/interview/:id" element={<InterviewDetailPage language="vi" authenticated={authenticated} />} />
        <Route path="/interview" element={<Where />} />
        <Route path="/login" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

it('lists published questions, syncs filters with URL, hides personal mark controls from guests, and rolls back failed card save', async () => {
  let failMark = false
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/v1/interview-questions/options') return json([{ id: 'sql', name: 'SQL' }])
    if (url.pathname === '/api/v1/interview-questions/q1/mark' && init?.method === 'PUT') {
      if (failMark) return json(null, 503, 'INTERVIEW_STORAGE_UNAVAILABLE')
      const body = JSON.parse(String(init.body))
      return json({ reviewed: false, saved: Boolean(body.saved) })
    }
    return json(page([publishedQuestion()]))
  })
  vi.stubGlobal('fetch', fetchMock)

  // Guest view: no mark filter and no save button
  const guestView = renderList('/interview', false)
  expect(await screen.findByRole('link', { name: /Giải thích cơ chế ACID/ })).toBeTruthy()
  expect(screen.queryByRole('group', { name: 'Trạng thái cá nhân' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Lưu bài viết' })).toBeNull()
  guestView.unmount()

  // Signed-in learner view: personal mark filter, URL filter sync, and inline save button with rollback
  setAccessToken('learner')
  const user = userEvent.setup()
  renderList('/interview', true)
  await screen.findByRole('link', { name: /Giải thích cơ chế ACID/ })
  await user.click(within(screen.getByRole('group', { name: 'Trạng thái cá nhân' })).getByRole('button', { name: 'Đã lưu' }))
  await user.selectOptions(screen.getByLabelText('Mức độ'), 'HARD')
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('mark=SAVED') && String(u).includes('level=HARD'))).toBe(true),
  )

  const saveBtn = screen.getByRole('button', { name: 'Lưu bài viết' })
  expect(saveBtn.getAttribute('aria-pressed')).toBe('false')
  failMark = true
  await user.click(saveBtn)
  await waitFor(() => expect(saveBtn.getAttribute('aria-pressed')).toBe('false'))
  expect(await screen.findByText('Dịch vụ đang gián đoạn. Hãy thử lại.')).toBeTruthy()
})

it('shows Guest the question on /interview/:id without calling /answer and sends them to /login with returnTo', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/v1/interview-questions/q1') return json(publishedQuestion({ viewer: null }))
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  const user = userEvent.setup()
  renderDetail(false)

  expect(await screen.findByText('Giải thích cơ chế ACID trong cơ sở dữ liệu quan hệ?')).toBeTruthy()
  expect(screen.getByText('Đăng nhập để xem gợi ý, đáp án mẫu và luyện trả lời.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Xem gợi ý' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Xem đáp án mẫu' })).toBeNull()
  expect(screen.queryByText('Luyện trả lời')).toBeNull()
  expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/answer'))).toBe(false)

  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  expect(screen.getByTestId('where').textContent).toBe('/login{"returnTo":"/interview/q1"}')
})

it('fetches /answer lazily on first click of Xem gợi ý (showing only the hint) and reuses cached response for Xem đáp án mẫu', async () => {
  let answerCalls = 0
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/v1/interview-questions/q1') return json(publishedQuestion())
    if (url.pathname === '/api/v1/me/interview-feedback/quota') return json({ limit: 15, remaining: 14 })
    if (url.pathname === '/api/v1/interview-questions/q1/answer') {
      answerCalls++
      return json({
        hint: 'Gợi ý: Hãy nêu Atomicity, Consistency, Isolation, Durability.',
        sampleAnswer: 'Đáp án mẫu đầy đủ cho câu hỏi ACID.',
      })
    }
    if (url.pathname === '/api/v1/interview-questions/q1/mark' && init?.method === 'PUT') {
      const body = JSON.parse(String(init.body))
      return json({ reviewed: Boolean(body.reviewed), saved: Boolean(body.saved) })
    }
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('learner')
  const user = userEvent.setup()
  renderDetail(true)

  expect(await screen.findByText('Giải thích cơ chế ACID trong cơ sở dữ liệu quan hệ?')).toBeTruthy()
  expect(answerCalls).toBe(0)

  // First click on "Xem gợi ý": calls /answer once and shows ONLY the hint
  await user.click(screen.getByRole('button', { name: 'Xem gợi ý' }))
  expect(await screen.findByText('Gợi ý: Hãy nêu Atomicity, Consistency, Isolation, Durability.')).toBeTruthy()
  expect(screen.queryByText('Đáp án mẫu đầy đủ cho câu hỏi ACID.')).toBeNull()
  expect(answerCalls).toBe(1)

  // Clicking "Xem đáp án mẫu" reveals the sample answer from cache without calling /answer a second time
  await user.click(screen.getByRole('button', { name: 'Xem đáp án mẫu' }))
  expect(await screen.findByText('Đáp án mẫu đầy đủ cho câu hỏi ACID.')).toBeTruthy()
  expect(answerCalls).toBe(1)

  // Mark as reviewed & Save toggles
  await user.click(screen.getByRole('button', { name: 'Đánh dấu đã ôn' }))
  expect(await screen.findByRole('button', { name: 'Đã ôn' })).toBeTruthy()
})

it('runs AI feedback flow: updates quota from headers, shows verdict/strengths/missing/advice/disclaimer, retries temporary errors, and locks on 0 quota', async () => {
  let failFeedback: { status: number; code: string; headers?: Record<string, string> } | null = null
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/v1/interview-questions/q1') return json(publishedQuestion())
    if (url.pathname === '/api/v1/me/interview-feedback/quota') return json({ limit: 15, remaining: 2 })
    if (url.pathname === '/api/v1/interview-questions/q1/feedback' && init?.method === 'POST') {
      if (failFeedback) {
        const { status, code, headers } = failFeedback
        failFeedback = null
        return json(null, status, code, headers)
      }
      return json(
        {
          verdict: 'PARTIAL',
          strengths: ['Nêu đúng Atomicity và Consistency'],
          missing: ['Chưa giải thích các mức Isolation', 'Thiếu ví dụ về Durability'],
          advice: 'Hãy bổ sung ví dụ về Read Committed và Serializable để câu trả lời thuyết phục hơn.',
        },
        200,
        undefined,
        { 'X-AI-Quota-Limit': '15', 'X-AI-Quota-Remaining': '1' },
      )
    }
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('learner')
  const user = userEvent.setup()
  renderDetail(true)

  expect(await screen.findByText('Còn 2/15 lượt hôm nay')).toBeTruthy()

  // Empty answer validation
  await user.click(screen.getByRole('button', { name: 'Nhận xét bằng AI' }))
  expect(screen.getByText('Câu trả lời cần từ 1 đến 4.000 ký tự.')).toBeTruthy()

  fireEvent.change(screen.getByLabelText('Câu trả lời của bạn'), {
    target: { value: 'ACID gồm Atomicity và Consistency giúp giao dịch toàn vẹn.' },
  })

  // Temporary AI failure shows Retry button
  failFeedback = { status: 502, code: 'AI_PROVIDER_UNAVAILABLE' }
  await user.click(screen.getByRole('button', { name: 'Nhận xét bằng AI' }))
  expect(await screen.findByText('Dịch vụ AI đang gián đoạn. Hãy thử lại.')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))

  // Success displays verdict badge, strengths, missing, advice, disclaimer, and updated quota from headers
  expect(await screen.findByText('Đúng một phần')).toBeTruthy()
  expect(screen.getByText('Bạn làm tốt')).toBeTruthy()
  expect(screen.getByText('Lời khuyên')).toBeTruthy()
  expect(screen.getByText('Nêu đúng Atomicity và Consistency')).toBeTruthy()
  expect(screen.getByText('Chưa giải thích các mức Isolation')).toBeTruthy()
  expect(screen.getByText('Hãy bổ sung ví dụ về Read Committed và Serializable để câu trả lời thuyết phục hơn.')).toBeTruthy()
  expect(screen.getByText('Nhận xét do AI tạo, có thể chưa chính xác. Hãy đối chiếu với đáp án mẫu.')).toBeTruthy()
  expect(screen.getByText('Còn 1/15 lượt hôm nay')).toBeTruthy()

  // Next call hits AI_QUOTA_EXCEEDED -> locks button and shows out-of-quota text
  failFeedback = { status: 429, code: 'AI_QUOTA_EXCEEDED', headers: { 'X-AI-Quota-Limit': '15', 'X-AI-Quota-Remaining': '0' } }
  await user.click(screen.getByRole('button', { name: 'Nhận xét bằng AI' }))
  expect(await screen.findAllByText('Bạn đã dùng hết lượt AI hôm nay.')).toHaveLength(2)
  expect((screen.getByRole('button', { name: 'Nhận xét bằng AI' }) as HTMLButtonElement).disabled).toBe(true)
})

it('hides quota count and keeps button enabled when GET /me/interview-feedback/quota fails with 503, and shows unavailable state on 404 question', async () => {
  let missingQuestion = false
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/v1/interview-questions/q1') {
      return missingQuestion ? json(null, 404, 'INTERVIEW_QUESTION_NOT_FOUND') : json(publishedQuestion())
    }
    if (url.pathname === '/api/v1/me/interview-feedback/quota') return json(null, 503, 'AI_STORAGE_UNAVAILABLE')
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('learner')
  renderDetail(true)

  const btn = (await screen.findByRole('button', { name: 'Nhận xét bằng AI' })) as HTMLButtonElement
  expect(btn.disabled).toBe(false)
  expect(screen.queryByText(/lượt hôm nay/)).toBeNull()

  cleanup()
  missingQuestion = true
  renderDetail(true)
  expect(await screen.findByText('Câu hỏi không còn khả dụng.')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Về danh sách' }).getAttribute('href')).toBe('/interview')
})

it('redirects ADMIN and MODERATOR away from /interview and /interview/:id without calling the public interview API', async () => {
  let roles: string[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname
    if (path.endsWith('/auth/refresh')) return json({ accessToken: 'tok2', expiresAt: '', expiresIn: 900 })
    if (path === '/api/v1/users/me') {
      return json({
        id: 'u1',
        fullName: 'Staff',
        email: 'staff@example.com',
        roles,
        phoneNumber: null,
        dateOfBirth: null,
        avatarUrl: null,
        createdAt: '',
        updatedAt: '',
      })
    }
    return json(page([]))
  })
  vi.stubGlobal('fetch', fetchMock)

  for (const [r, home] of [
    [['MODERATOR'], '/moderator'],
    [['ADMIN'], '/admin'],
  ] as const) {
    for (const path of ['/interview', '/interview/q1']) {
      roles = [...r]
      localStorage.setItem('techverse-authenticated', 'true')
      setAccessToken('tok')
      fetchMock.mockClear()
      render(
        <MemoryRouter initialEntries={[path]}>
          <App />
          <Where />
        </MemoryRouter>,
      )
      await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(home))
      expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/v1/interview-questions'))).toHaveLength(0)
      cleanup()
    }
  }
})
