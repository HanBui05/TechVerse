import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Dumbbell, History, RefreshCw, Search, X } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '../../components/EmptyState'
import { Pagination } from '../../components/Pagination'
import { difficultyLabel, practiceErrorText, practiceText, typeLabel } from '../../data/exerciseI18n'
import { practice, practiceFilter, practiceSearch } from '../../services/exerciseService'
import { formatDate } from '../Author/AuthorBlogsPage'
import { touch } from '../Courses/courseParts'
import type { ArticleOption, Page } from '../../types/articles'
import type { ExerciseDifficulty, PracticeAttempt, PracticeFilter, PracticeSet } from '../../types/exercises'
import type { Language } from '../../types/preferences'

export const DIFFICULTY_TONE: Record<ExerciseDifficulty, 'green' | 'amber' | 'rose'> = { EASY: 'green', MEDIUM: 'amber', HARD: 'rose' }
const GRID = 'grid list-none gap-4 sm:grid-cols-2 xl:grid-cols-3'

/** One line about my last attempt, from the stored score (quiz: n/total (p%), cards: remembered n/total). */
export function lastAttemptLine(attempt: PracticeAttempt, language: Language) {
  const t = practiceText(language)
  const values = { correct: attempt.correctCount, total: attempt.totalCount, percent: attempt.percent, date: formatDate(attempt.completedAt, language) }
  return t(attempt.type === 'FLASHCARD' ? 'lastCards' : 'lastQuiz', values)
}

function PracticeCard({ set, language }: { set: PracticeSet; language: Language }) {
  const t = practiceText(language)
  return <Link to={`/practice/${set.id}`} className="flex min-w-0 flex-1 rounded-2xl focus-visible:outline-2 focus-visible:outline-ring">
    <Card className="w-full gap-2 rounded-2xl p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none">
      <h2 className="text-base font-bold [overflow-wrap:anywhere]">{set.title}</h2>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={set.type === 'FLASHCARD' ? 'purple' : 'blue'}>{typeLabel[set.type][language]}</Badge>
        <Badge tone={DIFFICULTY_TONE[set.difficulty]}>{difficultyLabel[set.difficulty][language]}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{t(set.type === 'FLASHCARD' ? 'cards' : 'questions', { n: set.questionCount })} · {set.topic.name}</p>
      <p className="text-sm text-muted-foreground">{t('by', { name: set.author.fullName })}</p>
      {set.lastAttempt && <p className="text-xs font-medium text-foreground">{lastAttemptLine(set.lastAttempt, language)}</p>}
    </Card>
  </Link>
}

/** Public catalogue (wireframe 6a). The URL is the only filter/page state, so F5 and shared links keep it; open to Guests. */
export function PracticeListPage({ language = 'vi', authenticated = false }: { language?: Language; authenticated?: boolean }) {
  const t = practiceText(language)
  const [params, setParams] = useSearchParams()
  const filter = practiceFilter(params)
  const search = practiceSearch(filter).toString()
  // A malformed filter (unknown enum, bad page) is rewritten instead of reaching the API as a 400.
  useEffect(() => { if (params.toString() !== search) setParams(search, { replace: true }) }, [params, search, setParams])
  const [keyword, setKeyword] = useState(filter.keyword)
  const [data, setData] = useState<Page<PracticeSet> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [topics, setTopics] = useState<ArticleOption[]>([])
  const latest = useRef(0)
  useEffect(() => { setKeyword(filter.keyword) }, [filter.keyword])
  useEffect(() => { practice.options().then(setTopics, () => {}) }, [])

  const load = useCallback(async () => {
    const id = ++latest.current
    setLoading(true); setError('')
    try {
      const result = await practice.list(practiceFilter(new URLSearchParams(search)))
      if (id === latest.current) setData(result)
    } catch (e) {
      if (id === latest.current) { setData(null); setError(practiceErrorText(e, language, t('loadError'))) }
    } finally { if (id === latest.current) setLoading(false) }
  }, [search, language]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [load])
  // A shrunken result set can leave the page past the end: step back to the last real page.
  useEffect(() => { if (data && !data.content.length && filter.page > 0 && data.totalPages > 0) setParams(practiceSearch({ ...filter, page: data.totalPages - 1 }), { replace: true }) }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (patch: Partial<PracticeFilter>) => setParams(practiceSearch({ ...filter, page: 0, ...patch }))
  const submit = (event: FormEvent) => { event.preventDefault(); commit({ keyword }) }
  const filtered = search !== ''
  const select = 'h-9 w-full rounded-xl sm:w-44'

  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{t('subtitle')}</p>
      </div>
      {authenticated && <Button asChild variant="outline" className={touch}><Link to="/me/practice"><History aria-hidden />{t('history')}</Link></Button>}
    </header>

    <Card className="rounded-2xl p-3 shadow-sm sm:p-4">
      <h2 className="sr-only">{t('filters')}</h2>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {topics.length > 0 && <div className="max-sm:col-span-1">
          <Label htmlFor="practice-topic" className="sr-only">{t('topic')}</Label>
          <NativeSelect id="practice-topic" className={cn(select, touch)} value={filter.topicId} onChange={e => commit({ topicId: e.target.value })}>
            <NativeSelectOption value="">{t('allTopics')}</NativeSelectOption>
            {topics.map(topic => <NativeSelectOption key={topic.id} value={topic.id}>{topic.name}</NativeSelectOption>)}
          </NativeSelect></div>}
        <div>
          <Label htmlFor="practice-difficulty" className="sr-only">{t('difficulty')}</Label>
          <NativeSelect id="practice-difficulty" className={cn(select, touch)} value={filter.difficulty} onChange={e => commit({ difficulty: e.target.value as PracticeFilter['difficulty'] })}>
            <NativeSelectOption value="">{t('allDifficulties')}</NativeSelectOption>
            {(['EASY', 'MEDIUM', 'HARD'] as const).map(value => <NativeSelectOption key={value} value={value}>{difficultyLabel[value][language]}</NativeSelectOption>)}
          </NativeSelect></div>
        <div className="max-sm:col-span-2">
          <Label htmlFor="practice-type" className="sr-only">{t('type')}</Label>
          <NativeSelect id="practice-type" className={cn(select, touch)} value={filter.type} onChange={e => commit({ type: e.target.value as PracticeFilter['type'] })}>
            <NativeSelectOption value="">{t('allTypes')}</NativeSelectOption>
            {(['MULTIPLE_CHOICE', 'FLASHCARD'] as const).map(value => <NativeSelectOption key={value} value={value}>{typeLabel[value][language]}</NativeSelectOption>)}
          </NativeSelect></div>
        <form role="search" onSubmit={submit} className="relative min-w-56 flex-1 max-sm:col-span-2">
          <Label htmlFor="practice-search" className="sr-only">{t('search')}</Label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-accent-text" aria-hidden />
          <Input id="practice-search" type="search" enterKeyHint="search" maxLength={100} value={keyword} onChange={e => setKeyword(e.target.value)} placeholder={t('searchPlaceholder')}
            className={cn('h-9 rounded-xl bg-muted/50 pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden', touch)} />
          {keyword && <button type="button" aria-label={t('clearSearch')} onClick={() => { setKeyword(''); commit({ keyword: '' }) }}
            className={cn('absolute top-1/2 right-1 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground', touch)}><X className="size-4" aria-hidden /></button>}
        </form>
      </div>
    </Card>

    {error
      ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
          <span>{error}</span><Button type="button" variant="outline" size="sm" className={touch} onClick={() => void load()}><RefreshCw aria-hidden />{t('retry')}</Button></div>
      : loading && !data
        ? <ul role="status" aria-label={t('loading')} className={GRID}>{Array.from({ length: 6 }, (_, i) => <li key={i}><Skeleton className="h-36 rounded-2xl" /></li>)}</ul>
        : data && !data.content.length
          ? <EmptyState icon={Dumbbell} title={filtered ? t('noMatch') : t('empty')} action={filtered && <Button type="button" variant="outline" className={touch} onClick={() => setParams(new URLSearchParams())}>{t('clearFilters')}</Button>} />
          : data && <ul aria-label={t('list')} aria-busy={loading} className={GRID}>{data.content.map(set => <li key={set.id} className="flex min-w-0"><PracticeCard set={set} language={language} /></li>)}</ul>}

    {data && !error && <Pagination language={language} page={filter.page} totalPages={data.totalPages} loading={loading} onPageChange={page => setParams(practiceSearch({ ...filter, page }))} />}
  </main>
}
