import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Circle, Clock, Lightbulb, X } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MarkdownContent } from '../../components/MarkdownContent'
import { practiceText } from '../../data/exerciseI18n'
import { fenced, isQuizItem, wrongItems } from '../../services/exerciseService'
import type { CardItem, PracticeAttempt, QuizItem } from '../../types/exercises'
import type { Language } from '../../types/preferences'

const letter = (i: number) => String.fromCharCode(65 + i)
type Tone = 'green' | 'rose' | 'slate' | 'purple' | 'amber'
// Static class names per tone (Tailwind cannot see names built at runtime).
const SOFT: Record<Tone, string> = { green: 'border-tone-green-border bg-tone-green-bg text-tone-green-fg', rose: 'border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg', slate: 'border-tone-slate-border bg-tone-slate-bg text-tone-slate-fg', purple: 'border-tone-purple-border bg-tone-purple-bg text-tone-purple-fg', amber: 'border-tone-amber-border bg-tone-amber-bg text-tone-amber-fg' }
const ACCENT: Record<Tone, string> = { green: 'border-l-tone-green-fg', rose: 'border-l-tone-rose-fg', slate: 'border-l-tone-slate-fg', purple: 'border-l-tone-purple-fg', amber: 'border-l-tone-amber-fg' }
const RING: Record<Tone, string> = { green: 'text-tone-green-fg', rose: 'text-tone-rose-fg', slate: 'text-tone-slate-fg', purple: 'text-tone-purple-fg', amber: 'text-tone-amber-fg' }

export const duration = (seconds: number, t: ReturnType<typeof practiceText>) => seconds < 60 ? t('seconds', { n: seconds }) : t('minutes', { n: Math.round(seconds / 60) })
const verdictTone = (item: QuizItem): Tone => item.correct ? 'green' : item.selectedIndex === null ? 'slate' : 'rose'

/** Verdict by icon AND word (never colour alone); the word is visible in the chip, the icon is decoration. */
function Verdict({ item, language }: { item: QuizItem; language: Language }) {
  const t = practiceText(language)
  const Icon = item.correct ? Check : item.selectedIndex === null ? Circle : X
  return <Badge tone={verdictTone(item)} className="font-semibold"><Icon aria-hidden />{item.correct ? t('right') : item.selectedIndex === null ? t('blank') : t('wrong')}</Badge>
}

/** Circular score: the number carries the meaning, the arc is decoration (aria-hidden). */
function ScoreRing({ percent, tone }: { percent: number; tone: Tone }) {
  const r = 30, c = 2 * Math.PI * r
  return <div className={cn('relative flex size-[4.5rem] shrink-0 items-center justify-center', RING[tone])} aria-hidden>
    <svg viewBox="0 0 72 72" className="absolute inset-0 -rotate-90"><circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" className="stroke-muted" />
      <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" strokeLinecap="round" stroke="currentColor" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, percent) / 100)} className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700" /></svg>
    <span className="text-lg font-bold tabular-nums text-foreground">{percent}%</span>
  </div>
}

function QuizResult({ items, language }: { items: QuizItem[]; language: Language }) {
  const t = practiceText(language)
  const [onlyWrong, setOnlyWrong] = useState(false)
  // The number is the item's place in the whole list: the server's `position` base is not relied on, and the quick filter keeps the original numbers.
  const shown = items.map((item, i) => ({ item, n: i + 1 })).filter(({ item }) => !onlyWrong || wrongItems([item]).length)
  return <>
    <div role="group" aria-label={t('filter')} className="flex gap-2">
      {([[false, t('all')], [true, t('onlyWrong')]] as const).map(([value, label]) => <Button key={label} type="button" size="sm" variant={onlyWrong === value ? 'default' : 'outline'} aria-pressed={onlyWrong === value} className="pointer-coarse:min-h-11" onClick={() => setOnlyWrong(value)}>{label}</Button>)}
    </div>
    {onlyWrong && !shown.length && <p className="text-sm text-muted-foreground">{t('allRight')}</p>}
    <ol className="flex list-none flex-col gap-5">{shown.map(({ item, n }) => {
      const tone = verdictTone(item)
      return <li key={item.questionId}><Card className={cn('gap-4 rounded-2xl border-l-4 p-5 shadow-sm sm:p-6', ACCENT[tone])}>
        <div className="flex items-center gap-3">
          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold', SOFT[tone])} aria-hidden>{n}</span>
          <h3 className="text-base font-bold">{t('questionN', { n })}</h3>
          <span className="ml-auto"><Verdict item={item} language={language} /></span>
        </div>
        <div className="text-[0.95rem] font-medium"><MarkdownContent content={item.content} language={language} /></div>
        {item.codeSnippet && <MarkdownContent content={fenced(item.codeSnippet, item.codeLanguage)} language={language} />}
        <ol className="m-0 flex list-none flex-col gap-2 p-0">{item.options.map((option, i) => {
          const right = i === item.correctIndex
          const mine = i === item.selectedIndex
          const style = right ? SOFT.green : mine ? SOFT.rose : 'border-border bg-card text-muted-foreground'
          return <li key={i} className={cn('flex flex-wrap items-start gap-x-3 gap-y-1 rounded-xl border px-3 py-2.5 text-sm sm:flex-nowrap', style, (right || mine) && 'font-medium')}>
            <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold', right || mine ? 'border-current' : 'border-border')} aria-hidden>{letter(i)}</span>
            <span className="min-w-0 flex-1 pt-0.5 [overflow-wrap:anywhere]">{option}</span>
            <span className="flex shrink-0 flex-wrap gap-x-3 gap-y-0.5 text-xs font-semibold max-sm:basis-full max-sm:pl-9 sm:justify-end">
              {mine && <span className="inline-flex items-center gap-1">{right ? <Check aria-hidden className="size-3.5" /> : <X aria-hidden className="size-3.5" />}{t('yourAnswer')}</span>}
              {right && <span className="inline-flex items-center gap-1"><Check aria-hidden className="size-3.5" />{t('correctAnswer')}</span>}
            </span>
          </li>
        })}</ol>
        {item.explanation && <div className="flex gap-3 rounded-xl border-l-2 border-l-primary bg-muted/60 p-4 text-sm">
          <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-tone-amber-fg" />
          <div className="flex min-w-0 flex-col gap-1"><p className="font-bold">{t('explanation')}</p><MarkdownContent content={item.explanation} language={language} /></div>
        </div>}
      </Card></li>
    })}</ol>
  </>
}

function CardResult({ items, language }: { items: CardItem[]; language: Language }) {
  const t = practiceText(language)
  const missed = items.map((item, i) => ({ item, n: i + 1 })).filter(({ item }) => !item.remembered)
  return <section aria-label={t('notRemembered')} className="flex flex-col gap-4">
    <h3 className="text-base font-bold">{t('notRemembered')}</h3>
    {!missed.length && <p className="text-sm text-muted-foreground">{t('allRemembered')}</p>}
    <ul className="flex list-none flex-col gap-5">{missed.map(({ item, n }) => <li key={item.questionId}><Card className={cn('gap-4 rounded-2xl border-l-4 p-5 shadow-sm sm:p-6', ACCENT.purple)}>
      <div className="flex items-center gap-3">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold', SOFT.purple)} aria-hidden>{n}</span>
        <h4 className="text-base font-bold">{t('cardN', { n })}</h4>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/60 p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('front')}</p><MarkdownContent content={item.front} language={language} /></div>
        <div className={cn('flex flex-col gap-1 rounded-xl border p-4', SOFT.purple)}><p className="text-xs font-bold uppercase tracking-wide">{t('back2')}</p><div className="font-medium text-foreground"><MarkdownContent content={item.back} language={language} /></div></div>
      </div>
      {item.explanation && <div className="flex gap-3 rounded-xl border-l-2 border-l-primary bg-muted/60 p-4 text-sm">
        <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-tone-amber-fg" />
        <div className="flex min-w-0 flex-col gap-1"><p className="font-bold">{t('explanation')}</p><MarkdownContent content={item.explanation} language={language} /></div>
      </div>}
    </Card></li>)}</ul>
  </section>
}

/** Score banner + every item from the stored snapshot (wireframe 6e); shared by the attempt page and `/me/practice/:id`. */
export function PracticeResult({ attempt, language, actions }: { attempt: PracticeAttempt; language: Language; actions: ReactNode }) {
  const t = practiceText(language)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [attempt.id])
  const items = attempt.items ?? []
  const card = attempt.type === 'FLASHCARD'
  const quiz = items.filter(isQuizItem)
  const blank = quiz.filter(item => item.selectedIndex === null).length
  const wrong = quiz.length - quiz.filter(item => item.correct).length - blank
  const title = card ? t('cardResult', { correct: attempt.correctCount, total: attempt.totalCount }) : t('result', { correct: attempt.correctCount, total: attempt.totalCount, percent: attempt.percent })
  const tone: Tone = attempt.percent >= 80 ? 'green' : attempt.percent >= 50 ? 'amber' : 'rose'
  const stats: [Tone, number, string][] = card
    ? [['green', attempt.correctCount, t('remembered')], ['rose', attempt.totalCount - attempt.correctCount, t('notYet')]]
    : [['green', attempt.correctCount, t('right')], ['rose', wrong, t('wrong')], ['slate', blank, t('blank')]]
  return <div className="flex flex-col gap-5">
    <Card className="relative gap-4 overflow-hidden rounded-2xl border-border/85 bg-linear-to-br from-card via-card to-primary/10 p-5 shadow-md sm:p-6" role="status">
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-primary/12 blur-3xl" />
      <div className="relative flex items-center gap-4 sm:gap-5">
        <ScoreRing percent={attempt.percent} tone={tone} />
        <div className="flex min-w-0 flex-col gap-2">
          <h2 ref={heading} tabIndex={-1} className="text-xl font-extrabold tracking-tight outline-none sm:text-2xl">{title}</h2>
          <div role="group" aria-label={t('summary')} className="flex flex-wrap gap-2">
            {stats.map(([statTone, n, label]) => <Badge key={label} tone={statTone} className="gap-1 px-2.5 py-1 text-sm"><strong className="tabular-nums">{n}</strong> {label}</Badge>)}
            <Badge tone="blue" className="gap-1 px-2.5 py-1 text-sm"><Clock aria-hidden />{duration(attempt.durationSeconds, t)}</Badge>
          </div>
        </div>
      </div>
      <div className="relative flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">{actions}</div>
    </Card>
    {card ? <CardResult items={items.filter((item): item is CardItem => !isQuizItem(item))} language={language} />
      : <QuizResult items={quiz} language={language} />}
  </div>
}
