import { useEffect, useRef, useState } from 'react'
import { ArrowDown, RefreshCw, Send, Sparkles, Square, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownContent } from '../../components/MarkdownContent'
import { tutorError, tutorText } from '../../data/courseI18n'
import { lessonTutor } from '../../services/courseService'
import type { AiQuota } from '../../types/aiAssist'
import type { Language } from '../../types/preferences'
import { touch } from './courseParts'

const MAX_QUESTION = 500
const MAX_HISTORY = 6 // messages, as the server accepts
const MAX_TURN_CHARS = 2000 // per history message, as the server accepts; AI answers can be longer
const SHOW_COUNT_FROM = 400

type Turn = { id: number; question: string; answer: string; status: 'streaming' | 'done' | 'stopped' | 'error'; cut: boolean; error?: ReturnType<typeof tutorError> }

/**
 * “Ask AI about this lesson” (course-ai-tutor wireframe): the opener beside the title plus the right-hand sheet.
 * The conversation lives only in this component's state; the page remounts it (`key`) per lesson, which also aborts a running answer.
 */
export function LessonTutor({ courseId, lessonId, language, authenticated, hasText, askLogin }: {
  courseId: string; lessonId: string; language: Language; authenticated: boolean; hasText: boolean; askLogin: () => void
}) {
  const t = tutorText(language)
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [text, setText] = useState('')
  const [inputError, setInputError] = useState(false)
  const [quota, setQuota] = useState<AiQuota | null | undefined>(undefined) // undefined: not read yet, null: unreadable
  const [behind, setBehind] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const seq = useRef(0)
  const quotaRevision = useRef(0)
  const refund = useRef<ReturnType<typeof setTimeout>>(undefined)
  const input = useRef<HTMLTextAreaElement>(null)
  const log = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const streaming = turns.some(turn => turn.status === 'streaming')
  const exhausted = quota?.remaining === 0
  const count = text.trim().length

  useEffect(() => () => { abort.current?.abort(); clearTimeout(refund.current) }, [])
  // Auto-scroll to the newest text unless the reader scrolled up; then offer a jump instead.
  useEffect(() => {
    const el = log.current
    if (!el) return
    if (pinned.current) el.scrollTop = el.scrollHeight
    else setBehind(true)
  }, [turns, open])

  const writeQuota = (value: AiQuota | null | ((old: AiQuota | null | undefined) => AiQuota | null | undefined)) => { quotaRevision.current++; setQuota(value) }
  const remainingNow = (remaining: number | null) => remaining === null ? void loadQuota() : writeQuota(old => ({ limit: old?.limit ?? null, remaining }))
  function loadQuota() {
    const revision = ++quotaRevision.current
    return lessonTutor.quota().then(value => { if (revision === quotaRevision.current) setQuota(value) }, () => { if (revision === quotaRevision.current) setQuota(old => old ?? null) })
  }

  // The server refunds a cut-off request only once it notices the closed connection, so read the allowance again a little later.
  const refreshQuotaSoon = () => { void loadQuota(); clearTimeout(refund.current); refund.current = setTimeout(() => void loadQuota(), 2500) }

  async function send(raw: string, retryId?: number) {
    const question = raw.trim()
    if (!question || question.length > MAX_QUESTION) { setInputError(true); return }
    if (streaming || exhausted) return
    setInputError(false)
    const id = retryId ?? ++seq.current
    const history = turns.filter(turn => turn.id !== id && turn.status !== 'streaming' && turn.answer)
      .flatMap(turn => [{ role: 'USER' as const, content: turn.question }, { role: 'ASSISTANT' as const, content: turn.answer.slice(0, MAX_TURN_CHARS) }]).slice(-MAX_HISTORY)
    const fresh: Turn = { id, question, answer: '', status: 'streaming', cut: false }
    setTurns(all => retryId === undefined ? [...all, fresh] : all.map(turn => turn.id === id ? fresh : turn))
    if (retryId === undefined) setText('')
    pinned.current = true
    const controller = new AbortController()
    abort.current = controller
    const patch = (change: Partial<Turn> | ((turn: Turn) => Partial<Turn>)) => setTurns(all => all.map(turn => turn.id === id ? { ...turn, ...(typeof change === 'function' ? change(turn) : change) } : turn))
    const fail = (error: unknown) => {
      patch({ status: 'error', error: tutorError(error, language) })
      if (error === 'AI_QUOTA_EXCEEDED' || (error as { code?: string })?.code === 'AI_QUOTA_EXCEEDED') remainingNow(0)
    }
    let ended = false
    try {
      await lessonTutor.stream(courseId, lessonId, { question, history }, controller.signal, event => {
        if (event.type === 'metadata') patch({ cut: !!event.contextTruncated })
        else if (event.type === 'delta') patch(turn => ({ answer: turn.answer + event.text }))
        else {
          ended = true
          if (event.type === 'error') fail(event.code); else patch({ status: event.type === 'completed' ? 'done' : 'stopped' })
          if (event.type !== 'error' || event.code !== 'AI_QUOTA_EXCEEDED') remainingNow(event.quotaRemaining)
        }
      }, opened => { if (opened) writeQuota(opened) })
      if (!ended) { fail(new TypeError('stream closed')); refreshQuotaSoon() }
    } catch (error) {
      if (controller.signal.aborted) { patch({ status: 'stopped' }); refreshQuotaSoon() }
      else {
        fail(error)
        const known = (error as { quota?: AiQuota | null }).quota
        if (known) writeQuota(known); else refreshQuotaSoon()
      }
    } finally { if (abort.current === controller) abort.current = null }
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) { pinned.current = true; setBehind(false); void loadQuota() }
  }
  const onScroll = () => {
    const el = log.current!
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
    if (pinned.current) setBehind(false)
  }
  const jump = () => { const el = log.current!; el.scrollTop = el.scrollHeight; pinned.current = true; setBehind(false) }

  const last = turns.at(-1)
  const label = <><Sparkles aria-hidden />{t(hasText && !authenticated ? 'login' : 'open')}</>
  const opener = !hasText
    ? <Button type="button" variant="outline" aria-disabled="true" className={cn('w-full opacity-60 sm:w-auto', touch)}>{label}</Button>
    : !authenticated
      ? <Button type="button" variant="outline" className={cn('w-full sm:w-auto', touch)} onClick={askLogin}>{label}</Button>
      : <SheetTrigger asChild><Button type="button" variant="outline" className={cn('w-full sm:w-auto', touch)}>{label}</Button></SheetTrigger>

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <div className="flex w-full flex-col gap-1 sm:ml-auto sm:w-auto">{opener}{!hasText && <p className="text-xs text-muted-foreground">{t('noText')}</p>}</div>
    <SheetContent side="right" closeLabel={t('close')} className="w-full gap-0 p-0 sm:max-w-[420px]" onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus() }}>
      <SheetHeader className="border-b border-border p-4 pr-14">
        <SheetTitle className="flex items-center gap-2 text-base"><Sparkles className="size-4" aria-hidden />{t('title')}</SheetTitle>
        <SheetDescription>{t('notice')}</SheetDescription>
      </SheetHeader>

      <div ref={log} onScroll={onScroll} aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        {turns.length === 0
          ? <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"><Sparkles className="size-6" aria-hidden />{t('empty')}</div>
          : turns.map(turn => <div key={turn.id} className="flex flex-col gap-2">
            <p className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded-xl bg-muted px-3 py-2 text-sm">{turn.question}</p>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Sparkles className="size-3" aria-hidden />{t('ai')}</span>
              {turn.answer && <div className="min-w-0 overflow-x-auto text-sm"><MarkdownContent content={turn.answer} language={language} /></div>}
              {turn.status === 'streaming' && <span aria-hidden className="inline-block h-4 w-1.5 bg-foreground motion-safe:animate-pulse" />}
              {turn.cut && <p className="text-xs text-muted-foreground">{t('cut')}</p>}
              {turn.error && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-danger">
                <TriangleAlert className="size-4 shrink-0" aria-hidden /><span>{turn.error.text}</span>
                {turn === last && turn.error.retry && <Button type="button" variant="outline" size="sm" className={touch} disabled={streaming || exhausted} onClick={() => void send(turn.question, turn.id)}><RefreshCw aria-hidden />{t('retry')}</Button>}
                {turn.error.login && <Button type="button" variant="outline" size="sm" className={touch} onClick={askLogin}>{t('login')}</Button>}
              </div>}
            </div>
          </div>)}
      </div>
      {behind && <Button type="button" size="sm" variant="secondary" className={cn('mx-auto mb-2', touch)} onClick={jump}><ArrowDown aria-hidden />{t('newMessages')}</Button>}

      <div className="flex flex-col gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {exhausted && <p className="flex items-center gap-1 text-sm text-danger"><TriangleAlert className="size-4 shrink-0" aria-hidden />{t('quotaOut')}</p>}
        {quota === undefined ? <Skeleton className="h-4 w-32" /> : quota && <p className="text-xs text-muted-foreground">{t('quota', { remaining: quota.remaining, limit: quota.limit ?? '–' })}</p>}
        <form className="flex items-end gap-2" onSubmit={event => { event.preventDefault(); void send(text) }}>
          <Textarea ref={input} rows={1} value={text} disabled={exhausted} aria-label={t('question')} aria-invalid={count > MAX_QUESTION} placeholder={t('placeholder')} className="max-h-32 min-h-11 resize-none"
            onChange={event => { setText(event.target.value); setInputError(false) }}
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(text) } }} />
          {streaming
            ? <Button type="button" variant="outline" className={touch} onClick={() => abort.current?.abort()}><Square aria-hidden />{t('stop')}</Button>
            : <Button type="submit" className={touch} disabled={exhausted || count > MAX_QUESTION}><Send aria-hidden />{t('send')}</Button>}
        </form>
        {inputError && <p role="alert" className="text-sm text-danger">{t('inputError')}</p>}
        {count >= SHOW_COUNT_FROM && <p className={cn('text-right text-xs', count > MAX_QUESTION ? 'text-danger' : 'text-muted-foreground')}>{t('count', { n: count })}</p>}
      </div>
    </SheetContent>
  </Sheet>
}
