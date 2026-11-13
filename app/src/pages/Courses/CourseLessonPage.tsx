import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { BookOpen, Check, ChevronLeft, ChevronRight, ListTree, Lock, RefreshCw } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BackToTopButton } from '../../components/BackToTopButton'
import { EmptyState } from '../../components/EmptyState'
import { MarkdownContent } from '../../components/MarkdownContent'
import { courseErrorText, readerCourseText } from '../../data/courseI18n'
import { ApiError } from '../../services/api/client'
import { embedUrl, flatLessons, lessonAccess, publicCourses } from '../../services/courseService'
import { CourseFrame, type FrameActions } from './CourseFrame'
import { touch } from './courseParts'
import type { CourseLearning, PublicChapter, PublicCourseDetail, PublicLesson, Viewer } from '../../types/courses'
import type { Language } from '../../types/preferences'

type Heading = { id: string; text: string; level: 2 | 3 }
type Tree = { courseTitle: string; chapters: PublicChapter[]; viewer: Viewer; learning: CourseLearning | null }
type Failure = { kind: 'missing' | 'locked' | 'error'; text: string; tree?: Tree }

/** Lesson page (wireframe 2c-4/2c-5): video, Markdown with TOC, completion toggle and previous/next from the curriculum. */
export function CourseLessonPage({ language = 'vi', authenticated = false }: { language?: Language; authenticated?: boolean }) {
  const t = readerCourseText(language)
  const { courseId = '', lessonId = '' } = useParams()
  // Starting on the lesson already open navigates to the same path: a new location key reloads it as enrolled.
  const { key } = useLocation()
  const [data, setData] = useState<PublicLesson | null>(null)
  const [learning, setLearning] = useState<CourseLearning | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [headings, setHeadings] = useState<Heading[]>([])
  const [saving, setSaving] = useState(false)
  const [completionError, setCompletionError] = useState('')
  const [status, setStatus] = useState('')
  const body = useRef<HTMLDivElement>(null)
  const latest = useRef(0)

  // `quiet` refreshes in place (after a stale completion) so the error message stays on screen.
  const load = useCallback(async (quiet = false) => {
    const request = ++latest.current
    if (!quiet) { setData(null); setFailure(null); setHeadings([]); setCompletionError(''); setStatus('') }
    try {
      const result = await publicCourses.lesson(courseId, lessonId)
      if (request !== latest.current) return
      setData(result); setLearning(result.learning)
    } catch (e) {
      if (request !== latest.current) return
      const text = courseErrorText(e, language, t('loadError'))
      if (e instanceof ApiError && e.code === 'LESSON_PREVIEW_ONLY') {
        // The locked card still shows the curriculum, taken from the overview.
        let tree: Tree | undefined
        try {
          const detail: PublicCourseDetail = await publicCourses.detail(courseId)
          tree = { courseTitle: detail.title, chapters: detail.chapters, viewer: detail.viewer, learning: detail.learning }
        } catch { /* the card alone is enough */ }
        if (request === latest.current) setFailure({ kind: 'locked', text: t('lockedText'), tree })
      } else setFailure({ kind: e instanceof ApiError && e.status === 404 ? 'missing' : 'error', text: e instanceof ApiError && e.status === 404 ? t('notFound') : text })
    }
  }, [courseId, lessonId, key, language]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [load])

  // The TOC reads the ids MarkdownContent gave the headings, so TOC and anchors share one slug pass.
  useEffect(() => {
    const nodes = [...(body.current?.querySelectorAll<HTMLElement>('h2[id], h3[id]') ?? [])]
    setHeadings(nodes.map(node => ({ id: node.id, text: node.textContent ?? '', level: node.tagName === 'H3' ? 3 : 2 })))
    if (data) window.scrollTo(0, 0)
  }, [data])

  const page = (content: ReactNode) => <main className="tw-page mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">{content}</main>
  const toCourses = <Button asChild variant="outline" className={cn('self-start', touch)}><Link to="/courses">{t('backToCourses')}</Link></Button>

  if (failure?.kind === 'missing') return page(<EmptyState icon={BookOpen} title={failure.text} action={toCourses} />)
  if (failure?.kind === 'error') return page(<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
    <span>{failure.text}</span><Button type="button" variant="outline" size="sm" className={touch} onClick={() => void load()}><RefreshCw aria-hidden />{t('retry')}</Button></div>)
  if (failure?.kind === 'locked') {
    const card = (actions?: FrameActions) => <main id="lesson-content" className="tw-page mx-auto flex w-full max-w-3xl flex-col px-4 py-10 sm:px-6">
      <EmptyState icon={Lock} title={t('lockedTitle')} description={failure.text} action={actions && failure.tree && (authenticated
        ? failure.tree.viewer.canStart && <Button type="button" className={touch} disabled={actions.starting} onClick={() => void actions.start(lessonId)}>{t('startLearning')}</Button>
        : <Button type="button" className={touch} onClick={() => actions.askLogin(`/courses/${courseId}/lessons/${lessonId}`)}>{t('login')}</Button>)} />
      {actions?.startError && <p role="alert" className="mt-3 text-center text-sm text-danger">{actions.startError}</p>}
    </main>
    return failure.tree
      ? <CourseFrame language={language} authenticated={authenticated} courseId={courseId} title={failure.tree.courseTitle} chapters={failure.tree.chapters} viewer={failure.tree.viewer} learning={failure.tree.learning} currentLessonId={lessonId}>{actions => card(actions)}</CourseFrame>
      : card()
  }
  if (!data) return page(<div role="status" aria-label={t('loading')} className="flex flex-col gap-4"><Skeleton className="h-9 w-3/4" /><Skeleton className="aspect-video rounded-2xl" />{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div>)

  const { lesson, viewer } = data
  const lessons = flatLessons(data.chapters)
  const index = lessons.findIndex(item => item.id === lesson.id)
  const chapter = data.chapters.find(item => item.id === lesson.chapterId)
  const neighbour = (item: (typeof lessons)[number] | undefined) => item && { item, mode: lessonAccess(item, viewer, authenticated) }
  const prev = neighbour(lessons[index - 1])
  const next = neighbour(lessons[index + 1])
  const video = embedUrl(lesson.video)
  const completed = learning?.completedLessonIds.includes(lesson.id) ?? false
  const progress = learning?.progress

  const toggle = async () => {
    setSaving(true); setCompletionError('')
    try {
      const result = await publicCourses.complete(courseId, lesson.id, !completed)
      setLearning(result)
      setStatus(t(completed ? 'uncompletedStatus' : 'completedStatus', { x: result.progress.completed, y: result.progress.total }))
    } catch (e) {
      setCompletionError(courseErrorText(e, language, t('completionFailed')))
      if (e instanceof ApiError && e.code === 'COURSE_ENROLLMENT_REQUIRED') void load(true)
    } finally { setSaving(false) }
  }

  const step = (target: typeof prev, dir: 'prev' | 'next', actions: FrameActions) => {
    if (!target) return null
    const label = t(dir === 'prev' ? 'prevOf' : 'nextOf', { title: target.item.title })
    const Icon = dir === 'prev' ? ChevronLeft : ChevronRight
    const text = <>{dir === 'prev' && <Icon aria-hidden />}<span className="max-md:sr-only">{t(dir)}</span>{dir === 'next' && <Icon aria-hidden />}</>
    if (target.mode === 'open') return <Button asChild variant="outline" className={touch}><Link to={`/courses/${courseId}/lessons/${target.item.id}`} aria-label={label}>{text}</Link></Button>
    return <Button type="button" variant="outline" className={touch} aria-label={label} aria-disabled={target.mode === 'locked'}
      onClick={() => { if (target.mode === 'login') actions.askLogin(`/courses/${courseId}/lessons/${target.item.id}`); else if (target.mode === 'start') void actions.start(target.item.id) }}>{text}</Button>
  }

  const toc = headings.length > 0 && <ol className="flex flex-col gap-0.5 text-sm">{headings.map(h => <li key={h.id} className={h.level === 3 ? 'pl-4' : ''}>
    <a href={`#${h.id}`} className={cn('block rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring', touch)}>{h.text}</a></li>)}</ol>

  return <CourseFrame language={language} authenticated={authenticated} courseId={courseId} title={data.courseTitle} chapters={data.chapters} viewer={viewer} learning={learning} currentLessonId={lesson.id}>
    {actions => <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 py-6 pb-24 sm:px-6 md:pb-6">
      <main id="lesson-content" className="flex min-w-0 max-w-3xl flex-1 flex-col gap-5">
        <nav aria-label={t('breadcrumb')} className="text-sm text-muted-foreground"><Link to={`/courses/${courseId}`} className={cn('hover:text-foreground', touch)}>{data.courseTitle}</Link>{chapter && <> › {chapter.title}</>}</nav>
        <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{lesson.title}</h1>{lesson.preview && !viewer.enrolled && <Badge tone="sky">{t('preview')}</Badge>}</div>
        {lesson.summary && <p className="text-muted-foreground">{lesson.summary}</p>}
        {video && <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-muted">
          <iframe src={video} title={t('video', { title: lesson.title })} className="size-full" loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />
        </div>}
        {headings.length > 0 && <details className="rounded-xl border border-border xl:hidden"><summary className={cn('flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-semibold', touch)}><ListTree className="size-4" aria-hidden />{t('toc')}</summary><nav aria-label={t('toc')} className="px-2 pb-2">{toc}</nav></details>}
        {lesson.content && <div ref={body} className="[&>div]:text-base [&>div]:leading-[1.85]"><MarkdownContent content={lesson.content} anchors language={language} /></div>}

        {!viewer.enrolled && <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-muted/40 p-4"><p className="text-sm">{t('previewHint')}</p>
          {viewer.canStart && (authenticated
            ? <Button type="button" className={touch} disabled={actions.starting} onClick={() => void actions.start()}>{t('startLearning')}</Button>
            : <Button type="button" className={touch} onClick={() => actions.askLogin(`/courses/${courseId}/lessons/${lesson.id}`)}>{t('login')}</Button>)}
          {actions.startError && <p role="alert" className="text-sm text-danger">{actions.startError}</p>}</div>}

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <div className="max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-20 max-md:border-t max-md:border-border max-md:bg-background max-md:p-2 flex items-center justify-between gap-2">
            {step(prev, 'prev', actions) ?? <span />}
            {viewer.enrolled && <Button type="button" variant={completed ? 'outline' : 'default'} className={cn('max-md:flex-1', touch)} disabled={saving} onClick={() => void toggle()}>
              {completed && <Check aria-hidden />}{t(completed ? 'uncomplete' : 'complete')}</Button>}
            {step(next, 'next', actions) ?? <span />}
          </div>
          {completionError && <p role="alert" className="text-sm text-danger">{completionError}</p>}
          <p role="status" aria-live="polite" className="sr-only">{status}</p>
          {progress && viewer.enrolled && <p className="text-xs text-muted-foreground">{t('progress', { x: progress.completed, y: progress.total, p: progress.percent })}</p>}
        </div>
      </main>
      {headings.length > 0 && <aside className="sticky top-20 hidden h-fit max-h-[calc(100svh-6rem)] w-64 shrink-0 overflow-y-auto xl:block"><h2 className="mb-2 text-sm font-semibold">{t('tocTitle')}</h2><nav aria-label={t('tocTitle')}>{toc}</nav></aside>}
      <BackToTopButton label={language === 'vi' ? 'Lên đầu trang' : 'Back to top'} />
    </div>}
  </CourseFrame>
}
