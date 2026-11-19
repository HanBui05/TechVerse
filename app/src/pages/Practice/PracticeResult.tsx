import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Circle, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MarkdownContent } from '../../components/MarkdownContent'
import { practiceText } from '../../data/exerciseI18n'
import { fenced, isQuizItem, wrongItems } from '../../services/exerciseService'
import type { CardItem, PracticeAttempt, QuizItem } from '../../types/exercises'
import type { Language } from '../../types/preferences'

const letter = (i: number) => String.fromCharCode(65 + i)

/** Verdict by icon AND word (never colour alone); the word is visible in the chip, the icon is decoration. */
function Verdict({ item, language }: { item: QuizItem; language: Language }) {
  const t = practiceText(language)
  const blank = item.selectedIndex === null
  const [Icon, label, tone] = item.correct ? [Check, t('right'), 'green' as const] : blank ? [Circle, t('blank'), 'slate' as const] : [X, t('wrong'), 'rose' as const]
  return <Badge tone={tone} className="font-semibold"><Icon aria-hidden />{label}</Badge>
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
    <ol className="flex list-none flex-col gap-4">{shown.map(({ item, n }) => {
      const picked = item.selectedIndex
      return <li key={item.questionId}><Card className="gap-3 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">{t('questionN', { n })}</h3><Verdict item={item} language={language} /></div>
        <MarkdownContent content={item.content} language={language} />
        {item.codeSnippet && <MarkdownContent content={fenced(item.codeSnippet, item.codeLanguage)} language={language} />}
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex flex-wrap gap-x-2"><dt className="font-semibold">{t('yourAnswer')}:</dt><dd>{picked === null ? <span className="text-muted-foreground">{t('blank')}</span> : `${letter(picked)}. ${item.options[picked]}`}</dd></div>
          {!item.correct && <div className="flex flex-wrap gap-x-2"><dt className="font-semibold">{t('correctAnswer')}:</dt><dd>{`${letter(item.correctIndex)}. ${item.options[item.correctIndex]}`}</dd></div>}
        </dl>
        {item.explanation && <div className="flex flex-col gap-1 border-t border-border pt-3 text-sm"><p className="font-semibold">{t('explanation')}</p><MarkdownContent content={item.explanation} language={language} /></div>}
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
    <ul className="flex list-none flex-col gap-4">{missed.map(({ item, n }) => <li key={item.questionId}><Card className="gap-3 rounded-2xl p-4 shadow-sm">
      <h4 className="text-sm font-bold">{t('cardN', { n })}</h4>
      <div><p className="text-xs font-semibold text-muted-foreground">{t('front')}</p><MarkdownContent content={item.front} language={language} /></div>
      <div><p className="text-xs font-semibold text-muted-foreground">{t('back2')}</p><MarkdownContent content={item.back} language={language} /></div>
      {item.explanation && <div><p className="text-xs font-semibold text-muted-foreground">{t('explanation')}</p><MarkdownContent content={item.explanation} language={language} /></div>}
    </Card></li>)}</ul>
  </section>
}

/** Score + every item from the stored snapshot (wireframe 6e); shared by the attempt page and `/me/practice/:id`. */
export function PracticeResult({ attempt, language, actions }: { attempt: PracticeAttempt; language: Language; actions: ReactNode }) {
  const t = practiceText(language)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [attempt.id])
  const items = attempt.items ?? []
  const card = attempt.type === 'FLASHCARD'
  const title = card ? t('cardResult', { correct: attempt.correctCount, total: attempt.totalCount }) : t('result', { correct: attempt.correctCount, total: attempt.totalCount, percent: attempt.percent })
  return <div className="flex flex-col gap-5">
    <div className="flex flex-col gap-3" role="status">
      <h2 ref={heading} tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none">{title}</h2>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
    {card ? <CardResult items={items.filter((item): item is CardItem => !isQuizItem(item))} language={language} />
      : <QuizResult items={items.filter(isQuizItem)} language={language} />}
  </div>
}
