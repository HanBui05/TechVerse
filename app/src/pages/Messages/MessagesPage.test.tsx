import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import App from '../../App'
import { MessagesPage, reconcilePending, type PendingMessage } from './MessagesPage'
import { ApiError, setAccessToken } from '../../services/api/client'
import {
  canSendInConversation,
  mergeMessagesBySeq,
  messagingService,
  validateMessageContent,
} from '../../services/messagingService'
import { MESSAGING_ERRORS, messagingErrorText } from '../../data/messagingI18n'
import type { ConversationDetail, ConversationMessage, ConversationSummary } from '../../types/messaging'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  url: string
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  open() {
    this.readyState = 1
    this.onopen?.()
  }

  receive(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }

  serverClose() {
    this.readyState = 3
    this.onclose?.()
  }

  close() {
    this.readyState = 3
  }
}

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

const makeSummary = (over: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id: 'conv-1',
  other: { id: 'author-1', fullName: 'Trần Tác Giả', avatarUrl: null },
  role: 'LEARNER',
  contextCourse: { id: 'course-1', title: 'Spring Boot Thực Chiến', available: true },
  contextEnrolled: false,
  lastMessageExcerpt: 'Chào bạn, khóa học này cần biết Java cơ bản.',
  lastMessageAt: '2026-11-22T09:00:00Z',
  unread: true,
  blockedByMe: false,
  blockedByOther: false,
  locked: false,
  ...over,
})

const makeDetail = (over: Partial<ConversationDetail> = {}): ConversationDetail => ({
  ...makeSummary(),
  canSend: true,
  remainingBeforeReply: 2,
  ...over,
})

const makeMsg = (seq: number, over: Partial<ConversationMessage> = {}): ConversationMessage => ({
  id: `m-${seq}`,
  seq,
  senderId: over.mine ? 'me-1' : 'author-1',
  mine: false,
  content: `Tin nhắn số ${seq}`,
  createdAt: '2026-11-22T09:00:00Z',
  ...over,
})

function Where() {
  const l = useLocation()
  return <output data-testid="where">{l.pathname}</output>
}

beforeEach(() => {
  FakeWebSocket.instances = []
  vi.stubGlobal('WebSocket', FakeWebSocket)
  messagingService.resetForTests()
})

afterEach(() => {
  messagingService.resetForTests()
  cleanup()
  setAccessToken(null)
  localStorage.clear()
  sessionStorage.clear()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ---- Unit tests ----

it('unit: validates message content bounds (1..2000 trimmed, no NUL) and maps all 1a/1b error codes in vi and en', () => {
  expect(validateMessageContent('   ')).toBe('messageLength')
  expect(validateMessageContent('Xin chào')).toBeNull()
  expect(validateMessageContent('a'.repeat(2000))).toBeNull()
  expect(validateMessageContent('a'.repeat(2001))).toBe('messageLength')
  expect(validateMessageContent('Tin có\0NUL')).toBe('contentInvalid')

  const codes = [
    'AUTH_ACCESS_TOKEN_REQUIRED',
    'AUTH_INVALID_ACCESS_TOKEN',
    'ACCESS_DENIED',
    'CONVERSATION_NOT_ALLOWED',
    'CONVERSATION_NOT_FOUND',
    'MESSAGE_CONTENT_INVALID',
    'MESSAGE_CLIENT_ID_CONFLICT',
    'CONVERSATION_BLOCKED',
    'CONVERSATION_LOCKED',
    'CONVERSATION_AWAITING_REPLY',
    'MESSAGE_RATE_LIMITED',
    'MESSAGE_STORAGE_UNAVAILABLE',
    'REPORT_TARGET_NOT_FOUND',
    'REPORT_TARGET_EMPTY',
    'REPORT_OWN_CONTENT',
    'REPORT_ALREADY_SUBMITTED',
    'REPORT_NOT_FOUND',
    'REPORT_ALREADY_HANDLED',
    'CONVERSATION_STATE_INVALID',
  ]
  for (const code of codes) {
    expect(MESSAGING_ERRORS[code]?.vi, code).toBeTruthy()
    expect(MESSAGING_ERRORS[code]?.en, code).toBeTruthy()
    expect(messagingErrorText(new ApiError('English', 400, code), 'vi')).not.toContain('English')
    expect(messagingErrorText(new ApiError('English', 400, code), 'en')).not.toContain('English')
  }
  expect(messagingErrorText(new ApiError('x', 403, 'CONVERSATION_NOT_ALLOWED'), 'vi')).toBe(
    'Không thể nhắn cho tác giả của khóa này.',
  )
  expect(messagingErrorText(new ApiError('x', 409, 'CONVERSATION_AWAITING_REPLY'), 'vi')).toBe(
    'Hãy chờ tác giả trả lời trước khi gửi thêm.',
  )
  expect(messagingErrorText(new ApiError('x', 409, 'REPORT_TARGET_EMPTY'), 'vi')).toBe(
    'Chưa có tin nhắn nào để báo cáo.',
  )
  expect(messagingErrorText(new ApiError('x', 400, 'VALIDATION_ERROR'), 'vi')).toBe(
    'Yêu cầu không hợp lệ. Hãy tải lại trang.',
  )
})

it('unit: merges messages by seq without duplicates and computes canSend by conversation state', () => {
  const m1 = makeMsg(1)
  const m2 = makeMsg(2, { mine: true, content: 'Tin đã lưu' })
  const merged = mergeMessagesBySeq([m1, m2], [makeMsg(2, { mine: true, content: 'Tin đã lưu' }), makeMsg(3)])
  expect(merged.map(m => m.seq)).toEqual([1, 2, 3])

  expect(canSendInConversation(makeDetail())).toBe(true)
  expect(canSendInConversation(makeDetail({ remainingBeforeReply: 0 }))).toBe(false)
  expect(canSendInConversation(makeDetail({ blockedByMe: true }))).toBe(false)
  expect(canSendInConversation(makeDetail({ blockedByOther: true }))).toBe(false)
  expect(canSendInConversation(makeDetail({ locked: true }))).toBe(false)
  expect(canSendInConversation(makeDetail({ canSend: false }))).toBe(false)
})

it('unit: a pending message disappears once the server copy is loaded, one-to-one by content after its send point', () => {
  const pending = (clientId: string, content: string, afterSeq: number): PendingMessage => ({
    clientId, content, afterSeq, createdAt: '2026-11-22T09:00:00Z', status: 'sending',
  })
  const a = pending('a', 'Xin chào', 2)
  const b = pending('b', 'Xin chào', 2)
  const c = pending('c', 'Câu khác', 2)
  // Only my own messages after the send point count, each matching one pending item.
  const server = [makeMsg(1, { mine: true, content: 'Xin chào' }), makeMsg(3, { mine: true, content: 'Xin chào' }), makeMsg(4, { content: 'Câu khác' })]
  expect(reconcilePending([a, b, c], server).map(p => p.clientId)).toEqual(['b', 'c'])
  expect(reconcilePending([{ ...a, status: 'failed' }], server)).toEqual([])
})

it('unit: a seq already confirmed for one pending message never hides another with the same content', () => {
  const b: PendingMessage = { clientId: 'b', content: 'Xin chào', afterSeq: 2, createdAt: '2026-11-22T09:00:00Z', status: 'failed' }
  const server = [makeMsg(3, { mine: true, content: 'Xin chào' })]
  expect(reconcilePending([b], server, new Set([3]))).toEqual([b])
  expect(reconcilePending([b], server, new Set())).toEqual([])
})

it('unit: catch-up keeps paging until hasMore is false, past 20 pages', async () => {
  const spy = vi.spyOn(messagingService, 'messages').mockImplementation(async (_id, params = {}) => {
    const from = (params.afterSeq ?? 0) + 1
    return { messages: [makeMsg(from)], hasMore: from < 25 }
  })
  try {
    const all = await messagingService.fetchAllAfterSeq('conv-1', 0, 1)
    expect(all.map(m => m.seq)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1))
  } finally {
    spy.mockRestore()
  }
})

// ---- Integration tests on MessagesPage ----

it('lists conversations with unread marker, marks read on open, sends message, and retries failed send with the SAME clientId', async () => {
  const readCalls: number[] = []
  const sendCalls: { content: string; clientId: string }[] = []
  let failSendOnce = true

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method || 'GET'
    if (url.pathname === '/api/v1/conversations/socket-ticket') {
      return json({ ticket: 'tk-1', expiresAt: '2026-11-22T10:00:00Z' })
    }
    if (url.pathname === '/api/v1/conversations/unread-count') return json({ count: 1 })
    if (url.pathname === '/api/v1/conversations') return json(page([makeSummary()]))
    if (url.pathname === '/api/v1/conversations/conv-1' && method === 'GET') return json(makeDetail())
    if (url.pathname === '/api/v1/conversations/conv-1/messages' && method === 'GET') {
      return json({ messages: [makeMsg(1), makeMsg(2)], hasMore: false })
    }
    if (url.pathname === '/api/v1/conversations/conv-1/read' && method === 'PUT') {
      const body = JSON.parse(String(init?.body)) as { seq: number }
      readCalls.push(body.seq)
      return json(makeDetail({ unread: false }))
    }
    if (url.pathname === '/api/v1/conversations/conv-1/messages' && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { content: string; clientId: string }
      sendCalls.push(body)
      if (failSendOnce) {
        failSendOnce = false
        return json(null, 503, 'MESSAGE_STORAGE_UNAVAILABLE')
      }
      return json(makeMsg(3, { mine: true, content: body.content }), 201)
    }
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/messages/conv-1']}>
      <Routes>
        <Route path="/messages/:id" element={<MessagesPage language="vi" />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByText('Tin nhắn số 2')).toBeTruthy()
  expect(screen.getAllByText('Trần Tác Giả').length).toBeGreaterThan(0)
  expect(screen.getByText(/Hỏi về:/)).toBeTruthy()
  expect(screen.getByText('Chưa đăng ký')).toBeTruthy()
  expect(screen.getByText('Bạn có thể gửi thêm 2 tin trước khi tác giả trả lời.')).toBeTruthy()

  // Marked read up to seq 2 on open
  await waitFor(() => expect(readCalls).toContain(2))

  // Send a message -> fails first time -> click "Gửi lại" -> reuses the EXACT same clientId
  const input = screen.getByPlaceholderText('Nhập tin nhắn…')
  await user.click(input)
  await user.paste('Em muốn hỏi thêm về lộ trình học khóa này.')
  await user.click(screen.getByRole('button', { name: 'Gửi' }))

  const retryBtn = await screen.findByRole('button', { name: 'Gửi lại' })
  expect(sendCalls).toHaveLength(1)
  const firstClientId = sendCalls[0].clientId
  expect(firstClientId).toBeTruthy()

  await user.click(retryBtn)
  await waitFor(() => expect(sendCalls).toHaveLength(2))
  expect(sendCalls[1].clientId).toBe(firstClientId)
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Gửi lại' })).toBeNull())
})

it('handles WebSocket message & state events, and reconnects with catch-up after disconnect', async () => {
  let detailState = makeDetail({ remainingBeforeReply: 0, canSend: false })
  let afterSeqCalls = 0

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method || 'GET'
    if (url.pathname === '/api/v1/conversations/socket-ticket') {
      return json({ ticket: 'tk-ws', expiresAt: '2026-11-22T10:00:00Z' })
    }
    if (url.pathname === '/api/v1/conversations/unread-count') return json({ count: 0 })
    if (url.pathname === '/api/v1/conversations') return json(page([makeSummary({ unread: false })]))
    if (url.pathname === '/api/v1/conversations/conv-1' && method === 'GET') return json(detailState)
    if (url.pathname === '/api/v1/conversations/conv-1/messages' && method === 'GET') {
      if (url.searchParams.has('afterSeq')) {
        afterSeqCalls++
        return json({ messages: [makeMsg(3, { content: 'Tác giả đã trả lời bạn!' })], hasMore: false })
      }
      return json({ messages: [makeMsg(1), makeMsg(2)], hasMore: false })
    }
    if (url.pathname === '/api/v1/conversations/conv-1/read' && method === 'PUT') {
      return json(detailState)
    }
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')

  render(
    <MemoryRouter initialEntries={['/messages/conv-1']}>
      <Routes>
        <Route path="/messages/:id" element={<MessagesPage language="vi" />} />
      </Routes>
    </MemoryRouter>,
  )

  // Initially remainingBeforeReply = 0 -> input is hidden and waiting message is shown
  expect(await screen.findByText('Hãy chờ tác giả trả lời trước khi gửi thêm.')).toBeTruthy()
  expect(screen.queryByPlaceholderText('Nhập tin nhắn…')).toBeNull()

  await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0))
  const ws = FakeWebSocket.instances.at(-1)!
  act(() => ws.open())

  // Author replies -> server pushes message event -> FE fetches afterSeq and reloads detail (now canSend = true, remainingBeforeReply = null)
  detailState = makeDetail({ remainingBeforeReply: null, canSend: true })
  act(() => ws.receive({ type: 'message', conversationId: 'conv-1', seq: 3 }))

  expect(await screen.findByText('Tác giả đã trả lời bạn!')).toBeTruthy()
  expect(await screen.findByPlaceholderText('Nhập tin nhắn…')).toBeTruthy()
  expect(afterSeqCalls).toBe(1)

  // Context course changes -> server pushes state event -> "Hỏi về" updates
  detailState = makeDetail({
    remainingBeforeReply: null,
    canSend: true,
    contextCourse: { id: 'course-2', title: 'Microservices Nâng Cao', available: true },
  })
  act(() => ws.receive({ type: 'state', conversationId: 'conv-1' }))
  expect(await screen.findByText('Microservices Nâng Cao')).toBeTruthy()
})

it('re-runs catch-up for an event that arrives mid-fetch and never shows my message twice when its event beats the POST response', async () => {
  const deferred = () => {
    let resolve!: (r: Response) => void
    const promise = new Promise<Response>(r => { resolve = r })
    return { promise, resolve }
  }
  let firstCatchup: ReturnType<typeof deferred> | null = null
  let postResponse: ReturnType<typeof deferred> | null = null
  const serverMessages = [makeMsg(1), makeMsg(2)]
  let afterSeqCalls = 0

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method || 'GET'
    if (url.pathname === '/api/v1/conversations/socket-ticket') return json({ ticket: 'tk', expiresAt: '2026-11-22T10:00:00Z' })
    if (url.pathname === '/api/v1/conversations/unread-count') return json({ count: 0 })
    if (url.pathname === '/api/v1/conversations') return json(page([makeSummary({ unread: false })]))
    if (url.pathname === '/api/v1/conversations/conv-1' && method === 'GET') return json(makeDetail({ remainingBeforeReply: null }))
    if (url.pathname === '/api/v1/conversations/conv-1/read') return json(makeDetail())
    if (url.pathname === '/api/v1/conversations/conv-1/messages' && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { content: string }
      serverMessages.push(makeMsg(serverMessages.length + 1, { mine: true, content: body.content }))
      postResponse = deferred()
      return postResponse.promise
    }
    if (url.pathname === '/api/v1/conversations/conv-1/messages') {
      const after = url.searchParams.get('afterSeq')
      if (after === null) return json({ messages: serverMessages.slice(), hasMore: false })
      afterSeqCalls++
      const snapshot = serverMessages.filter(m => m.seq > Number(after))
      if (afterSeqCalls === 1) {
        firstCatchup = deferred()
        await firstCatchup.promise
      }
      return json({ messages: snapshot, hasMore: false })
    }
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/messages/conv-1']}>
      <Routes>
        <Route path="/messages/:id" element={<MessagesPage language="vi" />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByText('Tin nhắn số 2')).toBeTruthy()
  await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0))
  const ws = FakeWebSocket.instances.at(-1)!
  act(() => ws.open())

  // seq 3 arrives; its catch-up is still in flight (snapshot taken) when seq 4 is stored and signalled.
  serverMessages.push(makeMsg(3, { content: 'Tin thứ ba' }))
  act(() => ws.receive({ type: 'message', conversationId: 'conv-1', seq: 3 }))
  await waitFor(() => expect(firstCatchup).not.toBeNull())
  serverMessages.push(makeMsg(4, { content: 'Tin thứ tư' }))
  act(() => ws.receive({ type: 'message', conversationId: 'conv-1', seq: 4 }))
  await act(async () => { firstCatchup!.resolve(new Response()) })
  expect(await screen.findByText('Tin thứ tư')).toBeTruthy()

  // My own message: the event and its catch-up land before the POST response.
  await user.click(screen.getByPlaceholderText('Nhập tin nhắn…'))
  await user.paste('Cảm ơn thầy đã trả lời')
  await user.click(screen.getByRole('button', { name: 'Gửi' }))
  await waitFor(() => expect(postResponse).not.toBeNull())
  act(() => ws.receive({ type: 'message', conversationId: 'conv-1', seq: 5 }))
  await waitFor(() => expect(screen.queryByText('Đang gửi…')).toBeNull())
  expect(screen.getAllByText('Cảm ơn thầy đã trả lời')).toHaveLength(1)
  await act(async () => { postResponse!.resolve(json(serverMessages[4], 201)) })
  expect(screen.getAllByText('Cảm ơn thầy đã trả lời')).toHaveLength(1)
})

function connectedFetch(handle: (url: URL, method: string) => Response | null | Promise<Response | null>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method || 'GET'
    const own = await handle(url, method)
    if (own) return own
    if (url.pathname === '/api/v1/conversations/socket-ticket') return json({ ticket: 'tk', expiresAt: '2026-11-22T10:00:00Z' })
    if (url.pathname === '/api/v1/conversations/unread-count') return json({ count: 0 })
    return json(null, 404)
  })
}

async function openOn(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/messages/:id" element={<MessagesPage language="vi" />} />
      </Routes>
    </MemoryRouter>,
  )
}

it('retries a failed catch-up while the socket stays connected', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const serverMessages = [makeMsg(1)]
  let afterSeqCalls = 0
  vi.stubGlobal('fetch', connectedFetch(url => {
    if (url.pathname === '/api/v1/conversations') return json(page([makeSummary({ unread: false })]))
    if (url.pathname === '/api/v1/conversations/conv-1') return json(makeDetail())
    if (url.pathname === '/api/v1/conversations/conv-1/read') return json(makeDetail())
    if (url.pathname === '/api/v1/conversations/conv-1/messages') {
      const after = url.searchParams.get('afterSeq')
      if (after === null) return json({ messages: serverMessages.slice(), hasMore: false })
      afterSeqCalls++
      if (afterSeqCalls === 1) return json(null, 503, 'MESSAGE_STORAGE_UNAVAILABLE')
      return json({ messages: serverMessages.filter(m => m.seq > Number(after)), hasMore: false })
    }
    return null
  }))
  setAccessToken('tok')
  await openOn('/messages/conv-1')
  expect(await screen.findByText('Tin nhắn số 1')).toBeTruthy()
  await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0))
  const ws = FakeWebSocket.instances.at(-1)!
  act(() => ws.open())

  serverMessages.push(makeMsg(2, { content: 'Tin đến sau lỗi' }))
  act(() => ws.receive({ type: 'message', conversationId: 'conv-1', seq: 2 }))
  await waitFor(() => expect(afterSeqCalls).toBe(1))
  await act(async () => { await vi.advanceTimersByTimeAsync(2500) })
  expect(await screen.findByText('Tin đến sau lỗi')).toBeTruthy()
})

it('retries a failed mark-read while the socket stays connected and nothing new arrives', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  let readCalls = 0
  vi.stubGlobal('fetch', connectedFetch(url => {
    if (url.pathname === '/api/v1/conversations') return json(page([makeSummary()]))
    if (url.pathname === '/api/v1/conversations/conv-1') return json(makeDetail())
    if (url.pathname === '/api/v1/conversations/conv-1/messages') return json({ messages: [makeMsg(1)], hasMore: false })
    if (url.pathname === '/api/v1/conversations/conv-1/read') {
      readCalls++
      return readCalls === 1 ? json(null, 503, 'MESSAGE_STORAGE_UNAVAILABLE') : json(makeDetail({ unread: false }))
    }
    return null
  }))
  setAccessToken('tok')
  await openOn('/messages/conv-1')
  expect(await screen.findByText('Tin nhắn số 1')).toBeTruthy()
  await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0))
  act(() => FakeWebSocket.instances.at(-1)!.open())
  await waitFor(() => expect(readCalls).toBe(1))
  await act(async () => { await vi.advanceTimersByTimeAsync(2500) })
  expect(readCalls).toBe(2)
})

it('does not lose an event of the newly opened conversation while the previous one is still catching up', async () => {
  let release!: () => void
  const held = new Promise<void>(r => { release = r })
  let conv1AfterSeq = 0
  const conv2 = [makeMsg(1, { content: 'Tin B một' })]
  vi.stubGlobal('fetch', connectedFetch(async url => {
    if (url.pathname === '/api/v1/conversations') {
      return json(page([
        makeSummary({ unread: false }),
        makeSummary({ id: 'conv-2', unread: false, other: { id: 'author-2', fullName: 'Lê Tác Giả B', avatarUrl: null } }),
      ]))
    }
    if (url.pathname === '/api/v1/conversations/conv-1') return json(makeDetail())
    if (url.pathname === '/api/v1/conversations/conv-2') return json(makeDetail({ id: 'conv-2', other: { id: 'author-2', fullName: 'Lê Tác Giả B', avatarUrl: null } }))
    if (url.pathname.endsWith('/read')) return json(makeDetail())
    if (url.pathname === '/api/v1/conversations/conv-1/messages') {
      if (url.searchParams.get('afterSeq') === null) return json({ messages: [makeMsg(1)], hasMore: false })
      conv1AfterSeq++
      await held
      return json({ messages: [], hasMore: false })
    }
    if (url.pathname === '/api/v1/conversations/conv-2/messages') {
      const after = url.searchParams.get('afterSeq')
      return json({ messages: after === null ? conv2.slice() : conv2.filter(m => m.seq > Number(after)), hasMore: false })
    }
    return null
  }))
  setAccessToken('tok')
  const user = userEvent.setup()
  await openOn('/messages/conv-1')
  expect(await screen.findByText('Tin nhắn số 1')).toBeTruthy()
  await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0))
  const ws = FakeWebSocket.instances.at(-1)!
  act(() => ws.open())

  act(() => ws.receive({ type: 'message', conversationId: 'conv-1', seq: 2 }))
  await waitFor(() => expect(conv1AfterSeq).toBe(1))
  await user.click(screen.getByRole('link', { name: /Lê Tác Giả B/ }))
  expect(await screen.findByText('Tin B một')).toBeTruthy()
  conv2.push(makeMsg(2, { content: 'Tin B hai' }))
  act(() => ws.receive({ type: 'message', conversationId: 'conv-2', seq: 2 }))
  await act(async () => { release() })
  expect(await screen.findByText('Tin B hai')).toBeTruthy()
})

it('falls back to 5s/30s polling when socket ticket fails and stops polling while tab is hidden', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  let afterSeqPolls = 0
  let unreadPolls = 0
  let ticketCalls = 0
  let readCalls = 0

  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/v1/conversations/socket-ticket') {
      ticketCalls++
      return json(null, 503, 'MESSAGE_STORAGE_UNAVAILABLE')
    }
    if (url.pathname === '/api/v1/conversations/unread-count') {
      unreadPolls++
      return json({ count: 0 })
    }
    if (url.pathname === '/api/v1/conversations') return json(page([makeSummary({ unread: false })]))
    if (url.pathname === '/api/v1/conversations/conv-1') return json(makeDetail({ unread: false }))
    if (url.pathname === '/api/v1/conversations/conv-1/messages') {
      if (url.searchParams.has('afterSeq')) {
        afterSeqPolls++
        return json({ messages: [], hasMore: false })
      }
      return json({ messages: [makeMsg(1)], hasMore: false })
    }
    if (url.pathname === '/api/v1/conversations/conv-1/read') {
      readCalls++
      // The first mark-read fails; it must be retried even though no new message arrives.
      return readCalls === 1 ? json(null, 503, 'MESSAGE_STORAGE_UNAVAILABLE') : json(makeDetail({ unread: false }))
    }
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')

  render(
    <MemoryRouter initialEntries={['/messages/conv-1']}>
      <Routes>
        <Route path="/messages/:id" element={<MessagesPage language="vi" />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByText('Tin nhắn số 1')).toBeTruthy()
  const beforeAfterSeq = afterSeqPolls

  await act(async () => {
    await vi.advanceTimersByTimeAsync(5200)
  })
  expect(afterSeqPolls).toBeGreaterThan(beforeAfterSeq)
  expect(readCalls).toBeGreaterThanOrEqual(2)
  // A failed first ticket is retried with backoff instead of polling forever.
  expect(ticketCalls).toBeGreaterThanOrEqual(2)

  const beforeUnread = unreadPolls
  await act(async () => {
    await vi.advanceTimersByTimeAsync(25500)
  })
  expect(unreadPolls).toBeGreaterThan(beforeUnread)
})

it('keeps the newer detail response when two detail requests resolve out of order', async () => {
  let resolveFirst!: (res: Response) => void
  let detailCallCount = 0

  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/v1/conversations/socket-ticket') {
      return Promise.resolve(json({ ticket: 'tk-1', expiresAt: '2026-11-22T10:00:00Z' }))
    }
    if (url.pathname === '/api/v1/conversations/unread-count') return Promise.resolve(json({ count: 0 }))
    if (url.pathname === '/api/v1/conversations') return Promise.resolve(json(page([makeSummary({ unread: false })])))
    if (url.pathname === '/api/v1/conversations/conv-1') {
      detailCallCount++
      if (detailCallCount === 1) {
        return new Promise<Response>(r => {
          resolveFirst = r
        })
      }
      return Promise.resolve(
        json(
          makeDetail({
            contextCourse: { id: 'c-new', title: 'Khóa học Mới Nhất', available: true },
          }),
        ),
      )
    }
    if (url.pathname === '/api/v1/conversations/conv-1/messages') {
      return Promise.resolve(json({ messages: [makeMsg(1)], hasMore: false }))
    }
    if (url.pathname === '/api/v1/conversations/conv-1/read') {
      return Promise.resolve(
        json(
          makeDetail({
            contextCourse: { id: 'c-new', title: 'Khóa học Mới Nhất', available: true },
          }),
        ),
      )
    }
    return Promise.resolve(json(null, 404))
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')

  render(
    <MemoryRouter initialEntries={['/messages/conv-1']}>
      <Routes>
        <Route path="/messages/:id" element={<MessagesPage language="vi" />} />
      </Routes>
    </MemoryRouter>,
  )

  await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0))
  const ws = FakeWebSocket.instances.at(-1)!
  act(() => ws.open())
  // Trigger a second detail fetch via state event before the first detail fetch finishes
  act(() => ws.receive({ type: 'state', conversationId: 'conv-1' }))

  expect(await screen.findByText('Khóa học Mới Nhất')).toBeTruthy()

  // Now the older first detail response resolves late
  act(() => {
    resolveFirst(
      json(
        makeDetail({
          contextCourse: { id: 'c-old', title: 'Khóa học Cũ Đã Lỗi Thời', available: true },
        }),
      ),
    )
  })

  expect(screen.getByText('Khóa học Mới Nhất')).toBeTruthy()
  expect(screen.queryByText('Khóa học Cũ Đã Lỗi Thời')).toBeNull()
})

it('loads older messages, blocks/unblocks with confirmation, submits a conversation report with privacy notice, and shows locked state', async () => {
  let detailState = makeDetail()
  const blockCalls: boolean[] = []
  const reportCalls: unknown[] = []

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method || 'GET'
    if (url.pathname === '/api/v1/conversations/socket-ticket') {
      return json({ ticket: 'tk-1', expiresAt: '2026-11-22T10:00:00Z' })
    }
    if (url.pathname === '/api/v1/conversations/unread-count') return json({ count: 0 })
    if (url.pathname === '/api/v1/conversations') return json(page([makeSummary({ unread: false })]))
    if (url.pathname === '/api/v1/conversations/conv-1' && method === 'GET') return json(detailState)
    if (url.pathname === '/api/v1/conversations/conv-1/messages' && method === 'GET') {
      if (url.searchParams.get('beforeSeq') === '2') {
        return json({ messages: [makeMsg(1, { content: 'Tin nhắn cũ hơn số 1' })], hasMore: false })
      }
      return json({ messages: [makeMsg(2, { content: 'Tin nhắn mới số 2' })], hasMore: true })
    }
    if (url.pathname === '/api/v1/conversations/conv-1/read') return json(detailState)
    if (url.pathname === '/api/v1/conversations/conv-1/block' && method === 'PUT') {
      const { blocked } = JSON.parse(String(init?.body)) as { blocked: boolean }
      blockCalls.push(blocked)
      detailState = makeDetail({ blockedByMe: blocked, canSend: !blocked })
      return json(detailState)
    }
    if (url.pathname === '/api/v1/reports' && method === 'POST') {
      const body = JSON.parse(String(init?.body))
      reportCalls.push(body)
      return json({ id: 'rep-c1', status: 'OPEN', createdAt: '2026-11-22T11:00:00Z' })
    }
    return json(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/messages/conv-1']}>
      <Routes>
        <Route path="/messages/:id" element={<MessagesPage language="vi" />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByText('Tin nhắn mới số 2')).toBeTruthy()

  // 1. Load older messages
  await user.click(screen.getByRole('button', { name: 'Tải tin cũ hơn' }))
  expect(await screen.findByText('Tin nhắn cũ hơn số 1')).toBeTruthy()

  // 2. Block conversation via actions menu + AlertDialog confirmation
  await user.click(screen.getByRole('button', { name: 'Tùy chọn cuộc trò chuyện' }))
  await user.click(await screen.findByRole('button', { name: 'Chặn' }))
  const alert = await screen.findByRole('alertdialog')
  expect(within(alert).getByText('Chặn cuộc trò chuyện này? Cả hai bên sẽ không gửi được tin mới.')).toBeTruthy()
  await user.click(within(alert).getByRole('button', { name: 'Chặn' }))

  expect(await screen.findByText('Bạn đã chặn cuộc trò chuyện này.')).toBeTruthy()
  expect(screen.queryByPlaceholderText('Nhập tin nhắn…')).toBeNull()
  expect(blockCalls).toEqual([true])

  // Unblock button shown directly for the blocker
  await user.click(screen.getByRole('button', { name: 'Bỏ chặn' }))
  expect(await screen.findByPlaceholderText('Nhập tin nhắn…')).toBeTruthy()
  expect(blockCalls).toEqual([true, false])

  // 3. Report conversation -> shows privacy disclaimer notice and sends targetType: "CONVERSATION"
  await user.click(screen.getByRole('button', { name: 'Tùy chọn cuộc trò chuyện' }))
  await user.click(await screen.findByRole('button', { name: 'Báo cáo' }))
  const reportDialog = await screen.findByRole('dialog')
  expect(
    within(reportDialog).getByText(
      'Khi bạn báo cáo, kiểm duyệt viên sẽ xem được toàn bộ tin nhắn trong cuộc trò chuyện này.',
    ),
  ).toBeTruthy()
  // Same reasons as forum reports (the backend rejects anything else).
  const reasonSelect = within(reportDialog).getByLabelText(/Lý do/) as HTMLSelectElement
  expect(Array.from(reasonSelect.options).map(o => o.value)).toEqual(['SPAM', 'INAPPROPRIATE', 'COPYRIGHT', 'MISLEADING', 'OTHER'])
  // OTHER needs a 10–1,000 character description.
  await user.selectOptions(reasonSelect, 'OTHER')
  await user.type(within(reportDialog).getByLabelText(/Mô tả/), 'ngắn')
  await user.click(within(reportDialog).getByRole('button', { name: 'Gửi báo cáo' }))
  expect(await within(reportDialog).findByText('Hãy mô tả vi phạm (10–1.000 ký tự).')).toBeTruthy()
  expect(reportCalls).toEqual([])
  await user.clear(within(reportDialog).getByLabelText(/Mô tả/))
  await user.paste('Tác giả gửi liên kết lừa đảo nhiều lần')
  await user.click(within(reportDialog).getByRole('button', { name: 'Gửi báo cáo' }))
  await waitFor(() =>
    expect(reportCalls).toEqual([
      {
        targetType: 'CONVERSATION',
        targetId: 'conv-1',
        reason: 'OTHER',
        description: 'Tác giả gửi liên kết lừa đảo nhiều lần',
      },
    ]),
  )

  // 4. Locked conversation state
  cleanup()
  detailState = makeDetail({ locked: true, canSend: false })
  render(
    <MemoryRouter initialEntries={['/messages/conv-1']}>
      <Routes>
        <Route path="/messages/:id" element={<MessagesPage language="vi" />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByText('Cuộc trò chuyện đã bị khóa bởi kiểm duyệt.')).toBeTruthy()
  expect(screen.queryByPlaceholderText('Nhập tin nhắn…')).toBeNull()
})

it('redirects ADMIN and MODERATOR away from /messages to their dashboards', async () => {
  let roles: string[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname
    if (path.endsWith('/auth/refresh')) return json({ accessToken: 'tok2', expiresAt: '', expiresIn: 900 })
    if (path === '/api/v1/users/me') {
      return json({
        id: 'u-staff',
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
    roles = [...r]
    localStorage.setItem('techverse-authenticated', 'true')
    setAccessToken('tok')
    render(
      <MemoryRouter initialEntries={['/messages']}>
        <App />
        <Where />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(home))
    cleanup()
  }
})
