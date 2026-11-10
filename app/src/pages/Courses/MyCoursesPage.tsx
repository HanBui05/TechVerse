import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, Check, ChevronLeft, PlayCircle, RefreshCw } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toneFor } from '@/lib/utils'
import { EmptyState } from '../../components/EmptyState'
import { Pagination } from '../../components/Pagination'
import { relativeDate } from '../../data/articleI18n'
import { courseErrorText, readerCourseText } from '../../data/courseI18n'
import { publicCourses } from '../../services/courseService'
import { CourseCover, LEVEL_TONE, ProgressBar, touch } from './courseParts'
import type { Page } from '../../types/articles'
import type { MyCourse } from '../../types/courses'
import type { Language } from '../../types/preferences'

/** “My courses” (wireframe 2c-7): order comes from the backend (last activity, then start); no filter or sort. */
export function MyCoursesPage({ language = 'vi' }: { language?: Language }) {
  const t = readerCourseText(language)
  const [params, setParams] = useSearchParams()
  const raw = Number(params.get('page'))
  const page = Number.isInteger(raw) && raw > 0 ? raw : 0
  const [data, setData] = useState<Page<MyCourse> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const latest = useRef(0)

  const load = useCallback(async () => {
    const id = ++latest.current
    setLoading(true); setError('')
    try {
      const result = await publicCourses.mine(page)
      if (id === latest.current) setData(result)
    } catch (e) {
      if (id === latest.current) { setData(null); setError(courseErrorText(e, language, t('loadError'))) }
    } finally {
      if (id === latest.current) setLoading(false)
    }
  }, [page, language]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [load])

  return <main className="tw-page mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-2">
        <Badge tone="green" className="self-start font-semibold"><PlayCircle aria-hidden />{t('mineKicker')}</Badge>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('myCourses')} {data && <span className="text-base font-normal text-muted-foreground">({t('mineCount', { n: data.totalElements })})</span>}</h1>
      </div>
      <Button asChild variant="outline" className={touch}><Link to="/courses"><ChevronLeft aria-hidden />{t('allCourses')}</Link></Button>
    </header>

    {error
      ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
          <span>{error}</span><Button type="button" variant="outline" size="sm" className={touch} onClick={() => void load()}><RefreshCw aria-hidden />{t('retry')}</Button></div>
      : loading && !data
        ? <ul role="status" aria-label={t('loading')} className="flex flex-col gap-3">{Array.from({ length: 3 }, (_, i) => <li key={i}><Skeleton className="h-28 rounded-2xl" /></li>)}</ul>
        : data && !data.content.length
          ? <EmptyState icon={BookOpen} title={t('mineEmpty')} description={t('mineEmptyText')} action={<Button asChild className={touch}><Link to="/courses">{t('explore')}</Link></Button>} />
          : data && <ul aria-busy={loading} className="flex flex-col gap-3">{data.content.map(item => {
              const { course, progress, continueLesson } = item
              const finished = progress.total > 0 && progress.completed >= progress.total
              const when = item.lastAccessedAt ? t('activeAgo', { when: relativeDate(item.lastAccessedAt, language) }) : t('startedOn', { when: relativeDate(item.grantedAt, language) })
              return <li key={course.id} className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm max-sm:flex-col">
                <Link to={`/courses/${course.id}`} tabIndex={-1} aria-hidden className="hidden h-[75px] w-[120px] shrink-0 overflow-hidden rounded-xl border border-border sm:block"><CourseCover course={course} /></Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-base font-bold leading-snug"><Link to={`/courses/${course.id}`} className={cn('hover:text-accent-text focus-visible:outline-2 focus-visible:outline-ring', touch)}>{course.title}</Link></h2>
                    <span className="flex gap-1.5"><Badge tone={LEVEL_TONE[course.level]}>{t(course.level)}</Badge><Badge tone={toneFor(course.topic.name)}>{course.topic.name}</Badge></span>
                  </div>
                  <ProgressBar percent={progress.percent} label={`${t('progressLabel')}: ${course.title}`} />
                  <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    <span>{t('progress', { x: progress.completed, y: progress.total, p: progress.percent })}</span>
                    {finished && <Badge tone="green"><Check aria-hidden />{t('complete100')}</Badge>}
                    {!finished && continueLesson && <span>{t('nextLesson', { title: continueLesson.title })}</span>}
                    <span>{when}</span>
                  </p>
                  <div className="flex sm:justify-end">
                    {finished || !continueLesson
                      ? <Button asChild variant="outline" className={cn('max-sm:w-full', touch)}><Link to={`/courses/${course.id}`}>{t('review')}</Link></Button>
                      : <Button asChild className={cn('max-sm:w-full', touch)}><Link to={`/courses/${course.id}/lessons/${continueLesson.id}`} aria-label={`${t('continueLearning')}: ${course.title}`}>{t('continueLearning')}</Link></Button>}
                  </div>
                </div>
              </li>
            })}</ul>}

    {data && !error && <Pagination language={language} page={page} totalPages={data.totalPages} loading={loading} onPageChange={next => setParams(next > 0 ? { page: String(next) } : {})} />}
  </main>
}
