import { useEffect, useId, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { TagPicker } from '../../../components/TagPicker'
import { MarkdownContent } from '../../../components/MarkdownContent'
import { courseErrorText, courseText } from '../../../data/courseI18n'
import { authorCourses, courseChangedFields } from '../../../services/courseService'
import { imageSources } from '../../../services/articleService'
import { fieldLabel } from '../AuthorBlogsPage'
import { MarkdownComposer } from './MarkdownComposer'
import type { ArticleOption } from '../../../types/articles'
import type { AuthorCourse, CourseFields, CourseLevel } from '../../../types/courses'
import type { Language } from '../../../types/preferences'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const LEVELS: CourseLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']
const EMPTY: CourseFields = { title: '', summary: '', description: '', level: 'BEGINNER', topicId: '', tagIds: [], coverImageUrl: null }
const fieldsOf = (c: AuthorCourse): CourseFields => ({ title: c.title, summary: c.summary ?? '', description: c.description ?? '', level: c.level, topicId: c.topic.id, tagIds: c.tags.map(tag => tag.id), coverImageUrl: c.coverImageUrl })
type Key = 'title' | 'topicId'

/** What the editor shell needs from the active panel: is it dirty, and can it save itself (used before leaving the item). */
export type Guard = { dirty: boolean; save: () => Promise<boolean> }

type Props = {
  language: Language; course: AuthorCourse | null; options: { topics: ArticleOption[]; tags: ArticleOption[] }; readOnly: boolean; busy: boolean
  /** Existing course: PATCH the diff. New course: create with the whole form. Resolves false on failure (the shell shows the error). */
  onSave: (fields: Partial<CourseFields>) => Promise<boolean>; guard: MutableRefObject<Guard | null>; error?: string; onUploading: (uploading: boolean) => void
}

export function CourseInfoPanel({ language, course, options, readOnly, busy, onSave, guard, error, onUploading }: Props) {
  const t = courseText(language)
  const uid = useId()
  const [form, setForm] = useState<CourseFields>(course ? fieldsOf(course) : EMPTY)
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({})
  const [trusted, setTrusted] = useState<Set<string>>(() => new Set(course ? [...imageSources(course.description ?? ''), ...(course.coverImageUrl ? [course.coverImageUrl] : [])].filter(url => !course.imageIssues.some(i => i.source === url)) : []))
  const [message, setMessage] = useState('')
  const cover = useRef<HTMLInputElement>(null)
  const [uploading, setUploadingState] = useState(false)
  const setUploading = (next: boolean) => { setUploadingState(next); onUploading(next) }
  const locked = readOnly || busy || uploading
  const diff = courseChangedFields(form, course)
  const dirty = Object.keys(diff).length > 0 && (course !== null || JSON.stringify(form) !== JSON.stringify(EMPTY))
  const set = <K extends keyof CourseFields>(key: K, value: CourseFields[K]) => { setForm(old => ({ ...old, [key]: value })); setErrors(old => ({ ...old, [key]: undefined })) }

  const save = async () => {
    if (uploading) return false
    const next: Partial<Record<Key, string>> = {}
    if (!form.title.trim()) next.title = t('titleRequired')
    if (!form.topicId) next.topicId = t('topicRequired')
    setErrors(next)
    if (Object.keys(next).length) return false
    if (course && !dirty) return true
    return onSave(course ? diff : form)
  }
  useEffect(() => { guard.current = { dirty: dirty && !readOnly, save } })

  const uploadCover = async (file: File) => {
    if (!course) return
    setMessage('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setMessage(t('fileType')); return }
    if (file.size > 5 * 1024 * 1024) { setMessage(t('tooLarge')); return }
    setUploading(true)
    try { const { url } = await authorCourses.uploadCourseImage(course.id, file, crypto.randomUUID()); setTrusted(old => new Set(old).add(url)); set('coverImageUrl', url) }
    catch (e) { setMessage(courseErrorText(e, language, t('loadError'))) }
    finally { setUploading(false) }
  }
  const allowed = (src: string) => trusted.has(src) && src.startsWith('https://res.cloudinary.com/')
  const topics = course && !options.topics.some(o => o.id === course.topic.id) ? [course.topic, ...options.topics] : options.topics
  const tags = [...options.tags, ...(course?.tags.filter(tag => !options.tags.some(o => o.id === tag.id)) ?? [])]
  const describe = (key: Key) => errors[key] ? { 'aria-invalid': true, 'aria-describedby': `${uid}-${key}-error` } : {}
  const fieldError = (key: Key) => errors[key] && <p id={`${uid}-${key}-error`} className="text-xs text-danger">{errors[key]}</p>
  const preview = <section role="region" aria-label={t('preview')} tabIndex={0} className="flex min-w-0 flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-card p-6 lg:max-h-[calc(45vh+4rem)]">
    {form.coverImageUrl && allowed(form.coverImageUrl) && <img src={form.coverImageUrl} alt="" className="aspect-video w-full rounded-lg border border-border object-cover" />}
    <h2 className="text-2xl leading-tight font-bold [overflow-wrap:anywhere]">{form.title.trim() || t('untitled')}</h2>
    {form.summary.trim() && <p className="border-l-4 border-primary pl-4 text-muted-foreground [overflow-wrap:anywhere]">{form.summary}</p>}
    <MarkdownContent content={form.description} imageAllowed={allowed} imagePlaceholder={t('imagePlaceholder')} />
  </section>

  return <div className="flex flex-col gap-5">
    <Card className="gap-0 rounded-2xl py-0">
      <h2 className="border-b border-border px-6 py-4 font-semibold">{t('courseInfo')}</h2>
      <div className="grid gap-4 p-6 md:grid-cols-2">
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor={`${uid}-title`} className={fieldLabel}>{t('titleField')} *</Label>
          <Input id={`${uid}-title`} value={form.title} maxLength={255} readOnly={locked} className={touch} onChange={e => set('title', e.target.value)} {...describe('title')} />
          {fieldError('title')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-topic`} className={fieldLabel}>{t('topic')} *</Label>
          <NativeSelect id={`${uid}-topic`} value={form.topicId} disabled={locked} className={touch} onChange={e => set('topicId', e.target.value)} {...describe('topicId')}>
            <NativeSelectOption value="">{t('chooseTopic')}</NativeSelectOption>
            {topics.map(o => <NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}
          </NativeSelect>
          {fieldError('topicId')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-level`} className={fieldLabel}>{t('level')}</Label>
          <NativeSelect id={`${uid}-level`} value={form.level} disabled={locked} className={touch} onChange={e => set('level', e.target.value as CourseLevel)}>
            {LEVELS.map(level => <NativeSelectOption key={level} value={level}>{t(level)}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="md:col-span-2"><TagPicker language={language} options={tags} selected={form.tagIds} disabled={locked} onChange={ids => set('tagIds', ids)} /></div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <div className="flex justify-between gap-2"><Label htmlFor={`${uid}-summary`} className={fieldLabel}>{t('summary')}</Label><span className="text-xs tabular-nums text-muted-foreground">{form.summary.length}/500</span></div>
          <Textarea id={`${uid}-summary`} rows={2} maxLength={500} readOnly={locked} className="max-h-32 overflow-y-auto" value={form.summary} onChange={e => set('summary', e.target.value)} />
        </div>
        {course && <div className="flex flex-col gap-2 md:col-span-2">
          <span className={fieldLabel}>{t('cover')}</span>
          <div className="flex flex-wrap items-center gap-3">
            {form.coverImageUrl && allowed(form.coverImageUrl) && <img src={form.coverImageUrl} alt="" className="h-16 w-28 rounded-md border border-border object-cover" />}
            <input ref={cover} type="file" className="sr-only" tabIndex={-1} aria-label={t('coverFile')} accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void uploadCover(file) }} />
            <Button type="button" size="sm" variant="outline" className={touch} disabled={locked} onClick={() => cover.current?.click()}><ImagePlus />{t('uploadCover')}</Button>
            {form.coverImageUrl && <Button type="button" size="sm" variant="ghost" className={touch} disabled={locked} onClick={() => set('coverImageUrl', null)}><Trash2 />{t('removeCover')}</Button>}
          </div>
          {message && <p role="alert" className="text-sm text-danger">{message}</p>}
        </div>}
        {!course && <p className="text-sm text-muted-foreground md:col-span-2"><span aria-hidden>ⓘ </span>{t('createHint')}</p>}
        {error && <p role="alert" className="text-sm text-danger md:col-span-2">{error}</p>}
        <div className="flex justify-end md:col-span-2">
          {!readOnly && <Button className={touch} disabled={busy || uploading} onClick={() => void save()}>{course ? t('save') : t('create')}</Button>}
        </div>
      </div>
    </Card>
    {course && <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-2">
        <span className={fieldLabel}>{t('description')}</span>
        <MarkdownComposer language={language} label={t('description')} value={form.description} disabled={locked} onBusy={setUploading} onChange={next => set('description', next)}
          upload={async file => (await authorCourses.uploadCourseImage(course.id, file, crypto.randomUUID())).url} onUploaded={url => setTrusted(old => new Set(old).add(url))} />
      </div>
      {preview}
    </div>}
  </div>
}
