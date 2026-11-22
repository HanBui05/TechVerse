import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ModeratorReportsPage } from './ModeratorReportsPage'
import { setAccessToken } from '../../../services/api/client'
import type { ModeratedForumPost, ModeratorReportItem } from '../../../types/forum'

afterEach(() => {
  cleanup()
  setAccessToken(null)
  vi.unstubAllGlobals()
})

const json = (data: unknown, status = 200, code?: string) =>
  new Response(JSON.stringify({ status, code, message: 'English message', data }), { status })

const page = (content: unknown[], totalElements = content.length) => ({
  content,
  page: 0,
  size: 20,
  totalElements,
  totalPages: 1,
  hasNext: false,
})

const makePost = (over: Partial<ModeratedForumPost> = {}): ModeratedForumPost => ({
  id: 'p1',
  type: 'QUESTION',
  questionId: 'q1',
  questionTitle: 'Câu hỏi nghi vấn spam liên kết?',
  content: 'Nội dung bài viết có chứa liên kết quảng cáo dịch vụ ngoài.',
  author: { id: 'u1', fullName: 'Nguyễn Đăng', avatarUrl: null },
  status: 'VISIBLE',
  publiclyVisible: true,
  moderationNote: null,
  hiddenBy: null,
  hiddenAt: null,
  ...over,
})

const makeReport = (over: Partial<ModeratorReportItem> = {}): ModeratorReportItem => ({
  id: 'r1',
  reason: 'SPAM',
  description: 'Đăng quảng cáo lặp lại nhiều lần.',
  status: 'OPEN',
  reporter: { id: 'u2', fullName: 'Trần Báo Cáo', avatarUrl: null },
  createdAt: '2026-11-20T09:00:00Z',
  handledAt: null,
  resolutionNote: null,
  post: makePost(),
  otherOpenReports: 2,
  ...over,
})

const renderPage = (initialPath = '/moderator/reports') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/moderator/reports" element={<ModeratorReportsPage language="vi" />} />
      </Routes>
    </MemoryRouter>,
  )

it('switches between the 3 URL tabs (Chờ xử lý, Đã xử lý, Nội dung đang ẩn) and shows "Không còn công khai" when publiclyVisible is false', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/v1/moderator/forum/posts') {
      return json(
        page([
          makePost({
            id: 'p-hidden',
            status: 'HIDDEN',
            publiclyVisible: false,
            moderationNote: 'Vi phạm nội quy',
            hiddenBy: { id: 'm1', fullName: 'Mod A', avatarUrl: null },
            hiddenAt: '2026-11-20T10:00:00Z',
          }),
        ]),
      )
    }
    const status = url.searchParams.get('status') ?? 'OPEN'
    if (status === 'OPEN') {
      return json(page([makeReport(), makeReport({ id: 'r2', post: makePost({ id: 'p2', publiclyVisible: false }), otherOpenReports: 0 })]))
    }
    return json(
      page([
        makeReport({
          id: 'r-done',
          status: status as 'ACTIONED' | 'DISMISSED',
          resolutionNote: 'Đã kiểm tra và xử lý.',
        }),
      ]),
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('moderator')
  const user = userEvent.setup()

  renderPage()

  expect(await screen.findAllByText('Câu hỏi nghi vấn spam liên kết?')).toHaveLength(2)
  expect(screen.getByText('+2 báo cáo khác')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Mở trong diễn đàn' }).getAttribute('href')).toBe('/forum/q1')
  expect(screen.getByText('Không còn công khai')).toBeTruthy()

  // Switch to "Đã xử lý" tab
  await user.click(screen.getByRole('tab', { name: 'Đã xử lý' }))
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/v1/moderator/reports?status=ACTIONED'))).toBe(true),
  )
  await user.click(screen.getByRole('button', { name: 'Đã bỏ qua' }))
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/v1/moderator/reports?status=DISMISSED'))).toBe(true),
  )

  // Switch to "Nội dung đang ẩn" tab
  await user.click(screen.getByRole('tab', { name: 'Nội dung đang ẩn' }))
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/v1/moderator/forum/posts?status=HIDDEN'))).toBe(true),
  )
  expect(await screen.findByText(/Vi phạm nội quy/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Hiện lại' })).toBeTruthy()
})

it('requires a reason to hide content, resolves HIDE_CONTENT and DISMISS then reloads the list, and handles REPORT_ALREADY_HANDLED', async () => {
  let openItems = [makeReport()]
  let failStale = false
  const writes: { path: string; body: unknown }[] = []

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method || 'GET'
    if (method === 'PATCH') {
      const body = JSON.parse(String(init?.body))
      writes.push({ path: url.pathname, body })
      if (failStale) {
        failStale = false
        return json(null, 409, 'REPORT_ALREADY_HANDLED')
      }
      openItems = []
      return json(makeReport({ status: body.action === 'HIDE_CONTENT' ? 'ACTIONED' : 'DISMISSED' }))
    }
    return json(page(openItems))
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('moderator')
  const user = userEvent.setup()

  renderPage()
  await screen.findByText('Câu hỏi nghi vấn spam liên kết?')

  // 1. Missing note on HIDE_CONTENT is blocked client-side
  await user.click(screen.getByRole('button', { name: 'Ẩn nội dung' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Ẩn nội dung' }))
  expect(within(dialog).getByText('Hãy ghi lý do (tối đa 1.000 ký tự).')).toBeTruthy()
  expect(writes).toHaveLength(0)

  // 2. REPORT_ALREADY_HANDLED shows reload banner without auto-retrying
  failStale = true
  const noteInput = within(dialog).getByRole('textbox')
  await user.click(noteInput)
  await user.paste('Ẩn do spam quảng cáo.')
  await user.click(within(dialog).getByRole('button', { name: 'Ẩn nội dung' }))

  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('Báo cáo đã được xử lý. Hãy tải lại.')
  await user.click(within(alert).getByRole('button', { name: 'Tải lại' }))

  // 3. Resolve with HIDE_CONTENT succeeds and reloads list (now empty)
  await user.click(await screen.findByRole('button', { name: 'Ẩn nội dung' }))
  const dialog2 = await screen.findByRole('dialog')
  const noteInput2 = within(dialog2).getByRole('textbox')
  await user.click(noteInput2)
  await user.paste('Ẩn do spam quảng cáo.')
  await user.click(within(dialog2).getByRole('button', { name: 'Ẩn nội dung' }))

  expect(await screen.findByText('Không có báo cáo nào chờ xử lý.')).toBeTruthy()
  expect(writes.at(-1)).toEqual({
    path: '/api/v1/moderator/reports/r1/resolve',
    body: { action: 'HIDE_CONTENT', note: 'Ẩn do spam quảng cáo.' },
  })
})

it('restores a hidden post from the "Nội dung đang ẩn" tab after confirmation', async () => {
  let hiddenItems = [
    makePost({
      id: 'p-hidden',
      status: 'HIDDEN',
      publiclyVisible: false,
      moderationNote: 'Ẩn tạm thời',
    }),
  ]
  const writes: { path: string; body: unknown }[] = []

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (init?.method === 'PATCH') {
      writes.push({ path: url.pathname, body: JSON.parse(String(init.body)) })
      hiddenItems = []
      return json(makePost({ id: 'p-hidden', status: 'VISIBLE', publiclyVisible: true }))
    }
    return json(page(hiddenItems))
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('moderator')
  const user = userEvent.setup()

  renderPage('/moderator/reports?tab=hidden')
  expect(await screen.findByText('Câu hỏi nghi vấn spam liên kết?')).toBeTruthy()

  await user.click(screen.getByRole('button', { name: 'Hiện lại' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Hiện lại' }))

  expect(await screen.findByText('Không có nội dung nào đang ẩn.')).toBeTruthy()
  expect(writes).toEqual([
    {
      path: '/api/v1/moderator/forum/posts/p-hidden/visibility',
      body: { action: 'RESTORE' },
    },
  ])
})

it('closes the dialog, shows the message and reloads the list on 409 FORUM_STATE_INVALID during restore', async () => {
  let listCalls = 0
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (init?.method === 'PATCH') {
      return json(null, 409, 'FORUM_STATE_INVALID')
    }
    if (url.pathname === '/api/v1/moderator/conversations') {
      return json(page([]))
    }
    listCalls++
    return json(
      page([
        makePost({
          id: 'p-hidden',
          status: 'HIDDEN',
          publiclyVisible: false,
          moderationNote: 'Ẩn tạm thời',
        }),
      ]),
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('moderator')
  const user = userEvent.setup()

  renderPage('/moderator/reports?tab=hidden')
  await screen.findByText('Câu hỏi nghi vấn spam liên kết?')
  expect(listCalls).toBe(1)

  await user.click(screen.getByRole('button', { name: 'Hiện lại' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Hiện lại' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(await screen.findByText('Không thực hiện được ở trạng thái hiện tại.')).toBeTruthy()
  await waitFor(() => expect(listCalls).toBe(2))
})

it('navigates back to the last valid page when resolving the final item on page > 0 leaves the current page empty', async () => {
  let resolved = false
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (init?.method === 'PATCH') {
      resolved = true
      return json(makeReport({ status: 'DISMISSED' }))
    }
    const p = Number(url.searchParams.get('page') ?? '0')
    if (!resolved && p === 1) {
      return json({
        content: [makeReport({ id: 'r-page1', post: makePost({ questionTitle: 'Báo cáo ở trang 2' }) })],
        page: 1,
        size: 20,
        totalElements: 21,
        totalPages: 2,
        hasNext: false,
      })
    }
    if (resolved && p === 1) {
      return json({
        content: [],
        page: 1,
        size: 20,
        totalElements: 20,
        totalPages: 1,
        hasNext: false,
      })
    }
    return json({
      content: [makeReport({ id: 'r-page0', post: makePost({ questionTitle: 'Báo cáo ở trang 1' }) })],
      page: 0,
      size: 20,
      totalElements: 20,
      totalPages: 1,
      hasNext: false,
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('moderator')
  const user = userEvent.setup()

  renderPage('/moderator/reports?page=1')
  expect(await screen.findByText('Báo cáo ở trang 2')).toBeTruthy()

  await user.click(screen.getByRole('button', { name: 'Bỏ qua' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Bỏ qua' }))

  expect(await screen.findByText('Báo cáo ở trang 1')).toBeTruthy()
})

it('ignores late responses from a previous tab when switching quickly from "Chờ xử lý" to "Đã xử lý"', async () => {
  let resolveOpenTab!: (value: Response) => void
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = new URL(String(input))
    const status = url.searchParams.get('status') ?? 'OPEN'
    if (status === 'OPEN') {
      return new Promise<Response>(r => {
        resolveOpenTab = r
      })
    }
    return Promise.resolve(
      json(
        page([
          makeReport({
            id: 'r-actioned',
            status: 'ACTIONED',
            post: makePost({ questionTitle: 'Bài thuộc tab Đã xử lý' }),
          }),
        ]),
      ),
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('moderator')
  const user = userEvent.setup()

  renderPage('/moderator/reports')
  // Immediately switch to "Đã xử lý" before OPEN finishes
  await user.click(screen.getByRole('tab', { name: 'Đã xử lý' }))
  expect(await screen.findByText('Bài thuộc tab Đã xử lý')).toBeTruthy()

  // Now the old OPEN request resolves late
  resolveOpenTab(
    json(
      page([
        makeReport({
          id: 'r-open-late',
          status: 'OPEN',
          post: makePost({ questionTitle: 'Bài cũ của tab Chờ xử lý' }),
        }),
      ]),
    ),
  )

  await waitFor(() => expect(screen.getByText('Bài thuộc tab Đã xử lý')).toBeTruthy())
  expect(screen.queryByText('Bài cũ của tab Chờ xử lý')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Ẩn nội dung' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Bỏ qua' })).toBeNull()
})

it('never shows the previous tab\'s rows or actions while the new tab loads or after it fails', async () => {
  let failHandled = false
  let releaseHandled!: () => void
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = new URL(String(input))
    const status = url.searchParams.get('status') ?? 'OPEN'
    if (status === 'OPEN') return Promise.resolve(json(page([makeReport({ post: makePost({ questionTitle: 'Báo cáo của tab Chờ xử lý' }) })])))
    return new Promise<Response>(r => {
      releaseHandled = () => r(failHandled ? json(null, 503, 'FORUM_STORAGE_UNAVAILABLE') : json(page([])))
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('moderator')
  const user = userEvent.setup()

  renderPage('/moderator/reports')
  expect(await screen.findByText('Báo cáo của tab Chờ xử lý')).toBeTruthy()

  // New tab pending: the OPEN rows and their actions are gone, a loading state shows.
  failHandled = true
  await user.click(screen.getByRole('tab', { name: 'Đã xử lý' }))
  expect(screen.queryByText('Báo cáo của tab Chờ xử lý')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Ẩn nội dung' })).toBeNull()
  expect(screen.getByRole('status', { name: 'Đang tải…' })).toBeTruthy()

  // New tab fails: an error, still no OPEN rows.
  releaseHandled()
  expect(await screen.findByText('Dịch vụ đang gián đoạn. Hãy thử lại.')).toBeTruthy()
  expect(screen.queryByText('Báo cáo của tab Chờ xử lý')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Bỏ qua' })).toBeNull()
})

it('hides the old rows and actions when the reload after a successful action fails', async () => {
  let reloadFails = false
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method || 'GET'
    if (method === 'PATCH') {
      reloadFails = true
      return json(makeReport({ status: 'DISMISSED' }))
    }
    return reloadFails ? json(null, 503, 'FORUM_STORAGE_UNAVAILABLE') : json(page([makeReport()]))
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('moderator')
  const user = userEvent.setup()

  renderPage()
  await screen.findByText('Câu hỏi nghi vấn spam liên kết?')
  await user.click(screen.getByRole('button', { name: 'Bỏ qua' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Bỏ qua' }))

  expect(await screen.findByText('Dịch vụ đang gián đoạn. Hãy thử lại.')).toBeTruthy()
  expect(screen.queryByText('Câu hỏi nghi vấn spam liên kết?')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Ẩn nội dung' })).toBeNull()
})

const makeConversationReport = (over: Partial<ModeratorReportItem> = {}): ModeratorReportItem => ({
  id: 'rc-1',
  targetType: 'CONVERSATION',
  reason: 'SPAM',
  description: 'Gửi liên kết lừa đảo qua tin nhắn riêng.',
  status: 'OPEN',
  reporter: { id: 'u-learner', fullName: 'Lê Học Viên', avatarUrl: null },
  createdAt: '2026-11-22T08:00:00Z',
  handledAt: null,
  resolutionNote: null,
  post: null as unknown as ModeratedForumPost,
  conversation: {
    id: 'conv-99',
    learner: { id: 'u-learner', fullName: 'Lê Học Viên', avatarUrl: null },
    author: { id: 'u-author', fullName: 'Phạm Tác Giả', avatarUrl: null },
    blocked: true,
    locked: false,
    lockNote: null,
    lockedBy: null,
    lockedAt: null,
  },
  otherOpenReports: 1,
  ...over,
})

it('labels an actioned conversation report as locked, not as hidden content', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/v1/moderator/reports' && url.searchParams.get('targetType') === 'CONVERSATION') {
      return json(page([makeConversationReport({ status: 'ACTIONED', resolutionNote: 'Khóa vì spam.' })]))
    }
    return json(page([]))
  }))
  setAccessToken('moderator')
  renderPage('/moderator/reports?tab=handled&targetType=CONVERSATION')
  expect(await screen.findByText(/Khóa vì spam\./)).toBeTruthy()
  expect(screen.getAllByText('Đã khóa cuộc trò chuyện')).toHaveLength(2) // filter + badge
  expect(screen.queryByText('Đã ẩn nội dung')).toBeNull()
})

it('loads conversation reports without fetching messages upfront, opens the read-only message sheet on "Xem tin nhắn", and loads older messages', async () => {
  let messageApiCalls = 0
  let readApiCalls = 0

  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/read')) {
      readApiCalls++
      return json(null, 200)
    }
    if (url.pathname === '/api/v1/moderator/conversations/conv-99/messages') {
      messageApiCalls++
      if (url.searchParams.get('beforeSeq') === '2') {
        return json({
          messages: [
            {
              id: 'm-1',
              seq: 1,
              senderId: 'u-learner',
              mine: false,
              content: 'Tin nhắn đầu tiên của người học.',
              createdAt: '2026-11-22T07:50:00Z',
            },
          ],
          hasMore: false,
        })
      }
      return json({
        messages: [
          {
            id: 'm-2',
            seq: 2,
            senderId: 'u-author',
            mine: false,
            content: 'Tin nhắn trả lời của tác giả.',
            createdAt: '2026-11-22T07:55:00Z',
          },
        ],
        hasMore: true,
      })
    }
    if (url.pathname === '/api/v1/moderator/reports') {
      if (url.searchParams.get('targetType') === 'CONVERSATION') {
        return json(page([makeConversationReport()]))
      }
      return json(page([makeReport()]))
    }
    return json(page([]))
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('moderator')
  const user = userEvent.setup()

  renderPage()
  await screen.findByText('Câu hỏi nghi vấn spam liên kết?')

  // Switch target type filter to "Cuộc trò chuyện"
  await user.click(screen.getByRole('button', { name: 'Cuộc trò chuyện' }))
  expect(await screen.findByText('Gửi liên kết lừa đảo qua tin nhắn riêng.')).toBeTruthy()
  expect(screen.getByText('Đang bị chặn')).toBeTruthy()
  expect(screen.getAllByText(/Lê Học Viên/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/Phạm Tác Giả/).length).toBeGreaterThan(0)

  // Messages API must NOT be called before clicking "Xem tin nhắn"
  expect(messageApiCalls).toBe(0)

  await user.click(screen.getByRole('button', { name: 'Xem tin nhắn' }))
  expect(
    await screen.findByText('Bạn chỉ xem được vì cuộc trò chuyện này đã bị báo cáo.'),
  ).toBeTruthy()
  expect(await screen.findByText('Tin nhắn trả lời của tác giả.')).toBeTruthy()
  expect(messageApiCalls).toBe(1)

  // Read-only: no message input and no mark-read call
  expect(screen.queryByPlaceholderText('Nhập tin nhắn…')).toBeNull()
  expect(readApiCalls).toBe(0)

  // Load older messages inside the sheet
  await user.click(screen.getByRole('button', { name: 'Tải tin cũ hơn' }))
  expect(await screen.findByText('Tin nhắn đầu tiên của người học.')).toBeTruthy()
  expect(messageApiCalls).toBe(2)
})

it('requires a reason to lock a reported conversation, resolves LOCK_CONVERSATION and DISMISS, and unlocks from the "Nội dung đang ẩn" tab', async () => {
  let convReports = [makeConversationReport()]
  let lockedConvs = [
    {
      id: 'conv-99',
      learner: { id: 'u-learner', fullName: 'Lê Học Viên', avatarUrl: null },
      author: { id: 'u-author', fullName: 'Phạm Tác Giả', avatarUrl: null },
      blocked: false,
      locked: true,
      lockNote: 'Khóa do gửi link độc hại.',
      lockedBy: { id: 'mod-1', fullName: 'Kiểm Duyệt Viên', avatarUrl: null },
      lockedAt: '2026-11-22T09:30:00Z',
    },
  ]
  const writes: { path: string; body: unknown }[] = []

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method || 'GET'
    if (method === 'PATCH') {
      const body = JSON.parse(String(init?.body))
      writes.push({ path: url.pathname, body })
      if (url.pathname.endsWith('/resolve')) {
        convReports = []
        return json(makeConversationReport({ status: body.action === 'LOCK_CONVERSATION' ? 'ACTIONED' : 'DISMISSED' }))
      }
      if (url.pathname === '/api/v1/moderator/conversations/conv-99/lock') {
        lockedConvs = []
        return json({ ...lockedConvs[0], locked: false })
      }
    }
    if (url.pathname === '/api/v1/moderator/reports') {
      if (url.searchParams.get('targetType') === 'CONVERSATION') {
        return json(page(convReports))
      }
      return json(page([]))
    }
    if (url.pathname === '/api/v1/moderator/forum/posts') {
      return json(page([]))
    }
    if (url.pathname === '/api/v1/moderator/conversations' && url.searchParams.get('locked') === 'true') {
      return json(page(lockedConvs))
    }
    return json(page([]))
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('moderator')
  const user = userEvent.setup()

  renderPage('/moderator/reports?targetType=CONVERSATION')
  expect(await screen.findByText('Gửi liên kết lừa đảo qua tin nhắn riêng.')).toBeTruthy()

  // 1. Lock conversation without note fails client validation
  await user.click(screen.getByRole('button', { name: 'Khóa cuộc trò chuyện' }))
  const lockDialog = await screen.findByRole('dialog')
  await user.click(within(lockDialog).getByRole('button', { name: 'Khóa cuộc trò chuyện' }))
  expect(within(lockDialog).getByText('Hãy ghi lý do (tối đa 1.000 ký tự).')).toBeTruthy()
  expect(writes).toHaveLength(0)

  // 2. Fill note and confirm LOCK_CONVERSATION
  const noteBox = within(lockDialog).getByRole('textbox')
  await user.click(noteBox)
  await user.paste('Khóa do gửi link độc hại.')
  await user.click(within(lockDialog).getByRole('button', { name: 'Khóa cuộc trò chuyện' }))

  expect(await screen.findByText('Không có báo cáo nào chờ xử lý.')).toBeTruthy()
  expect(writes[0]).toEqual({
    path: '/api/v1/moderator/reports/rc-1/resolve',
    body: { action: 'LOCK_CONVERSATION', note: 'Khóa do gửi link độc hại.' },
  })

  // 3. Dismiss another conversation report
  convReports = [makeConversationReport({ id: 'rc-2', description: 'Báo cáo nhầm lẫn.' })]
  await user.click(screen.getByRole('tab', { name: 'Đã xử lý' }))
  await user.click(screen.getByRole('tab', { name: 'Chờ xử lý' }))
  expect(await screen.findByText('Báo cáo nhầm lẫn.')).toBeTruthy()

  await user.click(screen.getByRole('button', { name: 'Bỏ qua' }))
  const dismissDialog = await screen.findByRole('dialog')
  // Conversation copy, not the forum post one.
  expect(within(dismissDialog).getByText(/Cuộc trò chuyện vẫn mở/)).toBeTruthy()
  expect(within(dismissDialog).queryByText(/diễn đàn/)).toBeNull()
  await user.click(within(dismissDialog).getByRole('button', { name: 'Bỏ qua' }))
  await waitFor(() =>
    expect(writes[1]).toEqual({
      path: '/api/v1/moderator/reports/rc-2/resolve',
      body: { action: 'DISMISS' },
    }),
  )

  // 4. Switch to "Nội dung đang ẩn" tab -> see locked conversation and unlock it
  await user.click(screen.getByRole('tab', { name: 'Nội dung đang ẩn' }))
  expect(await screen.findByText(/Khóa do gửi link độc hại\./)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Mở khóa' }))
  const unlockDialog = await screen.findByRole('dialog')
  await user.click(within(unlockDialog).getByRole('button', { name: 'Mở khóa' }))

  await waitFor(() =>
    expect(writes[2]).toEqual({
      path: '/api/v1/moderator/conversations/conv-99/lock',
      body: { locked: false, note: null },
    }),
  )
  expect(await screen.findByText('Không có nội dung nào đang ẩn.')).toBeTruthy()
})

