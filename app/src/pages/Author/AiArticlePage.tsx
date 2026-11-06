import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Info, Loader2, RefreshCw, Sparkles, Square } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { TagPicker } from '../../components/TagPicker'
import { AiOutlineEditor } from '../../components/articles/AiOutlineEditor'
import { aiErrorText, aiText } from '../../data/aiAssistI18n'
import { ApiError } from '../../services/api/client'
import { aiAssist, draftBytes, MAX_DRAFT_BYTES, outlineErrors, sha256Hex, type OutlineDraft } from '../../services/aiAssistService'
import { authorArticles } from '../../services/articleService'
import type { AiDraftRequest, AiLength, AiQuota, AiStreamEvent } from '../../types/aiAssist'
import type { ArticleOption, ArticleWrite } from '../../types/articles'
import type { Language } from '../../types/preferences'

export const SESSION_KEY = 'techverse-ai-compose:v1'
const LENGTHS: AiLength[] = ['SHORT', 'MEDIUM', 'LONG']
const TAXONOMY = ['TOPIC_NOT_FOUND', 'TAG_NOT_FOUND', 'ARTICLE_ASSOCIATION_INACTIVE']
const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const label = 'text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground'
const alertBox = 'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm'

type Form = { title: string; topicId: string; tagIds: string[]; idea: string; length: AiLength; targetAudience: string }
/** Only a buffer whose SHA-256 matched `completed` is kept; `key` exists once create started, so F5 retries idempotently. */
type Completed = { generationId: string; content: string; sha: string; payload: ArticleWrite; key?: string }
type Saved = { v: 1; form: Form; outline: OutlineDraft | null; completed?: Completed; streaming?: boolean }
type Run = { kind: 'idle' } | { kind: 'streaming'; text: string; total: number; timeoutSeconds: number | null }
  | { kind: 'stopped'; text: string } | { kind: 'failed'; text: string; error: unknown }
type Notice = 'restored' | 'restoredCompleted' | 'interrupted' | null

const EMPTY: Form = { title: '', topicId: '', tagIds: [], idea: '', length: 'MEDIUM', targetAudience: '' }
const fits = (text: string, min: number, max: number) => { const n = text.trim().length; return n >= min && n <= max }
// Wrong version or broken JSON: drop silently and start empty (spec “Session cũ/hỏng”).
function readSession(): Saved | null {
  try { const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null'); return saved?.v === 1 && saved.form ? saved : null } catch { return null }
}

/** `/author/blogs/ai`: idea → outline → SSE draft → verified handoff to the existing create (SAVE + aiGenerationId). */
export function AiArticlePage({ language = 'vi' }: { language?: Language } = {}) {
  const t = aiText(language)
  const uid = useId()
  const navigate = useNavigate()
  const [initial] = useState(readSession)
  const [form, setForm] = useState<Form>(initial?.form ?? EMPTY)
  const [outline, setOutline] = useState<OutlineDraft | null>(initial?.outline ?? null)
  const [completed, setCompleted] = useState<Completed | null>(initial?.completed ?? null)
  const [verified, setVerified] = useState(false)
  const [run, setRun] = useState<Run>({ kind: 'idle' })
  const [quota, setQuotaState] = useState<{ outline: AiQuota | null; draft: AiQuota | null }>({ outline: null, draft: null })
  // Each quota reported by an AI call bumps the revision; a refresh answering after that is stale and dropped.
  const quotaRevision = useRef(0)
  const setQuota: typeof setQuotaState = update => { quotaRevision.current += 1; setQuotaState(update) }
  const [options, setOptions] = useState<{ topics: ArticleOption[]; tags: ArticleOption[] } | null>(null)
  const [optionsError, setOptionsError] = useState('')
  const [notice, setNotice] = useState<Notice>(initial?.streaming ? 'interrupted' : initial && !initial.completed && (initial.outline || initial.form.idea) ? 'restored' : null)
  const [error, setError] = useState<{ text: string; forbidden?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [formOpen, setFormOpen] = useState(!initial?.outline)
  const [createError, setCreateError] = useState('')
  const [createLocked, setCreateLocked] = useState(false)
  const [confirm, setConfirm] = useState<'reset' | 'other' | 'regenerate' | null>(null)
  const abort = useRef<AbortController | null>(null)
  const generationId = useRef<string | null>(null)
  const stopped = useRef(false)
  const cleared = useRef(false)
  const completedHeading = useRef<HTMLHeadingElement>(null)
  const focusCompleted = useRef(false)
  const root = useRef<HTMLElement>(null)
  const streaming = run.kind === 'streaming'

  const loadOptions = useCallback(() => {
    setOptionsError('')
    authorArticles.options().then(o => setOptions({ topics: o.topics.content, tags: o.tags.content }), e => setOptionsError(aiErrorText(e, language)))
  }, [language])
  useEffect(() => { loadOptions() }, [loadOptions])
  // Today's allowance on open and whenever the tab regains focus (the daily quota resets at midnight, and a stale 0 locks the actions).
  // A failure keeps the last known value (or “—”).
  useEffect(() => {
    const refresh = () => {
      const revision = quotaRevision.current
      void aiAssist.quota().then(q => { if (revision === quotaRevision.current) setQuotaState({ outline: q.outline, draft: q.draft }) }, () => {})
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  // A restored completed buffer is trusted again only after its hash is recomputed.
  useEffect(() => {
    const saved = initial?.completed
    if (!saved) return
    void sha256Hex(saved.content).then(sha => {
      if (sha === saved.sha) { setVerified(true); setNotice('restoredCompleted') }
      else { setCompleted(null); setError({ text: aiErrorText('AI_STREAM_INTEGRITY_FAILED', language) }) }
    })
  }, [initial, language])

  // Tab session: form + outline always; the completed buffer only after verification; never partial preview or tokens.
  useEffect(() => {
    if (cleared.current) return
    const saved: Saved = { v: 1, form, outline, ...(completed ? { completed } : {}), ...(streaming ? { streaming: true } : {}) }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(saved))
  }, [form, outline, completed, streaming])

  // Leaving mid-stream: best-effort DELETE that survives the closing page (keepalive + bearer).
  useEffect(() => {
    if (!streaming) return
    const leave = () => { if (generationId.current) void aiAssist.cancel(generationId.current, true).catch(() => {}) }
    window.addEventListener('pagehide', leave)
    return () => window.removeEventListener('pagehide', leave)
  }, [streaming])
  // SPA navigation away while streaming: stop reading and release the backend slot.
  useEffect(() => () => {
    if (abort.current && !stopped.current) { stopped.current = true; abort.current.abort(); if (generationId.current) void aiAssist.cancel(generationId.current).catch(() => {}) }
  }, [])

  useEffect(() => { if (verified && focusCompleted.current) { focusCompleted.current = false; completedHeading.current?.focus() } }, [verified])

  // The completed payload is locked to the inputs it was written from; any input change invalidates it.
  // Form tag edits flow into the outline selection (keeping suggestions that are on, ≤10).
  const setField = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm(old => ({ ...old, [key]: value }))
    if (completed) { setCompleted(null); setVerified(false) }
    if (key === 'tagIds' && outline) {
      const ids = value as string[]
      setOutline({ ...outline, tagIds: [...ids, ...outline.tagIds.filter(id => outline.suggestedTagIds.includes(id) && !ids.includes(id))].slice(0, 10) })
    }
  }
  const formValid = Boolean(form.topicId) && fits(form.idea, 20, 4000) && fits(form.targetAudience, 3, 200) && (!form.title.trim() || fits(form.title, 5, 255))
  const showError = (e: unknown) => {
    const quotaOfError = (e as { quota?: AiQuota | null })?.quota
    setError({ text: aiErrorText(e, language), forbidden: e instanceof ApiError && e.status === 403 })
    if (e instanceof ApiError && TAXONOMY.includes(e.code ?? '')) loadOptions()
    return quotaOfError
  }

  const generateOutline = async () => {
    if (!formValid || busy || streaming) return
    setBusy(true); setError(null); setNotice(null)
    try {
      const title = form.title.trim()
      const result = await aiAssist.outline({ ...(title ? { title } : {}), topicId: form.topicId, tagIds: form.tagIds, idea: form.idea.trim(), length: form.length, targetAudience: form.targetAudience.trim() })
      const { title: outlineTitle, summary, tagIds, suggestedTagIds, sections } = result.outline
      setOutline({ title: outlineTitle, summary, tagIds, suggestedTagIds, sections })
      setQuota(q => ({ ...q, outline: result.quota }))
      setCompleted(null); setVerified(false); setRun({ kind: 'idle' }); setShowErrors(false); setFormOpen(false)
    } catch (e) {
      const q = showError(e)
      if (q) setQuota(old => ({ ...old, outline: q }))
    } finally { setBusy(false) }
  }

  const terminalQuota = (remaining: number | null) => {
    if (remaining !== null) setQuota(q => ({ ...q, draft: { limit: q.draft?.limit ?? null, remaining } }))
  }

  const writeDraft = async () => {
    if (!outline || streaming || busy) return
    setError(null); setNotice(null); setCreateError(''); setCreateLocked(false)
    if (Object.keys(outlineErrors(outline)).length) {
      setShowErrors(true); setError({ text: t('fixOutline') })
      requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    const body: AiDraftRequest = {
      title: outline.title.trim(), summary: outline.summary.trim(), topicId: form.topicId, tagIds: outline.tagIds, idea: form.idea.trim(), length: form.length,
      targetAudience: form.targetAudience.trim(), sections: outline.sections.map(s => ({ heading: s.heading.trim(), subsections: s.subsections.map(sub => sub.trim()) })),
    }
    if (draftBytes(body) > MAX_DRAFT_BYTES) { setError({ text: t('tooLarge') }); return }

    const controller = new AbortController()
    abort.current = controller; stopped.current = false; generationId.current = null
    let buffer = ''
    let terminal: AiStreamEvent | null = null
    setCompleted(null); setVerified(false)
    setRun({ kind: 'streaming', text: '', total: body.sections.length, timeoutSeconds: null })
    const onEvent = (event: AiStreamEvent) => {
      if (stopped.current || terminal) return // the first terminal wins; a Stop chosen earlier wins over a late completed
      if (event.type === 'metadata') { generationId.current = event.generationId; setRun(r => r.kind === 'streaming' ? { ...r, timeoutSeconds: event.timeoutSeconds } : r) }
      else if (event.type === 'delta') { buffer += event.text; setRun(r => r.kind === 'streaming' ? { ...r, text: buffer } : r) }
      else { terminal = event; terminalQuota(event.quotaRemaining) }
    }
    try {
      await aiAssist.streamDraft(body, controller.signal, onEvent, q => setQuota(old => ({ ...old, draft: q })))
    } catch (e) {
      if (!stopped.current) {
        const q = (e as { quota?: AiQuota | null })?.quota
        if (q) setQuota(old => ({ ...old, draft: q }))
        if (e instanceof ApiError && TAXONOMY.includes(e.code ?? '')) loadOptions()
        setRun({ kind: 'failed', text: buffer, error: e })
      }
      return
    } finally { abort.current = null }
    if (stopped.current) return
    const end = terminal as AiStreamEvent | null
    if (end?.type === 'cancelled') { setRun({ kind: 'stopped', text: buffer }); return }
    if (end?.type === 'error') { setRun({ kind: 'failed', text: buffer, error: end.code }); return }
    if (end?.type !== 'completed') { setRun({ kind: 'failed', text: buffer, error: new TypeError('stream ended without a terminal event') }); return }
    const sha = await sha256Hex(buffer)
    if (!end.validated || sha !== end.contentSha256) { setRun({ kind: 'failed', text: buffer, error: 'AI_STREAM_INTEGRITY_FAILED' }); return }
    const payload: ArticleWrite = { action: 'SAVE', aiGenerationId: end.generationId, title: body.title, topicId: body.topicId, tagIds: body.tagIds, summary: body.summary, content: buffer, coverImageUrl: null }
    focusCompleted.current = true
    setCompleted({ generationId: end.generationId, content: buffer, sha, payload })
    setVerified(true)
    setRun({ kind: 'idle' })
  }

  const stop = () => {
    stopped.current = true
    abort.current?.abort()
    if (generationId.current) void aiAssist.cancel(generationId.current).catch(() => {})
    setRun(r => ({ kind: 'stopped', text: r.kind === 'streaming' ? r.text : '' }))
  }

  const handoff = async () => {
    if (!completed || !verified || busy || createLocked) return
    // One key per accepted draft: kept with the payload so a retry (even after F5) replays the same create.
    const next = { ...completed, key: completed.key ?? crypto.randomUUID() }
    setCompleted(next); setBusy(true); setCreateError('')
    try {
      const article = await authorArticles.create(next.payload, next.key)
      cleared.current = true
      sessionStorage.removeItem(SESSION_KEY)
      navigate(`/author/blogs/${article.id}/edit`, { replace: true })
    } catch (e) {
      setCreateError(aiErrorText(e, language))
      if (e instanceof ApiError && (e.code === 'AI_GENERATION_INVALID' || TAXONOMY.includes(e.code ?? ''))) setCreateLocked(true)
    } finally { setBusy(false) }
  }

  const rewrite = () => { setCompleted(null); setVerified(false); setCreateError(''); setCreateLocked(false); setError(null); loadOptions() }
  const reset = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setForm(EMPTY); setOutline(null); setCompleted(null); setVerified(false); setRun({ kind: 'idle' }); setNotice(null); setError(null)
    setCreateError(''); setCreateLocked(false); setShowErrors(false); setFormOpen(true)
  }
  const runConfirmed = () => {
    const action = confirm
    setConfirm(null)
    if (action === 'reset') reset()
    else if (action === 'other') void generateOutline()
    else if (action === 'regenerate') void writeDraft()
  }

  const quotaText = (q: AiQuota | null) => q ? t('quota', { remaining: q.remaining, limit: q.limit ?? '—' }) : '—'
  const quotaLine = (key: 'quotaOutline' | 'quotaDraft', q: AiQuota | null) => <span className="text-xs text-muted-foreground" title={q ? undefined : t('quotaUnknown')}>{t(key, { value: quotaText(q) })}</span>
  const outlineQuotaExhausted = quota.outline?.remaining === 0
  const draftQuotaExhausted = quota.draft?.remaining === 0 && !streaming
  const topicName = options?.topics.find(o => o.id === form.topicId)?.name
  const sectionsDone = run.kind === 'streaming' ? Math.min((run.text.match(/^## /gm) ?? []).length, run.total) : 0
  const lockedInputs = streaming || busy
  const confirmCopy = confirm === 'reset' ? [t('resetTitle'), t('resetText'), t('reset')] : confirm === 'other' ? [t('otherTitle'), t('otherText'), t('otherOutline')] : [t('regenerateTitle'), t('regenerateText'), t('regenerate')]
  const failedText = run.kind === 'failed' ? aiErrorText(run.error, language) : ''
  const preview = (text: string, title: string) => <div role="region" aria-label={title} tabIndex={0} className="max-h-96 overflow-y-auto overscroll-contain rounded-lg border border-border bg-muted/40 p-4 outline-none [scrollbar-width:thin] focus-visible:ring-2 focus-visible:ring-ring">
    <pre className="m-0 font-sans text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</pre>
  </div>

  const ideaCard = <Card className="gap-0 rounded-2xl py-0">
    {outline
      ? <button type="button" aria-expanded={formOpen} aria-controls={`${uid}-form`} onClick={() => setFormOpen(open => !open)} className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border-0 bg-transparent px-6 py-4 text-left text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring ${touch}`}>
        <span className="flex min-w-0 flex-col"><span className="font-semibold">{t('step1')}</span>{!formOpen && <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{[form.title.trim(), topicName, `${form.tagIds.length} ${t('tags').toLowerCase()}`, t(form.length)].filter(Boolean).join(' · ')}</span>}</span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">{formOpen ? t('collapse') : t('expand')}{formOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</span>
      </button>
      : <h2 className="px-6 pt-5 text-lg font-semibold">{t('step1')}</h2>}
    {formOpen && <div id={`${uid}-form`} className={`grid gap-4 p-6 md:grid-cols-2 ${outline ? 'border-t border-border' : ''}`}>
      <p className="text-sm text-muted-foreground md:col-span-2">{t('formHelp')}</p>
      <div className="flex flex-col gap-2 md:col-span-2">
        <Label htmlFor={`${uid}-title`} className={label}>{t('titleField')}</Label>
        <Input id={`${uid}-title`} value={form.title} maxLength={255} readOnly={lockedInputs} className={touch} onChange={e => setField('title', e.target.value)}
          aria-invalid={form.title.trim() && !fits(form.title, 5, 255) ? true : undefined} aria-describedby={form.title.trim() && !fits(form.title, 5, 255) ? `${uid}-title-error` : undefined} />
        {form.title.trim() && !fits(form.title, 5, 255) && <p id={`${uid}-title-error`} className="text-xs text-danger">{t('titleLength')}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${uid}-topic`} className={label}>{t('topic')} *</Label>
        {options ? <NativeSelect id={`${uid}-topic`} value={form.topicId} disabled={lockedInputs} className={touch} onChange={e => setField('topicId', e.target.value)}>
          <NativeSelectOption value="">{t('chooseTopic')}</NativeSelectOption>
          {options.topics.map(o => <NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}
        </NativeSelect> : <Skeleton aria-busy="true" className="h-9 w-full" />}
      </div>
      {options ? <TagPicker language={language} options={options.tags} selected={form.tagIds} disabled={lockedInputs} onChange={ids => setField('tagIds', ids)} /> : <Skeleton aria-busy="true" className="h-24 w-full" />}
      {optionsError && <div role="alert" className={`${alertBox} border-border bg-tone-rose-bg text-danger md:col-span-2`}>
        <span>{t('optionsError')} {optionsError}</span>
        <Button size="sm" variant="outline" className={touch} onClick={loadOptions}><RefreshCw />{t('retry')}</Button>
      </div>}
      <div className="flex flex-col gap-2 md:col-span-2">
        <div className="flex justify-between gap-2"><Label htmlFor={`${uid}-idea`} className={label}>{t('idea')} *</Label><span className="text-xs tabular-nums text-muted-foreground">{form.idea.length}/4000</span></div>
        <Textarea id={`${uid}-idea`} rows={5} maxLength={4000} readOnly={lockedInputs} placeholder={t('ideaPlaceholder')} value={form.idea} onChange={e => setField('idea', e.target.value)} />
      </div>
      <div role="radiogroup" aria-labelledby={`${uid}-length`} className="flex flex-col gap-2">
        <span id={`${uid}-length`} className={label}>{t('length')} *</span>
        <div className="flex flex-wrap gap-2">
          {LENGTHS.map(length => <Button key={length} type="button" role="radio" aria-checked={form.length === length} variant={form.length === length ? 'default' : 'outline'} size="sm" disabled={lockedInputs} className={touch} onClick={() => setField('length', length)}>{t(length)}</Button>)}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${uid}-audience`} className={label}>{t('audience')} *</Label>
        <Input id={`${uid}-audience`} value={form.targetAudience} maxLength={200} readOnly={lockedInputs} placeholder={t('audiencePlaceholder')} className={touch} onChange={e => setField('targetAudience', e.target.value)} />
      </div>
      {!outline && <div className="flex flex-wrap items-center justify-end gap-3 md:col-span-2">
        {quotaLine('quotaOutline', quota.outline)}
        <Button className={`max-md:w-full ${touch}`} disabled={!formValid || busy || outlineQuotaExhausted} onClick={() => void generateOutline()}>
          {busy && <Loader2 className="animate-spin" />}{busy ? t('generating') : t('generateOutline')}
        </Button>
      </div>}
    </div>}
  </Card>

  const outlineCard = outline && <Card className="gap-4 rounded-2xl px-6 py-5">
    <h2 className="text-lg font-semibold">{t('step2')}</h2>
    <AiOutlineEditor value={outline} tags={options?.tags ?? []} onChange={next => { setOutline(next); if (completed) { setCompleted(null); setVerified(false) } }} showErrors={showErrors} disabled={lockedInputs} language={language} />
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <Button variant="outline" className={touch} disabled={lockedInputs || !formValid || outlineQuotaExhausted} onClick={() => setConfirm('other')}>{busy && !streaming ? <Loader2 className="animate-spin" /> : <RefreshCw />}{t('otherOutline')}</Button>
      {quotaLine('quotaOutline', quota.outline)}
    </div>
  </Card>

  const resultCard = run.kind === 'streaming'
    ? <Card className="gap-3 rounded-2xl px-6 py-5">
      <h2 className="text-lg font-semibold">{t('streaming')}</h2>
      <p role="status" className="inline-flex items-center gap-2 text-sm"><Loader2 aria-hidden className="size-4 animate-spin" />{run.timeoutSeconds ? t('progress', { done: sectionsDone, total: run.total, seconds: run.timeoutSeconds }) : t('connecting')}</p>
      <p className="inline-flex items-start gap-2 text-xs text-muted-foreground"><Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />{t('streamNote')}</p>
      {preview(run.text, t('preview'))}
    </Card>
    : completed && verified
      ? <Card className="gap-3 rounded-2xl border-tone-green-border px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 ref={completedHeading} tabIndex={-1} className="text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('completed')}</h2>
          <Badge tone="green"><CheckCircle2 aria-hidden />{t('verified')}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{t('completedNote')}</p>
        {preview(completed.content, t('preview'))}
        {createError && <div role="alert" className={`${alertBox} border-border bg-tone-rose-bg text-danger`}>
          <span>{t('createFailed')} {createError}</span>
          <Button size="sm" variant="outline" className={touch} onClick={rewrite}>{t('rewrite')}</Button>
        </div>}
      </Card>
      : run.kind === 'stopped' || run.kind === 'failed'
        ? <Card className="gap-3 rounded-2xl px-6 py-5">
          <div role={run.kind === 'failed' ? 'alert' : 'status'} className={`${alertBox} ${run.kind === 'failed' ? 'border-border bg-tone-rose-bg text-danger' : 'border-tone-slate-border bg-tone-slate-bg text-tone-slate-fg'}`}>
            <span>{run.kind === 'failed' ? failedText : t('stopped')}</span>
            {run.kind === 'failed' && run.error instanceof ApiError && run.error.status === 403
              ? <Button size="sm" variant="outline" asChild className={touch}><Link to="/author/blogs">{t('backToBlogs')}</Link></Button>
              : <Button size="sm" variant="outline" className={touch} disabled={draftQuotaExhausted} onClick={() => void writeDraft()}><RefreshCw />{t('retry')}</Button>}
          </div>
          {run.text && <details className="text-sm"><summary className={`cursor-pointer text-muted-foreground ${touch}`}>{t('partial')}</summary><div className="mt-2">{preview(run.text, t('partial'))}</div></details>}
        </Card>
        : null

  // One action bar: sticky at the bottom on mobile, inline on desktop; outside the preview so it never joins its live region.
  const actionBar = outline && <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-background px-4 py-3 sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
    <span className="mr-auto">{quotaLine('quotaDraft', quota.draft)}</span>
    {streaming
      ? <Button variant="destructive" className="min-h-11 min-w-11" onClick={stop}><Square />{t('stop')}</Button>
      : completed && verified
        ? <>
          <Button variant="outline" className={touch} disabled={busy || draftQuotaExhausted} onClick={() => setConfirm('regenerate')}>{t('regenerate')}</Button>
          <Button className={touch} disabled={busy || createLocked} onClick={() => void handoff()}>{busy && <Loader2 className="animate-spin" />}{busy ? t('saving') : t('handoff')}</Button>
        </>
        : <Button className={touch} disabled={busy || draftQuotaExhausted} onClick={() => void writeDraft()}><Sparkles />{t('write')}</Button>}
  </div>

  return <main ref={root} className="tw-page mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pt-6 sm:px-6 md:pb-8 lg:px-8">
    <header className="flex flex-col gap-2">
      <Link to="/author/blogs" className={`inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground ${touch}`}><ArrowLeft aria-hidden className="size-4" />{t('back')}</Link>
      <Badge tone="purple" className="self-start"><Sparkles aria-hidden />{t('kicker')}</Badge>
      <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
      <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
    </header>

    {notice && <div role="status" className={`${alertBox} border-tone-blue-border bg-tone-blue-bg text-tone-blue-fg`}>
      <span className="inline-flex items-start gap-2"><Info aria-hidden className="mt-0.5 size-4 shrink-0" />{t(notice)}</span>
      <Button size="sm" variant="outline" className={touch} disabled={streaming} onClick={() => setConfirm('reset')}>{t('reset')}</Button>
    </div>}
    {error && <div role="alert" className={`${alertBox} border-border bg-tone-rose-bg text-danger`}>
      <span>{error.text}</span>
      {error.forbidden && <Button size="sm" variant="outline" asChild className={touch}><Link to="/author/blogs">{t('backToBlogs')}</Link></Button>}
    </div>}

    {ideaCard}
    {outlineCard}
    {resultCard}
    {actionBar}

    <AlertDialog open={confirm !== null} onOpenChange={open => { if (!open) setConfirm(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{confirmCopy[0]}</AlertDialogTitle><AlertDialogDescription>{confirmCopy[1]}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction variant={confirm === 'reset' ? 'destructive' : 'default'} onClick={runConfirmed}>{confirmCopy[2]}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </main>
}
