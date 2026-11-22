import { API_BASE_URL, getAccessToken, getSessionVersion, request } from './api/client'
import type { ReportReason } from '../types/forum'
import type {
  ConversationDetail,
  ConversationMessage,
  ConversationMessagesPage,
  ConversationSummary,
  LockedConversationItem,
  MessagingPage,
  MessagingSocketEvent,
  SocketTicketResponse,
  UnreadCountResponse,
} from '../types/messaging'

export const MESSAGE_MIN_LENGTH = 1
export const MESSAGE_MAX_LENGTH = 2000

/** Client validation matching `ConversationRequest.SendMessage` and `ConversationService.validateContent`. */
export function validateMessageContent(raw: string): 'messageLength' | 'contentInvalid' | null {
  if (raw.includes('\0')) return 'contentInvalid'
  const trimmed = raw.trim()
  if (trimmed.length < MESSAGE_MIN_LENGTH || trimmed.length > MESSAGE_MAX_LENGTH) return 'messageLength'
  return null
}

/** Pure rule checking whether the composer should be active for a conversation detail snapshot. */
export function canSendInConversation(
  detail: Pick<ConversationDetail, 'canSend' | 'blockedByMe' | 'blockedByOther' | 'locked' | 'remainingBeforeReply'> | null,
): boolean {
  if (!detail) return false
  if (!detail.canSend || detail.blockedByMe || detail.blockedByOther || detail.locked) return false
  if (detail.remainingBeforeReply === 0) return false
  return true
}

/** Merges server message pages by ascending `seq` without duplicates. */
export function mergeMessagesBySeq(
  existing: ConversationMessage[],
  incoming: ConversationMessage[],
): ConversationMessage[] {
  const bySeq = new Map<number, ConversationMessage>()
  for (const msg of existing) bySeq.set(msg.seq, msg)
  for (const msg of incoming) bySeq.set(msg.seq, msg)
  return Array.from(bySeq.values()).sort((a, b) => a.seq - b.seq)
}

export type RealtimeSignal =
  | MessagingSocketEvent
  | { type: 'catchup' }
  | { type: 'poll-active' }
  | { type: 'poll-list' }

export type ConnectionState = 'connected' | 'reconnecting' | 'polling'

type UnreadListener = (count: number) => void
type SignalListener = (signal: RealtimeSignal) => void
type StateListener = (state: ConnectionState) => void

const unreadListeners = new Set<UnreadListener>()
const signalListeners = new Set<SignalListener>()
const stateListeners = new Set<StateListener>()

let currentUnread = 0
let connectionState: ConnectionState = 'connected'
let activeSocket: WebSocket | null = null
let hasConnectedOnce = false
let backoffMs = 1000
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let expCloseTimer: ReturnType<typeof setTimeout> | null = null
let activePollTimer: ReturnType<typeof setInterval> | null = null
let listPollTimer: ReturnType<typeof setInterval> | null = null
let connectingPromise: Promise<void> | null = null
let unreadInFlight = false
let trackedSessionVersion = -1

function setConnectionState(next: ConnectionState) {
  if (connectionState === next) return
  connectionState = next
  for (const listener of stateListeners) listener(next)
}

function emitSignal(signal: RealtimeSignal) {
  for (const listener of signalListeners) listener(signal)
}

function emitUnread(count: number) {
  currentUnread = count
  for (const listener of unreadListeners) listener(count)
}

function canCallNetwork(): boolean {
  if (getAccessToken()) return true
  const fn = globalThis.fetch as unknown as { mock?: unknown } | undefined
  return Boolean(fn && 'mock' in fn && fn.mock)
}

function hasSubscribers(): boolean {
  return unreadListeners.size > 0 || signalListeners.size > 0 || stateListeners.size > 0
}

function clearTimers() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  if (expCloseTimer) { clearTimeout(expCloseTimer); expCloseTimer = null }
}

function stopFallbackPolling() {
  if (activePollTimer) { clearInterval(activePollTimer); activePollTimer = null }
  if (listPollTimer) { clearInterval(listPollTimer); listPollTimer = null }
}

function startFallbackPolling() {
  if (!activePollTimer) {
    activePollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (!hasSubscribers() || !canCallNetwork()) return
      emitSignal({ type: 'poll-active' })
    }, 5000)
  }
  if (!listPollTimer) {
    listPollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (!hasSubscribers() || !canCallNetwork()) return
      void refreshUnreadCount()
      emitSignal({ type: 'poll-list' })
    }, 30000)
  }
}

export async function refreshUnreadCount(): Promise<number> {
  if (!canCallNetwork() || unreadInFlight) return currentUnread
  unreadInFlight = true
  try {
    const res = await messagingService.unreadCount()
    const nextCount = typeof res?.count === 'number' ? res.count : 0
    emitUnread(nextCount)
    return nextCount
  } catch {
    return currentUnread
  } finally {
    unreadInFlight = false
  }
}

function buildWsUrl(ticket: string): string {
  const wsBase = API_BASE_URL.replace(/^http/i, 'ws').replace(/\/$/, '')
  return `${wsBase}/ws/messaging?ticket=${encodeURIComponent(ticket)}`
}

function scheduleReconnect() {
  if (reconnectTimer || !hasSubscribers()) return
  const delay = backoffMs
  backoffMs = Math.min(30000, backoffMs * 2)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (hasSubscribers()) void ensureSocketConnected(true)
  }, delay)
}

async function ensureSocketConnected(isReconnect = false): Promise<void> {
  if (!hasSubscribers() || !canCallNetwork()) return
  if (activeSocket && (activeSocket.readyState === 1 || activeSocket.readyState === 0)) return
  if (connectingPromise) return connectingPromise

  const sessionVer = getSessionVersion()
  trackedSessionVersion = sessionVer

  connectingPromise = (async () => {
    try {
      const ticketRes = await messagingService.socketTicket()
      if (!hasSubscribers() || getSessionVersion() !== sessionVer) return
      if (typeof WebSocket === 'undefined') {
        setConnectionState('polling')
        startFallbackPolling()
        return
      }

      const ws = new WebSocket(buildWsUrl(ticketRes.ticket))
      activeSocket = ws

      ws.onopen = () => {
        if (activeSocket !== ws) return
        backoffMs = 1000
        stopFallbackPolling()
        const catchup = isReconnect || hasConnectedOnce
        hasConnectedOnce = true
        setConnectionState('connected')
        if (catchup) {
          void refreshUnreadCount()
          emitSignal({ type: 'catchup' })
        }
      }

      ws.onmessage = (ev: MessageEvent) => {
        if (activeSocket !== ws) return
        try {
          const parsed = JSON.parse(String(ev.data)) as MessagingSocketEvent
          if (!parsed || typeof parsed.type !== 'string') return
          if (parsed.type === 'unread') {
            void refreshUnreadCount()
          }
          emitSignal(parsed)
        } catch {
          // Ignore malformed event payloads
        }
      }

      ws.onclose = () => {
        if (activeSocket !== ws) return
        activeSocket = null
        clearTimers()
        if (!hasSubscribers()) return
        setConnectionState('reconnecting')
        startFallbackPolling()
        scheduleReconnect()
      }

      ws.onerror = () => {
        // Browser fires onclose after onerror
      }
    } catch {
      if (!hasSubscribers()) return
      setConnectionState(hasConnectedOnce ? 'reconnecting' : 'polling')
      startFallbackPolling()
      // A failed first ticket is retried too (1 → 30 s); polling covers the wait.
      scheduleReconnect()
    } finally {
      connectingPromise = null
    }
  })()

  return connectingPromise
}

function teardownRealtime() {
  clearTimers()
  stopFallbackPolling()
  const ws = activeSocket
  activeSocket = null
  if (ws) {
    ws.onopen = null
    ws.onmessage = null
    ws.onclose = null
    ws.onerror = null
    try { ws.close() } catch { /* ignore */ }
  }
  hasConnectedOnce = false
  backoffMs = 1000
  connectingPromise = null
  unreadInFlight = false
  connectionState = 'connected'
  currentUnread = 0
}

function checkLifecycle() {
  if (!hasSubscribers()) {
    teardownRealtime()
    return
  }
  if (trackedSessionVersion !== -1 && trackedSessionVersion !== getSessionVersion()) {
    teardownRealtime()
  }
  if (canCallNetwork()) {
    void ensureSocketConnected(false)
  }
}

export const messagingService = {
  openConversation(courseId: string): Promise<ConversationDetail> {
    return request<ConversationDetail>('/api/v1/conversations', {
      method: 'POST',
      body: JSON.stringify({ courseId }),
    })
  },

  listConversations(page = 0, size = 20): Promise<MessagingPage<ConversationSummary>> {
    return request<MessagingPage<ConversationSummary>>(`/api/v1/conversations?page=${page}&size=${size}`)
  },

  unreadCount(): Promise<UnreadCountResponse> {
    return request<UnreadCountResponse>('/api/v1/conversations/unread-count')
  },

  detail(id: string): Promise<ConversationDetail> {
    return request<ConversationDetail>(`/api/v1/conversations/${id}`)
  },

  messages(
    id: string,
    params: { beforeSeq?: number; afterSeq?: number; size?: number } = {},
  ): Promise<ConversationMessagesPage> {
    const search = new URLSearchParams()
    if (params.beforeSeq !== undefined) search.set('beforeSeq', String(params.beforeSeq))
    if (params.afterSeq !== undefined) search.set('afterSeq', String(params.afterSeq))
    search.set('size', String(params.size ?? 30))
    return request<ConversationMessagesPage>(`/api/v1/conversations/${id}/messages?${search.toString()}`)
  },

  /** Loops `afterSeq` until `hasMore === false` so more than one page of new messages is never missed. */
  async fetchAllAfterSeq(id: string, afterSeq: number, size = 30): Promise<ConversationMessage[]> {
    const collected: ConversationMessage[] = []
    let cursor = afterSeq
    // Until the last page: stopping early would hide the newest messages until another event.
    for (;;) {
      const page = await messagingService.messages(id, { afterSeq: cursor, size })
      if (page.messages.length === 0) break
      collected.push(...page.messages)
      const lastSeq = page.messages[page.messages.length - 1].seq
      if (!page.hasMore || lastSeq <= cursor) break
      cursor = lastSeq
    }
    return collected
  },

  sendMessage(id: string, body: { content: string; clientId: string }): Promise<ConversationMessage> {
    return request<ConversationMessage>(`/api/v1/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  markRead(id: string, seq: number): Promise<ConversationDetail> {
    return request<ConversationDetail>(`/api/v1/conversations/${id}/read`, {
      method: 'PUT',
      body: JSON.stringify({ seq }),
    })
  },

  setBlocked(id: string, blocked: boolean): Promise<ConversationDetail> {
    return request<ConversationDetail>(`/api/v1/conversations/${id}/block`, {
      method: 'PUT',
      body: JSON.stringify({ blocked }),
    })
  },

  reportConversation(targetId: string, reason: ReportReason, description?: string): Promise<unknown> {
    const trimmed = description?.trim()
    return request('/api/v1/reports', {
      method: 'POST',
      body: JSON.stringify({
        targetType: 'CONVERSATION',
        targetId,
        reason,
        ...(trimmed ? { description: trimmed } : {}),
      }),
    })
  },

  socketTicket(): Promise<SocketTicketResponse> {
    return request<SocketTicketResponse>('/api/v1/conversations/socket-ticket', {
      method: 'POST',
    })
  },

  // Moderator endpoints (for Task 2b)
  moderatorMessages(
    id: string,
    params: { beforeSeq?: number; afterSeq?: number; size?: number } = {},
  ): Promise<ConversationMessagesPage> {
    const search = new URLSearchParams()
    if (params.beforeSeq !== undefined) search.set('beforeSeq', String(params.beforeSeq))
    if (params.afterSeq !== undefined) search.set('afterSeq', String(params.afterSeq))
    search.set('size', String(params.size ?? 30))
    return request<ConversationMessagesPage>(`/api/v1/moderator/conversations/${id}/messages?${search.toString()}`)
  },

  moderatorSetLocked(id: string, locked: boolean, note?: string): Promise<void> {
    return request<void>(`/api/v1/moderator/conversations/${id}/lock`, {
      method: 'PATCH',
      body: JSON.stringify({
        locked,
        note: note?.trim() ? note.trim() : null,
      }),
    })
  },

  moderatorListLocked(page = 0, size = 20): Promise<MessagingPage<LockedConversationItem>> {
    return request<MessagingPage<LockedConversationItem>>(
      `/api/v1/moderator/conversations?locked=true&page=${page}&size=${size}`,
    )
  },

  subscribeUnread(listener: UnreadListener): () => void {
    unreadListeners.add(listener)
    checkLifecycle()
    void refreshUnreadCount()
    return () => {
      unreadListeners.delete(listener)
      checkLifecycle()
    }
  },

  subscribeSignals(onSignal: SignalListener, onState?: StateListener): () => void {
    signalListeners.add(onSignal)
    if (onState) {
      stateListeners.add(onState)
      onState(connectionState)
    }
    checkLifecycle()
    return () => {
      signalListeners.delete(onSignal)
      if (onState) stateListeners.delete(onState)
      checkLifecycle()
    }
  },

  disconnect(): void {
    teardownRealtime()
  },

  resetForTests(): void {
    unreadListeners.clear()
    signalListeners.clear()
    stateListeners.clear()
    teardownRealtime()
  },
}
