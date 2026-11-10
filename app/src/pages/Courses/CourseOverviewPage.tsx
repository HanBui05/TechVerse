import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookOpen, CalendarDays, ChevronDown, Hash, Layers, ListChecks, Lock, PlayCircle, RefreshCw, Check } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toneFor } from '@/lib/utils'
import { EmptyState } from '../../components/EmptyState'
import { MarkdownContent } from '../../components/MarkdownContent'
import { UserAvatar } from '../../components/UserAvatar'
import { topicIcon } from '../../components/articles/ArticleCard'
import { courseErrorText, readerCourseText } from '../../data/courseI18n'
import { ApiError } from '../../services/api/client'
import { flatLessons, lessonAccess, publicCourses } from '../../services/courseService'
import { formatDate } from '../Author/AuthorBlogsPage'
import { CourseFrame, type FrameActions } from './CourseFrame'
import { LEVEL_TONE, ProgressBar, touch } from './courseParts'
import type { PublicCourseDetail } from '../../types/courses'
import type { Language } from '../../types/preferences'

/** Course overview (wireframe 2c-3): info card + CTA by `viewer`, description, accordion of chapters; shares the learning frame. */
export function CourseOverviewPage({ language = 'vi', authenticated = false }: { language?: Language; authenticated?: boolean }) {
  const t = readerCourseText(language)
  const { id = '' } = useParams()
  const [course, setCourse] = useState<PublicCourseDetail | null>(null)
  const [error, setError] = useState<{ missing: boolean; text: string } | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const latest = useRef(0)

  const load = useCallback(async () => {
    const request = ++latest.current
    setCourse(null); setError(null)
    try {
      const result = await publicCourses.detail(id)
      if (request !== latest.current) return
      setCourse(result)
      setOpen(new Set(result.chapters.slice(0, 1).map(chapter => chapter.id)))
    } catch (e) {
      if (request === latest.current) setError({ missing: e instanceof ApiError && e.status === 404, text: courseErrorText(e, language, t('loadError')) })
    }
  }, [id, language]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [load])
  useEffect(() => { window.scrollTo(0, 0) }, [id])

  const shell = (content: ReactNode) => <main className="tw-page mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">{content}</main>
  const back = <Button asChild variant="outline" className={cn('self-start', touch)}><Link to="/courses">{t('backToCourses')}</Link></Button>
  if (error?.missing) return shell(<EmptyState icon={BookOpen} title={t('notFound')} action={back} />)
  if (error) return shell(<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
    <span>{error.text}</span><Button type="button" variant="outline" size="sm" className={touch} onClick={() => void load()}><RefreshCw aria-hidden />{t('retry')}</Button></div>)
  if (!course) return shell(<div role="status" aria-label={t('loading')} className="flex flex-col gap-4"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="aspect-video rounded-2xl" />{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>)

  const lessons = flatLessons(course.chapters)
  const firstPreview = lessons.find(lesson => lesson.preview)
  const allOpen = course.chapters.every(chapter => open.has(chapter.id))
  const tone = toneFor(course.topic.name)
  const TopicIcon = topicIcon(course.topic.name)
  const continueLesson = course.viewer.enrolled ? course.learning?.continueLesson : null
  const progress = course.viewer.enrolled ? course.learning?.progress : null
  const chip = 'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold'

  return <CourseFrame language={language} authenticated={authenticated} courseId={course.id} title={course.title} chapters={course.chapters} viewer={course.viewer} learning={course.learning}>
    {(actions: FrameActions) => <main id="lesson-content" className="tw-page mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <nav aria-label={t('breadcrumb')} className="text-sm text-muted-foreground"><Link to="/courses" className={cn('hover:text-foreground', touch)}>{t('back')}</Link> › <span className="text-foreground">{course.title}</span></nav>

      <section aria-labelledby="course-title" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <ul className="flex flex-wrap gap-2">
          <li><Badge tone={LEVEL_TONE[course.level]} className={chip}>{t(course.level)}</Badge></li>
          <li><Badge tone="blue" className={chip}><Layers aria-hidden />{t('chapters', { n: course.chapterCount })}</Badge></li>
          <li><Badge tone="purple" className={chip}><ListChecks aria-hidden />{t('lessons', { n: course.lessonCount })}</Badge></li>
          <li><Badge tone="slate" className={chip}><CalendarDays aria-hidden /><time dateTime={course.updatedAt}>{t('updated', { date: formatDate(course.updatedAt, language) })}</time></Badge></li>
        </ul>
        <ul className="flex flex-wrap gap-1.5">
          <li><Badge tone={tone} className="rounded-lg px-2 py-1 font-semibold"><TopicIcon aria-hidden />{course.topic.name}</Badge></li>
          {course.tags.map(tag => <li key={tag.id}><Badge tone={toneFor(tag.name)} className="rounded-lg px-2 py-1"><Hash aria-hidden />{tag.name}</Badge></li>)}
        </ul>
        <h1 id="course-title" className="text-2xl font-bold tracking-tight sm:text-3xl">{course.title}</h1>
        {course.summary && <p className="line-clamp-3 text-base text-muted-foreground">{course.summary}</p>}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="flex items-center gap-2.5">
            <UserAvatar name={course.author.fullName} url={course.author.avatarUrl} className="size-9 text-xs" />
            <span className="flex flex-col leading-tight"><span className="text-sm font-semibold">{course.author.fullName}</span><span className="text-[11px] tracking-wide text-muted-foreground uppercase">{t('author')}</span></span>
          </span>
          <div className="flex flex-wrap items-center gap-2 max-sm:w-full max-sm:flex-col max-sm:items-stretch">
            {course.viewer.enrolled
              ? continueLesson && <Button asChild className={touch}><Link to={`/courses/${course.id}/lessons/${continueLesson.id}`}><PlayCircle aria-hidden />{t('continueAt', { title: continueLesson.title })}</Link></Button>
              : course.viewer.canStart
                ? <Button type="button" className={touch} disabled={actions.starting} onClick={() => authenticated ? void actions.start() : actions.askLogin(`/courses/${course.id}`)}><PlayCircle aria-hidden />{t('startLearning')}</Button>
                : <p className="text-sm text-muted-foreground">{t('ownerNote')}</p>}
            {firstPreview && <Button asChild variant="outline" className={touch}><Link to={`/courses/${course.id}/lessons/${firstPreview.id}`}>{t('preview')}</Link></Button>}
          </div>
        </div>
        {progress && <div className="flex flex-col gap-1.5"><ProgressBar percent={progress.percent} label={t('progressLabel')} /><p className="text-xs text-muted-foreground">{t('progress', { x: progress.completed, y: progress.total, p: progress.percent })}</p></div>}
        {actions.startError && <p role="alert" className="text-sm text-danger">{actions.startError}</p>}
      </section>

      {course.coverImageUrl && <img src={course.coverImageUrl} alt="" className="aspect-video w-full rounded-2xl border border-border object-cover" />}
      {course.description && <section aria-labelledby="course-intro" className="flex flex-col gap-3"><h2 id="course-intro" className="text-xl font-bold">{t('introTitle')}</h2><MarkdownContent content={course.description} language={language} /></section>}

      <section aria-labelledby="course-content" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="course-content" className="text-xl font-bold">{t('content')} <span className="text-sm font-normal text-muted-foreground">({t('chapters', { n: course.chapterCount })} · {t('lessons', { n: course.lessonCount })})</span></h2>
          <Button type="button" variant="outline" size="sm" className={touch} onClick={() => setOpen(allOpen ? new Set() : new Set(course.chapters.map(chapter => chapter.id)))}>{allOpen ? t('collapseAll') : t('expandAll')}</Button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border">
          {course.chapters.map(chapter => {
            const expanded = open.has(chapter.id)
            const stat = course.learning?.chapters.find(item => item.chapterId === chapter.id)
            return <section key={chapter.id} className="border-b border-border last:border-b-0">
              <h3><button type="button" aria-expanded={expanded} onClick={() => setOpen(prev => { const next = new Set(prev); if (!next.delete(chapter.id)) next.add(chapter.id); return next })}
                className={cn('flex w-full items-center gap-3 bg-muted/40 px-4 py-3 text-left text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring', touch)}>
                <span className="min-w-0 flex-1"><span className="text-xs tracking-wide text-muted-foreground uppercase">{t('chapterN', { n: course.chapters.indexOf(chapter) + 1 })} · </span>{chapter.title}</span>
                {stat && <span className="text-xs font-normal text-muted-foreground">{t('chapterProgress', { x: stat.completed, y: stat.total })}</span>}
                <ChevronDown className={cn('size-4 shrink-0 transition-transform motion-reduce:transition-none', expanded && 'rotate-180')} aria-hidden />
              </button></h3>
              {expanded && <ul>{chapter.lessons.map(lesson => {
                const mode = lessonAccess(lesson, course.viewer, authenticated)
                const done = course.learning?.completedLessonIds.includes(lesson.id)
                const body = <>{done ? <Check className="size-4 shrink-0 text-success" aria-label={t('done')} /> : mode === 'open' ? <PlayCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : <Lock className="size-4 shrink-0 text-muted-foreground" aria-label={t('lockedLesson')} />}
                  <span className="min-w-0 flex-1"><span className="block">{chapter.lessons.indexOf(lesson) + 1}. {lesson.title}</span>{lesson.summary && <span className="block text-xs text-muted-foreground">{lesson.summary}</span>}</span>
                  {lesson.preview && !course.viewer.enrolled && <Badge tone="sky" className="shrink-0">{t('preview')}</Badge>}</>
                const cls = cn('flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring', touch, mode === 'locked' && 'cursor-not-allowed opacity-70')
                return <li key={lesson.id} className="border-t border-border">{mode === 'open'
                  ? <Link to={`/courses/${course.id}/lessons/${lesson.id}`} className={cls}>{body}</Link>
                  : <button type="button" aria-disabled={mode === 'locked'} className={cls} onClick={() => { if (mode === 'login') actions.askLogin(`/courses/${course.id}/lessons/${lesson.id}`); else if (mode === 'start') void actions.start(lesson.id) }}>{body}</button>}</li>
              })}</ul>}
            </section>
          })}
        </div>
      </section>
    </main>}
  </CourseFrame>
}
