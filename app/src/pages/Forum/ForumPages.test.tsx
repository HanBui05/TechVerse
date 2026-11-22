import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes, useLocation } from 'react-router-dom'
import App from '../../App'
import { ForumListPage } from './ForumListPage'
import { ForumQuestionEditorPage } from './ForumQuestionEditorPage'
import { ForumQuestionDetailPage } from './ForumQuestionDetailPage'
import { setAccessToken } from '../../services/api/client'
import type { ForumAnswer, ForumQuestionDetail, ForumQuestionSummary, ForumReactions } from '../../types/forum'

afterEach(() => {
  cleanup()
  setAccessToken(null)
  localStorage.clear()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

const json = (data: unknown, status = 200, code?: string) =>
  new Response(JSON.stringify({ status, code, message: 'English message', data }), { status })

const page = (content: unknown[], totalElements = content.length, hasNext = false) => ({
  content,
  page: 0,
  size: 20,
  totalElements,
  totalPages: Math.max(1, Math.ceil(totalElements / 20)),
  hasNext,
})

const topic = { id: '11111111-1111-1111-1111-111111111111', name: 'Spring Boot', active: true }
const baseReactions = (over: Partial<ForumReactions> = {}): ForumReactions => ({
  counts: { LIKE: 2, LOVE: 1, HAHA: 0, ANGRY: 0 },
  mine: null,
  ...over,
})

const summaryRow = (over: Partial<ForumQuestionSummary> = {}): ForumQuestionSummary => ({
  id: 'q1',
  title: 'Làm sao xử lý N+1 query trong Spring Data JPA?',
  excerpt: 'Khi dùng @OneToMany tôi gặp vấn đề truy vấn lặp lại nhiều lần…',
  topic,
  author: { id: 'u1', fullName: 'Nguyễn A', avatarUrl: null },
  answerCount: 2,
  reactionCount: 3,
  solved: true,
  createdAt: '2026-11-20T08:00:00Z',
  editedAt: '2026-11-20T09:00:00Z',
  ...over,
})

const makeAnswer = (over: Partial<ForumAnswer> = {}): ForumAnswer => ({
  id: 'ans-1',
  content: 'Bạn có thể sử dụng `@EntityGraph` hoặc `JOIN FETCH` trong câu truy vấn JPQL.',
  author: { id: 'u2', fullName: 'Trần B', avatarUrl: null },
  accepted: false,
  createdAt: '2026-11-20T08:30:00Z',
  editedAt: null,
  viewer: { canEdit: true, canDelete: true, canReport: true, canReact: true },
  reactions: baseReactions({ counts: { LIKE: 1, LOVE: 0, HAHA: 0, ANGRY: 0 } }),
  ...over,
})

const makeDetail = (over: Partial<ForumQuestionDetail> = {}): ForumQuestionDetail => ({
  id: 'q1',
  title: 'Làm sao xử lý N+1 query trong Spring Data JPA?',
  content: 'Khi dùng `@OneToMany` tôi gặp vấn đề truy vấn lặp lại nhiều lần trên bảng con.',
  topic,
  author: { id: 'u1', fullName: 'Nguyễn A', avatarUrl: null },
  deleted: false,
  solved: false,
  acceptedAnswerId: null,
  answerCount: 1,
  createdAt: '2026-11-20T08:00:00Z',
  editedAt: null,
  viewer: {
    canEdit: true,
    canDelete: true,
    canReport: true,
    canAccept: true,
    canAnswer: true,
    canReact: true,
  },
  reactions: baseReactions(),
  answers: [makeAnswer()],
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

it('lists questions on /forum, syncs URL filters (topic, solved, mine, keyword), and validates search length', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/v1/forum/options') return json([topic])
    return json(page([summaryRow()]))
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/forum']}>
      <Routes>
        <Route path="/forum" element={<ForumListPage language="vi" authenticated />} />
        <Route path="/forum/:id" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByRole('link', { name: 'Làm sao xử lý N+1 query trong Spring Data JPA?' })).toBeTruthy()
  expect(screen.getAllByText('Đã giải quyết').length).toBeGreaterThan(0)
  expect(screen.getByText('2 câu trả lời')).toBeTruthy()
  expect(screen.getByText(/Đã sửa/)).toBeTruthy()

  await screen.findByRole('option', { name: 'Spring Boot' })
  await user.click(screen.getByRole('button', { name: 'Chưa giải quyết' }))
  await user.click(screen.getByRole('button', { name: 'Bài của tôi' }))
  await user.selectOptions(screen.getByLabelText('Chủ đề'), topic.id)

  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([u]) => {
        const s = String(u)
        return s.includes('solved=false') && s.includes('mine=true') && s.includes(`topicId=${topic.id}`)
      }),
    ).toBe(true),
  )

  // 1-char keyword is rejected client-side
  const searchBox = screen.getByLabelText('Tìm câu hỏi')
  await user.click(searchBox)
  await user.paste('a')
  await user.click(screen.getByRole('button', { name: 'Tìm câu hỏi' }))
  expect(screen.getByText('Từ khóa tìm kiếm cần từ 2 đến 100 ký tự.')).toBeTruthy()
})

it('validates and posts a new question on /forum/new, and warns before leaving with unsaved changes', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/v1/forum/options') return json([topic])
    if (url.pathname === '/api/v1/forum/questions' && init?.method === 'POST') {
      return json(makeDetail({ id: 'new-q' }))
    }
    return json(makeDetail())
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')
  const user = userEvent.setup()

  const router = createMemoryRouter(
    [
      { path: '/forum/new', element: <ForumQuestionEditorPage language="vi" /> },
      { path: '/forum/:id', element: <Where /> },
      { path: '/forum', element: <Where /> },
    ],
    { initialEntries: ['/forum/new'] },
  )
  render(<RouterProvider router={router} />)
  await screen.findByRole('option', { name: 'Spring Boot' })

  await user.click(screen.getByRole('button', { name: 'Đăng câu hỏi' }))
  expect(screen.getByText('Tiêu đề từ 10 đến 150 ký tự.')).toBeTruthy()
  expect(screen.getByText('Hãy chọn chủ đề.')).toBeTruthy()
  expect(screen.getByText('Nội dung từ 20 đến 10.000 ký tự.')).toBeTruthy()

  const titleInput = screen.getByLabelText(/Tiêu đề/)
  await user.click(titleInput)
  await user.paste('Làm sao tối ưu truy vấn JPA phức tạp?')

  // Unsaved navigation blocker
  void router.navigate('/forum')
  expect(await screen.findByText('Bạn có thay đổi chưa lưu. Rời trang?')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Ở lại' }))

  await user.selectOptions(screen.getByLabelText(/Chủ đề/), topic.id)
  const contentInput = screen.getByLabelText(/Nội dung/)
  await user.click(contentInput)
  await user.paste('Tôi cần tối ưu truy vấn có nhiều bảng liên kết trong hệ thống lớn.')

  await user.click(screen.getByRole('button', { name: 'Đăng câu hỏi' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/forum/new-q'))
})

it('shows Guest the question and answers, prompts sign-in with returnTo for answering or reacting, and renders deleted question state', async () => {
  let detailData = makeDetail({
    viewer: { canEdit: false, canDelete: false, canReport: false, canAccept: false, canAnswer: false, canReact: false },
  })
  const fetchMock = vi.fn(async () => json(detailData))
  vi.stubGlobal('fetch', fetchMock)
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/forum/q1']}>
      <Routes>
        <Route path="/forum/:id" element={<ForumQuestionDetailPage language="vi" authenticated={false} />} />
        <Route path="/login" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByRole('heading', { name: 'Làm sao xử lý N+1 query trong Spring Data JPA?' })).toBeTruthy()
  expect(screen.getByText('Đăng nhập để đặt câu hỏi và trả lời.')).toBeTruthy()
  expect(screen.queryByLabelText('Câu trả lời của bạn')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  expect(screen.getByTestId('where').textContent).toBe('/login{"returnTo":"/forum/q1"}')

  cleanup()
  // Deleted question that still has visible answers
  detailData = {
    id: 'q1',
    topic,
    deleted: true,
    solved: false,
    answerCount: 1,
    createdAt: '2026-11-20T08:00:00Z',
    viewer: { canEdit: false, canDelete: false, canReport: false, canAccept: false, canAnswer: false, canReact: false },
    answers: [makeAnswer()],
  }
  render(
    <MemoryRouter initialEntries={['/forum/q1']}>
      <Routes>
        <Route path="/forum/:id" element={<ForumQuestionDetailPage language="vi" authenticated />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByText('Bài hỏi đã bị người đăng xóa.')).toBeTruthy()
  expect(screen.queryByLabelText('Câu trả lời của bạn')).toBeNull()
  expect(screen.getByText(/EntityGraph/)).toBeTruthy()
})

it('posts an answer, edits inline, marks/unmarks solution, deletes with confirmation, reports with OTHER reason, and allows MODERATOR direct hide', async () => {
  let current = makeDetail()
  const calls: { method: string; path: string; body: unknown }[] = []

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method || 'GET'
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null
    calls.push({ method, path: url.pathname, body })

    if (url.pathname === '/api/v1/forum/questions/q1' && method === 'GET') return json(current)
    if (url.pathname === '/api/v1/forum/questions/q1/answers' && method === 'POST') {
      const created = makeAnswer({ id: 'ans-2', content: body.content })
      current = { ...current, answers: [...current.answers, created], answerCount: current.answers.length + 1 }
      return json(created)
    }
    if (url.pathname === '/api/v1/forum/answers/ans-1' && method === 'PATCH') {
      current = {
        ...current,
        answers: current.answers.map(a => (a.id === 'ans-1' ? { ...a, content: body.content, editedAt: '2026-11-20T10:00:00Z' } : a)),
      }
      return json(current.answers[0])
    }
    if (url.pathname === '/api/v1/forum/questions/q1/accepted-answer' && method === 'PUT') {
      current = {
        ...current,
        solved: Boolean(body.answerId),
        acceptedAnswerId: body.answerId,
        answers: current.answers.map(a => ({ ...a, accepted: a.id === body.answerId })),
      }
      return json(current)
    }
    if (url.pathname === '/api/v1/forum/answers/ans-2' && method === 'DELETE') {
      current = { ...current, answers: current.answers.filter(a => a.id !== 'ans-2') }
      return json(null)
    }
    if (url.pathname === '/api/v1/reports' && method === 'POST') {
      return json({ id: 'rep-1', status: 'OPEN', createdAt: '2026-11-20T11:00:00Z' })
    }
    if (url.pathname === '/api/v1/moderator/forum/posts/ans-1/visibility' && method === 'PATCH') {
      current = { ...current, answers: current.answers.filter(a => a.id !== 'ans-1') }
      return json({ id: 'ans-1', status: 'HIDDEN' })
    }
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/forum/q1']}>
      <Routes>
        <Route path="/forum/:id" element={<ForumQuestionDetailPage language="vi" authenticated isModerator />} />
        <Route path="/forum" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Làm sao xử lý N+1 query trong Spring Data JPA?' })

  // 1. Create a new answer
  const answerInput = screen.getByLabelText('Câu trả lời của bạn')
  await user.click(answerInput)
  await user.paste('Dùng BatchSize để tải tập hợp con theo từng lô hiệu quả.')
  await user.click(screen.getByRole('button', { name: 'Gửi câu trả lời' }))
  expect(await screen.findByText('Dùng BatchSize để tải tập hợp con theo từng lô hiệu quả.')).toBeTruthy()

  // 2. Edit answer inline
  const ans1Card = screen.getByText(/EntityGraph/).closest('li')!
  await user.click(within(ans1Card).getByRole('button', { name: 'Sửa' }))
  const editBox = within(ans1Card).getByRole('textbox')
  await user.clear(editBox)
  await user.paste('Nội dung câu trả lời số 1 đã được cập nhật chi tiết hơn.')
  await user.click(within(ans1Card).getByRole('button', { name: 'Lưu' }))
  expect(await screen.findByText('Nội dung câu trả lời số 1 đã được cập nhật chi tiết hơn.')).toBeTruthy()

  // 3. Mark and unmark solution
  await user.click(within(ans1Card).getByRole('button', { name: 'Chọn làm lời giải' }))
  expect(await screen.findByText('Lời giải')).toBeTruthy()
  expect(calls.some(c => c.path.endsWith('/accepted-answer') && (c.body as { answerId: string }).answerId === 'ans-1')).toBe(true)
  await user.click(within(ans1Card).getByRole('button', { name: 'Bỏ chọn' }))
  await waitFor(() => expect(screen.queryByText('Lời giải')).toBeNull())

  // 4. Delete answer with confirmation dialog
  const ans2Card = screen.getByText('Dùng BatchSize để tải tập hợp con theo từng lô hiệu quả.').closest('li')!
  await user.click(within(ans2Card).getByRole('button', { name: 'Xóa' }))
  expect(await screen.findByText('Xóa bài này? Không thể hoàn tác.')).toBeTruthy()
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Xóa' }))
  await waitFor(() => expect(screen.queryByText('Dùng BatchSize để tải tập hợp con theo từng lô hiệu quả.')).toBeNull())

  // 5. Report with reason OTHER (requires >= 10 chars description)
  await user.click(within(ans1Card).getByRole('button', { name: 'Báo cáo' }))
  const reportDialog = await screen.findByRole('dialog')
  await user.selectOptions(within(reportDialog).getByLabelText(/Lý do/), 'OTHER')
  await user.click(within(reportDialog).getByRole('button', { name: 'Gửi báo cáo' }))
  expect(within(reportDialog).getByText('Hãy mô tả vi phạm (10–1.000 ký tự).')).toBeTruthy()
  const descBox = within(reportDialog).getByLabelText(/Mô tả thêm/)
  await user.click(descBox)
  await user.paste('Nội dung quảng cáo trá hình không liên quan chủ đề.')
  await user.click(within(reportDialog).getByRole('button', { name: 'Gửi báo cáo' }))
  expect(await screen.findByText('Đã gửi báo cáo. Cảm ơn bạn.')).toBeTruthy()

  // 6. Moderator direct hide with required reason
  await user.click(within(ans1Card).getByRole('button', { name: 'Ẩn' }))
  const hideDialog = await screen.findByRole('dialog')
  await user.click(within(hideDialog).getByRole('button', { name: 'Ẩn' }))
  expect(within(hideDialog).getByText('Hãy ghi lý do (tối đa 1.000 ký tự).')).toBeTruthy()
  const hideNote = within(hideDialog).getByLabelText(/Lý do ẩn/)
  await user.click(hideNote)
  await user.paste('Bài trả lời vi phạm quy định diễn đàn.')
  await user.click(within(hideDialog).getByRole('button', { name: 'Ẩn' }))
  expect(await screen.findByText('Đã ẩn bài.')).toBeTruthy()
})

it('handles reactions: select, change, toggle off, and opens the "Người đã bày tỏ cảm xúc" modal with tabs', async () => {
  let qReactions: ForumReactions = { counts: { LIKE: 2, LOVE: 1, HAHA: 0, ANGRY: 0 }, mine: null }
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method || 'GET'
    if (url.pathname === '/api/v1/forum/questions/q1') {
      return json(makeDetail({ answers: [], reactions: qReactions }))
    }
    if (url.pathname === '/api/v1/forum/posts/q1/reaction' && method === 'PUT') {
      const { type } = JSON.parse(String(init?.body)) as { type: ForumReactions['mine'] }
      qReactions = {
        counts: { LIKE: 2, LOVE: 1, HAHA: 0, ANGRY: 0, [type!]: (qReactions.counts[type!] ?? 0) + 1 },
        mine: type,
      }
      return json(qReactions)
    }
    if (url.pathname === '/api/v1/forum/posts/q1/reaction' && method === 'DELETE') {
      qReactions = { counts: { LIKE: 2, LOVE: 1, HAHA: 0, ANGRY: 0 }, mine: null }
      return json(qReactions)
    }
    if (url.pathname === '/api/v1/forum/posts/q1/reactions') {
      return json(
        page([
          {
            user: { id: 'u9', fullName: 'Lê C', avatarUrl: null },
            type: 'LOVE',
            reactedAt: '2026-11-20T12:00:00Z',
          },
        ]),
      )
    }
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/forum/q1']}>
      <Routes>
        <Route path="/forum/:id" element={<ForumQuestionDetailPage language="vi" authenticated />} />
      </Routes>
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Làm sao xử lý N+1 query trong Spring Data JPA?' })

  // React with LOVE
  await user.click(screen.getByRole('button', { name: 'Bày tỏ cảm xúc' }))
  await user.click(await screen.findByRole('button', { name: 'Yêu thích' }))
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/posts/q1/reaction') && i?.method === 'PUT'),
    ).toBe(true),
  )

  // Click same type again -> unreact (DELETE)
  await user.click(screen.getByRole('button', { name: 'Bày tỏ cảm xúc' }))
  await user.click(await screen.findByRole('button', { name: 'Yêu thích' }))
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/posts/q1/reaction') && i?.method === 'DELETE'),
    ).toBe(true),
  )

  // Open "Người đã bày tỏ cảm xúc" modal
  await user.click(screen.getByRole('button', { name: 'Người đã bày tỏ cảm xúc' }))
  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByText('Lê C')).toBeTruthy()
  await user.click(within(dialog).getByRole('tab', { name: /Yêu thích/ }))
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/posts/q1/reactions?type=LOVE'))).toBe(true),
  )
})

it('allows ADMIN and MODERATOR accounts to open /forum without being redirected by ReaderRoute', async () => {
  let roles: string[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname
    if (path.endsWith('/auth/refresh')) return json({ accessToken: 'tok2', expiresAt: '', expiresIn: 900 })
    if (path === '/api/v1/users/me') {
      return json({
        id: 'u1',
        fullName: 'Staff User',
        email: 'staff@example.com',
        roles,
        phoneNumber: null,
        dateOfBirth: null,
        avatarUrl: null,
        createdAt: '',
        updatedAt: '',
      })
    }
    if (path === '/api/v1/forum/options') return json([topic])
    if (path === '/api/v1/forum/questions') return json(page([summaryRow()]))
    return json(page([]))
  })
  vi.stubGlobal('fetch', fetchMock)

  for (const r of [['MODERATOR'], ['ADMIN']]) {
    roles = [...r]
    localStorage.setItem('techverse-authenticated', 'true')
    setAccessToken('tok')
    render(
      <MemoryRouter initialEntries={['/forum']}>
        <App />
        <Where />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('link', { name: 'Làm sao xử lý N+1 query trong Spring Data JPA?' })).toBeTruthy()
    expect(screen.getByTestId('where').textContent).toBe('/forum')
    cleanup()
  }
})

it('shows FORUM_CONTENT_INVALID under the content field while preserving typed text in question editor, new answer, and inline answer edit', async () => {
  let postQuestionCalls = 0
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method || 'GET'
    if (url.pathname === '/api/v1/forum/options') return json([topic])
    if (url.pathname === '/api/v1/forum/questions' && method === 'POST') {
      postQuestionCalls++
      return json(null, 400, 'FORUM_CONTENT_INVALID')
    }
    if (url.pathname === '/api/v1/forum/questions/q1' && method === 'GET') {
      return json(makeDetail())
    }
    if (url.pathname === '/api/v1/forum/questions/q1/answers' && method === 'POST') {
      return json(null, 400, 'FORUM_CONTENT_INVALID')
    }
    if (url.pathname === '/api/v1/forum/answers/ans-1' && method === 'PATCH') {
      return json(null, 400, 'FORUM_CONTENT_INVALID')
    }
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')
  const user = userEvent.setup()

  // 1. Question editor
  render(
    <MemoryRouter initialEntries={['/forum/new']}>
      <Routes>
        <Route path="/forum/new" element={<ForumQuestionEditorPage language="vi" />} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('option', { name: 'Spring Boot' })
  await user.selectOptions(screen.getByLabelText(/Chủ đề/), topic.id)
  const titleInput = screen.getByLabelText(/Tiêu đề/)
  await user.click(titleInput)
  await user.paste('Câu hỏi có nội dung bị server từ chối?')
  const contentInput = screen.getByLabelText(/Nội dung/)
  const badQuestionText = 'Nội dung dài trên 20 ký tự kèm ![alt](https://a.b/c.png) để server kiểm tra.'
  await user.click(contentInput)
  await user.paste(badQuestionText)
  await user.click(screen.getByRole('button', { name: 'Đăng câu hỏi' }))

  const qContentError = await screen.findByText('Nội dung chứa định dạng không được hỗ trợ.')
  expect(postQuestionCalls).toBe(1)
  expect(qContentError.id).toBe('forum-content-error')
  expect((screen.getByLabelText(/Nội dung/) as HTMLTextAreaElement).value).toBe(badQuestionText)
  cleanup()

  // 2. New answer & inline answer edit
  render(
    <MemoryRouter initialEntries={['/forum/q1']}>
      <Routes>
        <Route path="/forum/:id" element={<ForumQuestionDetailPage language="vi" authenticated />} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'Làm sao xử lý N+1 query trong Spring Data JPA?' })

  const newAnsBox = screen.getByLabelText('Câu trả lời của bạn')
  const badAnsText = 'Câu trả lời có ![img](https://a.b/c.png) bị server từ chối.'
  await user.click(newAnsBox)
  await user.paste(badAnsText)
  await user.click(screen.getByRole('button', { name: 'Gửi câu trả lời' }))
  expect(await screen.findByText('Nội dung chứa định dạng không được hỗ trợ.')).toBeTruthy()
  expect((screen.getByLabelText('Câu trả lời của bạn') as HTMLTextAreaElement).value).toBe(badAnsText)

  const ans1Card = screen.getByText(/EntityGraph/).closest('li')!
  await user.click(within(ans1Card).getByRole('button', { name: 'Sửa' }))
  const editBox = within(ans1Card).getByRole('textbox')
  await user.clear(editBox)
  await user.paste(badAnsText)
  await user.click(within(ans1Card).getByRole('button', { name: 'Lưu' }))
  expect(await within(ans1Card).findByText('Nội dung chứa định dạng không được hỗ trợ.')).toBeTruthy()
  expect((within(ans1Card).getByRole('textbox') as HTMLTextAreaElement).value).toBe(badAnsText)
})

it('blocks /forum/:id/edit when viewer.canEdit is false, showing "Bạn không có quyền." and a link back to the question', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/v1/forum/options') return json([topic])
    return json(
      makeDetail({
        viewer: { canEdit: false, canDelete: false, canReport: true, canAccept: false, canAnswer: true, canReact: true },
      }),
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')

  render(
    <MemoryRouter initialEntries={['/forum/q1/edit']}>
      <Routes>
        <Route path="/forum/:id/edit" element={<ForumQuestionEditorPage language="vi" />} />
        <Route path="/forum/:id" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByText('Bạn không có quyền.')).toBeTruthy()
  expect(screen.queryByLabelText(/Tiêu đề/)).toBeNull()
  const backLink = screen.getByRole('link', { name: /Quay lại câu hỏi|Về câu hỏi|Hỏi đáp/i })
  expect(backLink.getAttribute('href')).toBe('/forum/q1')
})

it('shows topic load error with Retry button on /forum/new and disables Post question until topics load', async () => {
  let failOptions = true
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/v1/forum/options') {
      if (failOptions) return json(null, 503, 'FORUM_STORAGE_UNAVAILABLE')
      return json([topic])
    }
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/forum/new']}>
      <Routes>
        <Route path="/forum/new" element={<ForumQuestionEditorPage language="vi" />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByText('Dịch vụ đang gián đoạn. Hãy thử lại.')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Đăng câu hỏi' }) as HTMLButtonElement).disabled).toBe(true)

  failOptions = false
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('option', { name: 'Spring Boot' })).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Đăng câu hỏi' }) as HTMLButtonElement).disabled).toBe(false)
})

it('reloads question detail while keeping the error message when react or write actions fail with 404 or 409 state errors', async () => {
  let detailCalls = 0
  let questionGone = false
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method || 'GET'
    if (url.pathname === '/api/v1/forum/questions/q1' && method === 'GET') {
      detailCalls++
      if (questionGone) return json(null, 404, 'FORUM_POST_NOT_FOUND')
      return json(makeDetail())
    }
    if (url.pathname === '/api/v1/forum/posts/q1/reaction' && method === 'PUT') {
      return json(null, 409, 'FORUM_QUESTION_CLOSED')
    }
    if (url.pathname === '/api/v1/forum/questions/q1/answers' && method === 'POST') {
      questionGone = true
      return json(null, 404, 'FORUM_POST_NOT_FOUND')
    }
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/forum/q1']}>
      <Routes>
        <Route path="/forum/:id" element={<ForumQuestionDetailPage language="vi" authenticated />} />
      </Routes>
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Làm sao xử lý N+1 query trong Spring Data JPA?' })
  expect(detailCalls).toBe(1)

  // 1. React fails with 409 FORUM_QUESTION_CLOSED -> shows react-specific copy AND reloads detail
  await user.click(screen.getAllByRole('button', { name: 'Bày tỏ cảm xúc' })[0])
  await user.click(await screen.findByRole('button', { name: 'Thích' }))
  expect(await screen.findByText('Bài hỏi đã bị xóa.')).toBeTruthy()
  await waitFor(() => expect(detailCalls).toBe(2))

  // 2. Creating an answer fails with 404 FORUM_POST_NOT_FOUND -> reloads detail, detail is 404 -> shows notFound state
  const ansBox = screen.getByLabelText('Câu trả lời của bạn')
  await user.click(ansBox)
  await user.paste('Câu trả lời gửi khi bài hỏi vừa bị xóa.')
  await user.click(screen.getByRole('button', { name: 'Gửi câu trả lời' }))
  await waitFor(() => expect(detailCalls).toBe(3))
  expect(await screen.findByText('Không tìm thấy bài viết.')).toBeTruthy()
})

it('keeps the error and the typed answer visible when the composer disappears after a 409 reload', async () => {
  let closed = false
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method || 'GET'
    if (url.pathname === '/api/v1/forum/questions/q1' && method === 'GET') {
      return json(closed
        ? makeDetail({ deleted: true, title: undefined, content: undefined, author: undefined, reactions: undefined,
            viewer: { canEdit: false, canDelete: false, canReport: false, canAccept: false, canAnswer: false, canReact: false } })
        : makeDetail())
    }
    if (url.pathname === '/api/v1/forum/questions/q1/answers' && method === 'POST') {
      closed = true
      return json(null, 409, 'FORUM_QUESTION_CLOSED')
    }
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/forum/q1']}>
      <Routes>
        <Route path="/forum/:id" element={<ForumQuestionDetailPage language="vi" authenticated />} />
      </Routes>
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Làm sao xử lý N+1 query trong Spring Data JPA?' })
  await user.click(screen.getByLabelText('Câu trả lời của bạn'))
  await user.paste('Bản nháp câu trả lời không được mất.')
  await user.click(screen.getByRole('button', { name: 'Gửi câu trả lời' }))

  expect(await screen.findByText('Bài hỏi đã bị người đăng xóa.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Gửi câu trả lời' })).toBeNull()
  expect(screen.getByText('Bài hỏi đã bị xóa, không thể trả lời.')).toBeTruthy()
  expect(screen.getByText('Bản nháp câu trả lời không được mất.')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Đóng' }))
  expect(screen.queryByText('Bản nháp câu trả lời không được mất.')).toBeNull()
})

it('keeps the error and the edited text visible when the answer being edited is gone after a 404 reload', async () => {
  let gone = false
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method || 'GET'
    if (url.pathname === '/api/v1/forum/questions/q1' && method === 'GET') {
      return json(gone ? makeDetail({ answers: [], answerCount: 0 }) : makeDetail())
    }
    if (url.pathname === '/api/v1/forum/answers/ans-1' && method === 'PATCH') {
      gone = true
      return json(null, 404, 'FORUM_POST_NOT_FOUND')
    }
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/forum/q1']}>
      <Routes>
        <Route path="/forum/:id" element={<ForumQuestionDetailPage language="vi" authenticated />} />
      </Routes>
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Làm sao xử lý N+1 query trong Spring Data JPA?' })
  const answerItem = screen.getAllByRole('listitem').find(li => li.textContent?.includes('Trần B'))!
  await user.click(within(answerItem).getByRole('button', { name: 'Sửa' }))
  fireEvent.change(document.getElementById('edit-ans-ans-1')!, { target: { value: 'Nội dung đang sửa phải còn lại.' } })
  await user.click(within(answerItem).getByRole('button', { name: 'Lưu' }))

  expect(await screen.findByText('Không tìm thấy bài viết.')).toBeTruthy()
  expect(await screen.findByText('Nội dung đang sửa phải còn lại.')).toBeTruthy()
  expect(screen.queryByText('Trần B')).toBeNull()
})

it('lets the author save an edit with the current topic when the topic list fails to load', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method || 'GET'
    if (url.pathname === '/api/v1/forum/options') return json(null, 503, 'FORUM_STORAGE_UNAVAILABLE')
    if (url.pathname === '/api/v1/forum/questions/q1' && method === 'PATCH') return json(makeDetail())
    if (url.pathname === '/api/v1/forum/questions/q1') return json(makeDetail())
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/forum/q1/edit']}>
      <Routes>
        <Route path="/forum/:id/edit" element={<ForumQuestionEditorPage language="vi" />} />
        <Route path="/forum/:id" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByText('Dịch vụ đang gián đoạn. Hãy thử lại.')).toBeTruthy()
  const save = screen.getByRole('button', { name: 'Lưu' }) as HTMLButtonElement
  expect(save.disabled).toBe(false)
  await user.click(save)
  await waitFor(() => expect(screen.getByTestId('where').textContent).toContain('/forum/q1'))
  const patch = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH')!
  expect(JSON.parse(String((patch[1] as RequestInit).body)).topicId).toBe(topic.id)
})

it('keeps the action error visible on the not-found state when the reload after a 409 returns 404', async () => {
  let closed = false
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method || 'GET'
    if (url.pathname === '/api/v1/forum/questions/q1' && method === 'GET') {
      return closed ? json(null, 404, 'FORUM_POST_NOT_FOUND') : json(makeDetail())
    }
    if (url.pathname === '/api/v1/forum/questions/q1/answers' && method === 'POST') {
      closed = true
      return json(null, 409, 'FORUM_QUESTION_CLOSED')
    }
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/forum/q1']}>
      <Routes>
        <Route path="/forum/:id" element={<ForumQuestionDetailPage language="vi" authenticated />} />
      </Routes>
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Làm sao xử lý N+1 query trong Spring Data JPA?' })
  await user.click(screen.getByLabelText('Câu trả lời của bạn'))
  await user.paste('Bản nháp khi bài hỏi biến mất hẳn.')
  await user.click(screen.getByRole('button', { name: 'Gửi câu trả lời' }))

  expect(await screen.findByText('Không tìm thấy bài viết.')).toBeTruthy()
  expect(screen.getByText('Bài hỏi đã bị xóa, không thể trả lời.')).toBeTruthy()
  expect(screen.getByText('Bản nháp khi bài hỏi biến mất hẳn.')).toBeTruthy()
})

it('keeps both drafts when two stale edit errors happen one after another', async () => {
  let gone: string[] = []
  const second = makeAnswer({ id: 'ans-2', author: { id: 'u3', fullName: 'Lê C', avatarUrl: null }, content: 'Câu trả lời thứ hai để sửa sau.' })
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method || 'GET'
    if (url.pathname === '/api/v1/forum/questions/q1' && method === 'GET') {
      const answers = [makeAnswer(), second].filter(a => !gone.includes(a.id))
      return json(makeDetail({ answers, answerCount: answers.length }))
    }
    const edit = url.pathname.match(/^\/api\/v1\/forum\/answers\/(ans-\d)$/)
    if (edit && method === 'PATCH') {
      gone = [...gone, edit[1]]
      return json(null, 404, 'FORUM_POST_NOT_FOUND')
    }
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/forum/q1']}>
      <Routes>
        <Route path="/forum/:id" element={<ForumQuestionDetailPage language="vi" authenticated />} />
      </Routes>
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Làm sao xử lý N+1 query trong Spring Data JPA?' })
  const editAndSave = async (author: string, id: string, text: string) => {
    const item = screen.getAllByRole('listitem').find(li => li.textContent?.includes(author))!
    await user.click(within(item).getByRole('button', { name: 'Sửa' }))
    fireEvent.change(document.getElementById('edit-ans-' + id)!, { target: { value: text } })
    await user.click(within(item).getByRole('button', { name: 'Lưu' }))
  }
  await editAndSave('Trần B', 'ans-1', 'Bản nháp thứ nhất không được mất.')
  await waitFor(() => expect(screen.queryByText('Trần B')).toBeNull())
  await editAndSave('Lê C', 'ans-2', 'Bản nháp thứ hai cũng phải còn.')
  await waitFor(() => expect(screen.queryByText('Lê C')).toBeNull())

  expect(screen.getByText(/Bản nháp thứ nhất không được mất\./)).toBeTruthy()
  expect(screen.getByText(/Bản nháp thứ hai cũng phải còn\./)).toBeTruthy()
})
