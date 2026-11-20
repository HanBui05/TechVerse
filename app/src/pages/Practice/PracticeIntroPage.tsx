import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Lock, Play, RefreshCw } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MarkdownContent } from '../../components/MarkdownContent'
import { difficultyLabel, practiceErrorKind, practiceErrorText, practiceText, typeLabel } from '../../data/exerciseI18n'
import { practice } from '../../services/exerciseService'
import { touch } from '../Courses/courseParts'
import { DIFFICULTY_TONE, lastAttemptLine } from './PracticeListPage'
import type { PracticeSet } from '../../types/exercises'
import type { Language } from '../../types/preferences'

/** Set introduction (wireframe 6b): no questions here, only whether and how the viewer may start. Open to Guests. */
export function PracticeIntroPage({ language = 'vi', authenticated = false }: { language?: Language; authenticated?: boolean }) {
  const { id = '' } = useParams()
  const t = practiceText(language)
  const navigate = useNavigate()
  const [set, setSet] = useState<PracticeSet | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'error'>('loading')
  const [error, setError] = useState('')
  const [run, setRun] = useState(0)
  useEffect(() => {
    let live = true
    setState('loading')
    practice.detail(id).then(result => { if (live) { setSet(result); setState('ready') } }, e => {
      if (!live) return
      setState(practiceErrorKind(e) === 'gone' ? 'gone' : 'error'); setError(practiceErrorText(e, language, t('loadError')))
    })
    return () => { live = false }
  }, [id, run, language]) // eslint-disable-line react-hooks/exhaustive-deps

  const frame = (body: ReactNode) => <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8 pb-28 sm:px-6 lg:px-8">{body}</main>
  if (state === 'loading') return frame(<div role="status" aria-label={t('loading')} className="flex flex-col gap-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-5 w-1/2" /><Skeleton className="h-24 w-full" /></div>)
  if (state === 'gone') return frame(<div role="status" className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center"><p className="text-base font-bold">{t('gone')}</p><Button asChild variant="outline" className={touch}><Link to="/practice">{t('toList')}</Link></Button></div>)
  if (state === 'error' || !set) return frame(<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger"><span>{error}</span><Button type="button" variant="outline" size="sm" className={touch} onClick={() => setRun(r => r + 1)}><RefreshCw aria-hidden />{t('retry')}</Button></div>)

  const reason = set.viewer?.reason
  const canAttempt = set.viewer?.canAttempt === true
  const cta = 'max-sm:h-11 max-sm:w-full'
  return frame(<>
    <Link to="/practice" className="inline-flex items-center gap-1 self-start text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">‹ {t('back')}</Link>
    <Card className="relative overflow-hidden rounded-2xl p-6 shadow-sm sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-52 rounded-full bg-primary/10 blur-3xl" />
      <header className="relative flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={set.type === 'FLASHCARD' ? 'purple' : 'blue'} className="font-semibold">{typeLabel[set.type][language]}</Badge>
          <Badge tone={DIFFICULTY_TONE[set.difficulty]} className="font-semibold">{difficultyLabel[set.difficulty][language]}</Badge>
          <Badge tone="slate">{set.topic.name}</Badge>
          <span className="text-sm text-muted-foreground">{t(set.type === 'FLASHCARD' ? 'cards' : 'questions', { n: set.questionCount })} · {t('by', { name: set.author.fullName })}</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl [overflow-wrap:anywhere]">{set.title}</h1>
      </header>
      {set.description && <div className="border-t border-border/60 pt-4"><MarkdownContent content={set.description} language={language} /></div>}
      <div className={cn('flex flex-col gap-2 pt-2 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-10 max-sm:border-t max-sm:border-border max-sm:bg-background/95 max-sm:p-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:backdrop-blur-md sm:items-start')}>
        {canAttempt
          ? <Button asChild size="lg" className={cn(touch, cta)}><Link to={`/practice/${set.id}/attempt`}><Play aria-hidden />{t('start')}</Link></Button>
          : reason === 'LOGIN_REQUIRED' || !authenticated
            ? <Button type="button" size="lg" className={cn(touch, cta)} onClick={() => navigate('/login', { state: { returnTo: `/practice/${set.id}` } })}>{t('signIn')}</Button>
            : <>
                <Button type="button" size="lg" className={cn(touch, cta)} disabled><Lock aria-hidden />{t('start')}</Button>
                {reason === 'OWNER' && <p className="text-sm text-muted-foreground">{t('owner')}</p>}
              </>}
      </div>
    </Card>
    {authenticated && set.lastAttempt && <Card className="flex-row flex-wrap items-center justify-between gap-3 rounded-2xl border-tone-green-border/50 bg-tone-green-bg/20 p-4 shadow-sm sm:px-6">
      <p className="text-sm"><span className="font-semibold text-tone-green-fg">{t('last')}:</span> {lastAttemptLine(set.lastAttempt, language).replace(/^[^:]+:\s*/, '')}</p>
      <Button asChild variant="outline" size="sm" className={touch}><Link to={`/me/practice/${set.lastAttempt.id}`}>{t('viewAttempt')}</Link></Button>
    </Card>}
  </>)
}
