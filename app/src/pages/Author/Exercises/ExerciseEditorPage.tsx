import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link, UNSAFE_DataRouterContext, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Eye, Info, Plus, RefreshCw, Save, Send, Sparkles, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { MarkdownContent } from '../../../components/MarkdownContent'
import { fieldLabel } from '../AuthorBlogsPage'
import { exerciseTone } from './AuthorExercisesPage'
import { difficultyLabel, exerciseErrorText, exerciseText, isExerciseConflict, statusLabel, typeLabel } from '../../../data/exerciseI18n'
import { aiAssist } from '../../../services/aiAssistService'
import { MAX_QUESTIONS, MIN_TO_SUBMIT, authorExercises, emptyQuestion, exerciseActions, infoErrors, questionBody, questionErrors } from '../../../services/exerciseService'
import type { AiQuota } from '../../../types/aiAssist'
import type { ArticleOption } from '../../../types/articles'
import type { ExerciseDifficulty, ExerciseInfo, ExerciseQuestion, ExerciseSet, ExerciseType } from '../../../types/exercises'
import type { Language } from '../../../types/preferences'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const DIFFICULTIES: ExerciseDifficulty[] = ['EASY', 'MEDIUM', 'HARD']
const TYPES: ExerciseType[] = ['MULTIPLE_CHOICE', 'FLASHCARD']
const NEW_INFO: ExerciseInfo = { title: '', description: '', topicId: '', difficulty: 'MEDIUM', type: 'MULTIPLE_CHOICE' }
type T = ReturnType<typeof exerciseText>
type Load = 'loading' | 'ready' | 'notFound' | 'error'

const infoOf = (s: ExerciseSet): ExerciseInfo => ({ title: s.title, description: s.description, topicId: s.topic.id, difficulty: s.difficulty, type: s.type })
const questionsOf = (s: ExerciseSet): ExerciseQuestion[] => (s.questions ?? []).map(({ id: _id, position: _position, ...q }) => q)
const sigOf = (info: ExerciseInfo, questions: ExerciseQuestion[]) => ({ info: JSON.stringify(info), questions: JSON.stringify(questions.map(questionBody)) })
const plain = (q: ExerciseQuestion) => (q.front ?? q.content ?? '').replace(/\s+/g, ' ').trim()
const quotaOfError = (e: unknown) => (e as { quota?: AiQuota | null }).quota ?? null

/** Blocks in-app navigation to another route while there are unsaved edits; needs a data router (see main.tsx). */
function LeaveGuard({ dirty, language }: { dirty: () => boolean; language: Language }) {
  const t = exerciseText(language)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty() && currentLocation.pathname !== nextLocation.pathname)
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

const Problem = ({ id, text }: { id: string; text?: string }) => text ? <p id={id} role="alert" className="text-xs text-danger">{text}</p> : null

/** One question (quiz) or card (flashcard) in a dialog; “Xong” only updates the list being edited, it never calls the API. */
function QuestionDialog({ language, type, number, initial, onDone, onClose }: { language: Language; type: ExerciseType; number: number; initial: ExerciseQuestion; onDone: (q: ExerciseQuestion) => void; onClose: () => void }) {
  const t = exerciseText(language)
  const [q, setQ] = useState(initial)
  const [tried, setTried] = useState(false)
  const card = type === 'FLASHCARD'
  const errors = tried ? questionErrors(q) : {}
  const say = (key: string) => errors[key] ? t(errors[key]) : undefined
  const patch = (next: Partial<ExerciseQuestion>) => setQ(old => ({ ...old, ...next }))
  const options = q.options ?? []
  const setOption = (i: number, value: string) => patch({ options: options.map((o, j) => j === i ? value : o) })
  const text = (key: 'content' | 'explanation' | 'front' | 'back', label: string, optional = false) => <div className="flex flex-col gap-2">
    <Label htmlFor={`q-${key}`} className={fieldLabel}>{label}{optional ? ` (${t('optional')})` : ' *'}</Label>
    <Textarea id={`q-${key}`} value={q[key] ?? ''} aria-invalid={Boolean(errors[key])} aria-describedby={`q-${key}-error`} onChange={e => patch({ [key]: e.target.value })} />
    <Problem id={`q-${key}-error`} text={say(key)} />
  </div>
  const done = () => { setTried(true); if (!Object.keys(questionErrors(q)).length) onDone(q) }

  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{t(card ? 'card' : 'question', { n: number })}</DialogTitle>
        <DialogDescription>{t('questionDialog')}</DialogDescription>
      </DialogHeader>
      {Object.keys(errors).length > 0 && <p role="alert" className="text-sm text-danger">{t(card ? 'cardInvalid' : 'questionInvalid', { n: number })}</p>}
      <div className="flex flex-col gap-4">
        {card ? <>{text('front', t('faceFront'))}{text('back', t('faceBack'))}{text('explanation', t('explanation'), true)}</> : <>
          {text('content', t('content'))}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={q.codeSnippet !== null} onChange={e => patch({ codeSnippet: e.target.checked ? '' : null, codeLanguage: e.target.checked ? q.codeLanguage : null })} />{t('addCode')}</label>
          {q.codeSnippet !== null && <div className="flex flex-col gap-2">
            <Label htmlFor="q-language" className={fieldLabel}>{t('codeLanguage')}</Label>
            <Input id="q-language" value={q.codeLanguage ?? ''} aria-invalid={Boolean(errors.codeLanguage)} aria-describedby="q-language-error" onChange={e => patch({ codeLanguage: e.target.value })} />
            <Problem id="q-language-error" text={say('codeLanguage')} />
            <Label htmlFor="q-code" className={fieldLabel}>{t('codeSnippet')}</Label>
            <Textarea id="q-code" className="font-mono" value={q.codeSnippet} aria-invalid={Boolean(errors.codeSnippet)} onChange={e => patch({ codeSnippet: e.target.value })} />
            <Problem id="q-code-error" text={say('codeSnippet')} />
          </div>}
          <fieldset className="flex flex-col gap-2">
            <legend className={`${fieldLabel} mb-2`}>{t('options')} *</legend>
            {options.map((option, i) => <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input type="radio" name="correct" className={`size-4 ${touch}`} aria-label={`${t('correct')}: ${t('option', { n: i + 1 })}`} checked={q.correctIndex === i} onChange={() => patch({ correctIndex: i })} />
                <Input aria-label={t('option', { n: i + 1 })} value={option} aria-invalid={Boolean(errors[`option-${i}`])} onChange={e => setOption(i, e.target.value)} />
                <Button type="button" variant="ghost" size="icon" className={touch} disabled={options.length <= 2} aria-label={t('removeOption', { n: i + 1 })}
                  onClick={() => patch({ options: options.filter((_, j) => j !== i), correctIndex: q.correctIndex === null || q.correctIndex === i ? null : q.correctIndex > i ? q.correctIndex - 1 : q.correctIndex })}><Trash2 /></Button>
              </div>
              <Problem id={`q-option-${i}-error`} text={say(`option-${i}`)} />
            </div>)}
            <Problem id="q-options-error" text={say('options') ?? say('correct')} />
            <Button type="button" variant="outline" size="sm" className={`self-start ${touch}`} disabled={options.length >= 6} onClick={() => patch({ options: [...options, ''] })}><Plus />{t('addOption')}</Button>
          </fieldset>
          {text('explanation', t('explanation'))}
        </>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" className={touch} onClick={onClose}>{t('cancel')}</Button>
        <Button type="button" className={touch} onClick={done}>{t('finish')}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}

/** The preview shows the author what a learner sees, plus the answer, from the list being edited (nothing is sent). */
function PreviewDialog({ language, questions, onClose }: { language: Language; questions: ExerciseQuestion[]; onClose: () => void }) {
  const t = exerciseText(language)
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{t('preview')}</DialogTitle><DialogDescription>{t('showAnswer')}</DialogDescription></DialogHeader>
      <ol className="m-0 flex list-none flex-col gap-4 p-0">
        {questions.map((q, i) => <li key={i} className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <span className={fieldLabel}>{t(q.front !== null ? 'card' : 'question', { n: i + 1 })}</span>
          <MarkdownContent content={q.front ?? q.content ?? ''} language={language} />
          {q.codeSnippet && <MarkdownContent content={`\`\`\`${q.codeLanguage ?? ''}\n${q.codeSnippet}\n\`\`\``} language={language} />}
          {q.front !== null ? <MarkdownContent content={q.back ?? ''} language={language} />
            : <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">{(q.options ?? []).map((o, j) => <li key={j} className={q.correctIndex === j ? 'font-semibold text-tone-green-fg' : ''}>{q.correctIndex === j && <span aria-hidden>✓ </span>}{o}{q.correctIndex === j && <span> ({t('showAnswer')})</span>}</li>)}</ul>}
          {q.explanation && <div className="text-sm text-muted-foreground"><MarkdownContent content={q.explanation} language={language} /></div>}
        </li>)}
      </ol>
      <DialogFooter><Button className={touch} onClick={onClose}>{t('close')}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}

type AiPanelProps = { language: Language; setId: string; saving: boolean; type: ExerciseType; total: number; ensureSaved: () => Promise<boolean>; version: () => number; onVersion: (version: number) => void; onAdd: (questions: ExerciseQuestion[]) => void; onConflict: () => void }

/** “Tạo câu hỏi bằng AI”: suggestions are never saved by the server; they join the list being edited only through “Thêm câu đã chọn”. */
function AiPanel({ language, setId, saving, type, total, ensureSaved, version, onVersion, onAdd, onConflict }: AiPanelProps) {
  const t = exerciseText(language)
  const [form, setForm] = useState({ instruction: '', sourceText: '', count: 5 })
  const [quota, setQuota] = useState<AiQuota | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [suggestions, setSuggestions] = useState<{ q: ExerciseQuestion; on: boolean }[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  useEffect(() => { void aiAssist.quota().then(q => setQuota(q.exercise ?? null), () => {}) }, [])
  const problems = {
    instruction: form.instruction.length > 500 ? t('instructionLength') : '',
    sourceText: form.sourceText.length > 8000 ? t('sourceLength') : '',
    count: form.count < 1 || form.count > 10 ? t('countRange') : '',
  }
  const out = quota !== null && quota.remaining <= 0
  const generate = async () => {
    if (busy || out || Object.values(problems).some(Boolean)) return
    setBusy(true); setError(''); setInfo('')
    try {
      if (!await ensureSaved()) return
      const { suggestions: result, quota: next } = await authorExercises.suggest(setId, { version: version(), ...form })
      onVersion(result.version)
      if (next) setQuota(next)
      setSuggestions(old => [...old, ...result.questions.map(q => ({ q, on: true }))])
      setInfo(t('aiResult', { n: result.questions.length, count: result.requested }))
    } catch (e) {
      if (quotaOfError(e)) setQuota(quotaOfError(e))
      if (isExerciseConflict(e)) onConflict()
      else setError(exerciseErrorText(e, language, t('loadError')))
    } finally { setBusy(false) }
  }
  const selected = suggestions.filter(s => s.on)
  const add = () => {
    if (total + selected.length > MAX_QUESTIONS) { setError(t('tooMany')); return }
    onAdd(selected.map(s => s.q)); setSuggestions(suggestions.filter(s => !s.on)); setError(''); setInfo(t('added', { n: selected.length }))
  }
  const field = (key: 'instruction' | 'sourceText', label: string, rows: number) => <div className="flex flex-col gap-2">
    <Label htmlFor={`ai-${key}`} className={fieldLabel}>{label}</Label>
    <Textarea id={`ai-${key}`} rows={rows} disabled={busy} value={form[key]} aria-invalid={Boolean(problems[key])} onChange={e => setForm({ ...form, [key]: e.target.value })} />
    <Problem id={`ai-${key}-error`} text={problems[key]} />
  </div>

  return <div className="flex flex-col gap-4" aria-busy={busy}>
    <p className="flex items-start gap-2 text-xs text-muted-foreground"><Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />{t('aiHint')}</p>
    {field('instruction', t('instruction'), 2)}
    {field('sourceText', t('source'), 5)}
    <div className="flex flex-col gap-2">
      <Label htmlFor="ai-count" className={fieldLabel}>{t('count')}</Label>
      <NativeSelect id="ai-count" className={touch} disabled={busy} value={form.count} onChange={e => setForm({ ...form, count: Number(e.target.value) })}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <NativeSelectOption key={n} value={n}>{n}</NativeSelectOption>)}
      </NativeSelect>
      <Problem id="ai-count-error" text={problems.count} />
    </div>
    {quota && <p className="text-xs text-muted-foreground">{out ? t('quotaOut') : t('quotaLeft', { remaining: quota.remaining, limit: quota.limit ?? '∞' })}</p>}
    <Button type="button" className={touch} disabled={busy || out} onClick={() => void generate()}><Sparkles />{busy ? t('generating') : t('generate')}</Button>
    {error && <p role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-3 py-2 text-sm text-danger">{error}</p>}
    {info && <p role="status" className="text-sm text-muted-foreground">{info}</p>}
    {suggestions.length > 0 && <div className="flex flex-col gap-2">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {suggestions.map((s, i) => <li key={i} className="flex items-start gap-2 rounded-lg border border-border p-3">
          <input type="checkbox" className={`mt-1 size-4 ${touch}`} checked={s.on} aria-label={t('pick', { title: t('suggestion', { n: i + 1 }) })} onChange={e => setSuggestions(suggestions.map((x, j) => j === i ? { ...x, on: e.target.checked } : x))} />
          <span className="flex min-w-0 flex-1 flex-col gap-1 text-sm"><span className="font-medium">{t('suggestion', { n: i + 1 })}</span><span className="line-clamp-2 text-muted-foreground [overflow-wrap:anywhere]">{plain(s.q)}</span></span>
          <Button type="button" size="sm" variant="outline" className={touch} onClick={() => setEditing(i)}>{t('editSuggestion')}</Button>
        </li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className={touch} onClick={() => setSuggestions(suggestions.map(s => ({ ...s, on: true })))}>{t('selectAll')}</Button>
        <Button type="button" size="sm" variant="outline" className={touch} onClick={() => setSuggestions(suggestions.map(s => ({ ...s, on: false })))}>{t('clearAll')}</Button>
        <Button type="button" size="sm" className={touch} disabled={!selected.length || saving} onClick={add}>{t('addSelected')} ({selected.length})</Button>
      </div>
    </div>}
    {editing !== null && <QuestionDialog language={language} type={type} number={editing + 1} initial={suggestions[editing].q} onClose={() => setEditing(null)}
      onDone={q => { setSuggestions(suggestions.map((s, j) => j === editing ? { ...s, q } : s)); setEditing(null) }} />}
  </div>
}

/** `/author/exercises/new` creates the metadata only; `/:id/edit` edits metadata + questions with one Save (PATCH then PUT, each with the fresh `version`). */
export function ExerciseEditorPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = exerciseText(language)
  const { id } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const dataRouter = useContext(UNSAFE_DataRouterContext)
  const [load, setLoad] = useState<Load>(id ? 'loading' : 'ready')
  const [set, setSet] = useState<ExerciseSet | null>(null)
  const [info, setInfo] = useState<ExerciseInfo>(NEW_INFO)
  const [questions, setQuestions] = useState<ExerciseQuestion[]>([])
  const [topics, setTopics] = useState<ArticleOption[]>([])
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<{ index: number | null; q: ExerciseQuestion } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [confirm, setConfirm] = useState<'submit' | 'withdraw' | null>(null)
  const [conflict, setConflict] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const saved = useRef(sigOf(NEW_INFO, []))
  const current = useRef(saved.current)
  const version = useRef(0)
  const loadedId = useRef<string | null>(null)
  const inflight = useRef(false)

  current.current = sigOf(info, questions)
  const differs = () => current.current.info !== saved.current.info || current.current.questions !== saved.current.questions
  const dirty = differs()
  const dirtyNow = useCallback(differs, [])

  const apply = useCallback((next: ExerciseSet) => {
    const nextInfo = infoOf(next), nextQuestions = questionsOf(next)
    saved.current = current.current = sigOf(nextInfo, nextQuestions)
    version.current = next.version; loadedId.current = next.id
    setSet(next); setInfo(nextInfo); setQuestions(nextQuestions)
  }, [])
  const fetchSet = useCallback(async (setId: string) => {
    setLoad('loading'); setError('')
    try { apply(await authorExercises.detail(setId)); setLoad('ready') }
    catch (e) { setLoad((e as { status?: number }).status === 404 ? 'notFound' : 'error'); setError(exerciseErrorText(e, language, t('loadError'))) }
  }, [apply, language])
  useEffect(() => { if (id && loadedId.current !== id) void fetchSet(id) }, [id, fetchSet])
  useEffect(() => { authorExercises.options().then(setTopics, () => {}) }, [])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirtyNow()) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirtyNow])

  const matrix = set ? exerciseActions(set) : null
  const readOnly = Boolean(matrix?.readOnly)
  const card = info.type === 'FLASHCARD'
  const infoProblems = tried ? infoErrors(info) : {}
  const questionProblems = tried ? questions.map(questionErrors) : []
  const enough = questions.length >= MIN_TO_SUBMIT[info.type]

  /** One write at a time; failures show their copy and a version conflict opens the reload dialog. */
  const write = async (action: () => Promise<unknown>) => {
    if (inflight.current) return false
    inflight.current = true; setBusy(true); setError(''); setMessage('')
    try { await action(); return true }
    catch (e) { if (isExerciseConflict(e)) setConflict(true); else setError(exerciseErrorText(e, language, t('loadError'))); return false }
    finally { inflight.current = false; setBusy(false) }
  }

  const save = async (): Promise<boolean> => {
    setTried(true)
    if (Object.keys(infoErrors(info)).length || questions.some(q => Object.keys(questionErrors(q)).length)) { setError(questions.some(q => Object.keys(questionErrors(q)).length) ? t('fixQuestions') : ''); return false }
    if (!set) {
      return write(async () => {
        const created = await authorExercises.create({ ...info, title: info.title.trim() })
        apply(created); setMessage(t('created')); navigate(`/author/exercises/${created.id}/edit`, { replace: true })
      })
    }
    if (!dirty) return true
    return write(async () => {
      let next = set
      if (current.current.info !== saved.current.info) { const updated = await authorExercises.update(set.id, version.current, { ...info, title: info.title.trim() }); next = { ...updated, questions: updated.questions ?? set.questions }
        // keep the fresh version and the saved metadata even if the questions PUT fails, so a retry is not a false conflict
        version.current = next.version; saved.current = { ...saved.current, info: current.current.info }; setSet(next) }
      if (current.current.questions !== saved.current.questions) next = await authorExercises.saveQuestions(set.id, next.version, questions)
      apply(next); setMessage(t('saved'))
    })
  }

  const change = (next: ExerciseSet) => { apply(next); setMessage(t('done')) }
  const confirmed = async () => {
    const action = confirm
    setConfirm(null)
    if (!set || !action) return
    await write(async () => { const next = await (action === 'submit' ? authorExercises.submit(set.id) : authorExercises.withdraw(set.id)); apply(next); setMessage(t(action === 'submit' ? 'submitted' : 'done')) })
  }
  const submit = async () => { if (!dirty || await save()) setConfirm('submit') }
  const move = (i: number, by: -1 | 1) => setQuestions(q => { const next = [...q];[next[i], next[i + by]] = [next[i + by], next[i]]; return next })
  const commit = (q: ExerciseQuestion) => { if (editing) setQuestions(old => editing.index === null ? [...old, q] : old.map((x, i) => i === editing.index ? q : x)); setEditing(null) }
  const ai = set && !readOnly && <AiPanel language={language} setId={set.id} saving={busy} type={info.type} total={questions.length} ensureSaved={() => save()} version={() => version.current}
    onVersion={v => { version.current = v; setSet(s => s && { ...s, version: v, aiAssisted: true }) }} onAdd={more => setQuestions(old => [...old, ...more])} onConflict={() => setConflict(true)} />

  if (load === 'loading') return <main aria-busy="true" aria-label={t('loading')} className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8"><Skeleton className="h-8 w-72" /><Skeleton className="h-64 w-full" /></main>
  if (load !== 'ready') return <main className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
    <p role="alert" className="text-base font-semibold">{load === 'notFound' ? t('notFound') : error}</p>
    {load === 'error' ? <Button className={touch} onClick={() => id && void fetchSet(id)}><RefreshCw />{t('retry')}</Button> : <Button asChild className={touch}><Link to="/author/exercises">{t('toList')}</Link></Button>}
  </main>

  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    {dataRouter && <LeaveGuard dirty={dirtyNow} language={language} />}
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 py-3 backdrop-blur">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className={touch}><Link to="/author/exercises"><ArrowLeft />{t('back')}</Link></Button>
        <h1 className="min-w-0 text-xl font-bold [overflow-wrap:anywhere]">{set?.title ?? t('newSet')}</h1>
        {set && <Badge tone={exerciseTone(set.status)}>{statusLabel[set.status][language]}</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {set && <Button variant="outline" className={touch} onClick={() => setPreviewing(true)}><Eye />{t('preview')}</Button>}
        {readOnly && matrix && matrix.actions.map(action => action === 'delete' ? null : <Button key={action} variant="outline" className={touch} disabled={busy}
          onClick={() => action === 'withdraw' ? setConfirm('withdraw') : void write(async () => {
            if (action === 'copy') { const copy = await authorExercises.copy(set!.id); navigate(`/author/exercises/${copy.id}/edit`) }
            else change(await authorExercises.visibility(set!.id, action === 'hide' ? 'HIDE' : 'UNHIDE'))
          })}>{t(action)}</Button>)}
        {!readOnly && <Button className={touch} disabled={busy} onClick={() => void save()}><Save />{busy ? t('saving') : set ? t('save') : t('create')}{dirty && set && <span aria-label={t('unsaved')}>•</span>}</Button>}
        {!readOnly && set && <Button variant="outline" className={touch} disabled={busy || !enough} onClick={() => void submit()}><Send />{t('submit')}</Button>}
      </div>
    </header>

    {set?.status === 'CHANGES_REQUESTED' && set.moderationNote && <p role="status" className="flex items-start gap-2 rounded-lg border border-border bg-tone-amber-bg px-4 py-3 text-sm text-tone-amber-fg"><AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" /><span>{t('changesRequested')}: “{set.moderationNote}”</span></p>}
    {readOnly && <p role="status" className="flex items-start gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm"><Info aria-hidden className="mt-0.5 size-4 shrink-0" />{set?.status === 'PENDING' ? t('readOnlyPending') : t('readOnly')}</p>}
    {error && <p role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">{error}</p>}
    {message && <p role="status" className="rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">{message}</p>}

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6"> {/* locked while saving so a response cannot overwrite newer edits */}
        <Card className="gap-4 rounded-2xl p-6">
          <h2 className="text-base font-bold">{t('info')}</h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ex-title" className={fieldLabel}>{t('titleField')} *</Label>
            <Input id="ex-title" disabled={readOnly} value={info.title} aria-invalid={Boolean(infoProblems.title)} onChange={e => setInfo({ ...info, title: e.target.value })} />
            <Problem id="ex-title-error" text={infoProblems.title && t(infoProblems.title)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ex-description" className={fieldLabel}>{t('description')}</Label>
            <Textarea id="ex-description" disabled={readOnly} value={info.description} aria-invalid={Boolean(infoProblems.description)} onChange={e => setInfo({ ...info, description: e.target.value })} />
            <span className="text-xs text-muted-foreground">{info.description.length}/2.000</span>
            <Problem id="ex-description-error" text={infoProblems.description && t(infoProblems.description)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ex-topic" className={fieldLabel}>{t('topic')} *</Label>
            <NativeSelect id="ex-topic" className={touch} disabled={readOnly} value={info.topicId} onChange={e => setInfo({ ...info, topicId: e.target.value })}>
              <NativeSelectOption value="">{t('chooseTopic')}</NativeSelectOption>
              {topics.map(o => <NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}
              {set && !topics.some(o => o.id === set.topic.id) && <NativeSelectOption value={set.topic.id}>{set.topic.name}</NativeSelectOption>}
            </NativeSelect>
            <Problem id="ex-topic-error" text={infoProblems.topicId && t(infoProblems.topicId)} />
          </div>
          <fieldset className="flex flex-col gap-2" disabled={readOnly}>
            <legend className={`${fieldLabel} mb-2`}>{t('difficulty')} *</legend>
            <div className="flex flex-wrap gap-4">{DIFFICULTIES.map(d => <label key={d} className={`flex items-center gap-2 text-sm ${touch}`}><input type="radio" name="difficulty" className="size-4" checked={info.difficulty === d} onChange={() => setInfo({ ...info, difficulty: d })} />{difficultyLabel[d][language]}</label>)}</div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className={`${fieldLabel} mb-2`}>{t('typeField')} *</legend>
            {set ? <p className="text-sm">{typeLabel[info.type][language]} <span className="text-muted-foreground">· {t('typeLocked')}</span></p>
              : <div className="flex flex-wrap gap-4">{TYPES.map(v => <label key={v} className={`flex items-center gap-2 text-sm ${touch}`}><input type="radio" name="type" className="size-4" checked={info.type === v} onChange={() => setInfo({ ...info, type: v })} />{typeLabel[v][language]}</label>)}</div>}
            {!set && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Info aria-hidden className="size-3.5" />{t('typeLocked')}</p>}
          </fieldset>
        </Card>

        {set && <Card className="gap-4 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">{t(card ? 'cardsHeading' : 'questionsHeading')} ({questions.length}/{MAX_QUESTIONS})</h2>
            {!readOnly && isMobile && <Button variant="outline" size="sm" className={touch} onClick={() => setAiOpen(true)}><Sparkles />{t('ai')}</Button>}
          </div>
          {!readOnly && !enough && <p className="text-sm text-muted-foreground">{t('notReady')}</p>}
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {questions.map((q, i) => <li key={i} className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={fieldLabel}>{t(card ? 'card' : 'question', { n: i + 1 })}</span>
                {!readOnly && <span className="flex flex-wrap gap-1">
                  <Button type="button" variant="ghost" size="icon" className={touch} disabled={i === 0} aria-label={`${t('moveUp')} ${i + 1}`} onClick={() => move(i, -1)}><ArrowUp /></Button>
                  <Button type="button" variant="ghost" size="icon" className={touch} disabled={i === questions.length - 1} aria-label={`${t('moveDown')} ${i + 1}`} onClick={() => move(i, 1)}><ArrowDown /></Button>
                  <Button type="button" variant="outline" size="sm" className={touch} aria-label={`${t('edit')} ${i + 1}`} onClick={() => setEditing({ index: i, q })}>{t('edit')}</Button>
                  <Button type="button" variant="outline" size="sm" className={touch} aria-label={`${t('removeQuestion')} ${i + 1}`} onClick={() => setQuestions(old => old.filter((_, j) => j !== i))}>{t('removeQuestion')}</Button>
                </span>}
              </div>
              <p className="line-clamp-2 text-sm [overflow-wrap:anywhere]">{plain(q) || '—'}</p>
              {Object.keys(questionProblems[i] ?? {}).length > 0 && <p role="alert" className="text-xs text-danger">{t(card ? 'cardInvalid' : 'questionInvalid', { n: i + 1 })}</p>}
            </li>)}
          </ol>
          {!readOnly && <Button type="button" variant="outline" className={`self-start ${touch}`} disabled={questions.length >= MAX_QUESTIONS} onClick={() => setEditing({ index: null, q: emptyQuestion(info.type) })}><Plus />{t(card ? 'addCard' : 'addQuestion')}</Button>}
        </Card>}
      </fieldset>
      {ai && !isMobile && <aside aria-label={t('ai')}><Card className="gap-4 rounded-2xl p-6"><h2 className="flex items-center gap-2 text-base font-bold"><Sparkles aria-hidden className="size-4" />{t('ai')}</h2>{ai}</Card></aside>}
    </div>

    {ai && isMobile && <Sheet open={aiOpen} onOpenChange={setAiOpen}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto p-4">
        <SheetHeader><SheetTitle>{t('ai')}</SheetTitle><SheetDescription>{t('aiHint')}</SheetDescription></SheetHeader>
        {ai}
      </SheetContent>
    </Sheet>}
    {editing && <QuestionDialog language={language} type={info.type} number={(editing.index ?? questions.length) + 1} initial={editing.q} onClose={() => setEditing(null)} onDone={commit} />}
    {previewing && <PreviewDialog language={language} questions={questions} onClose={() => setPreviewing(false)} />}

    <AlertDialog open={confirm !== null}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t(confirm === 'withdraw' ? 'withdrawTitle' : 'submitTitle')}</AlertDialogTitle>{confirm === 'submit' && <AlertDialogDescription>{t('submitText')}</AlertDialogDescription>}</AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={touch} onClick={() => setConfirm(null)}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction className={touch} onClick={() => void confirmed()}>{t(confirm === 'withdraw' ? 'withdraw' : 'submit')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={conflict}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t('conflictTitle')}</AlertDialogTitle></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogAction className={touch} onClick={() => { setConflict(false); if (id) void fetchSet(id) }}>{t('reload')}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </main>
}
