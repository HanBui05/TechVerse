import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ClipboardCheck, Layers, ListChecks, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
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
import { AdminPagination } from '../../Admin/AdminPagination'
import { difficultyLabel, moderatorExerciseErrorText, moderatorExerciseText, statusLabel, typeLabel } from '../../../data/exerciseI18n'
import { moderatorExercises } from '../../../services/exerciseService'
import type { ArticleOption, Page } from '../../../types/articles'
import type { ExerciseStatus, ExerciseType, ModeratorExerciseSummary } from '../../../types/exercises'
import type { Language } from '../../../types/preferences'
import { fieldLabel, formatDate } from '../../Author/AuthorBlogsPage'
import { exerciseTone } from '../../Author/Exercises/AuthorExercisesPage'

const SIZE = 12
const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
// Drafts are private: the API never returns them, so there is no “Draft” filter.
const STATUSES: ExerciseStatus[] = ['PENDING', 'CHANGES_REQUESTED', 'PUBLISHED', 'AUTHOR_HIDDEN', 'HIDDEN', 'REMOVED']
const ATTENTION: Partial<Record<ExerciseStatus, string>> = { PENDING: 'border-l-tone-amber-fg', CHANGES_REQUESTED: 'border-l-tone-sky-fg', HIDDEN: 'border-l-tone-rose-fg', REMOVED: 'border-l-tone-rose-fg', AUTHOR_HIDDEN: 'border-l-tone-rose-fg' }
const DEFAULT = { status: 'PENDING' as ExerciseStatus, type: '' as ExerciseType | '', topicId: '' }

export function ModeratorExercisesPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = moderatorExerciseText(language)
  const [filters, setFilters] = useState(DEFAULT)
  const [keyword, setKeyword] = useState('')
  const query = useDebouncedValue(keyword.trim())
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Page<ModeratorExerciseSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [topics, setTopics] = useState<ArticleOption[]>([])
  const [topicsError, setTopicsError] = useState(false)
  // Only the newest list request may update the page.
  const latest = useRef(0)

  const load = useCallback(async () => {
    const id = ++latest.current
    setLoading(true); setError('')
    try {
      const result = await moderatorExercises.list({ page, size: SIZE, keyword: query, ...filters })
      if (id !== latest.current) return
      if (page > 0 && page >= result.totalPages) { setPage(Math.max(0, result.totalPages - 1)); return }
      setData(result)
    } catch (e) { if (id === latest.current) setError(moderatorExerciseErrorText(e, language, t('loadError'))) }
    finally { if (id === latest.current) setLoading(false) }
  }, [filters, page, query, language])
  useEffect(() => { void load() }, [load])
  useEffect(() => { setPage(0) }, [query])
  const loadTopics = useCallback(() => { setTopicsError(false); moderatorExercises.options().then(setTopics, () => setTopicsError(true)) }, [])
  useEffect(() => { loadTopics() }, [loadTopics])

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
      <Button variant="outline" className={touch} onClick={() => { void load(); if (topicsError) loadTopics() }} disabled={loading}><RefreshCw className={loading ? 'animate-spin motion-reduce:animate-none' : ''} />{t('refresh')}</Button>
    </header>

    <Card className="gap-4 rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><SlidersHorizontal className="size-4 text-accent-text" aria-hidden />{t('filters')}</h2>
        {data && <Badge tone="blue" aria-live="polite" className="px-3 py-1 font-semibold">{t('count', { n: data.totalElements })}</Badge>}
      </div>
      <div className="flex flex-col gap-3.5">
        <div className="grid gap-3.5 md:grid-cols-12">
          <div className="flex flex-col gap-1.5 md:col-span-6">
            <Label htmlFor="exercise-moderator-search" className={fieldLabel}>{t('search')}</Label>
            <div className="relative"><Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-accent-text" />
              <Input id="exercise-moderator-search" type="search" maxLength={100} className={`h-10 rounded-xl bg-background/60 pl-10 ${touch}`} placeholder={t('searchPlaceholder')} value={keyword} onChange={e => setKeyword(e.target.value)} /></div>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-3">
            <Label htmlFor="exercise-moderator-type" className={fieldLabel}>{t('type')}</Label>
            <NativeSelect id="exercise-moderator-type" className={`h-10 rounded-xl bg-background/60 ${touch}`} value={filters.type} onChange={e => setFilter({ type: e.target.value as ExerciseType | '' })}>
              <NativeSelectOption value="">{t('all')}</NativeSelectOption>
              {(Object.keys(typeLabel) as ExerciseType[]).map(type => <NativeSelectOption key={type} value={type}>{typeLabel[type][language]}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-3">
            <Label htmlFor="exercise-moderator-topic" className={fieldLabel}>{t('topic')}</Label>
            <NativeSelect id="exercise-moderator-topic" className={`h-10 rounded-xl bg-background/60 ${touch}`} value={filters.topicId} onChange={e => setFilter({ topicId: e.target.value })}>
              <NativeSelectOption value="">{t('allTopics')}</NativeSelectOption>
              {topics.map(o => <NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        </div>
        {topicsError && <p className="flex flex-wrap items-center gap-2 text-sm text-danger"><span>{t('loadError')}</span><Button size="sm" variant="outline" className={touch} onClick={loadTopics}><RefreshCw />{t('retry')}</Button></p>}
        <div className="flex items-center gap-2 max-sm:flex-col max-sm:items-start">
          <span className={`${fieldLabel} w-24 shrink-0`}>{t('status')}</span>
          <div role="group" aria-label={t('status')} className="flex items-center gap-1 rounded-xl border border-border/70 bg-background/60 p-1 max-sm:w-full max-sm:overflow-x-auto sm:flex-wrap">
            {STATUSES.map(value => {
              const selected = filters.status === value
              return <button key={value} type="button" aria-pressed={selected} onClick={() => setFilter({ status: value })}
                className={`inline-flex h-8 shrink-0 cursor-pointer items-center rounded-lg px-3 text-xs font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring ${touch} ${selected ? 'bg-card text-foreground shadow-xs ring-1 ring-border/80' : 'text-muted-foreground hover:text-foreground'}`}>
                {statusLabel[value][language]}
              </button>
            })}
          </div>
        </div>
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
              ? <EmptyState className="m-6" icon={ClipboardCheck} title={t('empty')} />
              : <EmptyState className="m-6" icon={Search} title={t('noMatch')} action={<Button variant="outline" className={touch} onClick={clear}>{t('clearFilters')}</Button>} />
            : <ul className={`m-0 flex list-none flex-col divide-y divide-border p-0 transition-opacity ${loading ? 'opacity-60' : ''}`}>
              {items.map(({ set, author, authorEligible }) => <li key={set.id} className={`relative flex flex-wrap items-start gap-4 border-l-[3px] px-6 py-4 transition-colors hover:bg-muted/50 sm:flex-nowrap ${ATTENTION[set.status] ?? 'border-l-transparent'}`}>
                <span aria-hidden className="hidden size-10 shrink-0 items-center justify-center rounded-md border border-tone-sky-border bg-tone-sky-bg text-tone-sky-fg sm:flex">{set.type === 'FLASHCARD' ? <Layers className="size-4" /> : <ListChecks className="size-4" />}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 max-sm:basis-full">
                  <Link to={`/moderator/exercises/${set.id}`} className="line-clamp-2 font-semibold outline-none [overflow-wrap:anywhere] after:absolute after:inset-0 focus-visible:underline">{set.title}</Link>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground"><UserAvatar name={author.fullName} url={author.avatarUrl} className="size-5" />{author.fullName}</span>
                    <Badge tone="slate">{typeLabel[set.type][language]}</Badge>
                    <Badge tone="slate">{difficultyLabel[set.difficulty][language]}</Badge>
                    <Badge tone={toneFor(set.topic.name)} className="max-w-full whitespace-normal">{set.topic.name}</Badge>
                    <span>{t(set.type === 'FLASHCARD' ? 'cards' : 'questions', { n: set.questionCount })}</span>
                    <span>{t('submitted', { date: formatDate(set.updatedAt, language, true) })}</span>
                    {set.aiAssisted && <Badge tone="purple">{t('aiUsed')}</Badge>}
                  </span>
                  {!authorEligible && <span className="inline-flex items-center gap-1 text-xs text-tone-rose-fg"><AlertTriangle aria-hidden className="size-3.5" />{t('ineligible')}</span>}
                </div>
                <Badge tone={exerciseTone(set.status)} className="shrink-0">{statusLabel[set.status][language]}</Badge>
              </li>)}
            </ul>}
      {!!data?.totalElements && <div className="border-t border-border px-6 py-4"><AdminPagination language={language} page={page} size={SIZE} total={data.totalElements} loading={loading} onPageChange={setPage} /></div>}
    </Card>
  </main>
}
