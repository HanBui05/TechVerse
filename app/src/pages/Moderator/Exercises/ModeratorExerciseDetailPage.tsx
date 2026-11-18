import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, Ban, CheckCircle2, CircleCheck, EyeOff, MoreHorizontal, PencilLine, RefreshCw, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { toneFor } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '../../../components/EmptyState'
import { MarkdownContent } from '../../../components/MarkdownContent'
import { UserAvatar } from '../../../components/UserAvatar'
import { ApiError } from '../../../services/api/client'
import { difficultyLabel, isExerciseStale, moderatorExerciseErrorText, moderatorExerciseText, statusLabel, typeLabel } from '../../../data/exerciseI18n'
import { MODERATION_NOTE_MAX, MODERATION_NOTE_REQUIRED, moderatorExerciseActions, moderatorExercises } from '../../../services/exerciseService'
import type { ExerciseModeration, ModeratorExerciseDetail } from '../../../types/exercises'
import type { Language } from '../../../types/preferences'
import { fieldLabel } from '../../Author/AuthorBlogsPage'
import { exerciseTone } from '../../Author/Exercises/AuthorExercisesPage'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const crumb = 'pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center'
const ICONS: Record<ExerciseModeration, typeof CheckCircle2> = { APPROVE: CheckCircle2, REQUEST_CHANGES: PencilLine, HIDE: EyeOff, RESTORE: RotateCcw, REMOVE: Ban }
const VARIANT: Record<ExerciseModeration, 'default' | 'outline' | 'destructive'> = { APPROVE: 'default', REQUEST_CHANGES: 'outline', HIDE: 'outline', RESTORE: 'default', REMOVE: 'destructive' }

// The fence is longer than any backtick run inside the code, so the snippet cannot close it early.
const fenced = (code: string, language: string | null) => { const fence = '`'.repeat(Math.max(3, ...(code.match(/`+/g) ?? []).map(run => run.length + 1))); const label = /^[\w+#.-]{1,50}$/.test(language ?? '') ? language : ''
  return `${fence}${label}\n${code}\n${fence}` }

export function ModeratorExerciseDetailPage({ language = 'vi' }: { language?: Language } = {}) {
  const { id = '' } = useParams()
  const t = moderatorExerciseText(language)
  const mobile = useIsMobile()
  const [detail, setDetail] = useState<ModeratorExerciseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<ExerciseModeration | null>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState(false)
  const [dialogError, setDialogError] = useState('')
  // A stale token or state locks every write until the set is reloaded (wireframe 5).
  const [stale, setStale] = useState(false)
  const [busy, setBusy] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(''); setNotFound(false)
    try { setDetail(await moderatorExercises.detail(id)); setStale(false) }
    catch (e) { if (e instanceof ApiError && e.status === 404) setNotFound(true); else setError(moderatorExerciseErrorText(e, language, t('loadError'))) }
    finally { setLoading(false) }
  }, [id, language])
  useEffect(() => { void load() }, [load])

  const ask = (action: ExerciseModeration) => { setMoreOpen(false); setPending(action); setNote(''); setNoteError(false); setDialogError(''); setMessage('') }
  // Never retried automatically: a review that failed may already have been applied by someone else.
  const confirm = async () => {
    if (!detail || !pending || busy) return
    if (MODERATION_NOTE_REQUIRED.includes(pending) && !note.trim()) { setNoteError(true); return }
    setBusy(true); setDialogError('')
    try {
      const updated = pending === 'APPROVE' || pending === 'REQUEST_CHANGES'
        ? await moderatorExercises.review(detail.set.id, pending, detail.reviewToken, note)
        : await moderatorExercises.publication(detail.set.id, pending, detail.reviewToken, note)
      setDetail(updated); setMessage(t(`${pending}_done`)); setPending(null)
    } catch (e) {
      // The author withdrew the set meanwhile: it is no longer visible to moderators.
      if (e instanceof ApiError && e.status === 404) { setPending(null); setDetail(null); setNotFound(true) }
      else if (isExerciseStale(e)) { setPending(null); setStale(true); setError(e instanceof ApiError && e.code === 'EXERCISE_STATE_INVALID' ? t('stateInvalid') : t('staleBanner')) }
      else setDialogError(moderatorExerciseErrorText(e, language, t('loadError')))
    } finally { setBusy(false) }
  }
  // Drop the old set (and its token) first, so a failed reload shows its error instead of the old actions.
  const reload = () => { setPending(null); setDetail(null); setError(''); void load() }

  const main = (body: React.ReactNode, extra = '') => <main className={`mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 ${extra}`}>{body}</main>
  if (!detail) {
    if (loading) return main(<div aria-busy="true" aria-label={t('loading')} className="flex flex-col gap-4"><Skeleton className="h-4 w-60" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-6 w-80 max-w-full" /><Skeleton className="h-64" /></div>)
    if (notFound) return main(<EmptyState icon={AlertTriangle} title={t('notFound')} action={<Button asChild variant="outline" className={touch}><Link to="/moderator/exercises">{t('toList')}</Link></Button>} />)
    return main(<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger"><span>{error}</span><Button size="sm" variant="outline" className={touch} onClick={() => void load()}><RefreshCw />{t('retry')}</Button></div>)
  }

  const { set, author, authorEligible } = detail
  const card = set.type === 'FLASHCARD'
  const actions = moderatorExerciseActions(set.status)
  const ineligible = set.status === 'PENDING' && !authorEligible
  const [shown, extra] = mobile ? [actions.slice(0, 2), actions.slice(2)] : [actions, []]
  const actionButton = (action: ExerciseModeration) => { const Icon = ICONS[action]; return <Button key={action} variant={VARIANT[action]} className={`max-md:min-h-11 max-md:flex-1 ${touch}`} disabled={busy || stale || (action === 'APPROVE' && ineligible)} onClick={() => ask(action)}><Icon />{t(action)}</Button> }
  const markdown = (text: string | null) => <div className="min-w-0"><MarkdownContent content={text ?? ''} imageAllowed={() => false} imagePlaceholder="" /></div>

  return main(<>
    <Breadcrumb aria-label={t('breadcrumb')}>
      <BreadcrumbList className="m-0 list-none p-0">
        <BreadcrumbItem><BreadcrumbLink asChild><Link to="/moderator" className={crumb}>{t('moderator')}</Link></BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbLink asChild><Link to="/moderator/exercises" className={crumb}>{t('back')}</Link></BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="truncate">{set.title}</BreadcrumbPage></BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>

    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-3">
        <h1 className="text-2xl font-bold [overflow-wrap:anywhere] sm:text-3xl">{set.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge tone={exerciseTone(set.status)}>{statusLabel[set.status][language]}</Badge>
          <Badge tone="slate">{typeLabel[set.type][language]}</Badge>
          <Badge tone="slate">{difficultyLabel[set.difficulty][language]}</Badge>
          <Badge tone={toneFor(set.topic.name)}>{set.topic.name}</Badge>
          {set.aiAssisted && <Badge tone="purple">{t('aiUsed')}</Badge>}
          <span className="inline-flex items-center gap-2 text-sm"><UserAvatar name={author.fullName} url={author.avatarUrl} className="size-6" />{author.fullName}
            {!authorEligible && <span className="inline-flex items-center gap-1 text-tone-rose-fg"><AlertTriangle aria-hidden className="size-4" />{t('ineligible')}</span>}
          </span>
          <span className="text-sm text-muted-foreground">{t(card ? 'cards' : 'questions', { n: set.questions.length })}</span>
        </div>
      </div>
      {actions.length > 0 && <div role="group" aria-label={t('actions')} className="flex flex-wrap gap-2 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-20 max-md:flex-nowrap max-md:border-t max-md:border-border max-md:bg-background max-md:p-3">
        {shown.map(actionButton)}
        {extra.length > 0 && <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild><Button variant="outline" size="icon" aria-label={t('more')} className="min-h-11 min-w-11"><MoreHorizontal /></Button></PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-1"><div className="flex flex-col gap-1">{extra.map(action => { const Icon = ICONS[action]; return <Button key={action} variant="ghost" disabled={busy || stale} className={`justify-start ${touch} ${action === 'REMOVE' ? 'text-danger' : ''}`} onClick={() => ask(action)}><Icon />{t(action)}</Button> })}</div></PopoverContent>
        </Popover>}
      </div>}
    </header>

    {stale && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-tone-amber-border bg-tone-amber-bg px-4 py-3 text-sm text-tone-amber-fg"><span>{error}</span><Button size="sm" variant="outline" className={touch} onClick={reload}><RefreshCw />{t('reload')}</Button></div>}
    {ineligible && <p className="flex items-center gap-2 rounded-lg border border-tone-rose-border bg-tone-rose-bg px-4 py-3 text-sm text-tone-rose-fg"><AlertTriangle aria-hidden className="size-4 shrink-0" />{t('ineligible')}</p>}
    {message && <p role="status" className="rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">{message}</p>}
    {set.moderationNote && <div className="rounded-lg border border-tone-sky-border bg-tone-sky-bg px-4 py-3 text-sm text-tone-sky-fg"><span className="font-semibold">{t('previousNote')}:</span> <span className="whitespace-pre-line [overflow-wrap:anywhere]">“{set.moderationNote}”</span></div>}
    {set.description.trim() && <div className="min-w-0">{markdown(set.description)}</div>}

    {set.questions.length === 0 ? <p className="text-sm text-muted-foreground">{t('noQuestions')}</p>
      : <ol className="m-0 flex list-none flex-col gap-4 p-0">
        {set.questions.map((q, index) => <li key={q.id}><Card className="gap-4 rounded-2xl p-5">
          <h2 className="text-base font-bold">{t(card ? 'cardN' : 'questionN', { n: index + 1 })}</h2>
          {card
            ? <>
              <div className="flex flex-col gap-1.5"><span className={fieldLabel}>{t('front')}</span>{markdown(q.front)}</div>
              <div className="flex flex-col gap-1.5"><span className={fieldLabel}>{t('backFace')}</span>{markdown(q.back)}</div>
            </>
            : <>
              {markdown(q.content)}
              {q.codeSnippet && <div className="min-w-0">{markdown(fenced(q.codeSnippet, q.codeLanguage))}</div>}
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {(q.options ?? []).map((option, i) => <li key={i} className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm [overflow-wrap:anywhere] ${i === q.correctIndex ? 'border-tone-green-border bg-tone-green-bg text-tone-green-fg' : 'border-border'}`}>
                  <span className="font-semibold">{String.fromCharCode(65 + i)}.</span><span className="min-w-0 flex-1">{option}</span>
                  {i === q.correctIndex && <span className="inline-flex items-center gap-1 font-semibold"><CircleCheck aria-hidden className="size-4" />{t('correctAnswer')}</span>}
                </li>)}
              </ul>
            </>}
          {q.explanation?.trim() && <div className="flex flex-col gap-1.5"><span className={fieldLabel}>{t('explanation')}</span>{markdown(q.explanation)}</div>}
        </Card></li>)}
      </ol>}

    <AlertDialog open={pending !== null} onOpenChange={open => { if (!open && !busy) setPending(null) }}>
      {pending && <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`${pending}_title`)}</AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]">{t(`${pending}_text`)}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="exercise-moderation-note" className={fieldLabel}>{t(MODERATION_NOTE_REQUIRED.includes(pending) ? 'reasonRequired' : 'noteOptional')}</Label>
          <Textarea id="exercise-moderation-note" rows={4} maxLength={MODERATION_NOTE_MAX} className="max-h-48 overflow-y-auto" value={note} aria-invalid={noteError && !note.trim()} aria-describedby="exercise-moderation-note-hint"
            onChange={e => { setNote(e.target.value); setNoteError(false) }} />
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <p id="exercise-moderation-note-hint" className="text-danger">{noteError && !note.trim() ? t('noteMissing') : ''}</p>
            <span className="text-muted-foreground tabular-nums">{note.length.toLocaleString('vi-VN')}/1.000</span>
          </div>
        </div>
        {dialogError && <div role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-3 py-2 text-sm text-danger">{dialogError}</div>}
        <AlertDialogFooter>
          <AlertDialogCancel className={touch} disabled={busy}>{t('cancel')}</AlertDialogCancel>
          <Button variant={VARIANT[pending] === 'outline' ? 'default' : VARIANT[pending]} className={touch} disabled={busy} onClick={() => void confirm()}>{t(pending)}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
  </>, actions.length ? 'max-md:pb-28' : '')
}
