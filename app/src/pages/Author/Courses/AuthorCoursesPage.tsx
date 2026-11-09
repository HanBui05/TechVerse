import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, Eye, GraduationCap, Layers, PencilLine, Plus, RefreshCw, Search, SlidersHorizontal, SquarePen } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { toneFor } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { EmptyState } from '../../../components/EmptyState'
import { AdminPagination } from '../../Admin/AdminPagination'
import { TONE_TILE, fieldLabel, formatDate } from '../AuthorBlogsPage'
import { CourseActionMenu, CourseStatusBadges, useCourseActions } from './courseActions'
import { courseErrorText, courseText } from '../../../data/courseI18n'
import { publicationLabel, workflowLabel } from '../../../data/articleI18n'
import { authorActions } from '../../../services/articleService'
import { authorCourses } from '../../../services/courseService'
import type { ArticleOption, AuthorArticleFilter, Page, PublicationStatus, WorkflowStatus } from '../../../types/articles'
import type { AuthorCourseSummary } from '../../../types/courses'
import type { Language } from '../../../types/preferences'

const SIZE = 20
const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
type StatKey = 'total' | 'DRAFT' | 'PENDING' | 'CHANGES_REQUESTED' | 'live'
const STATS: [StatKey, Pick<AuthorArticleFilter, 'workflowStatus' | 'publicationStatus'>, ComponentType<{ className?: string }>, BadgeTone][] = [
  ['total', {}, Layers, 'blue'], ['DRAFT', { workflowStatus: 'DRAFT' }, SquarePen, 'slate'], ['PENDING', { workflowStatus: 'PENDING' }, Clock, 'amber'],
  ['CHANGES_REQUESTED', { workflowStatus: 'CHANGES_REQUESTED' }, PencilLine, 'sky'], ['live', { publicationStatus: 'PUBLISHED' }, CheckCircle2, 'green'],
]
const WORKFLOWS: WorkflowStatus[] = ['DRAFT', 'PENDING', 'CHANGES_REQUESTED', 'PUBLISHED']
const PUBLICATIONS: PublicationStatus[] = ['UNPUBLISHED', 'PUBLISHED', 'AUTHOR_HIDDEN', 'HIDDEN', 'REMOVED']
const SORTS = { newest: 'CREATED_AT:DESC', oldest: 'CREATED_AT:ASC', recentlyEdited: 'UPDATED_AT:DESC', titleAz: 'TITLE:ASC' } as const
const ATTENTION: Partial<Record<string, string>> = { PENDING: 'border-l-tone-amber-fg', CHANGES_REQUESTED: 'border-l-tone-sky-fg', HIDDEN: 'border-l-tone-rose-fg', REMOVED: 'border-l-tone-rose-fg', AUTHOR_HIDDEN: 'border-l-tone-rose-fg' }
const EMPTY_FILTERS = { workflowStatus: '' as WorkflowStatus | '', publicationStatus: '' as PublicationStatus | '', topicId: '', tagId: '', sort: SORTS.newest as string }

/** `/author/courses`: same workspace as the article list (stat tiles = filters, status chips, rows) over the course API. */
export function AuthorCoursesPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = courseText(language)
  const navigate = useNavigate()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [keyword, setKeyword] = useState('')
  const query = useDebouncedValue(keyword.trim())
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Page<AuthorCourseSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [stats, setStats] = useState<(number | null)[]>(STATS.map(() => null))
  const [options, setOptions] = useState<{ topics: ArticleOption[]; tags: ArticleOption[] }>({ topics: [], tags: [] })
  const latest = useRef(0)

  const load = useCallback(async () => {
    const id = ++latest.current
    setLoading(true); setError('')
    const [sortBy, direction] = filters.sort.split(':') as [AuthorArticleFilter['sortBy'], AuthorArticleFilter['direction']]
    try {
      const result = await authorCourses.list({ page, size: SIZE, keyword: query, workflowStatus: filters.workflowStatus, publicationStatus: filters.publicationStatus, topicId: filters.topicId, tagId: filters.tagId, sortBy, direction })
      if (id === latest.current) setData(result)
    } catch (e) { if (id === latest.current) setError(courseErrorText(e, language, t('loadError'))) }
    finally { if (id === latest.current) setLoading(false) }
  }, [filters, page, query, language])
  // Counts are decoration: a failing count shows “—” without blocking the list.
  const loadStats = useCallback(() => {
    STATS.forEach(([, filter], i) => authorCourses.list({ page: 0, size: 1, ...filter })
      .then(result => result.totalElements, () => null)
      .then(value => setStats(old => old.map((v, j) => j === i ? value : v))))
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { authorCourses.options().then(o => setOptions({ topics: o.topics.content, tags: o.tags.content }), () => {}) }, [])
  useEffect(() => { setPage(0) }, [query])

  const actions = useCourseActions(language, action => {
    setMessage(action === 'deleteHard' || action === 'deleteSoft' ? t('deleted') : t('actionDone'))
    void load(); loadStats()
  })
  const setFilter = (next: Partial<typeof EMPTY_FILTERS>) => { setFilters(old => ({ ...old, ...next })); setPage(0); setMessage('') }
  const filtered = Boolean(query || filters.workflowStatus || filters.publicationStatus || filters.topicId || filters.tagId)
  const clear = () => { setKeyword(''); setFilter(EMPTY_FILTERS) }
  const items = data?.content ?? []

  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <Badge tone="purple" className="self-start"><GraduationCap aria-hidden />{t('kicker')}</Badge>
        <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <Button asChild className={touch}><Link to="/author/courses/new"><Plus />{t('newCourse')}</Link></Button>
    </header>

    <section aria-label={t('stats')} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {STATS.map(([key, filter, Icon, tone], i) => {
        const active = (filter.workflowStatus ?? '') === filters.workflowStatus && (filter.publicationStatus ?? '') === filters.publicationStatus
        const label = key === 'total' ? t('total') : key === 'live' ? publicationLabel.PUBLISHED[language] : workflowLabel[key][language]
        return <button key={key} type="button" aria-pressed={active} onClick={() => setFilter({ workflowStatus: filter.workflowStatus ?? '', publicationStatus: filter.publicationStatus ?? '' })}
          className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-left shadow-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring ${touch} ${active ? TONE_TILE[tone] : 'border-border bg-card text-card-foreground hover:bg-muted/50'}`}>
          <span className="flex min-w-0 flex-col gap-1"><span className={`${fieldLabel} ${active ? 'text-current' : ''}`}>{label}</span><span className="text-2xl font-bold tabular-nums">{stats[i] ?? '—'}</span></span>
          <span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${TONE_TILE[tone]}`}><Icon className="size-5" /></span>
        </button>
      })}
    </section>

    <Card className="gap-0 rounded-2xl py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold"><span aria-hidden className="flex size-8 items-center justify-center rounded-lg border border-tone-sky-border bg-tone-sky-bg text-tone-sky-fg"><SlidersHorizontal className="size-4" /></span>{t('filters')}</h2>
        {data && <Badge tone="blue" aria-live="polite">{t('count', { n: data.totalElements })}</Badge>}
      </div>
      <div className="flex flex-col gap-4 p-6">
        <div className="grid gap-4 md:grid-cols-12">
          <div className="flex flex-col gap-2 md:col-span-5">
            <Label htmlFor="course-search" className={fieldLabel}>{t('search')}</Label>
            <div className="relative"><Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="course-search" type="search" maxLength={255} className={`pl-9 ${touch}`} placeholder={t('searchPlaceholder')} value={keyword} onChange={e => setKeyword(e.target.value)} /></div>
          </div>
          {([['topicId', 'topic', 'allTopics', options.topics], ['tagId', 'tag', 'allTags', options.tags]] as const).map(([key, label, all, list]) => <div key={key} className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor={`course-${key}`} className={fieldLabel}>{t(label)}</Label>
            <NativeSelect id={`course-${key}`} className={touch} value={filters[key]} onChange={e => setFilter({ [key]: e.target.value })}>
              <NativeSelectOption value="">{t(all)}</NativeSelectOption>
              {list.map(o => <NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}
            </NativeSelect>
          </div>)}
          <div className="flex flex-col gap-2 md:col-span-3">
            <Label htmlFor="course-sort" className={fieldLabel}>{t('sort')}</Label>
            <NativeSelect id="course-sort" className={touch} value={filters.sort} onChange={e => setFilter({ sort: e.target.value })}>
              {(Object.keys(SORTS) as (keyof typeof SORTS)[]).map(key => <NativeSelectOption key={key} value={SORTS[key]}>{t(key)}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        </div>
        {([['workflowFilter', 'workflowStatus', WORKFLOWS, workflowLabel], ['publicationFilter', 'publicationStatus', PUBLICATIONS, publicationLabel]] as const).map(([label, key, values, labels]) => <div key={key} className="flex flex-wrap items-center gap-2">
          <span className={`${fieldLabel} w-24`}>{t(label)}</span>
          <div role="group" aria-label={t(label)} className="flex flex-wrap gap-2">
            {(['', ...values] as string[]).map(value => <Button key={value || 'all'} size="sm" variant={filters[key] === value ? 'default' : 'outline'} className={`rounded-full ${touch}`} aria-pressed={filters[key] === value} onClick={() => setFilter({ [key]: value })}>
              {value ? (labels as Record<string, { vi: string; en: string }>)[value][language] : t('all')}
            </Button>)}
          </div>
        </div>)}
      </div>
    </Card>

    {(error || actions.error) && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
      <span>{error || actions.error}</span>
      {error && <Button size="sm" variant="outline" className={touch} onClick={() => void load()}><RefreshCw />{t('retry')}</Button>}
    </div>}
    {message && <p role="status" className="rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">{message}</p>}

    <Card className="gap-0 overflow-hidden rounded-2xl py-0">
      <h2 className="border-b border-border px-6 py-4 text-base font-bold">{t('list')}</h2>
      {loading && !data
        ? <div aria-busy="true" aria-label={t('loading')} className="flex flex-col divide-y divide-border">{[0, 1, 2, 3, 4].map(i => <div key={i} className="flex gap-4 px-6 py-4"><Skeleton className="hidden h-10 w-16 sm:block" /><div className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-64 max-w-full" /><Skeleton className="h-3 w-40" /></div></div>)}</div>
        : error && !data ? null
          : !items.length
            ? filtered
              ? <EmptyState className="m-6" icon={Search} title={t('noMatch')} action={<Button variant="outline" className={touch} onClick={clear}>{t('clearFilters')}</Button>} />
              : <EmptyState className="m-6" icon={GraduationCap} title={t('emptyTitle')} description={<span className="flex flex-col items-center gap-3">{t('emptyText')}<span className="flex flex-wrap justify-center gap-2">{t('steps').split('|').map((step, i) => <Badge key={step} tone={(['slate', 'amber', 'green'] as const)[i]}>{i + 1}. {step}</Badge>)}</span></span>}
                action={<Button asChild className={touch}><Link to="/author/courses/new"><Plus />{t('createFirst')}</Link></Button>} />
            : <ul className={`m-0 flex list-none flex-col divide-y divide-border p-0 transition-opacity ${loading ? 'opacity-60' : ''}`}>
              {items.map(item => {
                const { primary } = authorActions(item)
                const attention = ATTENTION[item.publicationStatus] ?? ATTENTION[item.workflowStatus]
                return <li key={item.id} onClick={e => { if (!(e.target as Element).closest('a,button')) navigate(`/author/courses/${item.id}/edit`) }}
                  className={`flex cursor-pointer flex-wrap items-start gap-4 border-l-[3px] px-6 py-4 transition-colors hover:bg-muted/50 sm:flex-nowrap ${attention ?? 'border-l-transparent'}`}>
                  {item.coverImageUrl
                    ? <img src={item.coverImageUrl} alt="" className="hidden h-10 w-16 shrink-0 rounded-md border border-border object-cover sm:block" />
                    : <span aria-hidden className={`hidden h-10 w-16 shrink-0 items-center justify-center rounded-md border sm:flex ${TONE_TILE[toneFor(item.topic.name)]}`}><GraduationCap className="size-4" /></span>}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="line-clamp-2 font-semibold [overflow-wrap:anywhere]">{item.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <Badge tone={toneFor(item.topic.name)} className="max-w-full whitespace-normal">{item.topic.name}</Badge>
                      <Badge tone="slate">{t(item.level)}</Badge>
                      <span>{t('updated', { date: formatDate(item.updatedAt, language) })}</span>
                      {item.publishedAt && <span>· {t('publishedOn', { date: formatDate(item.publishedAt, language) })}</span>}
                    </span>
                    <CourseStatusBadges course={item} language={language} />
                    {item.publicationStatus === 'HIDDEN' && <span className="text-xs text-tone-rose-fg"><span aria-hidden>ⓘ </span>{t('moderatorHidden')}</span>}
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <Button asChild size="sm" variant={primary === 'edit' ? 'default' : 'outline'} className={touch}>
                      <Link to={`/author/courses/${item.id}/edit`} aria-label={`${t(primary)} ${item.title}`}>{primary === 'edit' ? <PencilLine /> : <Eye />}{t(primary)}</Link>
                    </Button>
                    <CourseActionMenu course={item} language={language} onAsk={actions.ask} disabled={actions.busy} />
                  </div>
                </li>
              })}
            </ul>}
      {!!data?.totalElements && <div className="border-t border-border px-6 py-4"><AdminPagination language={language} page={page} size={SIZE} total={data.totalElements} loading={loading} onPageChange={setPage} /></div>}
    </Card>
    {actions.elements}
  </main>
}
