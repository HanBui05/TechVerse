import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { RefreshCw, Sparkles, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { MarkdownContent } from '../../../components/MarkdownContent'
import { courseErrorText, courseText } from '../../../data/courseI18n'
import { ApiError } from '../../../services/api/client'
import { imageSources } from '../../../services/articleService'
import { authorCourses, lessonChangedFields, videoLink, youtubeId } from '../../../services/courseService'
import { fieldLabel } from '../AuthorBlogsPage'
import { CourseAiSheet, type AiLessonDraft } from './CourseAiSheet'
import { MarkdownComposer } from './MarkdownComposer'
import type { Guard } from './CourseInfoPanel'
import type { AuthorCourse, Lesson, LessonFields, LessonWrite } from '../../../types/courses'
import type { Language } from '../../../types/preferences'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const EMPTY: LessonFields = { title: '', summary: '', content: '', videoUrl: '', preview: false }
const fieldsOf = (l: Lesson): LessonFields => ({ title: l.title, summary: l.summary ?? '', content: l.content ?? '', videoUrl: l.video ? videoLink(l.video.videoId) : '', preview: l.preview })
type Key = 'title' | 'video' | 'content'

type Props = {
  language: Language; course: AuthorCourse; lessonId: string | null; chapterId: string; chapterNumber: number; readOnly: boolean; busy: boolean
  guard: MutableRefObject<Guard | null>; onUploading: (uploading: boolean) => void
  /** The lesson was created/updated: the shell reloads the tree (and selects a created lesson). */
  onSaved: (lesson: Lesson, created: boolean) => Promise<void>
}

export function LessonPanel({ language, course, lessonId, chapterId, chapterNumber, readOnly, busy, guard, onSaved, onUploading }: Props) {
  const t = courseText(language)
  const uid = useId()
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(lessonId ? 'loading' : 'ready')
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState<LessonFields>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'preview' | 'published'>('preview')
  const [published, setPublished] = useState<Lesson | null>(null)
  const [trusted, setTrusted] = useState<Set<string>>(() => new Set())
  const [aiOpen, setAiOpen] = useState(false)
  const [aiDraft, setAiDraft] = useState<{ id: string; content: string } | null>(null)
  const [pendingDraft, setPendingDraft] = useState<AiLessonDraft | null>(null)
  const createKey = useRef<{ key: string; body: string } | null>(null)
  const inLive = Boolean(lessonId && course.publishedVersion?.chapters.some(c => c.lessons.some(l => l.id === lessonId)))
  const [uploading, setUploadingState] = useState(false)
  const setUploading = (next: boolean) => { setUploadingState(next); onUploading(next) }
  const locked = readOnly || busy || saving || uploading

  const load = useCallback(async () => {
    if (!lessonId) return
    setState('loading'); setLoadError('')
    try {
      const next = await authorCourses.lesson(course.id, lessonId)
      setLesson(next); setForm(fieldsOf(next))
      const flagged = new Set(next.imageIssues.map(issue => issue.source))
      setTrusted(new Set(imageSources(next.content ?? '').filter(url => !flagged.has(url))))
      setState('ready')
    } catch (e) { setLoadError(courseErrorText(e, language, t('lessonError'))); setState('error') }
  }, [course.id, lessonId, language])
  useEffect(() => { void load() }, [load])
  // The live tab reads the snapshot of the published version on demand.
  useEffect(() => {
    if (view !== 'published' || !lessonId || !course.publishedVersion || published) return
    authorCourses.lesson(course.id, lessonId, course.publishedVersion.id).then(setPublished, () => setView('preview'))
  }, [view, lessonId, course.id, course.publishedVersion, published])

  const set = <K extends keyof LessonFields>(key: K, value: LessonFields[K]) => { setForm(old => ({ ...old, [key]: value })); setErrors({}); setError('') }
  const diff = lesson ? lessonChangedFields(form, lesson) : null
  const dirty = diff ? Object.keys(diff).length > 0 : JSON.stringify(form) !== JSON.stringify(EMPTY)

  const save = async (): Promise<boolean> => {
    if (uploading) return false
    const next: Partial<Record<Key, string>> = {}
    if (!form.title.trim()) next.title = t('titleRequired')
    if (!form.videoUrl.trim() && !form.content.trim()) next.content = t('needVideoOrContent')
    setErrors(next); setError('')
    if (Object.keys(next).length) return false
    if (lesson && !dirty) return true
    const ai = aiDraft && aiDraft.content === form.content ? { aiGenerationId: aiDraft.id } : {}
    setSaving(true)
    try {
      if (lesson) {
        const saved = await authorCourses.updateLesson(course.id, lesson.id, { ...diff, ...ai })
        setLesson(saved) // new diff baseline: editing back to the old value must still be sent
        await onSaved(saved, false)
      } else {
        const body: LessonWrite = { title: form.title, preview: form.preview, ...(form.summary.trim() ? { summary: form.summary } : {}), ...(form.content.trim() ? { content: form.content } : {}), ...(form.videoUrl.trim() ? { videoUrl: form.videoUrl.trim() } : {}), ...ai }
        const json = JSON.stringify(body)
        // Same key only for a byte-identical retry; a changed body needs a fresh key or the server answers COURSE_KEY_CONFLICT.
        if (createKey.current?.body !== json) createKey.current = { key: crypto.randomUUID(), body: json }
        const saved = await authorCourses.createLesson(course.id, chapterId, body, createKey.current.key)
        await onSaved(saved, true)
      }
      setAiDraft(null)
      return true
    } catch (e) {
      const text = courseErrorText(e, language, t('loadError'))
      const code = e instanceof ApiError ? e.code : undefined
      if (code === 'LESSON_VIDEO_INVALID') setErrors({ video: text })
      else if (code === 'LESSON_CONTENT_REQUIRED') setErrors({ content: text })
      else setError(text)
      return false
    } finally { setSaving(false) }
  }
  useEffect(() => { guard.current = { dirty: dirty && !readOnly && state === 'ready', save } })

  const applyDraft = (draft: AiLessonDraft) => {
    setForm(old => ({ ...old, title: draft.title, summary: draft.summary, content: draft.content }))
    setAiDraft({ id: draft.generationId, content: draft.content }); setErrors({}); setError(''); setAiOpen(false); setPendingDraft(null)
  }
  const useDraft = (draft: AiLessonDraft) => form.content.trim() ? setPendingDraft(draft) : applyDraft(draft)

  if (state === 'loading') return <div aria-busy="true" aria-label={t('lessonLoading')} className="flex flex-col gap-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>
  if (state === 'error') return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">{loadError}<Button size="sm" variant="outline" className={touch} onClick={() => void load()}><RefreshCw />{t('retry')}</Button></div>

  const videoId = youtubeId(form.videoUrl)
  const allowed = (src: string) => trusted.has(src) && src.startsWith('https://res.cloudinary.com/')
  const showing = view === 'published' && published ? published : null
  const describe = (key: Key) => errors[key] ? { 'aria-invalid': true, 'aria-describedby': `${uid}-${key}-error` } : {}
  const fieldError = (key: Key) => errors[key] && <p id={`${uid}-${key}-error`} role="alert" className="text-xs text-danger">{errors[key]}</p>

  return <div className="flex flex-col gap-5">
    <Card className="gap-0 rounded-2xl py-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-6 py-4"><h2 className="font-semibold">{t('lessonOf', { n: chapterNumber })}</h2>{lesson?.aiAssisted && <Badge tone="blue"><Sparkles aria-hidden />{t('aiBadge')}</Badge>}</div>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-title`} className={fieldLabel}>{t('lessonTitle')} *</Label>
          <Input id={`${uid}-title`} value={form.title} maxLength={255} readOnly={locked} className={touch} onChange={e => set('title', e.target.value)} {...describe('title')} />
          {fieldError('title')}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between gap-2"><Label htmlFor={`${uid}-summary`} className={fieldLabel}>{t('lessonSummary')}</Label><span className="text-xs tabular-nums text-muted-foreground">{form.summary.length}/500</span></div>
          <Textarea id={`${uid}-summary`} rows={2} maxLength={500} readOnly={locked} className="max-h-32 overflow-y-auto" value={form.summary} onChange={e => set('summary', e.target.value)} />
        </div>
        <div className="flex items-start gap-3">
          <Checkbox id={`${uid}-preview`} checked={form.preview} disabled={locked} className="mt-1" onCheckedChange={checked => set('preview', checked === true)} />
          <div className="flex flex-col gap-0.5"><Label htmlFor={`${uid}-preview`}>{t('previewLesson')}</Label><span className="text-xs text-muted-foreground"><span aria-hidden>ⓘ </span>{t('previewHelp')}</span></div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-video`} className={fieldLabel}>{t('video')}</Label>
          <div className="flex flex-wrap gap-2">
            <Input id={`${uid}-video`} type="url" inputMode="url" value={form.videoUrl} maxLength={2048} readOnly={locked} placeholder="https://youtu.be/…" className={`min-w-0 flex-1 ${touch}`} onChange={e => set('videoUrl', e.target.value)} {...describe('video')} />
            {form.videoUrl && <Button type="button" variant="outline" className={touch} disabled={locked} onClick={() => set('videoUrl', '')}><X />{t('removeVideo')}</Button>}
          </div>
          {fieldError('video')}
          <p className="text-xs text-muted-foreground"><span aria-hidden>ⓘ </span>{t('videoHelp')}</p>
          {videoId && <div className="aspect-video w-full max-w-xl overflow-hidden rounded-lg border border-border bg-muted">
            <iframe title={t('videoPreviewTitle')} src={`https://www.youtube-nocookie.com/embed/${videoId}`} className="size-full" loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          </div>}
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {!readOnly && <div className="flex justify-end"><Button className={touch} disabled={locked} onClick={() => void save()}>{t('save')}</Button></div>}
      </div>
    </Card>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-2">
        <span className={fieldLabel}>{t('content')}</span>
        <MarkdownComposer language={language} label={t('contentField')} value={form.content} disabled={locked} onBusy={setUploading} onChange={next => set('content', next)} invalid={Boolean(errors.content)} describedBy={errors.content ? `${uid}-content-error` : undefined}
          upload={lesson ? async file => (await authorCourses.uploadLessonImage(course.id, lesson.id, file, crypto.randomUUID())).url : null} onUploaded={url => setTrusted(old => new Set(old).add(url))}
          extra={!readOnly && <Button type="button" size="sm" variant="secondary" className={touch} disabled={locked} onClick={() => setAiOpen(true)}><Sparkles />{t('aiCompose')}</Button>} />
        {fieldError('content')}
        {(lesson?.imageIssues.length ?? 0) > 0 && <p className="text-xs text-tone-amber-fg">{t('imagesIssues', { n: lesson!.imageIssues.length })} — {t('imagesHelp')}</p>}
      </div>
      <section role="region" aria-label={showing ? t('published', { n: course.publishedVersion!.versionNumber }) : t('preview')} tabIndex={0} className="flex min-w-0 flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-card p-6 lg:max-h-[calc(45vh+4rem)]">
        {inLive && <div role="group" aria-label={t('previewMode')} className="flex gap-2">
          {(['preview', 'published'] as const).map(mode => <Button key={mode} size="sm" variant={view === mode ? 'default' : 'outline'} aria-pressed={view === mode} className={`rounded-full ${touch}`} onClick={() => setView(mode)}>
            {mode === 'preview' ? t('preview') : t('published', { n: course.publishedVersion!.versionNumber })}
          </Button>)}
        </div>}
        <h3 className="text-xl font-bold [overflow-wrap:anywhere]">{(showing ?? form).title.trim() || t('untitled')}</h3>
        {(showing ? showing.summary : form.summary)?.trim() && <p className="text-muted-foreground [overflow-wrap:anywhere]">{showing ? showing.summary : form.summary}</p>}
        <MarkdownContent content={showing ? showing.content ?? '' : form.content} imageAllowed={allowed} imagePlaceholder={t('imagePlaceholder')} />
      </section>
    </div>
    <CourseAiSheet language={language} open={aiOpen} courseId={course.id} lessonKey={lessonId ?? `new:${chapterId}`} title={form.title} summary={form.summary} onClose={() => setAiOpen(false)} onUse={useDraft} />
    <AlertDialog open={pendingDraft !== null} onOpenChange={open => { if (!open) setPendingDraft(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t('replaceContent')}</AlertDialogTitle><AlertDialogDescription>{t('replaceContentText')}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => pendingDraft && applyDraft(pendingDraft)}>{t('replace')}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
}
