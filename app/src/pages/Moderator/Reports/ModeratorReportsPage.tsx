import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  Ban,
  Check,
  ExternalLink,
  EyeOff,
  Inbox,
  Lock,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Unlock,
} from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '../../../components/EmptyState'
import { MarkdownContent } from '../../../components/MarkdownContent'
import { Pagination } from '../../../components/Pagination'
import { UserAvatar } from '../../../components/UserAvatar'
import { fieldLabel, formatDate } from '../../Author/AuthorBlogsPage'
import { ConversationMessageThread } from '../../Messages/MessagesPage'
import {
  REPORT_REASONS,
  forumErrorText,
  isReportAlreadyHandled,
  moderatorReportText,
  reportReasonLabel,
  reportStatusLabel,
} from '../../../data/forumI18n'
import { messagingErrorText } from '../../../data/messagingI18n'
import { ApiError } from '../../../services/api/client'
import {
  moderatorReportService,
  moderatorReportsFilter,
  moderatorReportsSearch,
  validateModerationNote,
} from '../../../services/forumService'
import { mergeMessagesBySeq, messagingService } from '../../../services/messagingService'
import type { Page } from '../../../types/articles'
import type {
  ModeratedConversation,
  ModeratedForumPost,
  ModeratorReportItem,
  ModeratorReportsFilter,
  ModeratorReportsTab,
  ReportReason,
  ReportResolveAction,
  ReportStatus,
  ReportTargetType,
} from '../../../types/forum'
import type { ConversationMessage, LockedConversationItem } from '../../../types/messaging'
import type { Language } from '../../../types/preferences'

const PAGE_SIZE = 20
const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'

const REASON_TONE: Record<ReportReason, BadgeTone> = {
  SPAM: 'amber',
  INAPPROPRIATE: 'rose',
  COPYRIGHT: 'purple',
  MISLEADING: 'sky',
  OTHER: 'slate',
}

const STATUS_TONE: Record<ReportStatus, BadgeTone> = {
  OPEN: 'amber',
  ACTIONED: 'rose',
  DISMISSED: 'slate',
}

function CollapsibleMarkdown({ content, language }: { content: string; language: Language }) {
  const t = moderatorReportText(language)
  const isLong = content.length > 360 || content.split('\n').length > 6
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <div className={!expanded && isLong ? 'max-h-36 overflow-hidden' : ''}>
        <MarkdownContent content={content} language={language} imageAllowed={() => false} />
      </div>
      {isLong && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`self-start text-xs ${touch}`}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? t('collapseContent') : t('expandContent')}
        </Button>
      )}
    </div>
  )
}

type ViewerSheetTarget = {
  conversation: ModeratedConversation
  reportItem?: ModeratorReportItem
  fromLockedList?: boolean
}

export function ModeratorReportsPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = moderatorReportText(language)
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = moderatorReportsFilter(searchParams)
  const targetType: ReportTargetType = filter.targetType ?? 'FORUM_POST'

  const [reportsData, setReportsData] = useState<Page<ModeratorReportItem> | null>(null)
  const [hiddenData, setHiddenData] = useState<Page<ModeratedForumPost> | null>(null)
  const [lockedConversations, setLockedConversations] = useState<ModeratedConversation[]>([])
  const [lockedPage, setLockedPage] = useState(0)
  const [lockedTotalPages, setLockedTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [staleMessage, setStaleMessage] = useState('')
  const [message, setMessage] = useState('')
  const [reloadTick, setReloadTick] = useState(0)
  const latestRequest = useRef(0)
  // Data is shown only for the filter it was loaded for, so a tab switch never shows another tab's rows or actions.
  const filterKey = [filter.tab, targetType, filter.status, filter.reason, filter.page].join('|')
  const [loadedKey, setLoadedKey] = useState('')

  // Modal state for resolving a report, restoring a hidden post, or unlocking a conversation
  const [dialog, setDialog] = useState<
    | { kind: 'resolve'; item: ModeratorReportItem; action: ReportResolveAction }
    | { kind: 'restore'; post: ModeratedForumPost }
    | { kind: 'unlock'; conversation: ModeratedConversation }
    | null
  >(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [busy, setBusy] = useState(false)

  // Read-only conversation message viewer Sheet state
  const [viewerTarget, setViewerTarget] = useState<ViewerSheetTarget | null>(null)
  const [sheetMessages, setSheetMessages] = useState<ConversationMessage[]>([])
  const [sheetHasMore, setSheetHasMore] = useState(false)
  const [sheetLoading, setSheetLoading] = useState(false)
  const [sheetLoadingOlder, setSheetLoadingOlder] = useState(false)
  const [sheetError, setSheetError] = useState('')
  const sheetReqRef = useRef(0)

  const updateFilter = (patch: Partial<ModeratorReportsFilter>) => {
    setMessage('')
    setStaleMessage('')
    setSearchParams(
      moderatorReportsSearch({
        ...filter,
        ...patch,
        page: patch.page ?? 0,
      }),
      { replace: true },
    )
  }

  const load = useCallback(async () => {
    const reqId = ++latestRequest.current
    setLoading(true)
    setError('')
    try {
      if (filter.tab === 'hidden') {
        const [postsResult, lockedResult] = await Promise.all([
          moderatorReportService.listHiddenPosts({ page: filter.page, size: PAGE_SIZE }),
          messagingService.moderatorListLocked(lockedPage, PAGE_SIZE).catch(() => null),
        ])
        if (reqId !== latestRequest.current) return
        const validLocked = (lockedResult?.content ?? []).filter(
          (c): c is LockedConversationItem & ModeratedConversation =>
            Boolean(c && typeof c === 'object' && 'learner' in c && c.learner && 'author' in c && c.author),
        )
        if (postsResult.content.length === 0 && validLocked.length === 0 && filter.page > 0) {
          const targetPage = postsResult.totalPages > 0 ? Math.min(filter.page - 1, postsResult.totalPages - 1) : 0
          setSearchParams(moderatorReportsSearch({ ...filter, page: targetPage }), { replace: true })
          return
        }
        setHiddenData(postsResult)
        setLockedConversations(
          validLocked.map(c => ({
            id: c.id,
            learner: c.learner,
            author: c.author,
            blocked: Boolean(c.blocked),
            locked: c.locked ?? true,
            lockNote: c.lockNote,
            lockedBy: c.lockedBy,
            lockedAt: c.lockedAt,
          })),
        )
        setLockedTotalPages(validLocked.length > 0 ? (lockedResult?.totalPages ?? 1) : 0)
        setReportsData(null)
        setLoadedKey(filterKey)
      } else {
        const status: ReportStatus = filter.tab === 'open' ? 'OPEN' : filter.status
        const result = await moderatorReportService.listReports({
          status,
          targetType,
          reason: filter.reason,
          page: filter.page,
          size: PAGE_SIZE,
        })
        if (reqId !== latestRequest.current) return
        if (result.content.length === 0 && filter.page > 0) {
          const targetPage = result.totalPages > 0 ? Math.min(filter.page - 1, result.totalPages - 1) : 0
          setSearchParams(moderatorReportsSearch({ ...filter, page: targetPage }), { replace: true })
          return
        }
        setReportsData(result)
        setHiddenData(null)
        setLockedConversations([])
        setLoadedKey(filterKey)
      }
    } catch (e) {
      if (reqId === latestRequest.current) {
        // A failed reload must not leave rows (and their actions) from before the last change on screen.
        setLoadedKey('')
        setError(forumErrorText(e, language, 'general', t('loadError')))
      }
    } finally {
      if (reqId === latestRequest.current) {
        setLoading(false)
      }
    }
  }, [filter.tab, targetType, filter.status, filter.reason, filter.page, lockedPage, filterKey, language, setSearchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load()
  }, [load, reloadTick])

  const loadSheetMessages = useCallback(
    async (convId: string) => {
      const reqId = ++sheetReqRef.current
      setSheetLoading(true)
      setSheetError('')
      try {
        const res = await messagingService.moderatorMessages(convId, { size: 30 })
        if (reqId !== sheetReqRef.current) return
        setSheetMessages(mergeMessagesBySeq([], res.messages))
        setSheetHasMore(res.hasMore)
      } catch (e) {
        if (reqId === sheetReqRef.current) {
          setSheetError(messagingErrorText(e, language, t('loadError')))
        }
      } finally {
        if (reqId === sheetReqRef.current) {
          setSheetLoading(false)
        }
      }
    },
    [language, t],
  )

  const openConversationViewer = (target: ViewerSheetTarget) => {
    setViewerTarget(target)
    setSheetMessages([])
    setSheetHasMore(false)
    setSheetError('')
    void loadSheetMessages(target.conversation.id)
  }

  const handleLoadOlderSheetMessages = async () => {
    if (!viewerTarget || sheetLoadingOlder || !sheetHasMore || sheetMessages.length === 0) return
    const convId = viewerTarget.conversation.id
    const oldestSeq = sheetMessages[0].seq
    const reqId = sheetReqRef.current
    setSheetLoadingOlder(true)
    try {
      const res = await messagingService.moderatorMessages(convId, { beforeSeq: oldestSeq, size: 30 })
      if (reqId !== sheetReqRef.current) return
      setSheetMessages(prev => mergeMessagesBySeq(res.messages, prev))
      setSheetHasMore(res.hasMore)
    } catch (e) {
      if (reqId === sheetReqRef.current) {
        setSheetError(messagingErrorText(e, language, t('loadError')))
      }
    } finally {
      if (reqId === sheetReqRef.current) {
        setSheetLoadingOlder(false)
      }
    }
  }

  const openResolve = (item: ModeratorReportItem, action: ReportResolveAction) => {
    setDialog({ kind: 'resolve', item, action })
    setNote('')
    setNoteError(false)
    setDialogError('')
  }

  const openRestore = (post: ModeratedForumPost) => {
    setDialog({ kind: 'restore', post })
    setNote('')
    setNoteError(false)
    setDialogError('')
  }

  const openUnlock = (conversation: ModeratedConversation) => {
    setDialog({ kind: 'unlock', conversation })
    setNote('')
    setNoteError(false)
    setDialogError('')
  }

  const confirmDialog = async () => {
    if (!dialog || busy) return
    const needsNote =
      dialog.kind === 'resolve' &&
      (dialog.action === 'HIDE_CONTENT' || dialog.action === 'LOCK_CONVERSATION')
    if (validateModerationNote(needsNote, note)) {
      setNoteError(true)
      return
    }
    setBusy(true)
    setDialogError('')
    setMessage('')
    try {
      if (dialog.kind === 'resolve') {
        await moderatorReportService.resolveReport(dialog.item.id, {
          action: dialog.action,
          note,
        })
        setMessage(
          t(
            dialog.action === 'HIDE_CONTENT'
              ? 'resolvedHiddenMsg'
              : dialog.action === 'LOCK_CONVERSATION'
                ? 'resolvedLockedMsg'
                : 'resolvedDismissedMsg',
          ),
        )
      } else if (dialog.kind === 'restore') {
        await moderatorReportService.setPostVisibility(dialog.post.id, {
          action: 'RESTORE',
          note,
        })
        setMessage(t('restoredMsg'))
      } else {
        await messagingService.moderatorSetLocked(dialog.conversation.id, false, note)
        setMessage(t('unlockedMsg'))
      }
      setDialog(null)
      setViewerTarget(null)
      setStaleMessage('')
      await load()
    } catch (e) {
      if (isReportAlreadyHandled(e)) {
        setDialog(null)
        setViewerTarget(null)
        setStaleMessage(t('alreadyHandled'))
      } else if (
        e instanceof ApiError &&
        (e.code === 'FORUM_STATE_INVALID' || e.code === 'CONVERSATION_STATE_INVALID')
      ) {
        setDialog(null)
        setViewerTarget(null)
        setStaleMessage(forumErrorText(e, language, 'general', t('loadError')))
        await load()
      } else {
        setDialogError(forumErrorText(e, language, 'general', t('loadError')))
      }
    } finally {
      setBusy(false)
    }
  }

  const tabs: { key: ModeratorReportsTab; label: string }[] = [
    { key: 'open', label: t('tabOpen') },
    { key: 'handled', label: t('tabHandled') },
    { key: 'hidden', label: t('tabHidden') },
  ]

  const reports = reportsData?.content ?? []
  const hiddenPosts = hiddenData?.content ?? []
  const fresh = loadedKey === filterKey
  const totalPages = fresh ? ((filter.tab === 'hidden' ? hiddenData?.totalPages : reportsData?.totalPages) ?? 0) : 0
  const currentPage = (filter.tab === 'hidden' ? hiddenData?.page : reportsData?.page) ?? 0

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-1.5 border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('heading')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card className="gap-4 rounded-xl p-5">
        <div role="tablist" aria-label={t('heading')} className="flex flex-wrap gap-2">
          {tabs.map(tab => (
            <Button
              key={tab.key}
              type="button"
              role="tab"
              size="sm"
              variant={filter.tab === tab.key ? 'default' : 'outline'}
              aria-selected={filter.tab === tab.key}
              className={touch}
              onClick={() => updateFilter({ tab: tab.key })}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {filter.tab !== 'hidden' && (
          <div className="flex flex-wrap items-end gap-4 border-t border-border pt-4">
            <div className="flex flex-col gap-1.5">
              <span className={fieldLabel}>{t('targetTypeFilter')}</span>
              <div role="group" aria-label={t('targetTypeFilter')} className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={targetType === 'FORUM_POST' ? 'default' : 'outline'}
                  aria-pressed={targetType === 'FORUM_POST'}
                  className={touch}
                  onClick={() => updateFilter({ targetType: 'FORUM_POST' })}
                >
                  {t('targetForumPost')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={targetType === 'CONVERSATION' ? 'default' : 'outline'}
                  aria-pressed={targetType === 'CONVERSATION'}
                  className={touch}
                  onClick={() => updateFilter({ targetType: 'CONVERSATION' })}
                >
                  {t('targetConversation')}
                </Button>
              </div>
            </div>

            {filter.tab === 'handled' && (
              <div className="flex flex-col gap-1.5">
                <span className={fieldLabel}>{t('statusFilter')}</span>
                <div role="group" aria-label={t('statusFilter')} className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={filter.status === 'ACTIONED' ? 'default' : 'outline'}
                    aria-pressed={filter.status === 'ACTIONED'}
                    className={touch}
                    onClick={() => updateFilter({ status: 'ACTIONED' })}
                  >
                    {t(targetType === 'CONVERSATION' ? 'statusConversationLocked' : 'statusActioned')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filter.status === 'DISMISSED' ? 'default' : 'outline'}
                    aria-pressed={filter.status === 'DISMISSED'}
                    className={touch}
                    onClick={() => updateFilter({ status: 'DISMISSED' })}
                  >
                    {t('statusDismissed')}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mod-report-reason" className={fieldLabel}>{t('reasonFilter')}</Label>
              <NativeSelect
                id="mod-report-reason"
                value={filter.reason}
                className={`w-56 ${touch}`}
                onChange={e => updateFilter({ reason: e.target.value as ReportReason | '' })}
              >
                <NativeSelectOption value="">{t('allReasons')}</NativeSelectOption>
                {REPORT_REASONS.map(r => (
                  <NativeSelectOption key={r} value={r}>{reportReasonLabel[r][language]}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
        )}
      </Card>

      {staleMessage && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-tone-amber-border bg-tone-amber-bg px-4 py-3 text-sm text-tone-amber-fg"
        >
          <span>{staleMessage}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={touch}
            onClick={() => {
              setStaleMessage('')
              setReloadTick(x => x + 1)
            }}
          >
            <RefreshCw aria-hidden />
            {t('reload')}
          </Button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger"
        >
          <span>{error}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={touch}
            onClick={() => setReloadTick(x => x + 1)}
          >
            <RefreshCw aria-hidden />
            {t('retry')}
          </Button>
        </div>
      )}

      {message && (
        <p
          role="status"
          className="rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg"
        >
          {message}
        </p>
      )}

      {!fresh ? (
        error && !loading ? null : (
          <div role="status" aria-label={t('loading')} className="flex flex-col gap-4">
            {[0, 1, 2].map(i => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        )
      ) : filter.tab === 'hidden' ? (
        hiddenPosts.length === 0 && lockedConversations.length === 0 ? (
          <EmptyState icon={Inbox} title={t('emptyHidden')} />
        ) : (
          <div className="flex flex-col gap-6">
            {hiddenPosts.length > 0 && (
              <section aria-label={t('sectionHiddenPosts')} className="flex flex-col gap-3">
                {lockedConversations.length > 0 && (
                  <h2 className="text-base font-bold text-foreground">{t('sectionHiddenPosts')}</h2>
                )}
                <ul className="m-0 flex list-none flex-col gap-4 p-0">
                  {hiddenPosts.map(post => (
                    <li key={post.id}>
                      <Card className="gap-4 rounded-xl p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="slate">
                              {post.type === 'QUESTION' ? t('questionLabel') : t('answerLabel')}
                            </Badge>
                            {post.questionTitle && (
                              <span className="font-bold [overflow-wrap:anywhere]">{post.questionTitle}</span>
                            )}
                            {post.publiclyVisible ? (
                              <Link
                                to={`/forum/${post.questionId}`}
                                className={`inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline ${touch}`}
                              >
                                <ExternalLink aria-hidden className="size-3.5" />
                                {t('openInForum')}
                              </Link>
                            ) : (
                              <Badge tone="slate">{t('noLongerPublic')}</Badge>
                            )}
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={touch}
                            onClick={() => openRestore(post)}
                          >
                            <RotateCcw aria-hidden />
                            {t('restore')}
                          </Button>
                        </div>

                        <div className="rounded-lg border border-border bg-muted/20 p-4">
                          <CollapsibleMarkdown content={post.content} language={language} />
                        </div>

                        {post.moderationNote && (
                          <p className="rounded-lg border border-tone-amber-border/50 bg-tone-amber-bg/20 px-3 py-2 text-xs text-tone-amber-fg">
                            “{post.moderationNote}”
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <span>{t('authorLabel')}:</span>
                            <UserAvatar name={post.author.fullName} url={post.author.avatarUrl} className="size-5 text-[10px]" />
                            <strong className="font-medium text-foreground">{post.author.fullName}</strong>
                          </span>
                          {post.hiddenBy && (
                            <span className="inline-flex items-center gap-1.5">
                              <span>{t('hiddenByLabel')}:</span>
                              <strong className="font-medium text-foreground">{post.hiddenBy.fullName}</strong>
                            </span>
                          )}
                          {post.hiddenAt && <span>· {formatDate(post.hiddenAt, language)}</span>}
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {lockedConversations.length > 0 && (
              <section aria-label={t('sectionLockedConversations')} className="flex flex-col gap-3">
                <h2 className="text-base font-bold text-foreground">{t('sectionLockedConversations')}</h2>
                <ul className="m-0 flex list-none flex-col gap-4 p-0">
                  {lockedConversations.map(conv => (
                    <li key={conv.id}>
                      <Card className="gap-4 rounded-xl p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{t('targetConversation')}</Badge>
                            <Badge tone="rose">
                              <Lock className="size-3" aria-hidden />
                              {t('statusLocked')}
                            </Badge>
                            {conv.blocked && (
                              <Badge tone="amber">
                                <Ban className="size-3" aria-hidden />
                                {t('statusBlocked')}
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={touch}
                              onClick={() => openConversationViewer({ conversation: conv, fromLockedList: true })}
                            >
                              <MessageCircle aria-hidden />
                              {t('viewMessages')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={touch}
                              onClick={() => openUnlock(conv)}
                            >
                              <Unlock aria-hidden />
                              {t('unlockConversation')}
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 p-3.5 text-sm">
                          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            {t('participants')}:
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <UserAvatar name={conv.learner.fullName} url={conv.learner.avatarUrl} className="size-6 text-[10px]" />
                            <strong className="font-medium text-foreground">{conv.learner.fullName}</strong>
                            <Badge tone="slate" className="text-[11px]">{t('learnerRole')}</Badge>
                          </span>
                          <ArrowLeftRight className="size-4 text-muted-foreground" aria-hidden />
                          <span className="inline-flex items-center gap-1.5">
                            <UserAvatar name={conv.author.fullName} url={conv.author.avatarUrl} className="size-6 text-[10px]" />
                            <strong className="font-medium text-foreground">{conv.author.fullName}</strong>
                            <Badge tone="slate" className="text-[11px]">{t('authorRole')}</Badge>
                          </span>
                        </div>

                        {conv.lockNote && (
                          <p className="rounded-lg border border-tone-amber-border/50 bg-tone-amber-bg/20 px-3 py-2 text-xs text-tone-amber-fg">
                            “<span>{conv.lockNote}</span>”
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {conv.lockedBy && (
                            <span className="inline-flex items-center gap-1.5">
                              <span>{t('lockedByLabel')}:</span>
                              <strong className="font-medium text-foreground">{conv.lockedBy.fullName}</strong>
                            </span>
                          )}
                          {conv.lockedAt && <span>· {formatDate(conv.lockedAt, language)}</span>}
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
                {lockedTotalPages > 1 && (
                  <Pagination
                    language={language}
                    page={lockedPage}
                    totalPages={lockedTotalPages}
                    loading={loading}
                    onPageChange={setLockedPage}
                  />
                )}
              </section>
            )}
          </div>
        )
      ) : reports.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title={t(filter.tab === 'open' ? 'emptyOpen' : 'emptyHandled')}
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {reports.map(item => {
            const conv = item.conversation
            const isConv = item.targetType === 'CONVERSATION' || Boolean(conv)

            if (isConv && conv) {
              return (
                <li key={item.id}>
                  <Card className="gap-4 rounded-xl p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={REASON_TONE[item.reason]}>{reportReasonLabel[item.reason][language]}</Badge>
                        <Badge tone={STATUS_TONE[item.status]}>
                          {item.status === 'ACTIONED' ? t('statusConversationLocked') : reportStatusLabel[item.status][language]}
                        </Badge>
                        <Badge variant="outline">{t('targetConversation')}</Badge>
                        {conv.blocked && (
                          <Badge tone="amber">
                            <Ban className="size-3" aria-hidden />
                            {t('statusBlocked')}
                          </Badge>
                        )}
                        {conv.locked && (
                          <Badge tone="rose">
                            <Lock className="size-3" aria-hidden />
                            {t('statusLocked')}
                          </Badge>
                        )}
                        {item.otherOpenReports > 0 && (
                          <Badge tone="amber">{t('moreReports', { n: item.otherOpenReports })}</Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={touch}
                          onClick={() => openConversationViewer({ conversation: conv, reportItem: item })}
                        >
                          <MessageCircle aria-hidden />
                          {t('viewMessages')}
                        </Button>
                        {item.status === 'OPEN' && (
                          <>
                            {!conv.locked && (
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className={touch}
                                onClick={() => openResolve(item, 'LOCK_CONVERSATION')}
                              >
                                <Lock aria-hidden />
                                {t('lockConversation')}
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={touch}
                              onClick={() => openResolve(item, 'DISMISS')}
                            >
                              <Check aria-hidden />
                              {t('dismiss')}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-sm [overflow-wrap:anywhere]">“<span>{item.description}</span>”</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span>{t('reporterLabel')}:</span>
                        <UserAvatar name={item.reporter.fullName} url={item.reporter.avatarUrl} className="size-5 text-[10px]" />
                        <strong className="font-medium text-foreground">{item.reporter.fullName}</strong>
                      </span>
                      <span>· {formatDate(item.createdAt, language)}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm">
                      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {t('participants')}:
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <UserAvatar name={conv.learner.fullName} url={conv.learner.avatarUrl} className="size-6 text-[10px]" />
                        <strong className="font-medium text-foreground">{conv.learner.fullName}</strong>
                        <Badge tone="slate" className="text-[11px]">{t('learnerRole')}</Badge>
                      </span>
                      <ArrowLeftRight className="size-4 text-muted-foreground" aria-hidden />
                      <span className="inline-flex items-center gap-1.5">
                        <UserAvatar name={conv.author.fullName} url={conv.author.avatarUrl} className="size-6 text-[10px]" />
                        <strong className="font-medium text-foreground">{conv.author.fullName}</strong>
                        <Badge tone="slate" className="text-[11px]">{t('authorRole')}</Badge>
                      </span>
                    </div>

                    {item.resolutionNote && (
                      <p className="text-xs text-muted-foreground">
                        “{item.resolutionNote}”
                      </p>
                    )}
                  </Card>
                </li>
              )
            }

            return (
              <li key={item.id}>
                <Card className="gap-4 rounded-xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={REASON_TONE[item.reason]}>{reportReasonLabel[item.reason][language]}</Badge>
                      <Badge tone={STATUS_TONE[item.status]}>{reportStatusLabel[item.status][language]}</Badge>
                      <Badge variant="outline">
                        {item.post.type === 'QUESTION' ? t('questionLabel') : t('answerLabel')}
                      </Badge>
                      {item.otherOpenReports > 0 && (
                        <Badge tone="amber">{t('moreReports', { n: item.otherOpenReports })}</Badge>
                      )}
                    </div>

                    {item.status === 'OPEN' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className={touch}
                          onClick={() => openResolve(item, 'HIDE_CONTENT')}
                        >
                          <EyeOff aria-hidden />
                          {t('hideContent')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={touch}
                          onClick={() => openResolve(item, 'DISMISS')}
                        >
                          <Check aria-hidden />
                          {t('dismiss')}
                        </Button>
                      </div>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-sm [overflow-wrap:anywhere]">“{item.description}”</p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span>{t('reporterLabel')}:</span>
                      <UserAvatar name={item.reporter.fullName} url={item.reporter.avatarUrl} className="size-5 text-[10px]" />
                      <strong className="font-medium text-foreground">{item.reporter.fullName}</strong>
                    </span>
                    <span>· {formatDate(item.createdAt, language)}</span>
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {item.post.questionTitle && (
                          <span className="font-bold text-foreground [overflow-wrap:anywhere]">
                            {item.post.questionTitle}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <span>{t('authorLabel')}:</span>
                          <UserAvatar name={item.post.author.fullName} url={item.post.author.avatarUrl} className="size-5 text-[10px]" />
                          <strong className="font-medium text-foreground">{item.post.author.fullName}</strong>
                        </span>
                      </div>

                      {item.post.publiclyVisible ? (
                        <Link
                          to={`/forum/${item.post.questionId}`}
                          className={`inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline ${touch}`}
                        >
                          <ExternalLink aria-hidden className="size-3.5" />
                          {t('openInForum')}
                        </Link>
                      ) : (
                        <Badge tone="slate">{t('noLongerPublic')}</Badge>
                      )}
                    </div>

                    <CollapsibleMarkdown content={item.post.content} language={language} />
                  </div>

                  {item.resolutionNote && (
                    <p className="text-xs text-muted-foreground">
                      “{item.resolutionNote}”
                    </p>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <Pagination
          language={language}
          page={currentPage}
          totalPages={totalPages}
          loading={loading}
          onPageChange={page => updateFilter({ page })}
        />
      )}

      {/* Read-only Conversation Message Viewer Sheet */}
      <Sheet open={viewerTarget !== null} onOpenChange={open => { if (!open) setViewerTarget(null) }}>
        {viewerTarget && (
          <SheetContent
            side="right"
            closeLabel={t('close')}
            className="flex h-dvh w-full flex-col gap-0 p-0 sm:max-w-[560px]"
          >
            <SheetHeader className="border-b border-border bg-card/60 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <SheetTitle className="text-base font-bold">
                  {viewerTarget.conversation.learner.fullName} ↔ {viewerTarget.conversation.author.fullName}
                </SheetTitle>
                {viewerTarget.conversation.blocked && (
                  <Badge tone="amber">{t('statusBlocked')}</Badge>
                )}
                {viewerTarget.conversation.locked && (
                  <Badge tone="rose">{t('statusLocked')}</Badge>
                )}
              </div>
              <SheetDescription className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-foreground">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
                <span>{t('moderatorPrivacyNote')}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col bg-background">
              {sheetLoading ? (
                <div role="status" aria-label={t('loading')} className="flex flex-1 flex-col gap-3 p-5">
                  <Skeleton className="h-16 w-2/3 rounded-2xl" />
                  <Skeleton className="h-16 w-2/3 self-end rounded-2xl" />
                  <Skeleton className="h-16 w-1/2 rounded-2xl" />
                </div>
              ) : sheetError ? (
                <div role="alert" className="m-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
                  <span>{sheetError}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={touch}
                    onClick={() => void loadSheetMessages(viewerTarget.conversation.id)}
                  >
                    <RefreshCw aria-hidden />
                    {t('retry')}
                  </Button>
                </div>
              ) : (
                <ConversationMessageThread
                  language={language}
                  messages={sheetMessages}
                  hasMoreOlder={sheetHasMore}
                  loadingOlder={sheetLoadingOlder}
                  onLoadOlder={() => void handleLoadOlderSheetMessages()}
                  viewer={{
                    otherUserId: viewerTarget.conversation.learner.id,
                    participantsById: {
                      [viewerTarget.conversation.learner.id]: `${viewerTarget.conversation.learner.fullName} (${t('learnerRole')})`,
                      [viewerTarget.conversation.author.id]: `${viewerTarget.conversation.author.fullName} (${t('authorRole')})`,
                    },
                  }}
                />
              )}
            </div>

            <SheetFooter className="flex-row flex-wrap items-center justify-end gap-2 border-t border-border bg-card/60 px-5 py-3">
              {viewerTarget.reportItem?.status === 'OPEN' && (
                <>
                  {!viewerTarget.conversation.locked && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className={touch}
                      onClick={() => openResolve(viewerTarget.reportItem!, 'LOCK_CONVERSATION')}
                    >
                      <Lock aria-hidden />
                      {t('lockConversation')}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={touch}
                    onClick={() => openResolve(viewerTarget.reportItem!, 'DISMISS')}
                  >
                    <Check aria-hidden />
                    {t('dismiss')}
                  </Button>
                </>
              )}
              {viewerTarget.fromLockedList && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={touch}
                  onClick={() => openUnlock(viewerTarget.conversation)}
                >
                  <Unlock aria-hidden />
                  {t('unlockConversation')}
                </Button>
              )}
            </SheetFooter>
          </SheetContent>
        )}
      </Sheet>

      {/* Resolve / Restore / Unlock Dialog */}
      <Dialog open={dialog !== null} onOpenChange={open => { if (!open && !busy) setDialog(null) }}>
        {dialog && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {dialog.kind === 'restore'
                  ? t('restoreDialogTitle')
                  : dialog.kind === 'unlock'
                    ? t('unlockDialogTitle')
                    : dialog.action === 'HIDE_CONTENT'
                      ? t('hideDialogTitle')
                      : dialog.action === 'LOCK_CONVERSATION'
                        ? t('lockDialogTitle')
                        : t('dismissDialogTitle')}
              </DialogTitle>
              <DialogDescription>
                {dialog.kind === 'restore'
                  ? t('restoreDialogDesc')
                  : dialog.kind === 'unlock'
                    ? t('unlockDialogDesc')
                    : dialog.action === 'HIDE_CONTENT'
                      ? t('hideDialogDesc')
                      : dialog.action === 'LOCK_CONVERSATION'
                        ? t('lockDialogDesc')
                        : dialog.item.targetType === 'CONVERSATION'
                          ? t('dismissConversationDesc')
                          : t('dismissDialogDesc')}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="mod-report-note" className={fieldLabel}>
                  {t(
                    dialog.kind === 'resolve' && dialog.action === 'HIDE_CONTENT'
                      ? 'noteLabelRequired'
                      : dialog.kind === 'resolve' && dialog.action === 'LOCK_CONVERSATION'
                        ? 'lockNoteLabelRequired'
                        : 'noteLabelOptional',
                  )}
                </Label>
                <span className="text-xs tabular-nums text-muted-foreground">{note.trim().length}/1.000</span>
              </div>
              <Textarea
                id="mod-report-note"
                rows={4}
                value={note}
                disabled={busy}
                aria-invalid={noteError}
                onChange={e => {
                  setNote(e.target.value)
                  if (noteError) setNoteError(false)
                }}
              />
              {noteError && <p role="alert" className="text-xs text-danger">{t('noteMissing')}</p>}
              {dialogError && (
                <p role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-3 py-2 text-sm text-danger">
                  {dialogError}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" className={touch} disabled={busy} onClick={() => setDialog(null)}>
                {t('cancel')}
              </Button>
              <Button
                type="button"
                variant={
                  dialog.kind === 'resolve' &&
                  (dialog.action === 'HIDE_CONTENT' || dialog.action === 'LOCK_CONVERSATION')
                    ? 'destructive'
                    : 'default'
                }
                className={touch}
                disabled={busy}
                onClick={() => void confirmDialog()}
              >
                {dialog.kind === 'restore'
                  ? t('restore')
                  : dialog.kind === 'unlock'
                    ? t('unlockConversation')
                    : dialog.action === 'HIDE_CONTENT'
                      ? t('hideContent')
                      : dialog.action === 'LOCK_CONVERSATION'
                        ? t('lockConversation')
                        : t('dismiss')}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </main>
  )
}
