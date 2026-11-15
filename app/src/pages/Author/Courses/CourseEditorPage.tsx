import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { MutableRefObject, ReactNode } from 'react'
import { Link, UNSAFE_DataRouterContext, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ExternalLink, Info, ListTree, RefreshCw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '../../../components/EmptyState'
import { courseErrorText, courseText } from '../../../data/courseI18n'
import { ApiError } from '../../../services/api/client'
import { authorActions } from '../../../services/articleService'
import { authorCourses, courseReadiness } from '../../../services/courseService'
import { fieldLabel } from '../AuthorBlogsPage'
import { CourseActionMenu, CourseStatusBadges, useCourseActions } from './courseActions'
import { CourseInfoPanel, type Guard } from './CourseInfoPanel'
import { CourseTree, sameSelection, type Selection } from './CourseTree'
import { LessonPanel } from './LessonPanel'
import type { ArticleOption } from '../../../types/articles'
import type { AuthorCourse, CourseFields } from '../../../types/courses'
import type { Language } from '../../../types/preferences'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
type Load = 'loading' | 'ready' | 'notFound' | 'error'
type Blocker = { proceed: () => void; reset: () => void }

const selectionOf = (params: URLSearchParams): Selection =>
  params.get('lesson') ? { kind: 'lesson', id: params.get('lesson')! } : params.get('chapter') ? { kind: 'chapter', id: params.get('chapter')! }
    : params.get('newLesson') ? { kind: 'newLesson', chapterId: params.get('newLesson')! } : params.get('newChapter') ? { kind: 'newChapter' } : { kind: 'course' }
const paramsOf = (s: Selection): Record<string, string> => s.kind === 'lesson' ? { lesson: s.id } : s.kind === 'chapter' ? { chapter: s.id } : s.kind === 'newLesson' ? { newLesson: s.chapterId } : s.kind === 'newChapter' ? { newChapter: '1' } : {}

/**
 * Blocks in-app navigation to another route (Sidebar, Back) while an item is dirty: save first, and if that fails ask before dropping it.
 * Needs a data router (see main.tsx); query-only changes (tree selection) are handled by `select`.
 */
function LeaveGuard({ guard, onFailed }: { guard: MutableRefObject<Guard | null>; onFailed: (blocker: Blocker) => void }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => Boolean(guard.current?.dirty) && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    void guard.current!.save().then(ok => { if (ok) { guard.current = null; blocker.proceed() } else onFailed(blocker) })
  }, [blocker, guard, onFailed])
  return null
}

/** Chapter panel: only a title (the API has no chapter description) plus the lessons it holds. `existing` null = a new chapter. */
function ChapterPanel({ language, existing, readOnly, busy, guard, onSave, onPick }: { language: Language; existing: AuthorCourse['chapters'][number] | null; readOnly: boolean; busy: boolean; guard: MutableRefObject<Guard | null>; onSave: (title: string) => Promise<boolean>; onPick: (id: string) => void }) {
  const t = courseText(language)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [problem, setProblem] = useState('')
  const dirty = title !== (existing?.title ?? '')
  const save = async () => { if (!title.trim()) { setProblem(t('chapterRequired')); return false } setProblem(''); return existing && !dirty ? true : onSave(title.trim()) }
  useEffect(() => { guard.current = { dirty: dirty && !readOnly && (existing !== null || title.trim() !== ''), save } })
  return <Card className="gap-4 rounded-2xl p-6">
    <form className="flex flex-col gap-2" onSubmit={e => { e.preventDefault(); void save() }}>
      <Label htmlFor="chapter-title" className={fieldLabel}>{t('chapterTitle')} *</Label>
      <div className="flex flex-wrap gap-2">
        <Input id="chapter-title" value={title} maxLength={255} readOnly={readOnly || busy} className={`min-w-0 flex-1 ${touch}`} aria-invalid={problem ? true : undefined} aria-describedby={problem ? 'chapter-title-error' : undefined} onChange={e => { setTitle(e.target.value); setProblem('') }} />
        {!readOnly && <Button type="submit" className={touch} disabled={busy}>{t('save')}</Button>}
      </div>
      {problem && <p id="chapter-title-error" role="alert" className="text-xs text-danger">{problem}</p>}
    </form>
    {existing && <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {existing.lessons.map(lesson => <li key={lesson.id}><Button variant="ghost" className={`h-auto w-full justify-start whitespace-normal text-left ${touch}`} onClick={() => onPick(lesson.id)}>{lesson.title}</Button></li>)}
    </ul>}
  </Card>
}

export function CourseEditorPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = courseText(language)
  const { id } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [params, setParams] = useSearchParams()
  const [course, setCourse] = useState<AuthorCourse | null>(null)
  const [status, setStatus] = useState<Load>(id ? 'loading' : 'ready')
  const [options, setOptions] = useState<{ topics: ArticleOption[]; tags: ArticleOption[] }>({ topics: [], tags: [] })
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [notReady, setNotReady] = useState(false)
  const [structureOpen, setStructureOpen] = useState(false)
  const [leaveTo, setLeaveTo] = useState<Selection | 'list' | 'route' | null>(null)
  const [removal, setRemoval] = useState<{ kind: 'chapter' | 'lesson'; id: string; name: string; hard: boolean } | null>(null)
  const guard = useRef<Guard | null>(null)
  const blocked = useRef<Blocker | null>(null)
  const inflight = useRef(false)
  const createKey = useRef<{ key: string; body: string } | null>(null)
  const loadedId = useRef<string | null>(null)
  const dataRouter = useContext(UNSAFE_DataRouterContext)
  const failedLeave = useCallback((blocker: Blocker) => { blocked.current = blocker; setLeaveTo('route') }, [])

  const apply = useCallback((next: AuthorCourse) => { loadedId.current = next.id; setCourse(next) }, [])
  const load = useCallback(async (courseId: string) => {
    setStatus('loading'); setError('')
    try { apply(await authorCourses.detail(courseId)); setStatus('ready') }
    catch (e) { setStatus(e instanceof ApiError && e.status === 404 ? 'notFound' : 'error'); setError(courseErrorText(e, language, t('loadError'))) }
  }, [apply, language])
  // After the first create the URL switches /new → /:id/edit; that course is already loaded.
  useEffect(() => { if (id && loadedId.current !== id) void load(id) }, [id, load])
  useEffect(() => { authorCourses.options().then(o => setOptions({ topics: o.topics.content, tags: o.tags.content }), () => {}) }, [])

  const matrix = course ? authorActions(course) : null
  const readOnly = Boolean(matrix?.readOnly)
  const actions = useCourseActions(language, (_action, updated) => {
    if (!updated) { navigate('/author/courses'); return }
    apply(updated); setMessage(t('actionDone'))
  })
  const selection = selectionOf(params)
  const dirty = () => Boolean(guard.current?.dirty)
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (guard.current?.dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  // One write at a time; a late response of an older write can never overwrite a newer tree.
  const write = async (action: () => Promise<boolean | void>) => {
    if (inflight.current) return false
    inflight.current = true; setBusy(true); setError(''); setMessage('')
    try { return (await action()) !== false } catch (e) { handle(e); return false }
    finally { inflight.current = false; setBusy(false) }
  }
  const handle = (e: unknown) => {
    setError(courseErrorText(e, language, t('loadError')))
    if (course && e instanceof ApiError && (e.code === 'COURSE_ORDER_INVALID' || e.code === 'COURSE_NOT_EDITABLE')) void authorCourses.detail(course.id).then(apply, () => {})
  }

  const go = (next: Selection) => { setStructureOpen(false); setParams(paramsOf(next), { replace: false }) }
  // Leaving an item saves it first; if that fails the Author decides (wireframe 3a-3).
  const select = async (next: Selection) => {
    if (sameSelection(next, selection)) { setStructureOpen(false); return }
    if (dirty()) { if (!(await guard.current!.save())) { setLeaveTo(next); return } }
    go(next)
  }
  const leaveList = async (e: React.MouseEvent) => {
    if (!dirty()) return
    e.preventDefault()
    if (await guard.current!.save()) navigate('/author/courses'); else setLeaveTo('list')
  }

  const saveInfo = (fields: Partial<CourseFields>) => write(async () => {
    if (!course) {
      const body = { action: 'SAVE' as const, ...fields }
      const json = JSON.stringify(body)
      if (createKey.current?.body !== json) createKey.current = { key: crypto.randomUUID(), body: json }
      const created = await authorCourses.create(body, createKey.current.key)
      // The form is saved: clear the guard so the route change below is not treated as leaving a dirty item.
      apply(created); guard.current = null; navigate(`/author/courses/${created.id}/edit`, { replace: true })
      return
    }
    apply(await authorCourses.update(course.id, { action: 'SAVE', ...fields })); setMessage(t('saved'))
  })
  const saveChapter = (title: string) => write(async () => {
    if (!course) return
    if (selection.kind === 'chapter') { apply(await authorCourses.editChapter(course.id, selection.id, title)); setMessage(t('saved')); return }
    const next = await authorCourses.addChapter(course.id, title)
    apply(next); setParams({ chapter: next.chapters[next.chapters.length - 1].id }, { replace: true })
  })
  const lessonSaved = async (lesson: { id: string }, created: boolean) => {
    if (!course) return
    apply(await authorCourses.detail(course.id)); setMessage(t('saved'))
    if (created) setParams({ lesson: lesson.id }, { replace: true })
  }
  const move = (kind: 'chapter' | 'lesson', itemId: string, direction: -1 | 1) => void write(async () => {
    if (!course) return
    const swap = (ids: string[]) => { const i = ids.indexOf(itemId); const j = i + direction; if (i < 0 || j < 0 || j >= ids.length) return ids; const next = [...ids]; [next[i], next[j]] = [next[j], next[i]]; return next }
    if (kind === 'chapter') apply(await authorCourses.reorderChapters(course.id, swap(course.chapters.map(c => c.id))))
    else { const chapter = course.chapters.find(c => c.lessons.some(l => l.id === itemId))!; apply(await authorCourses.reorderLessons(course.id, chapter.id, swap(chapter.lessons.map(l => l.id)))) }
  })
  const askRemove = (kind: 'chapter' | 'lesson', itemId: string, name: string) => {
    const live = course?.publishedVersion?.chapters
    const published = kind === 'chapter' ? live?.some(c => c.id === itemId) : live?.some(c => c.lessons.some(l => l.id === itemId))
    setRemoval({ kind, id: itemId, name, hard: !published })
  }
  const remove = () => {
    const target = removal
    setRemoval(null)
    if (!target || !course) return
    void write(async () => {
      apply(target.kind === 'chapter' ? await authorCourses.deleteChapter(course.id, target.id) : await authorCourses.deleteLesson(course.id, target.id))
      if ((selection.kind === 'chapter' || selection.kind === 'lesson') && selection.id === target.id) setParams({}, { replace: true })
    })
  }
  // The panel saves first, outside the write lock (its own save takes that lock); never while an image is still uploading.
  const submit = async () => {
    if (!course || inflight.current || uploading) return
    setNotReady(false)
    if (dirty() && !(await guard.current!.save())) return
    void write(submitNow)
  }
  const submitNow = async () => {
    if (!course) return false
    try { apply(await authorCourses.update(course.id, { action: 'SUBMIT' })); setMessage(t('submitted')) }
    catch (e) { if (e instanceof ApiError && e.code === 'COURSE_NOT_READY') { setNotReady(true); setError(t('notReady')) } else throw e }
  }

  if (status === 'loading') return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8" aria-busy="true"><Skeleton className="h-8 w-72 max-w-full" /><div className="grid gap-6 lg:grid-cols-[320px_1fr]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div></main>
  if (status !== 'ready') return <main className="tw-page mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
    {status === 'notFound'
      ? <EmptyState icon={AlertTriangle} title={t('notFound')} action={<Button asChild className={touch}><Link to="/author/courses">{t('backToList')}</Link></Button>} />
      : <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">{error}<Button variant="outline" size="sm" className={touch} onClick={() => id && void load(id)}><RefreshCw />{t('retry')}</Button></div>}
  </main>

  const guardElement = dataRouter && <LeaveGuard guard={guard} onFailed={failedLeave} />
  const back = <Link to="/author/courses" onClick={e => void leaveList(e)} className={`inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground ${touch}`}><ArrowLeft aria-hidden className="size-4" />{t('back')}</Link>
  if (!course) return <main className="tw-page mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
    {back}
    <h1 className="text-2xl font-bold">{t('newTitle')}</h1>
    <CourseInfoPanel language={language} course={null} options={options} readOnly={false} busy={busy} guard={guard} onSave={saveInfo} error={error} onUploading={setUploading} />
    {guardElement}
  </main>

  const wf = course.workflowStatus, pub = course.publicationStatus
  const live = course.publishedVersion
  const banner: [string, ReactNode, ReactNode?] | null = pub === 'REMOVED' ? ['border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg', course.moderationNote ? t('removedBanner', { note: course.moderationNote }) : t('removedBannerNoNote')]
    : wf === 'PENDING' ? ['border-tone-amber-border bg-tone-amber-bg text-tone-amber-fg', t('pendingBanner'), <Button size="sm" variant="outline" className={touch} disabled={actions.busy} onClick={() => actions.ask('withdraw', course)}>{t('withdraw')}</Button>]
      : pub === 'HIDDEN' ? ['border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg', t('hiddenBanner')]
        : pub === 'AUTHOR_HIDDEN' ? ['border-tone-slate-border bg-tone-slate-bg text-tone-slate-fg', t('authorHiddenBanner'), <Button size="sm" variant="outline" className={touch} disabled={actions.busy} onClick={() => actions.ask('unhide', course)}>{t('unhide')}</Button>]
          : wf === 'CHANGES_REQUESTED' ? ['border-tone-sky-border bg-tone-sky-bg text-tone-sky-fg', course.moderationNote ? t('changesBanner', { note: course.moderationNote }) : t('changesBannerNoNote')]
            : live && wf !== 'PUBLISHED' ? ['border-tone-blue-border bg-tone-blue-bg text-tone-blue-fg', t('liveBanner', { n: live.versionNumber })] : null

  const chapterIndex = (chapterId: string) => course.chapters.findIndex(c => c.id === chapterId)
  const lessonChapter = selection.kind === 'lesson' ? course.chapters.find(c => c.lessons.some(l => l.id === selection.id)) : undefined
  const chapter = selection.kind === 'chapter' ? course.chapters.find(c => c.id === selection.id) : undefined
  const missingItem = (selection.kind === 'lesson' && !lessonChapter) || (selection.kind === 'chapter' && !chapter) || (selection.kind === 'newLesson' && chapterIndex(selection.chapterId) < 0)
  const current: Selection = missingItem ? { kind: 'course' } : selection
  const currentName = current.kind === 'lesson' ? lessonChapter!.lessons.find(l => l.id === current.id)!.title : current.kind === 'chapter' ? chapter!.title : current.kind === 'newChapter' ? t('addChapter') : current.kind === 'newLesson' ? t('addLesson') : t('courseInfo')
  const lockedTree = busy || readOnly || uploading
  const tree = <CourseTree language={language} course={course} selected={current} locked={lockedTree} onSelect={next => void select(next)} onMove={move} onDelete={askRemove} />
  const panelKey = JSON.stringify(current)

  const panel = current.kind === 'course'
    ? <CourseInfoPanel key={`${course.id}:${course.updatedAt}`} language={language} course={course} options={options} readOnly={readOnly} busy={busy} guard={guard} onSave={saveInfo} onUploading={setUploading} />
    : current.kind === 'chapter' || current.kind === 'newChapter'
      ? <ChapterPanel key={`${panelKey}:${chapter?.title}`} language={language} existing={chapter ?? null} readOnly={readOnly} busy={busy} guard={guard} onSave={saveChapter} onPick={lessonId => void select({ kind: 'lesson', id: lessonId })} />
      : <LessonPanel key={panelKey} language={language} course={course} lessonId={current.kind === 'lesson' ? current.id : null} chapterId={current.kind === 'lesson' ? lessonChapter!.id : current.chapterId}
        chapterNumber={(current.kind === 'lesson' ? course.chapters.indexOf(lessonChapter!) : chapterIndex(current.chapterId)) + 1} readOnly={readOnly} busy={busy} guard={guard} onSaved={lessonSaved} onUploading={setUploading} />

  const missing = notReady ? courseReadiness(course) : []
  const missingText = (m: ReturnType<typeof courseReadiness>[number]) => m.kind === 'noChapter' ? t('rNoChapter') : m.kind === 'summary' ? t('rSummary') : m.kind === 'description' ? t('rDescription')
    : m.kind === 'emptyChapter' ? t('rEmptyChapter', { name: course.chapters.find(c => c.id === m.chapterId)?.title ?? '' }) : t('rImages', { n: m.count })
  const missingTarget = (m: ReturnType<typeof courseReadiness>[number]): Selection => m.kind === 'emptyChapter' ? { kind: 'chapter', id: m.chapterId } : m.kind === 'noChapter' ? { kind: 'newChapter' } : { kind: 'course' }
  const savedAt = t('savedAt', { time: new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { timeStyle: 'short' }).format(new Date(course.updatedAt)) })

  return <main className={`tw-page mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 ${isMobile && !readOnly ? 'pb-24' : ''}`}>
    <header className="sticky top-16 z-10 -mx-4 flex flex-col gap-2 border-b border-border bg-background/95 px-4 py-3 sm:-mx-6 sm:px-6 md:top-0 lg:-mx-8 lg:px-8">
      {back}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold [overflow-wrap:anywhere] sm:text-2xl">{course.title}</h1>
        <CourseStatusBadges course={course} language={language} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{savedAt}</span>
          {live && !isMobile && <Button asChild variant="outline" className={touch}><Link to={`/courses/${course.id}`} target="_blank" rel="noopener"><ExternalLink />{t('previewCourse')}</Link></Button>}
          {!readOnly && !isMobile && <Button className={touch} disabled={busy || uploading} onClick={() => void submit()}><Send />{t('submit')}</Button>}
          <CourseActionMenu course={course} language={language} onAsk={actions.ask} disabled={actions.busy} />
        </div>
      </div>
    </header>

    {banner && <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${banner[0]}`}><span className="inline-flex items-start gap-2 [overflow-wrap:anywhere]"><Info aria-hidden className="mt-0.5 size-4 shrink-0" />{banner[1]}</span>{banner[2]}</div>}
    {(error || actions.error) && <div role="alert" className="flex flex-col gap-2 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
      <div className="flex flex-wrap items-center justify-between gap-3"><span>{error || actions.error}</span><Button size="sm" variant="outline" className={touch} onClick={() => void load(course.id)}><RefreshCw />{t('reload')}</Button></div>
      {missing.length > 0 && <ul className="m-0 flex list-none flex-col gap-1 p-0">{missing.map((m, i) => <li key={i}><Button variant="link" className={`h-auto p-0 text-left text-danger underline ${touch}`} onClick={() => void select(missingTarget(m))}>{missingText(m)}</Button></li>)}</ul>}
    </div>}
    {message && <p role="status" className="rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">{message}</p>}

    {isMobile && <Button variant="outline" className="h-11 justify-start" onClick={() => setStructureOpen(true)}><ListTree />{t('structureSheet', { name: currentName })}</Button>}
    <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      {!isMobile && <div className="lg:sticky lg:top-24">{tree}</div>}
      <div className="min-w-0">{panel}</div>
    </div>

    {isMobile && !readOnly && <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 border-t border-border bg-background p-3">
      <span className="text-xs text-muted-foreground">{savedAt}</span>
      <Button className="h-11" disabled={busy || uploading} onClick={() => void submit()}><Send />{t('submit')}</Button>
    </div>}

    <Sheet open={isMobile && structureOpen} onOpenChange={setStructureOpen}>
      <SheetContent side="bottom" closeLabel={t('close')} className="max-h-[85svh] gap-0">
        <SheetHeader className="border-b border-border p-4 pr-14"><SheetTitle>{t('structure')}</SheetTitle></SheetHeader>
        <div className="overflow-y-auto p-4">{tree}</div>
      </SheetContent>
    </Sheet>

    <AlertDialog open={removal !== null} onOpenChange={open => { if (!open) setRemoval(null) }}>
      {removal && <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{removal.kind === 'chapter' ? t('deleteChapter') : t('deleteLesson')}</AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]">{t(removal.hard ? 'deleteHardItem' : 'deleteSoftItem', { name: removal.name })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>{t('cancel')}</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={remove}>{removal.hard ? t('deleteHard') : t('remove')}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>

    <AlertDialog open={leaveTo !== null} onOpenChange={open => { if (!open) { if (leaveTo === 'route') blocked.current?.reset(); setLeaveTo(null) } }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t('leaveTitle')}</AlertDialogTitle><AlertDialogDescription>{t('leaveText')}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('stay')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => { const to = leaveTo!; setLeaveTo(null); guard.current = null; if (to === 'route') blocked.current?.proceed(); else if (to === 'list') navigate('/author/courses'); else go(to) }}>{t('leave')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {actions.elements}
    {guardElement}
  </main>
}
