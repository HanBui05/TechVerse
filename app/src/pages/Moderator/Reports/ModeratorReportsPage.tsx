import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, ExternalLink, EyeOff, Inbox, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '../../../components/EmptyState'
import { MarkdownContent } from '../../../components/MarkdownContent'
import { Pagination } from '../../../components/Pagination'
import { UserAvatar } from '../../../components/UserAvatar'
import { fieldLabel, formatDate } from '../../Author/AuthorBlogsPage'
import {
  REPORT_REASONS,
  forumErrorText,
  isReportAlreadyHandled,
  moderatorReportText,
  reportReasonLabel,
  reportStatusLabel,
} from '../../../data/forumI18n'
import { ApiError } from '../../../services/api/client'
import {
  moderatorReportService,
  moderatorReportsFilter,
  moderatorReportsSearch,
  validateModerationNote,
} from '../../../services/forumService'
import type { Page } from '../../../types/articles'
import type {
  ModeratedForumPost,
  ModeratorReportItem,
  ModeratorReportsFilter,
  ModeratorReportsTab,
  ReportReason,
  ReportResolveAction,
  ReportStatus,
} from '../../../types/forum'
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

export function ModeratorReportsPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = moderatorReportText(language)
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = moderatorReportsFilter(searchParams)

  const [reportsData, setReportsData] = useState<Page<ModeratorReportItem> | null>(null)
  const [hiddenData, setHiddenData] = useState<Page<ModeratedForumPost> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [staleMessage, setStaleMessage] = useState('')
  const [message, setMessage] = useState('')
  const [reloadTick, setReloadTick] = useState(0)
  const latestRequest = useRef(0)
  // Data is shown only for the filter it was loaded for, so a tab switch never shows another tab's rows or actions.
  const filterKey = [filter.tab, filter.status, filter.reason, filter.page].join('|')
  const [loadedKey, setLoadedKey] = useState('')

  // Modal state for resolving a report or restoring a hidden post
  const [dialog, setDialog] = useState<
    | { kind: 'resolve'; item: ModeratorReportItem; action: ReportResolveAction }
    | { kind: 'restore'; post: ModeratedForumPost }
    | null
  >(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [busy, setBusy] = useState(false)

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
        const result = await moderatorReportService.listHiddenPosts({ page: filter.page, size: PAGE_SIZE })
        if (reqId !== latestRequest.current) return
        if (result.content.length === 0 && filter.page > 0) {
          const targetPage = result.totalPages > 0 ? Math.min(filter.page - 1, result.totalPages - 1) : 0
          setSearchParams(moderatorReportsSearch({ ...filter, page: targetPage }), { replace: true })
          return
        }
        setHiddenData(result)
        setReportsData(null)
        setLoadedKey(filterKey)
      } else {
        const status: ReportStatus = filter.tab === 'open' ? 'OPEN' : filter.status
        const result = await moderatorReportService.listReports({
          status,
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
  }, [filter.tab, filter.status, filter.reason, filter.page, filterKey, language, setSearchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load()
  }, [load, reloadTick])

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

  const confirmDialog = async () => {
    if (!dialog || busy) return
    const needsNote = dialog.kind === 'resolve' && dialog.action === 'HIDE_CONTENT'
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
        setMessage(t(dialog.action === 'HIDE_CONTENT' ? 'resolvedHiddenMsg' : 'resolvedDismissedMsg'))
      } else {
        await moderatorReportService.setPostVisibility(dialog.post.id, {
          action: 'RESTORE',
          note,
        })
        setMessage(t('restoredMsg'))
      }
      setDialog(null)
      setStaleMessage('')
      await load()
    } catch (e) {
      if (isReportAlreadyHandled(e)) {
        setDialog(null)
        setStaleMessage(t('alreadyHandled'))
      } else if (e instanceof ApiError && e.code === 'FORUM_STATE_INVALID') {
        setDialog(null)
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
                    {t('statusActioned')}
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
        hiddenPosts.length === 0 ? (
          <EmptyState icon={Inbox} title={t('emptyHidden')} />
        ) : (
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
        )
      ) : reports.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title={t(filter.tab === 'open' ? 'emptyOpen' : 'emptyHandled')}
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {reports.map(item => (
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
          ))}
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

      {/* Resolve / Restore Dialog */}
      <Dialog open={dialog !== null} onOpenChange={open => { if (!open && !busy) setDialog(null) }}>
        {dialog && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {dialog.kind === 'restore'
                  ? t('restoreDialogTitle')
                  : dialog.action === 'HIDE_CONTENT'
                    ? t('hideDialogTitle')
                    : t('dismissDialogTitle')}
              </DialogTitle>
              <DialogDescription>
                {dialog.kind === 'restore'
                  ? t('restoreDialogDesc')
                  : dialog.action === 'HIDE_CONTENT'
                    ? t('hideDialogDesc')
                    : t('dismissDialogDesc')}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="mod-report-note" className={fieldLabel}>
                  {t(
                    dialog.kind === 'resolve' && dialog.action === 'HIDE_CONTENT'
                      ? 'noteLabelRequired'
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
                variant={dialog.kind === 'resolve' && dialog.action === 'HIDE_CONTENT' ? 'destructive' : 'default'}
                className={touch}
                disabled={busy}
                onClick={() => void confirmDialog()}
              >
                {dialog.kind === 'restore'
                  ? t('restore')
                  : dialog.action === 'HIDE_CONTENT'
                    ? t('hideContent')
                    : t('dismiss')}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </main>
  )
}
