import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, Check, EyeOff, MessageSquareWarning, MoreHorizontal, RefreshCw, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { toneFor } from '@/lib/utils'
import { MarkdownContent } from '../../../components/MarkdownContent'
import { UserAvatar } from '../../../components/UserAvatar'
import { fieldLabel } from '../../Author/AuthorBlogsPage'
import { interviewLevelTone, interviewStatusTone } from '../../Author/InterviewQuestions/AuthorInterviewQuestionsPage'
import {
  MODERATION_INTERVIEW_NOTE_MAX,
  MODERATION_INTERVIEW_NOTE_REQUIRED,
  interviewErrorText,
  interviewLevelLabel,
  interviewStatusLabel,
  isInterviewStale,
  moderatorInterviewText,
} from '../../../data/interviewI18n'
import { ApiError } from '../../../services/api/client'
import { moderatorInterviewActions, moderatorInterviews } from '../../../services/interviewService'
import type { ModeratorInterviewAction, ModeratorInterviewQuestion } from '../../../types/interview'
import type { Language } from '../../../types/preferences'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const ICONS: Record<ModeratorInterviewAction, typeof Check> = {
  APPROVE: Check,
  REQUEST_CHANGES: MessageSquareWarning,
  HIDE: EyeOff,
  RESTORE: RotateCcw,
  REMOVE: Trash2,
}
const VARIANT: Record<ModeratorInterviewAction, 'default' | 'outline' | 'destructive'> = {
  APPROVE: 'default',
  REQUEST_CHANGES: 'outline',
  HIDE: 'outline',
  RESTORE: 'default',
  REMOVE: 'destructive',
}
const isNotFound = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.code === 'INTERVIEW_QUESTION_NOT_FOUND')

export function ModeratorInterviewQuestionDetailPage({ language = 'vi' }: { language?: Language }) {
  const { id = '' } = useParams()
  const t = moderatorInterviewText(language)
  const [detail, setDetail] = useState<ModeratorInterviewQuestion | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<ModeratorInterviewAction | null>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [busy, setBusy] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setNotFound(false)
    setStale(false)
    moderatorInterviews
      .detail(id)
      .then(result => {
        if (active) setDetail(result)
      })
      .catch(e => {
        if (!active) return
        if (isNotFound(e)) setNotFound(true)
        else setError(interviewErrorText(e, language, t('loadError')))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, reloadTick, language]) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = () => {
    setMessage('')
    setReloadTick(x => x + 1)
  }

  const ask = (action: ModeratorInterviewAction) => {
    setMoreOpen(false)
    setPending(action)
    setNote('')
    setNoteError(false)
    setDialogError('')
  }

  const confirm = async () => {
    if (!detail || !pending || busy) return
    const needsNote = (MODERATION_INTERVIEW_NOTE_REQUIRED as readonly string[]).includes(pending)
    const trimmed = note.trim()
    if (needsNote && (!trimmed || trimmed.length > MODERATION_INTERVIEW_NOTE_MAX)) {
      setNoteError(true)
      return
    }
    setBusy(true)
    setDialogError('')
    setMessage('')
    try {
      const updated =
        pending === 'APPROVE' || pending === 'REQUEST_CHANGES'
          ? await moderatorInterviews.review(detail.question.id, { decision: pending, reviewToken: detail.reviewToken, note: trimmed || undefined })
          : await moderatorInterviews.publication(detail.question.id, { action: pending, reviewToken: detail.reviewToken, reason: trimmed || undefined })
      setDetail(updated)
      setStale(false)
      setError('')
      setPending(null)
      setMessage(t(`${pending}_done`))
    } catch (e) {
      if (isInterviewStale(e)) {
        setPending(null)
        setStale(true)
        setError(interviewErrorText(e, language, t('loadError')))
      } else if (isNotFound(e)) {
        setPending(null)
        setDetail(null)
        setNotFound(true)
      } else {
        setDialogError(interviewErrorText(e, language, t('loadError')))
      }
    } finally {
      setBusy(false)
    }
  }

  const frame = (children: ReactNode, extra = '') => (
    <main className={`mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 ${extra}`}>{children}</main>
  )

  if (loading && !detail) {
    return frame(
      <div aria-busy="true" aria-label={t('loading')} className="flex flex-col gap-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-48 w-full" />
      </div>,
    )
  }

  if (notFound) {
    return frame(
      <div className="flex flex-col items-start gap-4">
        <p className="text-muted-foreground">{t('notFound')}</p>
        <Button asChild variant="outline" className={touch}>
          <Link to="/moderator/interview-questions">{t('toList')}</Link>
        </Button>
      </div>,
    )
  }

  if (error && !detail) {
    return frame(
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
        <span>{error}</span>
        <Button size="sm" variant="outline" className={touch} onClick={reload}>
          <RefreshCw aria-hidden />
          {t('retry')}
        </Button>
      </div>,
    )
  }

  if (!detail) return null

  const { question: q, author, authorEligible } = detail
  const actions = moderatorInterviewActions(q.status)
  const shown = actions.slice(0, 2)
  const extra = actions.slice(2)
  const ineligible = q.status === 'PENDING' && !authorEligible
  const actionButton = (action: ModeratorInterviewAction) => {
    const Icon = ICONS[action]
    return (
      <Button
        key={action}
        variant={VARIANT[action]}
        className={`max-md:flex-1 ${touch}`}
        disabled={busy || stale || (action === 'APPROVE' && !authorEligible)}
        onClick={() => ask(action)}
      >
        <Icon aria-hidden />
        {t(action)}
      </Button>
    )
  }

  return frame(
    <>
      <Breadcrumb aria-label={t('backToQueue')}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/moderator/interview-questions" className="pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">{t('backToQueue')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate">{q.question}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="text-xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-2xl">{q.question}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge tone={interviewStatusTone(q.status)}>{interviewStatusLabel[q.status][language]}</Badge>
            <Badge tone={interviewLevelTone(q.level)}>{interviewLevelLabel[q.level][language]}</Badge>
            <Badge tone={toneFor(q.topic.name)}>{q.topic.name}</Badge>
            {q.aiAssisted && <Badge tone="purple"><Sparkles aria-hidden />{t('aiUsed')}</Badge>}
            <span className="inline-flex items-center gap-2 text-sm">
              <UserAvatar name={author.fullName} url={author.avatarUrl} className="size-6" />
              {author.fullName}
              {!authorEligible && (
                <span className="inline-flex items-center gap-1 text-tone-rose-fg">
                  <AlertTriangle aria-hidden className="size-4" />
                  {t('ineligible')}
                </span>
              )}
            </span>
          </div>
        </div>

        {actions.length > 0 && (
          <div
            role="group"
            aria-label={t('actions')}
            className="flex flex-wrap gap-2 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-20 max-md:flex-nowrap max-md:border-t max-md:border-border max-md:bg-background/95 max-md:p-3 max-md:backdrop-blur-md"
          >
            {shown.map(actionButton)}
            {extra.length > 0 && (
              <Popover open={moreOpen} onOpenChange={setMoreOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" aria-label={t('more')} className="min-h-11 min-w-11">
                    <MoreHorizontal aria-hidden />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-48 p-1">
                  <div className="flex flex-col gap-1">
                    {extra.map(action => {
                      const Icon = ICONS[action]
                      return (
                        <Button
                          key={action}
                          variant="ghost"
                          disabled={busy || stale}
                          className={`justify-start ${touch} ${action === 'REMOVE' ? 'text-danger' : ''}`}
                          onClick={() => ask(action)}
                        >
                          <Icon aria-hidden />
                          {t(action)}
                        </Button>
                      )
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
      </header>

      {stale && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-tone-amber-border bg-tone-amber-bg px-4 py-3 text-sm text-tone-amber-fg">
          <span>{error}</span>
          <Button size="sm" variant="outline" className={touch} onClick={reload}>
            <RefreshCw aria-hidden />
            {t('reload')}
          </Button>
        </div>
      )}
      {ineligible && (
        <p className="flex items-center gap-2 rounded-lg border border-tone-rose-border bg-tone-rose-bg px-4 py-3 text-sm text-tone-rose-fg">
          <AlertTriangle aria-hidden className="size-4 shrink-0" />
          {t('ineligible')}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">
          {message}
        </p>
      )}
      {q.moderationNote && (
        <div className="rounded-lg border border-tone-sky-border bg-tone-sky-bg px-4 py-3 text-sm text-tone-sky-fg">
          <span className="font-semibold">{t('previousNote')}:</span>{' '}
          <span className="whitespace-pre-line [overflow-wrap:anywhere]">“{q.moderationNote}”</span>
        </div>
      )}

      <Card className="gap-4 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col gap-1.5">
          <h2 className={fieldLabel}>{t('questionSection')}</h2>
          <MarkdownContent content={q.question} language={language} />
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
          <h2 className={fieldLabel}>{t('hintSection')}</h2>
          {q.hint?.trim() ? (
            <MarkdownContent content={q.hint} language={language} />
          ) : (
            <p className="text-sm text-muted-foreground">{t('noHint')}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
          <h2 className={fieldLabel}>{t('sampleAnswerSection')}</h2>
          <MarkdownContent content={q.sampleAnswer} language={language} />
        </div>
      </Card>

      <AlertDialog open={pending !== null} onOpenChange={open => { if (!open && !busy) setPending(null) }}>
        {pending && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t(`${pending}_title`)}</AlertDialogTitle>
              <AlertDialogDescription className="[overflow-wrap:anywhere]">{t(`${pending}_text`)}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="interview-moderation-note" className={fieldLabel}>
                {t((MODERATION_INTERVIEW_NOTE_REQUIRED as readonly string[]).includes(pending) ? 'reasonRequired' : 'noteOptional')}
              </Label>
              <Textarea
                id="interview-moderation-note"
                rows={4}
                maxLength={MODERATION_INTERVIEW_NOTE_MAX}
                className="max-h-48 overflow-y-auto"
                value={note}
                aria-invalid={noteError && !note.trim()}
                aria-describedby="interview-moderation-note-hint"
                onChange={e => {
                  setNote(e.target.value)
                  setNoteError(false)
                }}
              />
              <div className="flex flex-wrap justify-between gap-2 text-xs">
                <p id="interview-moderation-note-hint" className="text-danger">
                  {noteError && !note.trim() ? t('noteMissing') : ''}
                </p>
                <span className="tabular-nums text-muted-foreground">{note.length.toLocaleString('vi-VN')}/1.000</span>
              </div>
            </div>
            {dialogError && (
              <div role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-3 py-2 text-sm text-danger">
                {dialogError}
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel className={touch} disabled={busy}>{t('cancel')}</AlertDialogCancel>
              <Button
                variant={VARIANT[pending] === 'outline' ? 'default' : VARIANT[pending]}
                className={touch}
                disabled={busy}
                onClick={() => void confirm()}
              >
                {t(pending)}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </>,
    actions.length ? 'max-md:pb-28' : '',
  )
}
