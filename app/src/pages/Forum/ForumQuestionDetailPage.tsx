import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Flag,
  Lock,
  PencilLine,
  RefreshCw,
  Send,
  SmilePlus,
  Trash2,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useIsMobile } from '@/hooks/use-mobile'
import { toneFor } from '@/lib/utils'
import { EmptyState } from '../../components/EmptyState'
import { CopyButton, MarkdownContent } from '../../components/MarkdownContent'
import { UserAvatar } from '../../components/UserAvatar'
import { fieldLabel, formatDate } from '../Author/AuthorBlogsPage'
import {
  FORUM_REACTION_TYPES,
  REPORT_REASONS,
  forumErrorText,
  forumReactionMeta,
  forumText,
  reportReasonLabel,
} from '../../data/forumI18n'
import { ApiError } from '../../services/api/client'
import {
  answerActions,
  forumService,
  moderatorReportService,
  questionActions,
  shouldReloadForumDetail,
  validateAnswerContent,
  validateModerationNote,
  validateReportInput,
} from '../../services/forumService'
import type {
  ForumAnswer,
  ForumQuestionDetail,
  ForumReactions,
  ForumReactionType,
  ForumReactor,
  ReportReason,
} from '../../types/forum'
import type { Language } from '../../types/preferences'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const DEFAULT_REACTIONS: ForumReactions = {
  counts: { LIKE: 0, LOVE: 0, HAHA: 0, ANGRY: 0 },
  mine: null,
}

function totalReactions(reactions?: ForumReactions): number {
  if (!reactions) return 0
  return FORUM_REACTION_TYPES.reduce((sum, type) => sum + (reactions.counts[type] ?? 0), 0)
}

function ReactionsListModal({
  postId,
  reactions,
  language,
  onClose,
}: {
  postId: string
  reactions: ForumReactions
  language: Language
  onClose: () => void
}) {
  const t = forumText(language)
  const isMobile = useIsMobile()
  const [activeType, setActiveType] = useState<ForumReactionType | ''>('')
  const [items, setItems] = useState<ForumReactor[]>([])
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadPage = useCallback(
    async (targetType: ForumReactionType | '', targetPage: number, append: boolean) => {
      setLoading(true)
      setError('')
      try {
        const res = await forumService.listReactions(postId, { type: targetType, page: targetPage, size: 20 })
        setItems(old => (append ? [...old, ...res.content] : res.content))
        setPage(res.page)
        setHasNext(res.hasNext)
      } catch (e) {
        setError(forumErrorText(e, language, 'react', t('loadError')))
      } finally {
        setLoading(false)
      }
    },
    [postId, language], // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    void loadPage(activeType, 0, false)
  }, [activeType, loadPage])

  const total = totalReactions(reactions)

  const body = (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t('reactionsDialogTitle')} className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        <Button
          type="button"
          role="tab"
          size="sm"
          variant={activeType === '' ? 'default' : 'outline'}
          aria-selected={activeType === ''}
          className={touch}
          onClick={() => setActiveType('')}
        >
          {t('reactionsAll')} ({total})
        </Button>
        {FORUM_REACTION_TYPES.map(type => {
          const count = reactions.counts[type] ?? 0
          const meta = forumReactionMeta[type]
          return (
            <Button
              key={type}
              type="button"
              role="tab"
              size="sm"
              variant={activeType === type ? 'default' : 'outline'}
              aria-selected={activeType === type}
              className={touch}
              onClick={() => setActiveType(type)}
            >
              <span aria-hidden>{meta.emoji}</span>
              <span>{meta.label[language]}</span>
              <span>({count})</span>
            </Button>
          )
        })}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {loading && items.length === 0 ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('noReactions')}</p>
      ) : (
        <ul className="m-0 flex max-h-80 list-none flex-col divide-y divide-border overflow-y-auto p-0">
          {items.map(reactor => {
            const meta = forumReactionMeta[reactor.type]
            return (
              <li key={`${reactor.user.id}-${reactor.type}`} className="flex items-center justify-between gap-3 py-2.5">
                <span className="inline-flex min-w-0 items-center gap-2.5 text-sm font-medium">
                  <UserAvatar name={reactor.user.fullName} url={reactor.user.avatarUrl} className="size-7 text-xs" />
                  <span className="truncate">{reactor.user.fullName}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <span aria-label={meta.label[language]}>{meta.emoji}</span>
                  <span>{meta.label[language]}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {hasNext && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          className={`self-center ${touch}`}
          onClick={() => void loadPage(activeType, page + 1, true)}
        >
          {t('showMore')}
        </Button>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open onOpenChange={open => { if (!open) onClose() }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto p-4">
          <SheetHeader className="pb-3">
            <SheetTitle>{t('reactionsDialogTitle')}</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('reactionsDialogTitle')}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}

function ReactionBar({
  postId,
  initial,
  canReact,
  authenticated,
  language,
  returnTo,
  onStaleError,
}: {
  postId: string
  initial?: ForumReactions
  canReact: boolean
  authenticated: boolean
  language: Language
  returnTo: string
  onStaleError?: () => void
}) {
  const t = forumText(language)
  const navigate = useNavigate()
  const [reactions, setReactions] = useState<ForumReactions>(initial ?? DEFAULT_REACTIONS)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [guestPromptOpen, setGuestPromptOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setReactions(initial ?? DEFAULT_REACTIONS)
  }, [initial])

  const choose = async (type: ForumReactionType) => {
    if (busy) return
    setPickerOpen(false)
    setBusy(true)
    setError('')
    try {
      const updated =
        reactions.mine === type
          ? await forumService.unreact(postId)
          : await forumService.react(postId, type)
      setReactions(updated)
    } catch (e) {
      setError(forumErrorText(e, language, 'react', t('loadError')))
      if (shouldReloadForumDetail(e)) onStaleError?.()
    } finally {
      setBusy(false)
    }
  }

  const total = totalReactions(reactions)
  const activeTypes = FORUM_REACTION_TYPES.filter(type => (reactions.counts[type] ?? 0) > 0)
  const mineMeta = reactions.mine ? forumReactionMeta[reactions.mine] : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!authenticated ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={touch}
          onClick={() => setGuestPromptOpen(v => !v)}
        >
          <SmilePlus aria-hidden className="size-4" />
          {t('reactButton')}
        </Button>
      ) : canReact ? (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant={mineMeta ? 'default' : 'outline'}
              size="sm"
              disabled={busy}
              aria-label={t('reactButton')}
              className={touch}
            >
              {mineMeta ? (
                <>
                  <span aria-hidden>{mineMeta.emoji}</span>
                  <span>{mineMeta.label[language]}</span>
                </>
              ) : (
                <>
                  <SmilePlus aria-hidden className="size-4" />
                  <span>{t('reactButton')}</span>
                </>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-1.5">
            <div role="group" aria-label={t('reactButton')} className="flex items-center gap-1">
              {FORUM_REACTION_TYPES.map(type => {
                const meta = forumReactionMeta[type]
                const selected = reactions.mine === type
                return (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant={selected ? 'default' : 'ghost'}
                    aria-label={meta.label[language]}
                    aria-pressed={selected}
                    disabled={busy}
                    className={touch}
                    onClick={() => void choose(type)}
                  >
                    <span aria-hidden className="text-base">{meta.emoji}</span>
                    <span className="text-xs">{meta.label[language]}</span>
                  </Button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      {total > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t('reactionsDialogTitle')}
          className={touch}
          onClick={() => setListOpen(true)}
        >
          <span className="inline-flex items-center gap-1" aria-hidden>
            {activeTypes.map(type => (
              <span key={type}>{forumReactionMeta[type].emoji}</span>
            ))}
          </span>
          <span className="tabular-nums font-semibold">{total}</span>
        </Button>
      )}

      {guestPromptOpen && !authenticated && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs"
        >
          <span>{t('guestPrompt')}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={touch}
            onClick={() => navigate('/login', { state: { returnTo } })}
          >
            {t('signIn')}
          </Button>
        </div>
      )}

      {error && <span role="alert" className="text-xs text-danger">{error}</span>}

      {listOpen && (
        <ReactionsListModal
          postId={postId}
          reactions={reactions}
          language={language}
          onClose={() => setListOpen(false)}
        />
      )}
    </div>
  )
}

function ReportPostDialog({
  targetId,
  language,
  onClose,
  onReported,
  onStaleError,
}: {
  targetId: string
  language: Language
  onClose: () => void
  onReported: () => void
  onStaleError?: (msg: string) => void
}) {
  const t = forumText(language)
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [description, setDescription] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const problems = tried ? validateReportInput(reason, description) : {}

  const submit = async () => {
    setTried(true)
    const errs = validateReportInput(reason, description)
    if (Object.keys(errs).length > 0 || !reason || busy) return
    setBusy(true)
    setError('')
    try {
      await forumService.createReport({ targetId, reason, description })
      onReported()
    } catch (e) {
      const msg = forumErrorText(e, language, 'report', t('loadError'))
      setError(msg)
      if (shouldReloadForumDetail(e)) onStaleError?.(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('report')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-reason" className={fieldLabel}>{t('reportReason')} *</Label>
            <NativeSelect
              id="report-reason"
              value={reason}
              disabled={busy}
              aria-invalid={Boolean(problems.reason)}
              className={`w-full ${touch}`}
              onChange={e => setReason(e.target.value as ReportReason | '')}
            >
              <NativeSelectOption value="">{t('chooseReason')}</NativeSelectOption>
              {REPORT_REASONS.map(r => (
                <NativeSelectOption key={r} value={r}>{reportReasonLabel[r][language]}</NativeSelectOption>
              ))}
            </NativeSelect>
            {problems.reason && <p role="alert" className="text-xs text-danger">{t(problems.reason)}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="report-description" className={fieldLabel}>
                {t('reportDetails')}{reason === 'OTHER' ? ' *' : ''}
              </Label>
              <span className="text-xs tabular-nums text-muted-foreground">{description.trim().length}/1.000</span>
            </div>
            <Textarea
              id="report-description"
              rows={4}
              value={description}
              disabled={busy}
              placeholder={t('reportDetailsPlaceholder')}
              aria-invalid={Boolean(problems.description)}
              onChange={e => setDescription(e.target.value)}
            />
            {problems.description && <p role="alert" className="text-xs text-danger">{t(problems.description)}</p>}
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className={touch} disabled={busy} onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="button" className={touch} disabled={busy} onClick={() => void submit()}>
            {t('submitReport')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModeratorHidePostDialog({
  postId,
  language,
  onClose,
  onHidden,
  onStaleError,
}: {
  postId: string
  language: Language
  onClose: () => void
  onHidden: () => void
  onStaleError?: (msg: string) => void
}) {
  const t = forumText(language)
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const noteErr = tried ? validateModerationNote(true, note) : null

  const submit = async () => {
    setTried(true)
    if (validateModerationNote(true, note) || busy) return
    setBusy(true)
    setError('')
    try {
      await moderatorReportService.setPostVisibility(postId, { action: 'HIDE', note })
      onHidden()
    } catch (e) {
      const msg = forumErrorText(e, language, 'general', t('loadError'))
      setError(msg)
      if (shouldReloadForumDetail(e)) onStaleError?.(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('hide')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="mod-hide-note" className={fieldLabel}>{t('hideReason')} *</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{note.trim().length}/1.000</span>
          </div>
          <Textarea
            id="mod-hide-note"
            rows={4}
            value={note}
            disabled={busy}
            placeholder={t('hideReasonPlaceholder')}
            aria-invalid={Boolean(noteErr)}
            onChange={e => setNote(e.target.value)}
          />
          {noteErr && <p role="alert" className="text-xs text-danger">{t(noteErr)}</p>}
          {error && (
            <p role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className={touch} disabled={busy} onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="button" variant="destructive" className={touch} disabled={busy} onClick={() => void submit()}>
            {t('hide')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ForumQuestionDetailPage({
  language = 'vi',
  authenticated = false,
  isModerator = false,
}: {
  language?: Language
  authenticated?: boolean
  isModerator?: boolean
}) {
  const { id = '' } = useParams()
  const t = forumText(language)
  const navigate = useNavigate()

  const [question, setQuestion] = useState<ForumQuestionDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notFound' | 'error'>('loading')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  // Text whose form vanished after a stale-state reload (question closed/gone, answer gone); shown so it is not lost.
  const [lostDraft, setLostDraft] = useState<string | null>(null)
  // A second stale error appends, so a draft the user has not copied yet is never replaced.
  const keepDraft = (text: string) => setLostDraft(old => (old ? `${old}\n\n---\n\n${text}` : text))

  // Answer creation state
  const [answerContent, setAnswerContent] = useState('')
  const [answerTab, setAnswerTab] = useState<'write' | 'preview'>('write')
  const [answerError, setAnswerError] = useState('')

  // Inline answer edit state
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [editingTab, setEditingTab] = useState<'write' | 'preview'>('write')
  const [editingError, setEditingError] = useState('')

  // Dialogs
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'question' | 'answer'; id: string } | null>(null)
  const [reportTargetId, setReportTargetId] = useState<string | null>(null)
  const [hideTargetId, setHideTargetId] = useState<string | null>(null)

  const reload = useCallback(
    async (silent = false, preserveError = false) => {
      if (!silent) setState('loading')
      if (!preserveError) setError('')
      try {
        const detail = await forumService.questionDetail(id)
        setQuestion(detail)
        setState('ready')
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          setQuestion(null)
          setState('notFound')
        } else {
          setState('error')
          setError(forumErrorText(e, language, 'general', t('loadError')))
        }
      }
    },
    [id, language], // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    void reload(false)
  }, [reload])

  const submitAnswer = async (e: FormEvent) => {
    e.preventDefault()
    if (!question || busy) return
    const errKey = validateAnswerContent(answerContent)
    if (errKey) {
      setAnswerError(t(errKey))
      return
    }
    setAnswerError('')
    setBusy(true)
    setMessage('')
    try {
      await forumService.createAnswer(question.id, answerContent)
      setAnswerContent('')
      setAnswerTab('write')
      await reload(true)
    } catch (err) {
      const msg = forumErrorText(err, language, 'general', t('loadError'))
      if (shouldReloadForumDetail(err)) {
        setAnswerError('')
        setError(msg)
        keepDraft(answerContent)
        await reload(true, true)
      } else {
        setAnswerError(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  const saveEditAnswer = async (answerId: string) => {
    if (busy) return
    const errKey = validateAnswerContent(editingContent)
    if (errKey) {
      setEditingError(t(errKey))
      return
    }
    setEditingError('')
    setBusy(true)
    setMessage('')
    try {
      await forumService.updateAnswer(answerId, editingContent)
      setEditingAnswerId(null)
      await reload(true)
    } catch (err) {
      const msg = forumErrorText(err, language, 'general', t('loadError'))
      if (shouldReloadForumDetail(err)) {
        setEditingAnswerId(null)
        setEditingError('')
        setError(msg)
        keepDraft(editingContent)
        await reload(true, true)
      } else {
        setEditingError(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || busy) return
    const target = deleteTarget
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (target.kind === 'question') {
        await forumService.deleteQuestion(target.id)
        setDeleteTarget(null)
        try {
          const detail = await forumService.questionDetail(id)
          setQuestion(detail)
          setState('ready')
        } catch {
          navigate('/forum', { replace: true })
        }
      } else {
        await forumService.deleteAnswer(target.id)
        setDeleteTarget(null)
        await reload(true)
      }
    } catch (err) {
      setDeleteTarget(null)
      setError(forumErrorText(err, language, 'general', t('loadError')))
      if (shouldReloadForumDetail(err)) await reload(true, true)
    } finally {
      setBusy(false)
    }
  }

  const toggleAccepted = async (answer: ForumAnswer) => {
    if (!question || busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await forumService.setAcceptedAnswer(question.id, answer.accepted ? null : answer.id)
      await reload(true)
    } catch (err) {
      setError(forumErrorText(err, language, 'general', t('loadError')))
      if (shouldReloadForumDetail(err)) await reload(true, true)
    } finally {
      setBusy(false)
    }
  }

  const lostDraftNotice = lostDraft !== null && (
    <Card className="gap-3 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t('lostDraft')}</p>
        <div className="flex items-center gap-1">
          <CopyButton text={() => lostDraft} label={t('copyDraft')} language={language} />
          <Button type="button" variant="ghost" size="sm" className={touch} onClick={() => setLostDraft(null)}>
            {t('close')}
          </Button>
        </div>
      </div>
      <pre className="m-0 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-sm [overflow-wrap:anywhere]">
        {lostDraft}
      </pre>
    </Card>
  )

  const frame = (body: ReactNode) => (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 pb-20 sm:px-6 lg:px-8">{body}</main>
  )

  if (state === 'loading' && !question) {
    return frame(
      <div role="status" aria-label={t('loading')} className="flex flex-col gap-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>,
    )
  }

  if (state === 'notFound') {
    return frame(
      <>
      {error && error !== t('notFound') && (
        <div role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      {lostDraftNotice}
      <EmptyState
        title={t('notFound')}
        action={
          <Button asChild variant="outline" className={touch}>
            <Link to="/forum">{t('backToList')}</Link>
          </Button>
        }
      />
      </>,
    )
  }

  if ((state === 'error' && !question) || !question) {
    return frame(
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger"
      >
        <span>{error}</span>
        <Button type="button" variant="outline" size="sm" className={touch} onClick={() => void reload(false)}>
          <RefreshCw aria-hidden />
          {t('retry')}
        </Button>
      </div>,
    )
  }

  const qActions = questionActions(question.viewer, { deleted: question.deleted, isModerator })
  const returnTo = `/forum/${question.id}`

  return frame(
    <>
      <Link
        to="/forum"
        className={`inline-flex items-center gap-1 self-start text-sm font-medium text-muted-foreground transition-colors hover:text-foreground ${touch}`}
      >
        ‹ {t('heading')}
      </Link>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger"
        >
          <span>{error}</span>
        </div>
      )}

      {lostDraftNotice}

      {message && (
        <p
          role="status"
          className="rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg"
        >
          {message}
        </p>
      )}

      {/* Question Card */}
      {question.deleted ? (
        <Card className="gap-3 rounded-xl border-dashed p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={toneFor(question.topic.name)}>{question.topic.name}</Badge>
          </div>
          <p className="text-sm font-medium text-muted-foreground">{t('deletedQuestionNotice')}</p>
        </Card>
      ) : (
        <Card className="gap-5 rounded-xl p-6 sm:p-8">
          <header className="flex flex-col gap-3 border-b border-border pb-4">
            <div className="flex flex-wrap items-center gap-2">
              {question.solved && (
                <Badge tone="green">
                  <CheckCircle2 aria-hidden className="size-3.5" />
                  {t('solved')}
                </Badge>
              )}
              <Badge tone={toneFor(question.topic.name)}>{question.topic.name}</Badge>
            </div>

            <h1 className="text-xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-2xl">
              {question.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {question.author && (
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <UserAvatar name={question.author.fullName} url={question.author.avatarUrl} className="size-5 text-[10px]" />
                  {question.author.fullName}
                </span>
              )}
              <span>· {formatDate(question.createdAt, language)}</span>
              {question.editedAt && <span>· {t('edited')}</span>}
            </div>
          </header>

          <div className="min-w-0">
            <MarkdownContent content={question.content ?? ''} language={language} imageAllowed={() => false} />
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <ReactionBar
              postId={question.id}
              initial={question.reactions}
              canReact={qActions.canReact}
              authenticated={authenticated}
              language={language}
              returnTo={returnTo}
              onStaleError={() => void reload(true, true)}
            />

            <div className="flex flex-wrap items-center gap-2">
              {qActions.canEdit && (
                <Button asChild variant="outline" size="sm" className={touch}>
                  <Link to={`/forum/${question.id}/edit`}>
                    <PencilLine aria-hidden />
                    {t('edit')}
                  </Link>
                </Button>
              )}
              {qActions.canDelete && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  className={touch}
                  onClick={() => setDeleteTarget({ kind: 'question', id: question.id })}
                >
                  <Trash2 aria-hidden />
                  {t('delete')}
                </Button>
              )}
              {qActions.canReport && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  className={touch}
                  onClick={() => setReportTargetId(question.id)}
                >
                  <Flag aria-hidden />
                  {t('report')}
                </Button>
              )}
              {qActions.canHide && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  className={touch}
                  onClick={() => setHideTargetId(question.id)}
                >
                  <EyeOff aria-hidden />
                  {t('hide')}
                </Button>
              )}
            </div>
          </footer>
        </Card>
      )}

      {/* Answers Section */}
      <section aria-label={t('answersCount', { n: question.answers.length })} className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">{t('answersCount', { n: question.answers.length })}</h2>

        {question.answers.length === 0 ? (
          <Card className="rounded-xl p-6 text-center text-sm text-muted-foreground">
            {t('emptyAnswers')}
          </Card>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {question.answers.map(ans => {
              const aActions = answerActions(ans.viewer, question.viewer, {
                questionDeleted: question.deleted,
                isModerator,
              })
              const isEditing = editingAnswerId === ans.id

              return (
                <li key={ans.id}>
                  <Card
                    className={`gap-4 rounded-xl p-6 ${
                      ans.accepted ? 'border-tone-green-border bg-tone-green-bg/15' : ''
                    }`}
                  >
                    <header className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {ans.accepted && (
                          <Badge tone="green">
                            <CheckCircle2 aria-hidden className="size-3.5" />
                            {t('solution')}
                          </Badge>
                        )}
                        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                          <UserAvatar name={ans.author.fullName} url={ans.author.avatarUrl} className="size-5 text-[10px]" />
                          {ans.author.fullName}
                        </span>
                        <span>· {formatDate(ans.createdAt, language)}</span>
                        {ans.editedAt && <span>· {t('edited')}</span>}
                      </div>
                    </header>

                    {isEditing ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={`edit-ans-${ans.id}`} className={fieldLabel}>{t('yourAnswer')}</Label>
                          <div className="inline-flex rounded-lg border border-border p-0.5">
                            <Button
                              type="button"
                              size="sm"
                              variant={editingTab === 'write' ? 'default' : 'ghost'}
                              className={`h-7 px-2 text-xs ${touch}`}
                              onClick={() => setEditingTab('write')}
                            >
                              {t('writeTab')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={editingTab === 'preview' ? 'default' : 'ghost'}
                              className={`h-7 px-2 text-xs ${touch}`}
                              onClick={() => setEditingTab('preview')}
                            >
                              {t('previewTab')}
                            </Button>
                          </div>
                        </div>

                        {editingTab === 'write' ? (
                          <Textarea
                            id={`edit-ans-${ans.id}`}
                            rows={5}
                            value={editingContent}
                            disabled={busy}
                            aria-invalid={Boolean(editingError)}
                            onChange={e => setEditingContent(e.target.value)}
                          />
                        ) : (
                          <div className="min-h-28 rounded-lg border border-border bg-muted/20 p-4">
                            <MarkdownContent content={editingContent} language={language} imageAllowed={() => false} />
                          </div>
                        )}

                        {editingError && <p role="alert" className="text-xs text-danger">{editingError}</p>}

                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={touch}
                            disabled={busy}
                            onClick={() => {
                              setEditingAnswerId(null)
                              setEditingError('')
                            }}
                          >
                            {t('cancel')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className={touch}
                            disabled={busy}
                            onClick={() => void saveEditAnswer(ans.id)}
                          >
                            {t('save')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <MarkdownContent content={ans.content} language={language} imageAllowed={() => false} />
                      </div>
                    )}

                    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
                      <ReactionBar
                        postId={ans.id}
                        initial={ans.reactions}
                        canReact={aActions.canReact}
                        authenticated={authenticated}
                        language={language}
                        returnTo={returnTo}
                        onStaleError={() => void reload(true, true)}
                      />

                      <div className="flex flex-wrap items-center gap-2">
                        {aActions.canAccept && (
                          <Button
                            type="button"
                            variant={ans.accepted ? 'outline' : 'default'}
                            size="sm"
                            disabled={busy}
                            className={touch}
                            onClick={() => void toggleAccepted(ans)}
                          >
                            <Check aria-hidden />
                            {ans.accepted ? t('unmarkSolution') : t('markSolution')}
                          </Button>
                        )}
                        {aActions.canEdit && !isEditing && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            className={touch}
                            onClick={() => {
                              setEditingAnswerId(ans.id)
                              setEditingContent(ans.content)
                              setEditingTab('write')
                              setEditingError('')
                            }}
                          >
                            <PencilLine aria-hidden />
                            {t('edit')}
                          </Button>
                        )}
                        {aActions.canDelete && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            className={touch}
                            onClick={() => setDeleteTarget({ kind: 'answer', id: ans.id })}
                          >
                            <Trash2 aria-hidden />
                            {t('delete')}
                          </Button>
                        )}
                        {aActions.canReport && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            className={touch}
                            onClick={() => setReportTargetId(ans.id)}
                          >
                            <Flag aria-hidden />
                            {t('report')}
                          </Button>
                        )}
                        {aActions.canHide && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            className={touch}
                            onClick={() => setHideTargetId(ans.id)}
                          >
                            <EyeOff aria-hidden />
                            {t('hide')}
                          </Button>
                        )}
                      </div>
                    </footer>
                  </Card>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {/* Answer Composer or Guest Sign-in Prompt */}
      {!question.deleted && (
        !authenticated ? (
          <Card className="flex-row flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 p-5">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock aria-hidden className="size-4 shrink-0 text-foreground" />
              <span>{t('guestPrompt')}</span>
            </p>
            <Button
              type="button"
              className={touch}
              onClick={() => navigate('/login', { state: { returnTo } })}
            >
              {t('signIn')}
            </Button>
          </Card>
        ) : qActions.canAnswer ? (
          <Card className="gap-4 rounded-xl p-6">
            <form onSubmit={e => void submitAnswer(e)} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="forum-new-answer" className="text-base font-bold">
                  {t('yourAnswer')}
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {answerContent.trim().length}/10.000
                  </span>
                  <div className="inline-flex rounded-lg border border-border p-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={answerTab === 'write' ? 'default' : 'ghost'}
                      className={`h-7 px-2.5 text-xs ${touch}`}
                      onClick={() => setAnswerTab('write')}
                    >
                      <PencilLine aria-hidden className="size-3.5" />
                      {t('writeTab')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={answerTab === 'preview' ? 'default' : 'ghost'}
                      className={`h-7 px-2.5 text-xs ${touch}`}
                      onClick={() => setAnswerTab('preview')}
                    >
                      <Eye aria-hidden className="size-3.5" />
                      {t('previewTab')}
                    </Button>
                  </div>
                </div>
              </div>

              {answerTab === 'write' ? (
                <Textarea
                  id="forum-new-answer"
                  rows={6}
                  value={answerContent}
                  disabled={busy}
                  placeholder={t('answerPlaceholder')}
                  aria-invalid={Boolean(answerError)}
                  onChange={e => {
                    setAnswerContent(e.target.value)
                    if (answerError) setAnswerError('')
                  }}
                />
              ) : (
                <div className="min-h-36 rounded-lg border border-border bg-muted/20 p-4">
                  {answerContent.trim() ? (
                    <MarkdownContent content={answerContent} language={language} imageAllowed={() => false} />
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('previewEmpty')}</p>
                  )}
                </div>
              )}

              {answerError && <p role="alert" className="text-xs text-danger">{answerError}</p>}

              <div className="flex justify-end">
                <Button type="submit" className={touch} disabled={busy}>
                  <Send aria-hidden />
                  {t('postAnswer')}
                </Button>
              </div>
            </form>
          </Card>
        ) : null
      )}

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={open => { if (!open && !busy) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirmTitle')}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} className={touch}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className={touch}
              onClick={e => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Dialog */}
      {reportTargetId && (
        <ReportPostDialog
          targetId={reportTargetId}
          language={language}
          onClose={() => setReportTargetId(null)}
          onReported={() => {
            setReportTargetId(null)
            setMessage(t('reportSubmitted'))
            void reload(true)
          }}
          onStaleError={() => void reload(true, true)}
        />
      )}

      {/* Moderator Direct Hide Dialog */}
      {hideTargetId && (
        <ModeratorHidePostDialog
          postId={hideTargetId}
          language={language}
          onClose={() => setHideTargetId(null)}
          onHidden={() => {
            const hidingQuestion = hideTargetId === question.id
            setHideTargetId(null)
            if (hidingQuestion) {
              navigate('/forum', { replace: true })
            } else {
              setMessage(t('postHidden'))
              void reload(true)
            }
          }}
          onStaleError={() => void reload(true, true)}
        />
      )}
    </>,
  )
}
