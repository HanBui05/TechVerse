import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, History, RefreshCw, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '../../components/EmptyState'
import { Pagination } from '../../components/Pagination'
import { practiceErrorKind, practiceErrorText, practiceText, typeLabel } from '../../data/exerciseI18n'
import { practice } from '../../services/exerciseService'
import { formatDate } from '../Author/AuthorBlogsPage'
import { touch } from '../Courses/courseParts'
import { PracticeResult, duration } from './PracticeResult'
import type { Page } from '../../types/articles'
import type { PracticeAttempt } from '../../types/exercises'
import type { Language } from '../../types/preferences'

const score = (a: PracticeAttempt, t: ReturnType<typeof practiceText>) => t(a.type === 'FLASHCARD' ? 'scoreCards' : 'scoreQuiz', { correct: a.correctCount, total: a.totalCount, percent: a.percent })

/** `/me/practice` (wireframe 6f): my attempts, newest first; each row opens the stored review. */
export function PracticeHistoryPage({ language = 'vi' }: { language?: Language }) {
  const t = practiceText(language)
  const [pageIndex, setPageIndex] = useState(0)
  const [data, setData] = useState<Page<PracticeAttempt> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(await practice.history(pageIndex)) }
    catch (e) { setData(null); setError(practiceErrorText(e, language, t('loadError'))) }
    finally { setLoading(false) }
  }, [pageIndex, language]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [load])

  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 lg:px-8">
    <header className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl border border-border/80 bg-linear-to-br from-card via-card to-tone-blue-bg/20 p-6 shadow-sm">
      <span aria-hidden className="hidden size-12 shrink-0 items-center justify-center rounded-2xl border border-tone-blue-border bg-tone-blue-bg text-tone-blue-fg shadow-2xs sm:flex"><History className="size-6" /></span>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t('historyTitle')}</h1>
    </header>
    {error
      ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
          <span>{error}</span><Button type="button" variant="outline" size="sm" className={touch} onClick={() => void load()}><RefreshCw aria-hidden />{t('retry')}</Button></div>
      : loading && !data
        ? <div role="status" aria-label={t('loading')} className="flex flex-col gap-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        : data && !data.content.length
          ? <EmptyState icon={History} title={t('historyEmpty')} action={<Button asChild variant="outline" className={touch}><Link to="/practice">{t('toPractice')}</Link></Button>} />
          : data && <ul aria-label={t('historyTitle')} aria-busy={loading} className="flex list-none flex-col gap-3">{data.content.map(attempt => <li key={attempt.id}>
              <Link to={`/me/practice/${attempt.id}`} className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-ring">
                <Card className="flex-row items-center justify-between gap-3 rounded-2xl p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent-text/40 hover:shadow-md motion-reduce:transition-none">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="flex flex-wrap items-center gap-2"><span className="font-bold transition-colors group-hover:text-accent-text [overflow-wrap:anywhere]">{attempt.title}</span><Badge tone={attempt.type === 'FLASHCARD' ? 'purple' : 'blue'}>{typeLabel[attempt.type][language]}</Badge></span>
                    <span className="text-sm text-muted-foreground">{score(attempt, t)} · {duration(attempt.durationSeconds, t)} · {formatDate(attempt.completedAt, language, true)}</span>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent-text" aria-hidden />
                </Card>
              </Link></li>)}</ul>}
    {data && !error && <Pagination language={language} page={pageIndex} totalPages={data.totalPages} loading={loading} onPageChange={setPageIndex} />}
  </main>
}

/** `/me/practice/:attemptId`: the stored snapshot, even when the set was hidden or removed meanwhile (then no retake button). */
export function PracticeAttemptReviewPage({ language = 'vi' }: { language?: Language }) {
  const { attemptId = '' } = useParams()
  const t = practiceText(language)
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [error, setError] = useState('')
  const [available, setAvailable] = useState<boolean | null>(null)
  const [run, setRun] = useState(0)
  useEffect(() => {
    let live = true
    setState('loading'); setAvailable(null)
    practice.attempt(attemptId).then(result => {
      if (!live) return
      setAttempt(result); setState('ready')
      practice.detail(result.exerciseSetId).then(() => live && setAvailable(true), () => live && setAvailable(false))
    }, e => { if (live) { setState(practiceErrorKind(e) === 'attemptNotFound' ? 'missing' : 'error'); setError(practiceErrorText(e, language, t('loadError'))) } })
    return () => { live = false }
  }, [attemptId, run, language]) // eslint-disable-line react-hooks/exhaustive-deps

  const back = <Link to="/me/practice" className="text-sm text-muted-foreground hover:text-foreground">‹ {t('backHistory')}</Link>
  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8 pb-28 sm:px-6 lg:px-8">
    {state === 'loading' && <div role="status" aria-label={t('loading')} className="flex flex-col gap-3"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-40 w-full rounded-2xl" /></div>}
    {state === 'missing' && <div role="status" className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center"><p className="text-base font-bold">{t('attemptNotFound')}</p><Button asChild variant="outline" className={touch}><Link to="/me/practice">{t('toHistory')}</Link></Button></div>}
    {state === 'error' && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger"><span>{error}</span><Button type="button" variant="outline" size="sm" className={touch} onClick={() => setRun(r => r + 1)}><RefreshCw aria-hidden />{t('retry')}</Button></div>}
    {state === 'ready' && attempt && <>
      {back}
      <h1 className="text-sm font-semibold text-muted-foreground">{attempt.title}</h1>
      <PracticeResult attempt={attempt} language={language} actions={<>
        {available && <Button asChild className={touch}><Link to={`/practice/${attempt.exerciseSetId}/attempt`}><RotateCcw aria-hidden />{t(attempt.type === 'FLASHCARD' ? 'reviewAgain' : 'attemptAgain')}</Link></Button>}
        {available === false && <p className="text-sm text-muted-foreground">{t('setGone')}</p>}
      </>} />
    </>}
  </main>
}
