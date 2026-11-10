import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, Ban, CheckCircle2, CircleCheck, Eye, EyeOff, Info, MoreHorizontal, PencilLine, PlayCircle, RefreshCw, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { BadgeTone } from '@/components/ui/badge'
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
import { BackToTopButton } from '../../../components/BackToTopButton'
import { EmptyState } from '../../../components/EmptyState'
import { MarkdownContent } from '../../../components/MarkdownContent'
import { UserAvatar } from '../../../components/UserAvatar'
import { ArticleStatusBadges } from '../../../components/articles/ArticleStatusBadges'
import { ApiError } from '../../../services/api/client'
import { historyActionLabel } from '../../../data/articleI18n'
import { isCourseStale, moderatorCourseErrorText, moderatorCourseText, type ModeratorCourseText } from '../../../data/courseI18n'
import { lastReturnNote, moderatorActions } from '../../../services/articleService'
import { changedLessonFields, isCourseImage, moderatorCourses, visibleChanges, type LessonField } from '../../../services/courseService'
import type { ModeratorAction } from '../../../types/articles'
import type { ChangeStatus, CourseChapter, Lesson, ModeratorCourseDetail } from '../../../types/courses'
import type { Language } from '../../../types/preferences'
import { ArticleHistorySheet, HISTORY_TONE, fieldLabel, formatDate } from '../../Author/AuthorBlogsPage'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const crumb = 'pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center'
const NOTE_REQUIRED: ModeratorAction[] = ['REQUEST_CHANGES', 'HIDE', 'REMOVE']
const ICONS: Record<ModeratorAction, typeof CheckCircle2> = { APPROVE: CheckCircle2, REQUEST_CHANGES: PencilLine, HIDE: EyeOff, RESTORE: RotateCcw, REMOVE: Ban }
const VARIANT: Record<ModeratorAction, 'default' | 'outline' | 'destructive'> = { APPROVE: 'default', REQUEST_CHANGES: 'outline', HIDE: 'outline', RESTORE: 'default', REMOVE: 'destructive' }
// Wireframe 4b-2: every label has text, colour only reinforces it; archived also gets a strike-through.
const CHANGE_TONE: Partial<Record<ChangeStatus, BadgeTone>> = { NEW: 'green', CHANGED: 'amber', ARCHIVED: 'rose' }
const LESSON_LABEL: Record<LessonField, 'fieldTitle' | 'fieldSummary' | 'preview' | 'video' | 'fieldContent'> = { title: 'fieldTitle', summary: 'fieldSummary', preview: 'preview', video: 'video', content: 'fieldContent' }

type Selected = { kind: 'info' } | { kind: 'chapter'; id: string; status: ChangeStatus } | { kind: 'lesson'; id: string; status: ChangeStatus }
type LessonPair = { proposed: Lesson | null; live: Lesson | null; loading: boolean; error: string }

function ChangeBadge({ status, t }: { status: ChangeStatus; t: ModeratorCourseText }) {
  const tone = CHANGE_TONE[status]
  return tone ? <Badge tone={tone} className="shrink-0">{t(status as 'NEW' | 'CHANGED' | 'ARCHIVED')}</Badge> : null
}

function Side({ label, children }: { label: string; children: ReactNode }) {
  return <section aria-label={label} className="flex min-w-0 flex-col gap-5 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
    <h2 className="text-base font-bold">{label}</h2>
    {children}
  </section>
}

function Field({ label, marked, t, children }: { label: string; marked: boolean; t: ModeratorCourseText; children: ReactNode }) {
  return <div className={`flex flex-col gap-1.5 ${marked ? 'border-l-2 border-l-tone-amber-fg pl-3' : ''}`}>
    <div className="flex items-center gap-2"><span className={fieldLabel}>{label}</span>{marked && <Badge tone="amber">{t('changed')}</Badge>}</div>
    {children}
  </div>
}

function LessonSide({ lesson, label, changed, mark, t, imageAllowed }: { lesson: Lesson; label: string; changed: LessonField[]; mark: boolean; t: ModeratorCourseText; imageAllowed: (src: string) => boolean }) {
  const field = (name: LessonField, body: ReactNode) => <Field label={t(LESSON_LABEL[name])} marked={mark && changed.includes(name)} t={t}>{body}</Field>
  return <Side label={label}>
    {field('title', <p className="text-lg font-semibold [overflow-wrap:anywhere]">{lesson.title}</p>)}
    {field('summary', lesson.summary?.trim() ? <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{lesson.summary}</p> : <p className="text-sm text-muted-foreground">{t('noSummary')}</p>)}
    {field('preview', <p className="text-sm">{t(lesson.preview ? 'previewOn' : 'previewOff')}</p>)}
    {field('video', lesson.video
      ? <div className="aspect-video w-full overflow-hidden rounded-lg border border-border"><iframe title={t('videoTitle', { side: label })} src={`https://www.youtube-nocookie.com/embed/${lesson.video.videoId}`} className="size-full" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>
      : <p className="text-sm text-muted-foreground">{t('noVideo')}</p>)}
    {field('content', lesson.content?.trim() ? <div className="min-w-0"><MarkdownContent content={lesson.content} imageAllowed={imageAllowed} imagePlaceholder={t('imagePlaceholder')} /></div> : <p className="text-sm text-muted-foreground">{t('noContent')}</p>)}
  </Side>
}

function ChapterSide({ chapter, label, t }: { chapter: CourseChapter; label: string; t: ModeratorCourseText }) {
  return <Side label={label}>
    <Field label={t('fieldTitle')} marked={false} t={t}><p className="text-lg font-semibold [overflow-wrap:anywhere]">{chapter.title}</p></Field>
    <Field label={t('lessons')} marked={false} t={t}>
      <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-sm">{chapter.lessons.map(lesson => <li key={lesson.id} className="[overflow-wrap:anywhere]">{lesson.title}</li>)}</ol>
    </Field>
  </Side>
}

export function ModeratorCourseDetailPage({ language = 'vi' }: { language?: Language } = {}) {
  const { id = '' } = useParams()
  const t = moderatorCourseText(language)
  const mobile = useIsMobile()
  const [detail, setDetail] = useState<ModeratorCourseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<ModeratorAction | null>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState(false)
  const [dialogError, setDialogError] = useState<{ text: string; stale: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'both' | 'proposed' | 'live'>('both')
  const [moreOpen, setMoreOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [all, setAll] = useState(false)
  const [selected, setSelected] = useState<Selected>({ kind: 'info' })
  const [pair, setPair] = useState<LessonPair>({ proposed: null, live: null, loading: false, error: '' })
  const latestLesson = useRef(0)

  const load = useCallback(async () => {
    setLoading(true); setError(''); setNotFound(false)
    try { setDetail(await moderatorCourses.detail(id)) }
    catch (e) { if (e instanceof ApiError && e.status === 404) setNotFound(true); else setError(moderatorCourseErrorText(e, language, t('detailError'))) }
    finally { setLoading(false) }
  }, [id, language])
  useEffect(() => { void load() }, [load])

  // Lesson content comes per lesson: the working copy unless ARCHIVED, the live snapshot unless NEW.
  const liveVersionId = detail?.course.publishedVersion?.id
  const loadLesson = useCallback(async (lessonId: string, status: ChangeStatus) => {
    const round = ++latestLesson.current
    setPair({ proposed: null, live: null, loading: true, error: '' })
    try {
      const [proposed, live] = await Promise.all([
        status === 'ARCHIVED' ? null : moderatorCourses.lesson(id, lessonId),
        status === 'NEW' || !liveVersionId ? null : moderatorCourses.lesson(id, lessonId, liveVersionId),
      ])
      if (round === latestLesson.current) setPair({ proposed, live, loading: false, error: '' })
    } catch (e) { if (round === latestLesson.current) setPair({ proposed: null, live: null, loading: false, error: moderatorCourseErrorText(e, language, t('lessonError')) }) }
  }, [id, liveVersionId, language])
  useEffect(() => { if (selected.kind === 'lesson') void loadLesson(selected.id, selected.status) }, [selected, loadLesson])

  const ask = (action: ModeratorAction) => { setMoreOpen(false); setPending(action); setNote(''); setNoteError(false); setDialogError(null); setMessage('') }
  const confirm = async () => {
    if (!detail || !pending || busy) return
    if (NOTE_REQUIRED.includes(pending) && !note.trim()) { setNoteError(true); return }
    setBusy(true); setDialogError(null)
    try {
      const updated = pending === 'APPROVE' || pending === 'REQUEST_CHANGES'
        ? await moderatorCourses.review(detail.course.id, pending, detail.reviewToken, note)
        : await moderatorCourses.publication(detail.course.id, pending, detail.reviewToken, note)
      setDetail(updated); setMessage(t(`${pending}_done`)); setPending(null); setSelected({ kind: 'info' })
    } catch (e) { setDialogError({ text: moderatorCourseErrorText(e, language, t('detailError')), stale: isCourseStale(e) }) }
    finally { setBusy(false) }
  }
  // Drop the stale course (and its token) first, so a failed reload shows its error instead of the old actions.
  const reload = () => { setPending(null); setDetail(null); setSelected({ kind: 'info' }); void load() }

  const main = (body: ReactNode, extra = '') => <main className={`mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 ${extra}`}>{body}</main>
  if (!detail) {
    if (loading) return main(<div aria-busy="true" aria-label={t('loading')} className="flex flex-col gap-4"><Skeleton className="h-4 w-60" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-6 w-80 max-w-full" /><div className="grid gap-4 md:grid-cols-[1fr_2fr]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div></div>)
    if (notFound) return main(<EmptyState icon={AlertTriangle} title={t('notFound')} action={<Button asChild variant="outline" className={touch}><Link to="/moderator/courses">{t('backToList')}</Link></Button>} />)
    return main(<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger"><span>{error}</span><Button size="sm" variant="outline" className={touch} onClick={() => void load()}><RefreshCw />{t('retry')}</Button></div>)
  }

  const { course, author } = detail
  const live = course.publishedVersion
  const actions = moderatorActions(course)
  const imageAllowed = (src: string) => isCourseImage(src, course.authorId, course.id)
  const ineligible = course.workflowStatus === 'PENDING' && !detail.authorEligible
  const returned = pending === 'APPROVE' ? lastReturnNote(course) : null
  const [shown, extra] = mobile ? [actions.slice(0, 2), actions.slice(2)] : [actions, []]
  const actionButton = (action: ModeratorAction) => { const Icon = ICONS[action]; return <Button key={action} variant={VARIANT[action]} className={`max-md:min-h-11 max-md:flex-1 ${touch}`} disabled={busy || (action === 'APPROVE' && ineligible)} onClick={() => ask(action)}><Icon />{t(action)}</Button> }

  // Chapter numbers follow the working order; archived chapters have none.
  const numbers = new Map(detail.changes.filter(c => c.changeStatus !== 'ARCHIVED').map((c, i) => [c.id, i + 1]))
  const nodes = visibleChanges(detail.changes, all)
  const isSelected = (kind: Selected['kind'], nodeId?: string) => selected.kind === kind && (kind === 'info' || (selected as { id: string }).id === nodeId)
  const node = (key: string, kind: Selected['kind'], label: ReactNode, status: ChangeStatus | null, onClick: () => void, indent = false) => <li key={key}>
    <button type="button" aria-current={isSelected(kind, key) || undefined} onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md border-0 px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${touch} ${indent ? 'pl-6' : 'font-semibold'} ${isSelected(kind, key) ? 'bg-muted text-foreground' : 'bg-transparent hover:bg-muted/60'}`}>
      <span className={`min-w-0 flex-1 [overflow-wrap:anywhere] ${status === 'ARCHIVED' ? 'line-through' : ''}`}>{label}</span>
      {status && <ChangeBadge status={status} t={t} />}
    </button>
  </li>

  // Sides of the selected item: proposed (working) and/or live (published snapshot).
  let proposedSide: ReactNode = null
  let liveSide: ReactNode = null
  let body: ReactNode = null
  const liveLabel = live ? t('live', { n: live.versionNumber }) : ''
  if (selected.kind === 'info') {
    proposedSide = <Side label={t('proposed')}>
      {live && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Info aria-hidden className="size-4 shrink-0" />{t('infoNote')}</p>}
      <Field label={t('fieldTitle')} marked={false} t={t}><p className="text-lg font-semibold [overflow-wrap:anywhere]">{course.title}</p></Field>
      <Field label={t('fieldSummary')} marked={false} t={t}>{course.summary?.trim() ? <p className="border-l-4 border-primary pl-3 text-sm text-muted-foreground [overflow-wrap:anywhere]">{course.summary}</p> : <p className="text-sm text-muted-foreground">{t('noSummary')}</p>}</Field>
      <div className="flex flex-wrap gap-6">
        <Field label={t('level')} marked={false} t={t}><Badge tone="slate" className="self-start">{t(course.level)}</Badge></Field>
        <Field label={t('fieldTopic')} marked={false} t={t}><Badge tone={toneFor(course.topic.name)} className="self-start">{course.topic.name}</Badge></Field>
        <Field label={t('fieldTags')} marked={false} t={t}>{course.tags.length
          ? <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">{course.tags.map(tag => <li key={tag.id}><Badge tone={toneFor(tag.name)}>#{tag.name}</Badge></li>)}</ul>
          : <p className="text-sm text-muted-foreground">{t('noTags')}</p>}</Field>
      </div>
      <Field label={t('fieldCover')} marked={false} t={t}>{course.coverImageUrl && imageAllowed(course.coverImageUrl)
        ? <img src={course.coverImageUrl} alt="" className="aspect-video w-full max-w-md rounded-lg border border-border object-cover" />
        : <p className="text-sm text-muted-foreground">{course.coverImageUrl ? t('imagePlaceholder') : t('noCover')}</p>}</Field>
      <Field label={t('description')} marked={false} t={t}>{course.description?.trim()
        ? <div className="min-w-0"><MarkdownContent content={course.description} imageAllowed={imageAllowed} imagePlaceholder={t('imagePlaceholder')} /></div>
        : <p className="text-sm text-muted-foreground">{t('noDescription')}</p>}</Field>
    </Side>
  } else if (selected.kind === 'chapter') {
    const working = course.chapters.find(c => c.id === selected.id)
    const published = live?.chapters.find(c => c.id === selected.id)
    if (working && selected.status !== 'ARCHIVED') proposedSide = <ChapterSide chapter={working} label={t('proposed')} t={t} />
    if (published && selected.status !== 'NEW') liveSide = <ChapterSide chapter={published} label={liveLabel} t={t} />
  } else if (pair.loading) {
    body = <div aria-busy="true" aria-label={t('lessonLoading')} className="flex flex-col gap-3"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-64" /></div>
  } else if (pair.error) {
    body = <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger"><span>{pair.error}</span><Button size="sm" variant="outline" className={touch} onClick={() => void loadLesson(selected.id, selected.status)}><RefreshCw />{t('retry')}</Button></div>
  } else {
    const changed = pair.proposed && pair.live ? changedLessonFields(pair.proposed, pair.live) : []
    if (pair.proposed) proposedSide = <LessonSide lesson={pair.proposed} label={t('proposed')} changed={changed} mark t={t} imageAllowed={imageAllowed} />
    if (pair.live) liveSide = <LessonSide lesson={pair.live} label={liveLabel} changed={changed} mark={false} t={t} imageAllowed={imageAllowed} />
  }
  const twoSides = Boolean(proposedSide && liveSide)
  const view = !twoSides ? 'single' : mobile && mode === 'both' ? 'proposed' : mode
  if (!body) body = <>
    {twoSides && <div role="group" aria-label={t('compareMode')} className="flex gap-1 self-end rounded-lg border border-border p-1">
      {([...(mobile ? [] : ['both' as const]), 'proposed', 'live'] as const).map(value => <Button key={value} size="sm" variant={view === value ? 'default' : 'ghost'} aria-pressed={view === value} className={touch} onClick={() => setMode(value)}>
        {value === 'both' ? t('both') : value === 'proposed' ? t('proposedShort') : t('liveShort')}
      </Button>)}
    </div>}
    <div className={view === 'both' ? 'grid items-start gap-4 xl:grid-cols-2' : 'flex flex-col gap-4'}>
      {view !== 'proposed' && liveSide}
      {view !== 'live' && proposedSide}
    </div>
  </>

  return main(<>
    <Breadcrumb aria-label={t('breadcrumb')}>
      <BreadcrumbList className="m-0 list-none p-0">
        <BreadcrumbItem><BreadcrumbLink asChild><Link to="/moderator" className={crumb}>{t('moderator')}</Link></BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbLink asChild><Link to="/moderator/courses" className={crumb}>{t('articles')}</Link></BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="truncate">{course.title}</BreadcrumbPage></BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>

    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-3">
        <h1 className="text-2xl font-bold [overflow-wrap:anywhere] sm:text-3xl">{course.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <ArticleStatusBadges article={course} language={language} moderator />
          {live && <Badge tone="green">v{live.versionNumber}</Badge>}
          <span className="inline-flex items-center gap-2 text-sm"><UserAvatar name={author.fullName} url={author.avatarUrl} className="size-6" />{author.fullName}
            {detail.authorEligible ? <span className="inline-flex items-center gap-1 text-tone-green-fg"><CircleCheck aria-hidden className="size-4" />{t('eligible')}</span> : <span className="inline-flex items-center gap-1 text-tone-rose-fg"><AlertTriangle aria-hidden className="size-4" />{t('ineligible')}</span>}
          </span>
        </div>
      </div>
      {actions.length > 0 && <div role="group" aria-label={t('actions')} className="flex flex-wrap gap-2 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-20 max-md:flex-nowrap max-md:border-t max-md:border-border max-md:bg-background max-md:p-3">
        {shown.map(actionButton)}
        {extra.length > 0 && <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild><Button variant="outline" size="icon" aria-label={t('actions')} className="min-h-11 min-w-11"><MoreHorizontal /></Button></PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-1"><div className="flex flex-col gap-1">{extra.map(action => { const Icon = ICONS[action]; return <Button key={action} variant="ghost" disabled={busy} className={`justify-start ${touch} ${action === 'REMOVE' ? 'text-danger' : ''}`} onClick={() => ask(action)}><Icon />{t(action)}</Button> })}</div></PopoverContent>
        </Popover>}
      </div>}
    </header>

    {ineligible && <p className="flex items-center gap-2 rounded-lg border border-tone-rose-border bg-tone-rose-bg px-4 py-3 text-sm text-tone-rose-fg"><AlertTriangle aria-hidden className="size-4 shrink-0" />{t('ineligibleReason')}</p>}
    {course.publicationStatus === 'REMOVED' && <p className="rounded-lg border border-tone-rose-border bg-tone-rose-bg px-4 py-3 text-sm text-tone-rose-fg">{t('removedBanner')}</p>}
    {course.publicationStatus === 'AUTHOR_DELETED' && <p className="rounded-lg border border-tone-slate-border bg-tone-slate-bg px-4 py-3 text-sm text-tone-slate-fg">{t('deletedBanner')}</p>}
    {message && <p role="status" className="rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">{message}</p>}

    <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card className="gap-3 rounded-2xl p-4 md:sticky md:top-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="course-changes" className="text-base font-bold">{t('changes')}</h2>
          <div role="group" aria-label={t('changes')} className="flex gap-1 rounded-lg border border-border p-1">
            {([false, true] as const).map(value => <Button key={String(value)} size="sm" variant={all === value ? 'default' : 'ghost'} aria-pressed={all === value} className={touch} onClick={() => setAll(value)}>{t(value ? 'viewAll' : 'changesOnly')}</Button>)}
          </div>
        </div>
        <nav aria-labelledby="course-changes">
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {node('info', 'info', <span className="inline-flex items-center gap-2"><Info aria-hidden className="size-4" />{t('courseInfo')}</span>, null, () => setSelected({ kind: 'info' }))}
            {nodes.map(chapter => <li key={chapter.id}>
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {node(chapter.id, 'chapter', <>{numbers.has(chapter.id) && <span className={`${fieldLabel} mr-2`}>{t('chapterN', { n: numbers.get(chapter.id)! })}</span>}{chapter.title}</>, chapter.changeStatus, () => setSelected({ kind: 'chapter', id: chapter.id, status: chapter.changeStatus }))}
                {chapter.lessons.map(lesson => node(lesson.id, 'lesson', <>{/* Plain inline (not inline-flex): line-through does not reach into atomic inline children. */}<PlayCircle aria-hidden className="mr-1.5 inline size-3.5 align-[-2px] text-muted-foreground" />{lesson.title}</>, lesson.changeStatus, () => setSelected({ kind: 'lesson', id: lesson.id, status: lesson.changeStatus }), true))}
              </ul>
            </li>)}
          </ul>
          {!nodes.length && <p className="px-2 py-1.5 text-sm text-muted-foreground">{t('noChanges')}</p>}
        </nav>
      </Card>
      <div className="flex min-w-0 flex-col gap-3">{body}</div>
    </div>

    <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card className="gap-3 rounded-2xl p-5">
        <h2 className="text-base font-bold">{t('authorCard')}</h2>
        <div className="flex items-center gap-3"><UserAvatar name={author.fullName} url={author.avatarUrl} className="size-10" /><span className="font-semibold [overflow-wrap:anywhere]">{author.fullName}</span></div>
        {detail.authorEligible
          ? <Badge tone="green" className="self-start"><CircleCheck aria-hidden />{t('eligible')}</Badge>
          : <Badge tone="rose" className="self-start"><AlertTriangle aria-hidden />{t('ineligible')}</Badge>}
      </Card>
      <Card className="gap-3 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">{t('historyRecent')}</h2>
          <Button size="sm" variant="outline" className={touch} onClick={() => setHistoryOpen(true)}><Eye />{t('viewAll')}</Button>
        </div>
        {detail.history.length
          ? <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {detail.history.map(entry => <li key={entry.id} className="flex gap-3">
              <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${HISTORY_TONE[entry.action]}`} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold">{historyActionLabel[entry.action][language]}{entry.versionNumber ? ` · v${entry.versionNumber}` : ''}{entry.actor ? ` · ${entry.actor.fullName}` : ''}</span>
                <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt, language, true)}</span>
                {entry.note && <p className="text-sm whitespace-pre-line [overflow-wrap:anywhere]">“{entry.note}”</p>}
              </div>
            </li>)}
          </ol>
          : <p className="text-sm text-muted-foreground">{t('historyEmpty')}</p>}
      </Card>
    </div>

    <BackToTopButton label={t('backToTop')} className={actions.length ? 'bottom-6 max-md:bottom-24' : 'bottom-6'} />
    <ArticleHistorySheet target={historyOpen ? course : null} language={language} title={t('history')} onClose={() => setHistoryOpen(false)} fetchPage={moderatorCourses.history} />

    <AlertDialog open={pending !== null} onOpenChange={open => { if (!open && !busy) setPending(null) }}>
      {pending && <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`${pending}_title`)}</AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]">{t(`${pending}_text`, { n: (live?.versionNumber ?? 0) + 1 })}</AlertDialogDescription>
        </AlertDialogHeader>
        {returned && <div className="rounded-lg border border-tone-sky-border bg-tone-sky-bg px-4 py-3 text-sm text-tone-sky-fg"><span className="font-semibold">{t('lastReturn')}</span> <span className="whitespace-pre-line [overflow-wrap:anywhere]">“{returned}”</span></div>}
        <div className="flex flex-col gap-2">
          <Label htmlFor="course-moderation-note" className={fieldLabel}>{t(pending === 'REQUEST_CHANGES' ? 'noteRequired' : NOTE_REQUIRED.includes(pending) ? 'reasonRequired' : 'noteOptional')}</Label>
          <Textarea id="course-moderation-note" rows={4} maxLength={2000} className="max-h-48 overflow-y-auto" value={note} aria-invalid={noteError && !note.trim()} aria-describedby="course-moderation-note-hint"
            onChange={e => { setNote(e.target.value); setNoteError(false) }} />
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <p id="course-moderation-note-hint" className="text-danger">{noteError && !note.trim() ? t(pending === 'REQUEST_CHANGES' ? 'noteMissing' : 'reasonMissing') : ''}</p>
            <span className="text-muted-foreground tabular-nums">{note.length}/2000</span>
          </div>
        </div>
        {dialogError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-tone-rose-bg px-3 py-2 text-sm text-danger">
          <span>{dialogError.text}</span>
          {dialogError.stale && <Button size="sm" variant="outline" className={touch} onClick={reload}><RefreshCw />{t('reload')}</Button>}
        </div>}
        <AlertDialogFooter>
          <AlertDialogCancel className={touch} disabled={busy}>{t('cancel')}</AlertDialogCancel>
          <Button variant={VARIANT[pending] === 'outline' ? 'default' : VARIANT[pending]} className={touch} disabled={busy || dialogError?.stale} onClick={() => void confirm()}>{t(pending)}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
  </>, actions.length ? 'max-md:pb-28' : '')
}
