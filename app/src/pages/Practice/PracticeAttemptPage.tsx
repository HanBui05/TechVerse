import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, UNSAFE_DataRouterContext, useBlocker, useParams } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, CircleAlert, ListChecks, RefreshCw, RotateCcw, X } from 'lucide-react'
import { cn } from 'cn'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { MarkdownContent } from '../../components/MarkdownContent'
import { practiceErrorKind, practiceErrorText, practiceText, type PracticeErrorKind } from '../../data/exerciseI18n'
import { ApiError } from '../../services/api/client'
import { attemptBody, fenced, practice, unansweredCount } from '../../services/exerciseService'
import { ProgressBar, touch } from '../Courses/courseParts'
import { PracticeResult } from './PracticeResult'
import type { CardQuestion, PracticeAttempt, PracticeQuestions, QuizQuestion } from '../../types/exercises'
import type { Language } from '../../types/preferences'

type Marks = Record<string, number | boolean | null>
const letter = (i: number) => String.fromCharCode(65 + i)
const isField = (target: EventTarget | null) => { const el = target as HTMLElement | null; return !!el && (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName) || el.isContentEditable) }

/** Blocks in-app navigation while answers are unsent; needs a data router (see main.tsx). */
function LeaveGuard({ dirty, language }: { dirty: boolean; language: Language }) {
  const t = practiceText(language)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  return <AlertDialog open={blocker.state === 'blocked'}>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{t('leave')}</AlertDialogTitle></AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className={touch} onClick={() => blocker.reset?.()}>{t('stay')}</AlertDialogCancel>
        <AlertDialogAction className={touch} onClick={() => blocker.proceed?.()}>{t('leaveNow')}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}

/** Quiz / flashcard attempt (wireframe 6c–6e). Answers live only in memory: F5 starts over, the server never keeps a draft. */
export function PracticeAttemptPage({ language = 'vi' }: { language?: Language }) {
  const { id = '' } = useParams()
  const t = practiceText(language)
  const dataRouter = useContext(UNSAFE_DataRouterContext)
  const [run, setRun] = useState(0)
  const [load, setLoad] = useState<'loading' | 'ready' | 'error' | 'gone' | 'forbidden' | 'login'>('loading')
  const [loadError, setLoadError] = useState('')
  const [data, setData] = useState<PracticeQuestions | null>(null)
  const [title, setTitle] = useState('')
  const [marks, setMarks] = useState<Marks>({})
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<{ kind: PracticeErrorKind; text: string; rate: boolean } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [result, setResult] = useState<PracticeAttempt | null>(null)
  const key = useRef<string | null>(null)
  const startedAt = useRef(Date.now())
  const questionHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let live = true
    setLoad('loading'); setLoadError(''); setData(null); setMarks({}); setIndex(0); setFlipped(false); setProblem(null); setResult(null); key.current = null
    practice.detail(id).then(set => { if (live) setTitle(set.title) }, () => {})
    practice.questions(id).then(questions => { if (!live) return; startedAt.current = Date.now(); setData(questions); setLoad('ready') }, error => {
      if (!live) return
      const kind = practiceErrorKind(error)
      setLoad(kind === 'login' ? 'login' : kind === 'gone' ? 'gone' : kind === 'forbidden' ? 'forbidden' : 'error')
      setLoadError(practiceErrorText(error, language, t('questionsError')))
    })
    return () => { live = false }
  }, [id, run, language]) // eslint-disable-line react-hooks/exhaustive-deps

  const questions = data?.questions ?? []
  const ids = questions.map(q => q.id)
  const card = data?.type === 'FLASHCARD'
  // After a failed submit whose outcome is unknown the answers stay frozen, so a retry with the same key can only return the stored attempt.
  const frozen = problem?.kind === 'retry'
  const dirty = !result && load === 'ready' && Object.values(marks).some(value => value !== null)

  const submit = useCallback(async (current: Marks) => {
    if (!data || busy) return
    key.current ??= crypto.randomUUID()
    setBusy(true); setProblem(null); setConfirming(false)
    try {
      const seconds = Math.min(86400, Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)))
      const attempt = await practice.submit(id, attemptBody(data.type, data.questions.map(q => q.id), current, seconds), key.current)
      key.current = null
      setResult(attempt)
    } catch (error) {
      const kind = practiceErrorKind(error)
      if (kind === 'login') setLoad('login')
      else if (kind === 'gone') setLoad('gone')
      else { if (kind === 'restart') key.current = null; setProblem({ kind, text: practiceErrorText(error, language, t('loadError')), rate: error instanceof ApiError && error.code === 'EXERCISE_RATE_LIMITED' }) }
    } finally { setBusy(false) }
  }, [data, busy, id, language]) // eslint-disable-line react-hooks/exhaustive-deps

  // `toggle` is the click on the option already chosen (clears it); `select` is any change, which is also what arrow keys and screen readers fire.
  const choose = (qid: string, i: number | null) => setMarks(m => ({ ...m, [qid]: i }))
  const pick = (qid: string, i: number) => choose(qid, marks[qid] === i ? null : i)
  const go = (to: number) => { if (to >= 0 && to < questions.length && !busy) { setIndex(to); setFlipped(false); setListOpen(false); questionHeading.current?.focus() } }
  const mark = (remembered: boolean) => {
    const next = { ...marks, [questions[index].id]: remembered }
    setMarks(next)
    if (index === questions.length - 1) void submit(next); else go(index + 1)
  }
  const askSubmit = () => unansweredCount(ids, marks as Record<string, number | null>) > 0 ? setConfirming(true) : void submit(marks)

  useEffect(() => {
    if (load !== 'ready' || result || busy || frozen || confirming || !data) return
    const onKey = (e: KeyboardEvent) => {
      if (isField(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (card) { if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f) } else if (e.key === 'ArrowLeft') go(index - 1); return }
      const q = questions[index] as QuizQuestion
      if (/^[1-6]$/.test(e.key) && Number(e.key) <= q.options.length) pick(q.id, Number(e.key) - 1)
      else if (e.key === 'ArrowRight') go(index + 1)
      else if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [load, result, busy, frozen, confirming, data, card, index]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const shell = (body: ReactNode) => <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 pb-32 sm:px-6 lg:pb-8">{body}</main>
  const notice = (text: string, link: ReactNode = <Button asChild variant="outline" className={touch}><Link to="/practice">{t('toList')}</Link></Button>) =>
    shell(<div role="status" className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center"><p className="text-base font-bold">{text}</p>{link}</div>)

  if (load === 'login') return <Navigate to="/login" replace state={{ returnTo: `/practice/${id}/attempt` }} />
  if (load === 'gone') return notice(t('gone'))
  if (load === 'forbidden') return notice(practiceErrorText(new ApiError('', 403, 'ACCESS_DENIED'), language, ''), undefined)
  if (load === 'loading') return shell(<div role="status" aria-label={t('loading')} className="flex flex-col gap-4"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-3 w-full" /><Skeleton className="h-48 w-full rounded-2xl" /></div>)
  if (load === 'error') return notice(loadError, <Button type="button" variant="outline" className={touch} onClick={() => setRun(r => r + 1)}><RefreshCw aria-hidden />{t('retry')}</Button>)

  const restart = () => setRun(r => r + 1)
  if (result) return shell(<>
    <h1 className="text-sm font-semibold text-muted-foreground">{title || result.title}</h1>
    <PracticeResult attempt={result} language={language} actions={<>
      <Button type="button" className={touch} onClick={restart}><RotateCcw aria-hidden />{card ? t('reviewAgain') : t('attemptAgain')}</Button>
      <Button asChild variant="outline" className={touch}><Link to="/practice">{t('toList')}</Link></Button>
    </>} />
  </>)

  const total = questions.length
  const current = questions[index]
  const percent = Math.round(((index + 1) / total) * 100)
  const failure = problem && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
    <span className="flex items-center gap-2"><CircleAlert className="size-4 shrink-0" aria-hidden />{problem.text}</span>
    {problem.kind === 'restart'
      ? <Button type="button" size="sm" variant="outline" className={touch} onClick={restart}><RotateCcw aria-hidden />{t('attemptAgain')}</Button>
      : <Button type="button" size="sm" variant="outline" className={touch} onClick={() => void submit(marks)}><RefreshCw aria-hidden />{t(problem.rate ? 'resubmit' : 'retry')}</Button>}
  </div>

  const header = <header className="flex flex-col gap-2">
    <Link to="/practice" className="text-sm text-muted-foreground hover:text-foreground">‹ {t('back')}</Link>
    <div className="flex items-baseline justify-between gap-3"><h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1><span className="text-sm tabular-nums text-muted-foreground">{percent}%</span></div>
    <ProgressBar percent={percent} label={t('progressLabel')} />
  </header>

  if (card) {
    const c = current as CardQuestion
    return shell(<>
      {header}
      {dataRouter && <LeaveGuard dirty={dirty} language={language} />}
      <h2 ref={questionHeading} tabIndex={-1} className="text-sm font-semibold outline-none">{t('cardProgress', { n: index + 1, total })}</h2>
      <Card className="min-h-48 cursor-pointer justify-center gap-3 rounded-2xl p-6 shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200" key={`${c.id}-${flipped}`} onClick={() => setFlipped(f => !f)}>
        <p className="text-xs font-semibold text-muted-foreground">{flipped ? t('back2') : t('front')}</p>
        <div aria-live="polite"><MarkdownContent content={flipped ? c.back : c.front} language={language} />
          {flipped && c.explanation && <div className="mt-3 border-t border-border pt-3 text-sm"><p className="font-semibold">{t('explanation')}</p><MarkdownContent content={c.explanation} language={language} /></div>}</div>
      </Card>
      {failure}
      <div className="flex flex-col gap-3 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:border-t max-lg:border-border max-lg:bg-background max-lg:p-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button type="button" variant="outline" className={cn(touch, 'max-lg:h-14')} aria-pressed={flipped} disabled={busy} onClick={() => setFlipped(f => !f)}>{t('flip')}</Button>
        </div>
        {flipped && <div className="flex gap-3">
          <Button type="button" variant="outline" className={cn(touch, 'flex-1 max-lg:h-14')} disabled={busy || frozen} onClick={() => mark(false)}><X aria-hidden />{t('notYet')}</Button>
          <Button type="button" className={cn(touch, 'flex-1 max-lg:h-14')} disabled={busy || frozen} onClick={() => mark(true)}><Check aria-hidden />{t('remembered')}</Button>
        </div>}
        <Button type="button" variant="ghost" className={cn(touch, 'self-start')} disabled={busy || frozen || index === 0} onClick={() => { go(index - 1); setFlipped(true) }}><ChevronLeft aria-hidden />{t('prevCard')}</Button>
      </div>
    </>)
  }

  const q = current as QuizQuestion
  const answered = (qid: string) => marks[qid] !== undefined && marks[qid] !== null
  const grid = <ol className="grid list-none grid-cols-5 gap-2">{questions.map((item, i) => {
    const done = answered(item.id)
    return <li key={item.id}><button type="button" disabled={busy} aria-current={i === index ? 'step' : undefined} aria-label={t('questionState', { n: i + 1, state: t(done ? 'answered' : 'unanswered') })} onClick={() => go(i)}
      className={cn('flex size-11 cursor-pointer items-center justify-center gap-0.5 rounded-lg border text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring', i === index ? 'border-primary ring-2 ring-primary' : 'border-border', done ? 'bg-tone-green-bg text-tone-green-fg' : 'bg-card text-muted-foreground')}>
      {i + 1}{done && <Check className="size-3" aria-hidden />}</button></li>
  })}</ol>

  return shell(<>
    {header}
    {dataRouter && <LeaveGuard dirty={dirty} language={language} />}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <Card className="gap-4 rounded-2xl p-5 shadow-sm">
        <h2 ref={questionHeading} tabIndex={-1} className="text-sm font-semibold text-muted-foreground outline-none">{t('progress', { n: index + 1, total })}</h2>
        <MarkdownContent content={q.content} language={language} />
        {q.codeSnippet && <MarkdownContent content={fenced(q.codeSnippet, q.codeLanguage)} language={language} />}
        <div role="radiogroup" aria-label={t('optionLabel')} className="flex flex-col gap-2">{q.options.map((option, i) => {
          const checked = marks[q.id] === i
          return <label key={i} className={cn('flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm', checked ? 'border-primary bg-tone-blue-bg' : 'border-border bg-card hover:bg-muted/50', (busy || frozen) && 'cursor-not-allowed opacity-70')}>
            <input type="radio" name={q.id} className="mt-0.5 size-4 accent-primary" checked={checked} disabled={busy || frozen} onChange={() => choose(q.id, i)} onClick={() => { if (checked) choose(q.id, null) }} />
            <span>{letter(i)}. {option}</span></label>
        })}</div>
        {failure}
        <div className="flex flex-wrap items-center justify-between gap-2 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-10 max-lg:border-t max-lg:border-border max-lg:bg-background max-lg:p-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="outline" className={touch} disabled={busy || index === 0} onClick={() => go(index - 1)}><ChevronLeft aria-hidden />{t('prev')}</Button>
          <Button type="button" variant="outline" className={cn(touch, 'lg:hidden')} onClick={() => setListOpen(true)}><ListChecks aria-hidden />{t('questionList')}</Button>
          <Button type="button" variant="outline" className={touch} disabled={busy || index === total - 1} onClick={() => go(index + 1)}>{t('next')}<ChevronRight aria-hidden /></Button>
          <Button type="button" className={cn(touch, 'max-lg:w-full lg:ml-auto')} disabled={busy} onClick={askSubmit}>{busy ? t('submitting') : t('submit')}</Button>
        </div>
      </Card>
      <aside aria-label={t('questionList')} className="hidden flex-col gap-3 lg:flex"><h2 className="text-sm font-semibold">{t('questionList')}</h2>{grid}</aside>
    </div>
    <Sheet open={listOpen} onOpenChange={setListOpen}><SheetContent side="bottom"><SheetHeader><SheetTitle>{t('questionList')}</SheetTitle></SheetHeader><div className="p-4">{grid}</div></SheetContent></Sheet>
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t('confirm', { n: unansweredCount(ids, marks as Record<string, number | null>) })}</AlertDialogTitle></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={touch}>{t('keepGoing')}</AlertDialogCancel>
          <AlertDialogAction className={touch} onClick={() => void submit(marks)}>{t('submitAnyway')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>)
}
