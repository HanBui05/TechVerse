import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, RefreshCw, Sparkles, Square } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useIsMobile } from '@/hooks/use-mobile'
import { AiOutlineEditor } from '../../../components/articles/AiOutlineEditor'
import { aiErrorText, aiText } from '../../../data/aiAssistI18n'
import { courseText } from '../../../data/courseI18n'
import { aiAssist, draftBytes, MAX_DRAFT_BYTES, outlineErrors, sha256Hex, type OutlineDraft } from '../../../services/aiAssistService'
import type { AiDraftRequest, AiLength, AiQuota, AiStreamEvent } from '../../../types/aiAssist'
import type { Language } from '../../../types/preferences'

const LENGTHS: AiLength[] = ['SHORT', 'MEDIUM', 'LONG']
const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const label = 'text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground'
const fits = (text: string, min: number, max: number) => { const n = text.trim().length; return n >= min && n <= max }
export const aiSessionKey = (courseId: string, lessonKey: string) => `techverse-ai-lesson:v1:${courseId}:${lessonKey}`

export type AiLessonDraft = { title: string; summary: string; content: string; generationId: string }
type Form = { title: string; idea: string; length: AiLength; targetAudience: string }
type Completed = { generationId: string; content: string; sha: string }
type Saved = { form: Form; outline: OutlineDraft | null; completed?: Completed }
type Run = { kind: 'idle' } | { kind: 'streaming'; text: string; total: number } | { kind: 'stopped' | 'failed'; text: string; error?: unknown }

type Props = { language: Language; open: boolean; courseId: string; lessonKey: string; title: string; summary: string; onClose: () => void; onUse: (draft: AiLessonDraft) => void }

/** AI draft for one lesson (wireframe 3a-7): same outline → SSE → verified-hash flow as the article, but the server takes the course taxonomy (`targetType=LESSON`). */
export function CourseAiSheet({ language, open, courseId, lessonKey, title, summary, onClose, onUse }: Props) {
  const t = aiText(language)
  const c = courseText(language)
  const isMobile = useIsMobile()
  const key = aiSessionKey(courseId, lessonKey)
  const [initial] = useState<Saved | null>(() => { try { return JSON.parse(sessionStorage.getItem(key) ?? 'null') } catch { return null } })
  const [form, setForm] = useState<Form>(initial?.form ?? { title, idea: summary.trim().length >= 20 ? summary.trim() : '', length: 'MEDIUM', targetAudience: '' })
  const [outline, setOutline] = useState<OutlineDraft | null>(initial?.outline ?? null)
  const [completed, setCompleted] = useState<Completed | null>(null)
  const [run, setRun] = useState<Run>({ kind: 'idle' })
  const [quota, setQuota] = useState<{ outline: AiQuota | null; draft: AiQuota | null }>({ outline: null, draft: null })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const generationId = useRef<string | null>(null)
  const stopped = useRef(false)
  const streaming = run.kind === 'streaming'

  // A restored completed buffer is trusted again only after its hash is recomputed.
  useEffect(() => {
    const saved = initial?.completed
    if (saved) void sha256Hex(saved.content).then(sha => { if (sha === saved.sha) setCompleted(saved); else setError(aiErrorText('AI_STREAM_INTEGRITY_FAILED', language)) })
  }, [initial, language])
  useEffect(() => { sessionStorage.setItem(key, JSON.stringify({ form, outline, ...(completed ? { completed } : {}) } satisfies Saved)) }, [key, form, outline, completed])
  useEffect(() => { if (open) void aiAssist.quota().then(q => setQuota({ outline: q.outline, draft: q.draft }), () => {}) }, [open])

  const stop = (quiet = false) => {
    stopped.current = true; abort.current?.abort()
    if (generationId.current) void aiAssist.cancel(generationId.current).catch(() => {})
    if (!quiet) setRun(r => ({ kind: 'stopped', text: r.kind === 'streaming' ? r.text : '' }))
  }
  // Closing the Sheet mid-stream is Stop; unmounting releases the backend slot too.
  const close = () => { if (streaming) stop(true); setRun(r => r.kind === 'streaming' ? { kind: 'stopped', text: r.text } : r); onClose() }
  useEffect(() => () => { if (abort.current && !stopped.current) { stopped.current = true; abort.current.abort(); if (generationId.current) void aiAssist.cancel(generationId.current).catch(() => {}) } }, [])

  const setField = <K extends keyof Form>(name: K, value: Form[K]) => { setForm(old => ({ ...old, [name]: value })); setCompleted(null) }
  const formValid = fits(form.idea, 20, 4000) && fits(form.targetAudience, 3, 200) && (!form.title.trim() || fits(form.title, 5, 255))
  const fail = (e: unknown) => { const q = (e as { quota?: AiQuota | null })?.quota; if (q) setQuota(old => ({ ...old, outline: q })); setError(aiErrorText(e, language)) }

  const generateOutline = async () => {
    if (!formValid || busy || streaming) return
    setBusy(true); setError('')
    try {
      const result = await aiAssist.outline({ targetType: 'LESSON', courseId, ...(form.title.trim() ? { title: form.title.trim() } : {}), idea: form.idea.trim(), length: form.length, targetAudience: form.targetAudience.trim() })
      const { title: heading, summary: text, tagIds, suggestedTagIds, sections } = result.outline
      setOutline({ title: heading, summary: text, tagIds, suggestedTagIds, sections }); setQuota(q => ({ ...q, outline: result.quota })); setCompleted(null); setShowErrors(false)
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  const writeDraft = async () => {
    if (!outline || streaming || busy) return
    setError('')
    if (Object.keys(outlineErrors(outline)).length) { setShowErrors(true); setError(t('fixOutline')); return }
    const body: AiDraftRequest = { targetType: 'LESSON', courseId, title: outline.title.trim(), summary: outline.summary.trim(), idea: form.idea.trim(), length: form.length, targetAudience: form.targetAudience.trim(), sections: outline.sections.map(s => ({ heading: s.heading.trim(), subsections: s.subsections.map(sub => sub.trim()) })) }
    if (draftBytes(body) > MAX_DRAFT_BYTES) { setError(t('tooLarge')); return }
    const controller = new AbortController()
    abort.current = controller; stopped.current = false; generationId.current = null
    let buffer = ''
    let terminal: AiStreamEvent | null = null
    setCompleted(null); setRun({ kind: 'streaming', text: '', total: body.sections.length })
    const onEvent = (event: AiStreamEvent) => {
      if (stopped.current || terminal) return
      if (event.type === 'metadata') generationId.current = event.generationId
      else if (event.type === 'delta') { buffer += event.text; setRun(r => r.kind === 'streaming' ? { ...r, text: buffer } : r) }
      else { terminal = event; if (event.quotaRemaining !== null) setQuota(q => ({ ...q, draft: { limit: q.draft?.limit ?? null, remaining: event.quotaRemaining! } })) }
    }
    try { await aiAssist.streamDraft(body, controller.signal, onEvent, q => setQuota(old => ({ ...old, draft: q }))) }
    catch (e) { if (!stopped.current) { const q = (e as { quota?: AiQuota | null })?.quota; if (q) setQuota(old => ({ ...old, draft: q })); setRun({ kind: 'failed', text: buffer, error: e }) } return }
    finally { abort.current = null }
    if (stopped.current) return
    const end = terminal as AiStreamEvent | null
    if (end?.type === 'cancelled') { setRun({ kind: 'stopped', text: buffer }); return }
    if (end?.type === 'error') { setRun({ kind: 'failed', text: buffer, error: end.code }); return }
    if (end?.type !== 'completed') { setRun({ kind: 'failed', text: buffer, error: new TypeError('stream ended without a terminal event') }); return }
    const sha = await sha256Hex(buffer)
    if (!end.validated || sha !== end.contentSha256) { setRun({ kind: 'failed', text: buffer, error: 'AI_STREAM_INTEGRITY_FAILED' }); return }
    setCompleted({ generationId: end.generationId, content: buffer, sha }); setRun({ kind: 'idle' })
  }

  const quotaLine = (name: 'quotaOutline' | 'quotaDraft', q: AiQuota | null) => <span className="text-xs text-muted-foreground">{t(name, { value: q ? t('quota', { remaining: q.remaining, limit: q.limit ?? '—' }) : '—' })}</span>
  const draftOut = quota.draft?.remaining === 0
  const preview = (text: string, name: string) => <div role="region" aria-label={name} tabIndex={0} className="max-h-72 overflow-y-auto overscroll-contain rounded-lg border border-border bg-muted/40 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"><pre className="m-0 font-sans text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</pre></div>
  const done = run.kind === 'streaming' ? Math.min((run.text.match(/^## /gm) ?? []).length, run.total) : 0
  const locked = busy || streaming

  return <Sheet open={open} onOpenChange={next => { if (!next) close() }}>
    <SheetContent side={isMobile ? 'bottom' : 'right'} closeLabel={c('close')} className={`gap-0 ${isMobile ? 'h-svh max-h-svh' : 'w-full sm:max-w-[720px]'}`}>
      <SheetHeader className="border-b border-border p-4 pr-14"><SheetTitle className="inline-flex items-center gap-2"><Sparkles aria-hidden className="size-4" />{c('aiSheetTitle')}</SheetTitle><p className="text-xs text-muted-foreground">{c('aiNote')}</p></SheetHeader>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-4">
        {error && <div role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">{error}</div>}
        <section className="flex flex-col gap-3" aria-label={t('step1')}>
          <h3 className="font-semibold">{t('step1')}</h3>
          <div className="flex flex-col gap-2"><Label htmlFor="ai-lesson-title" className={label}>{t('titleField')}</Label><Input id="ai-lesson-title" value={form.title} maxLength={255} readOnly={locked} className={touch} onChange={e => setField('title', e.target.value)} /></div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between gap-2"><Label htmlFor="ai-lesson-idea" className={label}>{t('idea')} *</Label><span className="text-xs tabular-nums text-muted-foreground">{form.idea.length}/4000</span></div>
            <Textarea id="ai-lesson-idea" rows={4} maxLength={4000} readOnly={locked} placeholder={t('ideaPlaceholder')} value={form.idea} onChange={e => setField('idea', e.target.value)} />
          </div>
          <div role="radiogroup" aria-label={t('length')} className="flex flex-wrap gap-2">
            {LENGTHS.map(length => <Button key={length} type="button" role="radio" aria-checked={form.length === length} variant={form.length === length ? 'default' : 'outline'} size="sm" disabled={locked} className={touch} onClick={() => setField('length', length)}>{t(length)}</Button>)}
          </div>
          <div className="flex flex-col gap-2"><Label htmlFor="ai-lesson-audience" className={label}>{t('audience')} *</Label><Input id="ai-lesson-audience" value={form.targetAudience} maxLength={200} readOnly={locked} placeholder={t('audiencePlaceholder')} className={touch} onChange={e => setField('targetAudience', e.target.value)} /></div>
          <div className="flex flex-wrap items-center justify-end gap-3">{quotaLine('quotaOutline', quota.outline)}
            <Button className={touch} disabled={!formValid || locked || quota.outline?.remaining === 0} onClick={() => void generateOutline()}>{busy && <Loader2 className="animate-spin" />}{busy ? t('generating') : outline ? t('otherOutline') : t('generateOutline')}</Button></div>
        </section>
        {outline && <section className="flex flex-col gap-3" aria-label={t('step2')}>
          <h3 className="font-semibold">{t('step2')}</h3>
          <AiOutlineEditor value={outline} tags={[]} onChange={next => { setOutline(next); setCompleted(null) }} showErrors={showErrors} disabled={locked} language={language} />
        </section>}
        {streaming && <section className="flex flex-col gap-2"><p role="status" className="inline-flex items-center gap-2 text-sm"><Loader2 aria-hidden className="size-4 animate-spin" />{t('progress', { done, total: run.total, seconds: 120 })}</p>{preview(run.text, t('preview'))}</section>}
        {(run.kind === 'stopped' || run.kind === 'failed') && <section className="flex flex-col gap-2">
          <p role={run.kind === 'failed' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${run.kind === 'failed' ? 'border-border bg-tone-rose-bg text-danger' : 'border-tone-slate-border bg-tone-slate-bg text-tone-slate-fg'}`}>{run.kind === 'failed' ? aiErrorText(run.error, language) : t('stopped')}</p>
          {run.text && <details className="text-sm"><summary className={`cursor-pointer text-muted-foreground ${touch}`}>{t('partial')}</summary>{preview(run.text, t('partial'))}</details>}
        </section>}
        {completed && !streaming && <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2"><h3 className="font-semibold">{t('completed')}</h3><Badge tone="green"><CheckCircle2 aria-hidden />{t('verified')}</Badge></div>
          {preview(completed.content, t('preview'))}
        </section>}
      </div>
      {outline && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border bg-background p-4">
        <span className="mr-auto">{quotaLine('quotaDraft', quota.draft)}</span>
        {streaming ? <Button variant="destructive" className="min-h-11 min-w-11" onClick={() => stop()}><Square />{t('stop')}</Button>
          : completed ? <>
            <Button variant="outline" className={touch} disabled={busy || draftOut} onClick={() => void writeDraft()}><RefreshCw />{t('regenerate')}</Button>
            <Button className={touch} onClick={() => onUse({ title: outline.title.trim(), summary: outline.summary.trim(), content: completed.content, generationId: completed.generationId })}>{c('useDraft')}</Button></>
            : <Button className={touch} disabled={busy || draftOut} onClick={() => void writeDraft()}><Sparkles />{t('write')}</Button>}
      </div>}
    </SheetContent>
  </Sheet>
}
