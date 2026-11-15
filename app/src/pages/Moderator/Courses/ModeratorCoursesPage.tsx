import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BookOpen, ClipboardCheck, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { toneFor } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { EmptyState } from '../../../components/EmptyState'
import { UserAvatar } from '../../../components/UserAvatar'
import { ArticleStatusBadges } from '../../../components/articles/ArticleStatusBadges'
import { AdminPagination } from '../../Admin/AdminPagination'
import { moderatorPublicationLabel, moderatorWorkflowLabel } from '../../../data/articleI18n'
import { moderatorCourseErrorText, moderatorCourseText } from '../../../data/courseI18n'
import { moderatorArticles } from '../../../services/articleService'
import { moderatorCourses } from '../../../services/courseService'
import type { ArticleOption, ModeratorArticleFilter, Page, PublicationStatus, WorkflowStatus } from '../../../types/articles'
import type { ModeratorCourseSummary } from '../../../types/courses'
import type { Language } from '../../../types/preferences'
import { TONE_TILE, fieldLabel, formatDate } from '../../Author/AuthorBlogsPage'
import { ArticleStats, useArticleStats } from '../ArticleStats'

const SIZE = 12
const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const WORKFLOWS: WorkflowStatus[] = ['PENDING', 'CHANGES_REQUESTED', 'PUBLISHED', 'DRAFT']
const PUBLICATIONS: PublicationStatus[] = ['UNPUBLISHED', 'PUBLISHED', 'AUTHOR_HIDDEN', 'HIDDEN', 'REMOVED']
const SORTS = { newest: 'CREATED_AT:DESC', oldest: 'CREATED_AT:ASC', recentlyEdited: 'UPDATED_AT:DESC', titleAz: 'TITLE:ASC' } as const
const ATTENTION: Partial<Record<string, string>> = { PENDING: 'border-l-tone-amber-fg', CHANGES_REQUESTED: 'border-l-tone-sky-fg', HIDDEN: 'border-l-tone-rose-fg', REMOVED: 'border-l-tone-rose-fg', AUTHOR_HIDDEN: 'border-l-tone-rose-fg' }
// Wireframe 4b-1: the pending queue is the default view; “Clear filters” returns here.
const DEFAULT = { workflowStatus: 'PENDING' as WorkflowStatus | '', publicationStatus: '' as PublicationStatus | '', topicId: '', tagId: '', sort: SORTS.newest as string }

export function ModeratorCoursesPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = moderatorCourseText(language)
  const [filters, setFilters] = useState(DEFAULT)
  const [keyword, setKeyword] = useState('')
  const query = useDebouncedValue(keyword.trim())
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Page<ModeratorCourseSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [options, setOptions] = useState<{ topics: ArticleOption[]; tags: ArticleOption[] }>({ topics: [], tags: [] })
  const [optionsError, setOptionsError] = useState(false)
  const [stats, loadStats] = useArticleStats(moderatorCourses.list)
  // Only the newest list request may update the page.
  const latest = useRef(0)

  const load = useCallback(async () => {
    const id = ++latest.current
    setLoading(true); setError('')
    const [sortBy, direction] = filters.sort.split(':') as [ModeratorArticleFilter['sortBy'], ModeratorArticleFilter['direction']]
    try {
      const result = await moderatorCourses.list({ page, size: SIZE, keyword: query, workflowStatus: filters.workflowStatus, publicationStatus: filters.publicationStatus, topicId: filters.topicId, tagId: filters.tagId, sortBy, direction })
      if (id !== latest.current) return
      if (page > 0 && page >= result.totalPages) { setPage(Math.max(0, result.totalPages - 1)); return }
      setData(result)
    } catch (e) { if (id === latest.current) setError(moderatorCourseErrorText(e, language, t('loadError'))) }
    finally { if (id === latest.current) setLoading(false) }
  }, [filters, page, query, language])
  useEffect(() => { void load() }, [load])
  useEffect(() => { setPage(0) }, [query])
  // shortcut: same reader taxonomy list as the article queue (no moderator options endpoint).
  const loadOptions = useCallback(() => {
    setOptionsError(false)
    moderatorArticles.options().then(o => setOptions({ topics: o.topics.content, tags: o.tags.content }), () => setOptionsError(true))
  }, [])
  useEffect(() => { loadOptions() }, [loadOptions])

  const setFilter = (next: Partial<typeof DEFAULT>) => { setFilters(old => ({ ...old, ...next })); setPage(0) }
  const isDefault = !query && (Object.keys(DEFAULT) as (keyof typeof DEFAULT)[]).every(key => filters[key] === DEFAULT[key])
  const clear = () => { setKeyword(''); setFilter(DEFAULT) }
  const items = data?.content ?? []

  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <Button variant="outline" className={touch} onClick={() => { void load(); loadStats(); if (optionsError) loadOptions() }} disabled={loading}><RefreshCw className={loading ? 'animate-spin motion-reduce:animate-none' : ''} />{t('refresh')}</Button>
    </header>

    <ArticleStats stats={stats} language={language} label={t('stats')} active={filters} onSelect={filter => setFilter(filter)} />

    <Card className="gap-0 rounded-2xl py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold"><span aria-hidden className="flex size-8 items-center justify-center rounded-lg border border-tone-sky-border bg-tone-sky-bg text-tone-sky-fg"><SlidersHorizontal className="size-4" /></span>{t('filters')}</h2>
        {data && <Badge tone="blue" aria-live="polite">{t('count', { n: data.totalElements })}</Badge>}
      </div>
      <div className="flex flex-col gap-4 p-6">
        <div className="grid gap-4 md:grid-cols-12">
          <div className="flex flex-col gap-2 md:col-span-4">
            <Label htmlFor="course-moderator-search" className={fieldLabel}>{t('search')}</Label>
            <div className="relative"><Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="course-moderator-search" type="search" maxLength={255} className={`pl-9 ${touch}`} placeholder={t('searchPlaceholder')} value={keyword} onChange={e => setKeyword(e.target.value)} /></div>
          </div>
          {([['topicId', 'topic', 'allTopics', options.topics], ['tagId', 'tag', 'allTags', options.tags]] as const).map(([key, label, all, list]) => <div key={key} className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor={`course-moderator-${key}`} className={fieldLabel}>{t(label)}</Label>
            <NativeSelect id={`course-moderator-${key}`} className={touch} value={filters[key]} onChange={e => setFilter({ [key]: e.target.value })}>
              <NativeSelectOption value="">{t(all)}</NativeSelectOption>
              {list.map(o => <NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}
            </NativeSelect>
          </div>)}
          <div className="flex flex-col gap-2 md:col-span-4">
            <Label htmlFor="course-moderator-sort" className={fieldLabel}>{t('sort')}</Label>
            <NativeSelect id="course-moderator-sort" className={touch} value={filters.sort} onChange={e => setFilter({ sort: e.target.value })}>
              {(Object.keys(SORTS) as (keyof typeof SORTS)[]).map(key => <NativeSelectOption key={key} value={SORTS[key]}>{t(key)}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        </div>
        {optionsError && <p className="flex flex-wrap items-center gap-2 text-sm text-danger"><span>{t('optionsError')}</span><Button size="sm" variant="outline" className={touch} onClick={loadOptions}><RefreshCw />{t('retry')}</Button></p>}
        {([['workflowFilter', 'workflowStatus', WORKFLOWS, moderatorWorkflowLabel], ['publicationFilter', 'publicationStatus', PUBLICATIONS, moderatorPublicationLabel]] as const).map(([label, key, values, labels]) => <div key={key} className="flex items-center gap-2 max-sm:flex-col max-sm:items-start">
          <span className={`${fieldLabel} w-24 shrink-0`}>{t(label)}</span>
          <div role="group" aria-label={t(label)} className="flex gap-2 max-sm:w-full max-sm:overflow-x-auto max-sm:pb-1 sm:flex-wrap">
            {(['', ...values] as string[]).map(value => <Button key={value || 'all'} size="sm" variant={filters[key] === value ? 'default' : 'outline'} className={`shrink-0 rounded-full ${touch}`} aria-pressed={filters[key] === value} onClick={() => setFilter({ [key]: value })}>
              {value ? (labels as Record<string, { vi: string; en: string }>)[value][language] : t('all')}
            </Button>)}
          </div>
        </div>)}
      </div>
    </Card>

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
      <span>{error}</span>
      <Button size="sm" variant="outline" className={touch} onClick={() => void load()}><RefreshCw />{t('retry')}</Button>
    </div>}

    <Card className="gap-0 overflow-hidden rounded-2xl py-0">
      <h2 className="border-b border-border px-6 py-4 text-base font-bold">{t('list')}</h2>
      {loading && !data
        ? <div aria-busy="true" aria-label={t('loading')} className="flex flex-col divide-y divide-border">{[0, 1, 2, 3, 4].map(i => <div key={i} className="flex gap-4 px-6 py-4"><Skeleton className="size-10 rounded-full" /><div className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-64 max-w-full" /><Skeleton className="h-3 w-40" /></div></div>)}</div>
        : error && !data ? null
          : !items.length
            ? isDefault
              ? <EmptyState className="m-6" icon={ClipboardCheck} title={t('noPending')} />
              : <EmptyState className="m-6" icon={Search} title={t('noMatch')} action={<Button variant="outline" className={touch} onClick={clear}>{t('clearFilters')}</Button>} />
            : <ul className={`m-0 flex list-none flex-col divide-y divide-border p-0 transition-opacity ${loading ? 'opacity-60' : ''}`}>
              {items.map(({ course, author, authorEligible }) => <li key={course.id} className={`relative flex flex-wrap items-start gap-4 border-l-[3px] px-6 py-4 transition-colors hover:bg-muted/50 sm:flex-nowrap ${ATTENTION[course.publicationStatus] ?? ATTENTION[course.workflowStatus] ?? 'border-l-transparent'}`}>
                {course.coverImageUrl
                  ? <img src={course.coverImageUrl} alt="" className="hidden h-10 w-16 shrink-0 rounded-md border border-border object-cover sm:block" />
                  : <span aria-hidden className={`hidden h-10 w-16 shrink-0 items-center justify-center rounded-md border sm:flex ${TONE_TILE[toneFor(course.topic.name)]}`}><BookOpen className="size-4" /></span>}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 max-sm:basis-full">
                  <Link to={`/moderator/courses/${course.id}`} className="line-clamp-2 font-semibold outline-none [overflow-wrap:anywhere] after:absolute after:inset-0 focus-visible:underline">{course.title}</Link>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground"><UserAvatar name={author.fullName} url={author.avatarUrl} className="size-5" />{author.fullName}</span>
                    <Badge tone={toneFor(course.topic.name)} className="max-w-full whitespace-normal">{course.topic.name}</Badge>
                    <Badge tone="slate">{t(course.level)}</Badge>
                    <span>{t('submitted', { date: formatDate(course.updatedAt, language) })}</span>
                  </span>
                  {!authorEligible && <span className="inline-flex items-center gap-1 text-xs text-tone-rose-fg"><AlertTriangle aria-hidden className="size-3.5" />{t('ineligible')}</span>}
                </div>
                <ArticleStatusBadges article={course} language={language} moderator className="sm:max-w-72 sm:justify-end" />
              </li>)}
            </ul>}
      {!!data?.totalElements && <div className="border-t border-border px-6 py-4"><AdminPagination language={language} page={page} size={SIZE} total={data.totalElements} loading={loading} onPageChange={setPage} /></div>}
    </Card>
  </main>
}
