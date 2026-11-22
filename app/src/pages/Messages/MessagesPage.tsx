import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  Ban,
  Flag,
  Lock,
  MessageCircle,
  MoreVertical,
  RefreshCw,
  Send,
  ShieldAlert,
  Unlock,
} from 'lucide-react'
import { cn } from 'cn'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '../../components/EmptyState'
import { MarkdownContent } from '../../components/MarkdownContent'
import { UserAvatar } from '../../components/UserAvatar'
import { REPORT_REASONS, reportReasonLabel } from '../../data/forumI18n'
import { messagingErrorText, messagingText } from '../../data/messagingI18n'
import { validateReportInput } from '../../services/forumService'
import {
  canSendInConversation,
  MESSAGE_MAX_LENGTH,
  mergeMessagesBySeq,
  messagingService,
  refreshUnreadCount,
  validateMessageContent,
  type ConnectionState,
  type RealtimeSignal,
} from '../../services/messagingService'
import type { ReportReason } from '../../types/forum'
import type {
  ConversationDetail,
  ConversationMessage,
  ConversationRole,
  ConversationSummary,
} from '../../types/messaging'
import type { Language } from '../../types/preferences'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const FIVE_MINUTES_MS = 5 * 60 * 1000

export type PendingMessage = {
  clientId: string
  content: string
  /** Highest seq known when it was sent: the stored copy can only come after it. */
  afterSeq: number
  createdAt: string
  status: 'sending' | 'failed'
  errorText?: string
}

/**
 * Pending items whose stored copy is not loaded yet. The message DTO has no clientId, so a stored copy is my own
 * message after the send point with the same content, matched one-to-one (two identical sends stay two).
 */
export function reconcilePending(
  pending: PendingMessage[],
  messages: ConversationMessage[],
  confirmed: ReadonlySet<number> = new Set(),
): PendingMessage[] {
  // Seqs a POST response already confirmed belong to that message, never to another pending one.
  const used = new Set<number>(confirmed)
  return pending.filter(p => {
    const match = messages.find(m => m.mine && m.content === p.content && m.seq > p.afterSeq && !used.has(m.seq))
    if (!match) return true
    used.add(match.seq)
    return false
  })
}

function makeClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Other participant's role in the conversation (server `role` is the caller's own role). */
function otherParticipantRoleLabel(myRole: ConversationRole, language: Language): string {
  const t = messagingText(language)
  return myRole === 'LEARNER' ? t('roleAuthor') : t('roleLearner')
}

function formatCompactTime(iso: string | null, language: Language): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  const locale = language === 'vi' ? 'vi-VN' : 'en-US'
  if (sameDay) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
}

function formatMessageTime(iso: string, language: Language): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const locale = language === 'vi' ? 'vi-VN' : 'en-US'
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

function formatDayDivider(iso: string, language: Language): string {
  const t = messagingText(language)
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const diffDays = Math.round((startOfToday - startOfMsg) / 86_400_000)
  if (diffDays === 0) return t('today')
  if (diffDays === 1) return t('yesterday')
  const locale = language === 'vi' ? 'vi-VN' : 'en-US'
  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export type ThreadViewerMode = {
  /** ID of the other participant (or left participant in moderator read-only view). */
  otherUserId: string
  participantsById?: Record<string, string>
}

/** Shared message stream component used by both `/messages/:id` and Moderator report message viewer (Task 2b). */
export function ConversationMessageThread({
  language = 'vi',
  messages,
  pendingMessages = [],
  hasMoreOlder,
  loadingOlder,
  onLoadOlder,
  onRetryPending,
  viewer,
  scrollSignal = 0,
}: {
  language?: Language
  messages: ConversationMessage[]
  pendingMessages?: PendingMessage[]
  hasMoreOlder: boolean
  loadingOlder: boolean
  onLoadOlder: () => void
  onRetryPending?: (item: PendingMessage) => void
  viewer: ThreadViewerMode
  scrollSignal?: number
}) {
  const t = messagingText(language)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const isAtBottomRef = useRef(true)
  const [showNewPill, setShowNewPill] = useState(false)
  const prevLastSeqRef = useRef<number>(0)

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    isAtBottomRef.current = true
    setShowNewPill(false)
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [scrollSignal, scrollToBottom])

  useEffect(() => {
    const lastMsg = messages[messages.length - 1]
    const lastSeq = lastMsg?.seq ?? 0
    if (lastSeq > prevLastSeqRef.current) {
      const fromOther = !lastMsg?.mine && lastMsg?.senderId === viewer.otherUserId
      if (isAtBottomRef.current || !fromOther || prevLastSeqRef.current === 0) {
        scrollToBottom()
      } else {
        setShowNewPill(true)
      }
    }
    prevLastSeqRef.current = lastSeq
  }, [messages, scrollToBottom, viewer.otherUserId])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = dist <= 72
    isAtBottomRef.current = atBottom
    if (atBottom && showNewPill) setShowNewPill(false)
  }

  const handleLoadOlderClick = () => {
    const el = containerRef.current
    const prevHeight = el?.scrollHeight ?? 0
    const prevTop = el?.scrollTop ?? 0
    onLoadOlder()
    requestAnimationFrame(() => {
      if (el && prevHeight > 0) {
        const diff = el.scrollHeight - prevHeight
        if (diff > 0) el.scrollTop = prevTop + diff
      }
    })
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-4 sm:px-6"
      >
        {hasMoreOlder && (
          <div className="mb-2 flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingOlder}
              onClick={handleLoadOlderClick}
              className={cn('rounded-full text-xs', touch)}
            >
              <RefreshCw className={cn('size-3.5', loadingOlder && 'animate-spin')} aria-hidden />
              {t('loadOlder')}
            </Button>
          </div>
        )}

        {messages.length === 0 && pendingMessages.length === 0 ? (
          <div className="my-auto flex flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground">
            <MessageCircle className="mb-2 size-8 text-muted-foreground/60" aria-hidden />
            <p>{t('emptyMessages')}</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const prev = idx > 0 ? messages[idx - 1] : null
            const next = idx < messages.length - 1 ? messages[idx + 1] : null
            const showDateDivider = !prev || dayKey(prev.createdAt) !== dayKey(msg.createdAt)
            const groupedWithPrev =
              !showDateDivider &&
              prev !== null &&
              prev.senderId === msg.senderId &&
              Math.abs(new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime()) < FIVE_MINUTES_MS
            const groupedWithNext =
              next !== null &&
              dayKey(next.createdAt) === dayKey(msg.createdAt) &&
              next.senderId === msg.senderId &&
              Math.abs(new Date(next.createdAt).getTime() - new Date(msg.createdAt).getTime()) < FIVE_MINUTES_MS

            const isMine = msg.mine || (msg.senderId !== viewer.otherUserId && !viewer.participantsById)
            const senderLabel = viewer.participantsById?.[msg.senderId]

            return (
              <div key={msg.id || `seq-${msg.seq}`} className="flex flex-col">
                {showDateDivider && (
                  <div className="my-3 flex items-center justify-center">
                    <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {formatDayDivider(msg.createdAt, language)}
                    </span>
                  </div>
                )}

                <div
                  className={cn(
                    'flex max-w-[85%] flex-col sm:max-w-[70%]',
                    isMine ? 'self-end items-end' : 'self-start items-start',
                    groupedWithPrev ? 'mt-0.5' : 'mt-2',
                  )}
                >
                  {senderLabel && !groupedWithPrev && (
                    <span className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">
                      {senderLabel}
                    </span>
                  )}
                  <div
                    className={cn(
                      'max-w-full overflow-x-auto rounded-2xl border px-3.5 py-2.5 text-sm leading-relaxed shadow-2xs',
                      isMine
                        ? 'rounded-br-sm border-primary/40 bg-primary/15 text-foreground'
                        : 'rounded-bl-sm border-border bg-card text-foreground',
                    )}
                  >
                    <MarkdownContent content={msg.content} language={language} imageAllowed={() => false} />
                  </div>
                  {!groupedWithNext && (
                    <time
                      dateTime={msg.createdAt}
                      className="mt-1 px-1 text-[11px] text-muted-foreground"
                    >
                      {formatMessageTime(msg.createdAt, language)}
                    </time>
                  )}
                </div>
              </div>
            )
          })
        )}

        {pendingMessages.map(item => (
          <div
            key={item.clientId}
            className="mt-2 flex max-w-[85%] flex-col items-end self-end sm:max-w-[70%]"
          >
            <div
              className={cn(
                'max-w-full overflow-x-auto rounded-2xl rounded-br-sm border px-3.5 py-2.5 text-sm leading-relaxed',
                item.status === 'failed'
                  ? 'border-danger/60 bg-tone-rose-bg/40 text-foreground'
                  : 'border-primary/30 bg-primary/10 text-foreground opacity-75',
              )}
            >
              <MarkdownContent content={item.content} language={language} imageAllowed={() => false} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 px-1 text-xs">
              {item.status === 'sending' ? (
                <span className="text-muted-foreground">{t('sending')}</span>
              ) : (
                <>
                  <span className="font-medium text-danger">{t('sendFailed')}</span>
                  {item.errorText && <span className="text-danger">· {item.errorText}</span>}
                  {onRetryPending && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onRetryPending(item)}
                      className={cn('h-7 px-2.5 text-xs', touch)}
                    >
                      <RefreshCw className="size-3" aria-hidden />
                      {t('resend')}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {showNewPill && (
        <div className="pointer-events-none absolute right-4 bottom-3 flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={scrollToBottom}
            className={cn('pointer-events-auto rounded-full shadow-md', touch)}
          >
            <ArrowDown className="size-3.5" aria-hidden />
            {t('newMessagesBelow')}
          </Button>
        </div>
      )}
    </div>
  )
}

export function MessagesPage({ language = 'vi' }: { language?: Language }) {
  const t = messagingText(language)
  const { id: activeId } = useParams<{ id?: string }>()

  // Left pane: conversation list state
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [listPage, setListPage] = useState(0)
  const [listHasNext, setListHasNext] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [listLoadingMore, setListLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected')
  const listReqIdRef = useRef(0)
  const listPollInFlightRef = useRef(false)

  // Right pane: active conversation state
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [pendingByConv, setPendingByConv] = useState<Record<string, PendingMessage[]>>({})
  const [draft, setDraft] = useState('')
  const [composerError, setComposerError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [scrollSignal, setScrollSignal] = useState(0)

  // Dialogs & Popover state
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false)
  const [blockPending, setBlockPending] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState<ReportReason>('SPAM')
  const [reportDesc, setReportDesc] = useState('')
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportNotice, setReportNotice] = useState<string | null>(null)

  // Concurrency & contiguous sequence refs
  const activeIdRef = useRef<string | undefined>(activeId)
  activeIdRef.current = activeId
  const detailReqIdRef = useRef(0)
  const openReqIdRef = useRef(0)
  const contiguousSeqRef = useRef(0)
  const lastMarkedReadSeqRef = useRef(0)
  const initialLoadedConvRef = useRef<string | null>(null)
  const catchupInFlightRef = useRef(false)
  /** A signal arrived while a load was running: fetch again once it ends, or the newer message is missed. */
  const catchupAgainRef = useRef(false)
  const catchUpRef = useRef<(convId: string) => Promise<void>>(async () => {})
  const markReadRef = useRef<(convId: string, seq: number) => Promise<void>>(async () => {})
  // Failed catch-ups and mark-reads retry on their own (2 → 30 s): with a live socket there is no polling to cover them.
  const catchupRetry = useRef<{ timer: ReturnType<typeof setTimeout> | null; delay: number }>({ timer: null, delay: 2000 })
  const markReadRetry = useRef<{ timer: ReturnType<typeof setTimeout> | null; delay: number }>({ timer: null, delay: 2000 })
  /** Per conversation: seqs confirmed by POST responses (see `reconcilePending`). */
  const confirmedSeqsRef = useRef<Record<string, Set<number>>>({})

  const loadConversationList = useCallback(
    async (page = 0, append = false) => {
      const reqId = ++listReqIdRef.current
      if (append) setListLoadingMore(true)
      else if (conversations.length === 0) setListLoading(true)
      setListError(null)
      try {
        const res = await messagingService.listConversations(page, 20)
        if (reqId !== listReqIdRef.current) return
        setConversations(prev => {
          if (!append) return res.content
          const seen = new Set(prev.map(item => item.id))
          return [...prev, ...res.content.filter(item => !seen.has(item.id))]
        })
        setListPage(res.page)
        setListHasNext(res.hasNext)
      } catch (e) {
        if (reqId === listReqIdRef.current && !append) {
          setListError(messagingErrorText(e, language))
        }
      } finally {
        if (reqId === listReqIdRef.current) {
          setListLoading(false)
          setListLoadingMore(false)
        }
      }
    },
    [conversations.length, language],
  )

  const loadDetailOnly = useCallback(
    async (convId: string) => {
      const reqId = ++detailReqIdRef.current
      try {
        const nextDetail = await messagingService.detail(convId)
        if (reqId !== detailReqIdRef.current || activeIdRef.current !== convId) return
        setDetail({ ...nextDetail, unread: false })
        setDetailLoading(false)
      } catch (e) {
        if (reqId === detailReqIdRef.current && activeIdRef.current === convId) {
          setDetailError(messagingErrorText(e, language))
          setDetailLoading(false)
        }
      }
    },
    [language],
  )

  const markReadIfNeeded = useCallback(async (convId: string, seq: number) => {
    if (seq <= 0 || seq <= lastMarkedReadSeqRef.current) return
    lastMarkedReadSeqRef.current = seq
    try {
      await messagingService.markRead(convId, seq)
      markReadRetry.current.delay = 2000
      setConversations(prev =>
        prev.map(item => (item.id === convId ? { ...item, unread: false } : item)),
      )
      void refreshUnreadCount()
    } catch {
      if (lastMarkedReadSeqRef.current === seq) lastMarkedReadSeqRef.current = 0
      const retry = markReadRetry.current
      if (!retry.timer) {
        retry.timer = setTimeout(() => {
          retry.timer = null
          if (activeIdRef.current === convId) void markReadRef.current(convId, Math.max(seq, contiguousSeqRef.current))
        }, retry.delay)
        retry.delay = Math.min(30000, retry.delay * 2)
      }
    }
  }, [])
  markReadRef.current = markReadIfNeeded

  const catchUpActiveMessages = useCallback(
    async (convId: string) => {
      if (catchupInFlightRef.current || initialLoadedConvRef.current !== convId) {
        catchupAgainRef.current = true
        return
      }
      catchupInFlightRef.current = true
      let failed = false
      try {
        do {
          catchupAgainRef.current = false
          const fetched = await messagingService.fetchAllAfterSeq(convId, contiguousSeqRef.current, 30)
          if (activeIdRef.current !== convId) return
          if (fetched.length > 0) {
            setMessages(prev => mergeMessagesBySeq(prev, fetched))
            const maxSeq = fetched[fetched.length - 1].seq
            if (maxSeq > contiguousSeqRef.current) contiguousSeqRef.current = maxSeq
          }
          // Also when nothing is new: retries a mark-read that failed earlier.
          await markReadIfNeeded(convId, contiguousSeqRef.current)
        } while (catchupAgainRef.current)
        catchupRetry.current.delay = 2000
      } catch {
        failed = true
        catchupAgainRef.current = true
      } finally {
        catchupInFlightRef.current = false
        const current = activeIdRef.current
        if (catchupAgainRef.current && current) {
          const retry = catchupRetry.current
          if (failed) {
            if (!retry.timer) {
              retry.timer = setTimeout(() => {
                retry.timer = null
                if (activeIdRef.current) void catchUpRef.current(activeIdRef.current)
              }, retry.delay)
              retry.delay = Math.min(30000, retry.delay * 2)
            }
          } else if (current !== convId) {
            // The user switched while this ran: serve the request queued for the open conversation.
            void catchUpRef.current(current)
          }
        }
      }
    },
    [markReadIfNeeded],
  )
  catchUpRef.current = catchUpActiveMessages

  useEffect(() => () => {
    if (catchupRetry.current.timer) clearTimeout(catchupRetry.current.timer)
    if (markReadRetry.current.timer) clearTimeout(markReadRetry.current.timer)
  }, [])

  // Initial list load
  useEffect(() => {
    void loadConversationList(0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  // Load active conversation detail + latest messages when `activeId` changes
  useEffect(() => {
    setComposerError(null)
    setActionError(null)
    setReportNotice(null)
    if (!activeId) {
      detailReqIdRef.current++
      openReqIdRef.current++
      initialLoadedConvRef.current = null
      setDetail(null)
      setMessages([])
      setHasMoreOlder(false)
      setDetailError(null)
      setDetailLoading(false)
      return
    }

    const convId = activeId
    const openReq = ++openReqIdRef.current
    initialLoadedConvRef.current = null
    catchupAgainRef.current = false
    contiguousSeqRef.current = 0
    lastMarkedReadSeqRef.current = 0
    setDetail(null)
    setMessages([])
    setDetailLoading(true)
    setDetailError(null)

    void loadDetailOnly(convId)

    void (async () => {
      try {
        const msgPage = await messagingService.messages(convId, { size: 30 })
        if (openReq !== openReqIdRef.current || activeIdRef.current !== convId) return
        const sorted = mergeMessagesBySeq([], msgPage.messages)
        setMessages(sorted)
        setHasMoreOlder(msgPage.hasMore)
        const maxSeq = sorted.length > 0 ? sorted[sorted.length - 1].seq : 0
        contiguousSeqRef.current = maxSeq
        initialLoadedConvRef.current = convId
        setScrollSignal(s => s + 1)
        setConversations(prev =>
          prev.map(item => (item.id === convId ? { ...item, unread: false } : item)),
        )
        if (maxSeq > 0) {
          await markReadIfNeeded(convId, maxSeq)
        }
        if (catchupAgainRef.current) void catchUpActiveMessages(convId)
      } catch (e) {
        if (openReq === openReqIdRef.current && activeIdRef.current === convId) {
          setDetailError(messagingErrorText(e, language))
          setDetailLoading(false)
        }
      }
    })()
  }, [activeId, language, loadDetailOnly, markReadIfNeeded, catchUpActiveMessages])

  // Subscribe to WebSocket / fallback polling signals
  useEffect(() => {
    const handleSignal = (signal: RealtimeSignal) => {
      const currId = activeIdRef.current
      if (signal.type === 'message') {
        if (currId && signal.conversationId === currId) {
          void catchUpActiveMessages(currId)
          void loadDetailOnly(currId)
        }
        void loadConversationList(0, false)
      } else if (signal.type === 'state') {
        if (currId && signal.conversationId === currId) {
          void loadDetailOnly(currId)
        }
        void loadConversationList(0, false)
      } else if (signal.type === 'catchup') {
        if (currId) {
          void catchUpActiveMessages(currId)
          void loadDetailOnly(currId)
        }
        void loadConversationList(0, false)
      } else if (signal.type === 'poll-active') {
        if (currId && initialLoadedConvRef.current === currId) {
          void catchUpActiveMessages(currId)
          void loadDetailOnly(currId)
        }
      } else if (signal.type === 'poll-list') {
        if (!listPollInFlightRef.current) {
          listPollInFlightRef.current = true
          void loadConversationList(0, false).finally(() => {
            listPollInFlightRef.current = false
          })
        }
      }
    }

    return messagingService.subscribeSignals(handleSignal, setConnectionState)
  }, [catchUpActiveMessages, loadConversationList, loadDetailOnly])

  const handleLoadOlder = async () => {
    if (!activeId || loadingOlder || !hasMoreOlder || messages.length === 0) return
    const oldestSeq = messages[0].seq
    const convId = activeId
    setLoadingOlder(true)
    try {
      const page = await messagingService.messages(convId, { beforeSeq: oldestSeq, size: 30 })
      if (activeIdRef.current !== convId) return
      setMessages(prev => mergeMessagesBySeq(page.messages, prev))
      setHasMoreOlder(page.hasMore)
    } catch (e) {
      if (activeIdRef.current === convId) setActionError(messagingErrorText(e, language))
    } finally {
      if (activeIdRef.current === convId) setLoadingOlder(false)
    }
  }

  const executeSend = async (convId: string, item: PendingMessage) => {
    setPendingByConv(prev => {
      const list = prev[convId] ?? []
      const exists = list.some(p => p.clientId === item.clientId)
      const nextList = exists
        ? list.map(p => (p.clientId === item.clientId ? { ...p, status: 'sending' as const, errorText: undefined } : p))
        : [...list, item]
      return { ...prev, [convId]: nextList }
    })

    try {
      const saved = await messagingService.sendMessage(convId, {
        content: item.content,
        clientId: item.clientId,
      })
      ;(confirmedSeqsRef.current[convId] ??= new Set()).add(saved.seq)
      setPendingByConv(prev => ({
        ...prev,
        [convId]: (prev[convId] ?? []).filter(p => p.clientId !== item.clientId),
      }))
      if (activeIdRef.current === convId) {
        setMessages(prev => mergeMessagesBySeq(prev, [saved]))
        setScrollSignal(s => s + 1)
        void loadDetailOnly(convId)
      }
      void loadConversationList(0, false)
    } catch (e) {
      const errText = messagingErrorText(e, language)
      setPendingByConv(prev => ({
        ...prev,
        [convId]: (prev[convId] ?? []).map(p =>
          p.clientId === item.clientId ? { ...p, status: 'failed' as const, errorText: errText } : p,
        ),
      }))
    }
  }

  const handleComposerSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!activeId || !canSendInConversation(detail)) return
    const check = validateMessageContent(draft)
    if (check === 'messageLength') {
      setComposerError(t('contentLengthError'))
      return
    }
    if (check === 'contentInvalid') {
      setComposerError(messagingErrorText({ code: 'MESSAGE_CONTENT_INVALID' }, language, t('contentLengthError')))
      return
    }
    const content = draft.trim()
    setDraft('')
    setComposerError(null)
    const pending: PendingMessage = {
      clientId: makeClientId(),
      content,
      afterSeq: messages.length > 0 ? messages[messages.length - 1].seq : 0,
      createdAt: new Date().toISOString(),
      status: 'sending',
    }
    void executeSend(activeId, pending)
  }

  const handleSetBlocked = async (blocked: boolean) => {
    if (!activeId || blockPending) return
    const convId = activeId
    setBlockPending(true)
    setActionError(null)
    try {
      const updated = await messagingService.setBlocked(convId, blocked)
      if (activeIdRef.current === convId) {
        setDetail(updated)
      }
      setConfirmBlockOpen(false)
      void loadConversationList(0, false)
    } catch (e) {
      if (activeIdRef.current === convId) {
        setActionError(messagingErrorText(e, language))
      }
      setConfirmBlockOpen(false)
    } finally {
      setBlockPending(false)
    }
  }

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeId || reportSubmitting) return
    const trimmedDesc = reportDesc.trim()
    // Same rules as forum reports: OTHER needs 10–1,000 characters, any description at most 1,000.
    if (Object.keys(validateReportInput(reportReason, reportDesc)).length > 0) {
      setReportError(t('reportOtherRequired'))
      return
    }
    const convId = activeId
    setReportSubmitting(true)
    setReportError(null)
    try {
      await messagingService.reportConversation(convId, reportReason, trimmedDesc)
      setReportOpen(false)
      setReportDesc('')
      setReportReason('SPAM')
      setReportNotice(t('reportSubmitted'))
    } catch (err) {
      setReportError(messagingErrorText(err, language))
    } finally {
      setReportSubmitting(false)
    }
  }

  const unreadCountInList = conversations.filter(c => c.unread).length
  const activePending = activeId
    ? reconcilePending(pendingByConv[activeId] ?? [], messages, confirmedSeqsRef.current[activeId])
    : []
  const trimmedDraftLength = draft.trim().length
  const canSendNow = canSendInConversation(detail)

  return (
    <main className="tw-page flex h-[calc(100dvh-4rem)] w-full md:h-dvh overflow-hidden bg-background">
      {/* Left column: Conversation list */}
      <section
        aria-label={t('title')}
        className={cn(
          'flex h-full w-full flex-col border-r border-border bg-card/40 lg:w-80 lg:shrink-0',
          activeId ? 'hidden lg:flex' : 'flex',
        )}
      >
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-foreground">{t('title')}</h1>
            {unreadCountInList > 0 && (
              <Badge tone="blue" className="rounded-full px-2 py-0.5 text-xs font-semibold">
                {unreadCountInList > 99 ? '99+' : unreadCountInList}
              </Badge>
            )}
          </div>
          {connectionState === 'reconnecting' && (
            <span aria-live="polite" className="text-xs font-medium text-muted-foreground">
              {t('reconnecting')}
            </span>
          )}
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {listLoading ? (
            <div role="status" aria-label={t('loading')} className="flex flex-col gap-2 p-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : listError ? (
            <div role="alert" className="m-3 flex flex-col gap-2 rounded-xl border border-border bg-tone-rose-bg p-3 text-xs text-danger">
              <span>{listError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadConversationList(0, false)}
                className={cn('self-start', touch)}
              >
                <RefreshCw className="size-3.5" aria-hidden />
                {t('retry')}
              </Button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="my-auto p-4">
              <EmptyState
                icon={MessageCircle}
                title={t('emptyConversations')}
                action={
                  <Button asChild variant="outline" size="sm" className={touch}>
                    <Link to="/courses">{t('browseCourses')}</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {conversations.map(item => {
                const isSelected = item.id === activeId
                const otherRole = otherParticipantRoleLabel(item.role, language)
                return (
                  <li key={item.id}>
                    <Link
                      to={`/messages/${item.id}`}
                      aria-current={isSelected ? 'page' : undefined}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring',
                        touch,
                        isSelected && 'bg-sidebar-accent',
                      )}
                    >
                      <UserAvatar
                        name={item.other.fullName}
                        url={item.other.avatarUrl}
                        className="mt-0.5 size-10 shrink-0 text-xs"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'truncate text-sm text-foreground',
                              item.unread ? 'font-bold' : 'font-medium',
                            )}
                          >
                            {item.other.fullName}
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {item.lastMessageAt && (
                              <time
                                dateTime={item.lastMessageAt}
                                className="text-[11px] text-muted-foreground"
                              >
                                {formatCompactTime(item.lastMessageAt, language)}
                              </time>
                            )}
                            {item.unread && (
                              <span
                                aria-label={t('unreadDot')}
                                className="size-2.5 shrink-0 rounded-full bg-primary"
                              />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="shrink-0 whitespace-nowrap">{otherRole}</span>
                          <span className="shrink-0">·</span>
                          <span className="min-w-0 truncate">{item.contextCourse.title}</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p
                            className={cn(
                              'truncate text-xs',
                              item.unread ? 'font-medium text-foreground' : 'text-muted-foreground',
                            )}
                          >
                            {item.lastMessageExcerpt ?? t('emptyMessages')}
                          </p>
                          {item.locked ? (
                            <Lock
                              className="size-3.5 shrink-0 text-muted-foreground"
                              aria-label={t('lockedByMod')}
                            />
                          ) : item.blockedByMe || item.blockedByOther ? (
                            <Ban
                              className="size-3.5 shrink-0 text-muted-foreground"
                              aria-label={item.blockedByMe ? t('blockedByMe') : t('blockedByOther')}
                            />
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          {listHasNext && (
            <div className="p-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={listLoadingMore}
                onClick={() => void loadConversationList(listPage + 1, true)}
                className={cn('w-full', touch)}
              >
                {t('loadMoreConversations')}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Right column: Active conversation */}
      <section
        className={cn(
          'flex h-full min-w-0 flex-1 flex-col bg-background',
          activeId ? 'flex' : 'hidden lg:flex',
        )}
      >
        {!activeId ? (
          <div className="m-auto max-w-md p-6">
            <EmptyState icon={MessageCircle} title={t('selectConversation')} />
          </div>
        ) : detailLoading && !detail ? (
          <div role="status" aria-label={t('loading')} className="flex flex-1 flex-col gap-4 p-6">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-24 w-2/3 rounded-2xl" />
            <Skeleton className="h-24 w-1/2 self-end rounded-2xl" />
          </div>
        ) : detailError && !detail ? (
          <div className="m-auto flex max-w-md flex-col items-center gap-3 p-6 text-center">
            <p role="alert" className="text-sm text-danger">{detailError}</p>
            <Button asChild variant="outline" size="sm" className={touch}>
              <Link to="/messages">{t('backToList')}</Link>
            </Button>
          </div>
        ) : detail ? (
          <>
            {/* Conversation Header (2 compact lines) */}
            <header className="flex flex-col gap-1.5 border-b border-border bg-card/60 px-4 py-3 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className={cn('shrink-0 lg:hidden', touch)}
                  >
                    <Link to="/messages" aria-label={t('backToList')}>
                      <ArrowLeft className="size-4" />
                    </Link>
                  </Button>
                  <UserAvatar
                    name={detail.other.fullName}
                    url={detail.other.avatarUrl}
                    className="size-9 shrink-0 text-xs"
                  />
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-sm font-bold text-foreground sm:text-base">
                      {detail.other.fullName}
                    </h2>
                    <Badge tone="slate" className="shrink-0 text-[11px]">
                      {otherParticipantRoleLabel(detail.role, language)}
                    </Badge>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {connectionState === 'reconnecting' && (
                    <span
                      aria-live="polite"
                      className="hidden text-xs font-medium text-muted-foreground sm:inline"
                    >
                      {t('reconnecting')}
                    </span>
                  )}
                  <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t('moreActions')}
                        className={touch}
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="flex w-48 flex-col gap-1 p-1.5">
                      {!detail.blockedByOther &&
                        (detail.blockedByMe ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={blockPending}
                            onClick={() => {
                              setMenuOpen(false)
                              void handleSetBlocked(false)
                            }}
                            className={cn('justify-start gap-2', touch)}
                          >
                            <Unlock className="size-4" aria-hidden />
                            {t('unblock')}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setMenuOpen(false)
                              setConfirmBlockOpen(true)
                            }}
                            className={cn('justify-start gap-2', touch)}
                          >
                            <Ban className="size-4" aria-hidden />
                            {t('block')}
                          </Button>
                        ))}
                      {!detail.locked && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setMenuOpen(false)
                            setReportError(null)
                            setReportOpen(true)
                          }}
                          className={cn('justify-start gap-2', touch)}
                        >
                          <Flag className="size-4" aria-hidden />
                          {t('report')}
                        </Button>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Line 2: Context course & enrollment status */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{t('aboutCoursePrefix')}</span>
                {detail.contextCourse.available && detail.contextCourse.id ? (
                  <Link
                    to={`/courses/${detail.contextCourse.id}`}
                    className="font-medium text-accent-text hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
                  >
                    {detail.contextCourse.title}
                  </Link>
                ) : (
                  <span className="font-medium text-muted-foreground">
                    {detail.contextCourse.title}
                  </span>
                )}
                {detail.contextEnrolled !== null && (
                  <Badge tone={detail.contextEnrolled ? 'green' : 'slate'} className="ml-0.5 text-[11px]">
                    {detail.contextEnrolled ? t('enrolled') : t('notEnrolled')}
                  </Badge>
                )}
              </div>
            </header>

            {actionError && (
              <div
                role="alert"
                className="border-b border-border bg-tone-rose-bg px-4 py-2 text-xs text-danger sm:px-6"
              >
                {actionError}
              </div>
            )}
            {reportNotice && (
              <div
                role="status"
                className="border-b border-border bg-tone-green-bg px-4 py-2 text-xs font-medium text-foreground sm:px-6"
              >
                {reportNotice}
              </div>
            )}

            {/* Message Thread */}
            <ConversationMessageThread
              language={language}
              messages={messages}
              pendingMessages={activePending}
              hasMoreOlder={hasMoreOlder}
              loadingOlder={loadingOlder}
              onLoadOlder={() => void handleLoadOlder()}
              onRetryPending={(item: PendingMessage) => void executeSend(detail.id, item)}
              viewer={{ otherUserId: detail.other.id }}
              scrollSignal={scrollSignal}
            />

            {/* Bottom status bar or Composer */}
            <footer className="border-t border-border bg-card/60 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
              {detail.locked ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Lock className="size-4 shrink-0" aria-hidden />
                  <span>{t('lockedByMod')}</span>
                </div>
              ) : detail.blockedByMe ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Ban className="size-4 shrink-0" aria-hidden />
                    {t('blockedByMe')}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={blockPending}
                    onClick={() => void handleSetBlocked(false)}
                    className={touch}
                  >
                    <Unlock className="size-3.5" aria-hidden />
                    {t('unblock')}
                  </Button>
                </div>
              ) : detail.blockedByOther ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Ban className="size-4 shrink-0" aria-hidden />
                  <span>{t('blockedByOther')}</span>
                </div>
              ) : !canSendNow ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
                  <AlertCircle className="size-4 shrink-0" aria-hidden />
                  <span>{t('awaitingReply')}</span>
                </div>
              ) : (
                <form onSubmit={handleComposerSubmit} className="flex flex-col gap-2">
                  {detail.remainingBeforeReply !== null && detail.remainingBeforeReply > 0 && (
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('remainingBeforeReply', { n: detail.remainingBeforeReply })}
                    </p>
                  )}
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={draft}
                      onChange={e => {
                        setDraft(e.target.value)
                        if (composerError) setComposerError(null)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          if (trimmedDraftLength >= 1 && trimmedDraftLength <= MESSAGE_MAX_LENGTH) {
                            handleComposerSubmit()
                          }
                        }
                      }}
                      placeholder={t('inputPlaceholder')}
                      rows={Math.min(6, Math.max(1, draft.split('\n').length))}
                      className="max-h-36 min-h-11 flex-1 resize-none text-sm"
                    />
                    <Button
                      type="submit"
                      disabled={trimmedDraftLength === 0 || trimmedDraftLength > MESSAGE_MAX_LENGTH}
                      className={cn('shrink-0', touch)}
                    >
                      <Send className="size-4" aria-hidden />
                      <span>{t('send')}</span>
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="hidden text-muted-foreground pointer-fine:inline">
                      {t('enterHint')}
                    </span>
                    <span
                      className={cn(
                        'ml-auto tabular-nums',
                        trimmedDraftLength > MESSAGE_MAX_LENGTH
                          ? 'font-semibold text-danger'
                          : trimmedDraftLength > 1800
                            ? 'text-accent-text'
                            : 'text-muted-foreground',
                      )}
                    >
                      {trimmedDraftLength}/{MESSAGE_MAX_LENGTH}
                    </span>
                  </div>
                  {(composerError || trimmedDraftLength > MESSAGE_MAX_LENGTH) && (
                    <p role="alert" className="text-xs text-danger">
                      {composerError ?? t('contentLengthError')}
                    </p>
                  )}
                </form>
              )}
            </footer>
          </>
        ) : null}
      </section>

      {/* Confirm Block AlertDialog */}
      <AlertDialog open={confirmBlockOpen} onOpenChange={setConfirmBlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('block')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmBlock')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={touch}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={blockPending}
              onClick={e => {
                e.preventDefault()
                void handleSetBlocked(true)
              }}
              className={touch}
            >
              {t('block')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Conversation Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reportTitle')}</DialogTitle>
            <DialogDescription className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-xs text-foreground">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
              <span>{t('reportPrivacyNotice')}</span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={e => void handleReportSubmit(e)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="conv-report-reason" className="text-xs font-semibold text-foreground">
                {t('reportReasonLabel')}
              </label>
              <NativeSelect
                id="conv-report-reason"
                value={reportReason}
                onChange={e => setReportReason(e.target.value as ReportReason)}
                className={touch}
              >
                {REPORT_REASONS.map(reason => (
                  <option key={reason} value={reason}>{reportReasonLabel[reason][language]}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="conv-report-desc" className="text-xs font-semibold text-foreground">
                {t('reportDescriptionLabel')}
              </label>
              <Textarea
                id="conv-report-desc"
                value={reportDesc}
                onChange={e => {
                  setReportDesc(e.target.value)
                  if (reportError) setReportError(null)
                }}
                rows={3}
                maxLength={1000}
              />
            </div>
            {reportError && (
              <p role="alert" className="text-xs text-danger">
                {reportError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReportOpen(false)}
                className={touch}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={reportSubmitting} className={touch}>
                {t('reportSubmit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}
