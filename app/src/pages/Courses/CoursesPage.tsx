import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownUp, BookOpen, FileStack, GraduationCap, LayoutGrid, PlayCircle, RefreshCw, Search, Signal, Sparkles, Tag, X } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { toneFor } from '@/lib/utils'
import { EmptyState } from '../../components/EmptyState'
import { Pagination } from '../../components/Pagination'
import { topicIcon } from '../../components/articles/ArticleCard'
import { courseErrorText, readerCourseText } from '../../data/courseI18n'
import { courseFilter, courseSearch, publicCourses } from '../../services/courseService'
import { TONE_TILE } from '../Author/AuthorBlogsPage'
import { CourseCard, touch } from './courseParts'
import type { ArticleOption, Page } from '../../types/articles'
import type { CourseFilter, PublicCourseSummary } from '../../types/courses'
import type { Language } from '../../types/preferences'

const GRID = 'grid list-none gap-6 sm:grid-cols-2 xl:grid-cols-3'
const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const

/** Course catalog (wireframe 2c-1). Like `/blogs` the URL is the only filter/page state; open to Guests. */
export function CoursesPage({ language = 'vi', authenticated = false }: { language?: Language; authenticated?: boolean }) {
  const t = readerCourseText(language)
  const [params, setParams] = useSearchParams()
  const filter = courseFilter(params)
  const search = courseSearch(filter).toString()
  useEffect(() => { if (params.toString() !== search) setParams(search, { replace: true }) }, [params, search, setParams])
  const [keyword, setKeyword] = useState(filter.keyword)
  const [data, setData] = useState<Page<PublicCourseSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [options, setOptions] = useState<{ topics: ArticleOption[]; tags: ArticleOption[] } | null>(null)
  const [optionsError, setOptionsError] = useState(false)
  const latest = useRef(0)
  useEffect(() => { setKeyword(filter.keyword) }, [filter.keyword])

  const load = useCallback(async () => {
    const id = ++latest.current
    setLoading(true); setError('')
    try {
      const result = await publicCourses.list(courseFilter(new URLSearchParams(search)))
      if (id === latest.current) setData(result)
    } catch (e) {
      if (id === latest.current) { setData(null); setError(courseErrorText(e, language, t('loadError'))) }
    } finally {
      if (id === latest.current) setLoading(false)
    }
  }, [search, language]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [load])

  const loadOptions = useCallback(() => {
    setOptionsError(false)
    publicCourses.options().then(result => setOptions({ topics: result.topics.content, tags: result.tags.content })).catch(() => setOptionsError(true))
  }, [])
  useEffect(loadOptions, [loadOptions])

  // A shrunken result set leaves the page past the end: go to the last page instead of an empty one.
  useEffect(() => {
    if (data && !data.content.length && filter.page > 0 && data.totalPages > 0) setParams(courseSearch({ ...filter, page: data.totalPages - 1 }), { replace: true })
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (patch: Partial<CourseFilter>) => setParams(courseSearch({ ...filter, page: 0, ...patch }))
  const submit = (event: FormEvent) => { event.preventDefault(); commit({ keyword }) }
  const filtered = search !== ''
  const field = 'relative max-sm:flex-1 [&>[data-slot=native-select-wrapper]]:w-full'

  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex items-start gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
      <span className="hidden size-14 shrink-0 items-center justify-center rounded-2xl border border-tone-green-border bg-tone-green-bg text-tone-green-fg shadow-sm sm:flex"><GraduationCap className="size-7" aria-hidden /></span>
      <div className="flex flex-col gap-2">
        <Badge tone="green" className="self-start font-semibold"><Sparkles aria-hidden />{t('kicker')}</Badge>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{t('subtitle')}</p>
      </div>
      {authenticated && <Button asChild variant="outline" className={cn('ml-auto shrink-0', touch)}>
        <Link to="/me/courses"><PlayCircle className="text-tone-green-fg" aria-hidden />{t('myCourses')}</Link>
      </Button>}
    </header>

    <Card className="gap-3 rounded-2xl p-3 shadow-sm sm:p-4">
      <h2 className="sr-only">{t('filters')}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <form role="search" onSubmit={submit} className="relative min-w-56 flex-1">
          <Label htmlFor="course-search" className="sr-only">{t('search')}</Label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-accent-text" aria-hidden />
          <Input id="course-search" type="search" enterKeyHint="search" maxLength={255} value={keyword} onChange={e => setKeyword(e.target.value)} placeholder={t('searchPlaceholder')}
            className={cn('h-9 rounded-xl bg-muted/50 pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden', touch)} />
          {keyword && <button type="button" aria-label={t('clearSearch')} onClick={() => { setKeyword(''); commit({ keyword: '' }) }}
            className={cn('absolute top-1/2 right-1 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground', touch)}><X className="size-4" aria-hidden /></button>}
        </form>
        {options && <div className={field}>
          <Label htmlFor="course-tag" className="sr-only">{t('tag')}</Label>
          <Tag className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-tone-purple-fg" aria-hidden />
          <NativeSelect id="course-tag" className={cn('h-9 w-full rounded-xl pl-9 sm:w-40', touch)} value={filter.tagId} onChange={e => commit({ tagId: e.target.value })}>
            <NativeSelectOption value="">{t('allTags')}</NativeSelectOption>
            {options?.tags.map(tag => <NativeSelectOption key={tag.id} value={tag.id}>{tag.name}</NativeSelectOption>)}
          </NativeSelect>
        </div>}
        <div className={field}>
          <Label htmlFor="course-level" className="sr-only">{t('level')}</Label>
          <Signal className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-tone-green-fg" aria-hidden />
          <NativeSelect id="course-level" className={cn('h-9 w-full rounded-xl pl-9 sm:w-40', touch)} value={filter.level} onChange={e => commit({ level: e.target.value as CourseFilter['level'] })}>
            <NativeSelectOption value="">{t('allLevels')}</NativeSelectOption>
            {LEVELS.map(level => <NativeSelectOption key={level} value={level}>{t(level)}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className={field}>
          <Label htmlFor="course-sort" className="sr-only">{t('sort')}</Label>
          <ArrowDownUp className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-tone-amber-fg" aria-hidden />
          <NativeSelect id="course-sort" className={cn('h-9 w-full rounded-xl pl-9 sm:w-36', touch)} value={filter.sort} onChange={e => commit({ sort: e.target.value as CourseFilter['sort'] })}>
            <NativeSelectOption value="NEWEST">{t('newest')}</NativeSelectOption>
            <NativeSelectOption value="OLDEST">{t('oldest')}</NativeSelectOption>
          </NativeSelect>
        </div>
        {data && <Badge tone="blue" className="h-9 rounded-xl px-3 text-sm font-semibold"><FileStack aria-hidden />{t('count', { n: data.totalElements })}</Badge>}
      </div>
      {options && <div role="group" aria-label={t('topics')} className="-mx-1 flex gap-2 overflow-x-auto px-1 py-0.5 sm:flex-wrap sm:overflow-visible">
        {[{ id: '', name: t('allTopics') }, ...(options?.topics ?? [])].map(topic => {
          const selected = filter.topicId === topic.id
          const Icon = topic.id ? topicIcon(topic.name) : LayoutGrid
          return <button key={topic.id || 'all'} type="button" aria-pressed={selected} onClick={() => commit({ topicId: topic.id })}
            className={cn('inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none', touch,
              selected ? 'border-primary bg-primary text-primary-foreground shadow-md' : topic.id ? TONE_TILE[toneFor(topic.name)] : 'border-border bg-muted text-foreground')}>
            <Icon className="size-3.5" aria-hidden />{topic.name}
          </button>
        })}
      </div>}
      {optionsError && <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-danger">{t('optionsError')}
        <Button type="button" variant="outline" size="sm" className={touch} onClick={loadOptions}><RefreshCw aria-hidden />{t('retry')}</Button></p>}
    </Card>

    {error
      ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
          <span>{error}</span><Button type="button" variant="outline" size="sm" className={touch} onClick={() => void load()}><RefreshCw aria-hidden />{t('retry')}</Button>
        </div>
      : loading && !data
        ? <ul role="status" aria-label={t('loading')} className={GRID}>{Array.from({ length: 9 }, (_, i) => <li key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
            <Skeleton className="aspect-[16/10] rounded-none" /><div className="flex flex-col gap-2.5 p-4"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-5 w-full" /><Skeleton className="h-4 w-4/5" /></div>
          </li>)}</ul>
        : data && !data.content.length
          ? <EmptyState icon={BookOpen} title={filtered ? t('emptyFiltered') : t('empty')} description={filtered ? t('emptyFilteredText') : t('emptyText')}
              action={filtered && <Button type="button" variant="outline" className={touch} onClick={() => setParams(new URLSearchParams())}>{t('clearFilters')}</Button>} />
          : data && <ul aria-label={t('list')} aria-busy={loading} className={GRID}>{data.content.map(course => <li key={course.id} className="flex min-w-0"><CourseCard course={course} language={language} /></li>)}</ul>}

    {data && !error && <Pagination language={language} page={filter.page} totalPages={data.totalPages} loading={loading} onPageChange={page => setParams(courseSearch({ ...filter, page }))} />}
  </main>
}
