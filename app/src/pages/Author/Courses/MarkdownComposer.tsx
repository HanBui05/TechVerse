import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { FileUp, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { courseErrorText, courseText } from '../../../data/courseI18n'
import { ApiError } from '../../../services/api/client'
import { authorCourses } from '../../../services/courseService'
import type { ImageIssue } from '../../../types/articles'
import type { Language } from '../../../types/preferences'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE = 5 * 1024 * 1024
const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'

type Props = {
  language: Language; value: string; onChange: (next: string) => void; disabled?: boolean
  /** Uploads one image and returns its managed URL; null while the owner has no ID yet (new lesson). */
  upload: ((file: File) => Promise<string>) | null
  onImported?: (issues: ImageIssue[]) => void; onUploaded?: (url: string) => void
  /** Extra toolbar buttons (AI compose). */
  onBusy?: (busy: boolean) => void; extra?: ReactNode; invalid?: boolean; describedBy?: string; label: string
}

/** Markdown source box + import + insert-image, shared by the course description and the lesson content. */
export function MarkdownComposer({ language, value, onChange, disabled, upload, onImported, onUploaded, onBusy, extra, invalid, describedBy, label }: Props) {
  const t = courseText(language)
  const uid = useId()
  const area = useRef<HTMLTextAreaElement>(null)
  const files = useRef<Record<string, HTMLInputElement | null>>({})
  const latest = useRef(value)
  latest.current = value
  const [busy, setBusyState] = useState(false)
  const setBusy = (next: boolean) => { setBusyState(next); onBusy?.(next) }
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')

  const importFile = async (file: File) => {
    setMessage(''); setNotice('')
    const local = !/\.(md|txt)$/i.test(file.name) ? new ApiError('', 415, 'COURSE_FILE_UNSUPPORTED') : file.size > 1024 * 1024 ? new ApiError('', 413, 'COURSE_FILE_TOO_LARGE') : null
    if (local) { setMessage(courseErrorText(local, language, '')); return }
    setBusy(true)
    try {
      const result = await authorCourses.importFile(file)
      onChange(result.content); onImported?.(result.imageIssues); setNotice(t('imported'))
    } catch (e) { setMessage(courseErrorText(e, language, t('loadError'))) }
    finally { setBusy(false) }
  }
  const insertImage = async (file: File) => {
    setMessage(''); setNotice('')
    if (!IMAGE_TYPES.includes(file.type)) { setMessage(t('fileType')); return }
    if (file.size > MAX_IMAGE) { setMessage(t('tooLarge')); return }
    if (!upload) return
    setBusy(true)
    try {
      const url = await upload(file)
      onUploaded?.(url)
      // Typing continues during the upload: insert into the current text, not the one captured at the start.
      const current = latest.current
      const at = Math.min(area.current?.selectionStart ?? current.length, current.length)
      onChange(`${current.slice(0, at)}![](${url})${current.slice(at)}`)
    } catch (e) { setMessage(courseErrorText(e, language, t('loadError'))) }
    finally { setBusy(false) }
  }
  const input = (name: string, aria: string, onFile: (file: File) => void, accept: string) =>
    <input ref={el => { files.current[name] = el }} type="file" className="sr-only" tabIndex={-1} aria-label={aria} accept={accept}
      onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) onFile(file) }} />

  return <section className="flex min-w-0 flex-col gap-3">
    <div className="flex flex-wrap items-center gap-2">
      {input('import', t('importInput'), file => void importFile(file), '.md,.txt,text/markdown,text/plain')}
      <Button type="button" size="sm" variant="outline" className={touch} disabled={disabled || busy} onClick={() => files.current.import?.click()}><FileUp />{t('importFile')}</Button>
      {input('insert', t('insertInput'), file => void insertImage(file), IMAGE_TYPES.join(','))}
      <Button type="button" size="sm" variant="outline" className={touch} disabled={disabled || busy || !upload} onClick={() => files.current.insert?.click()}><ImagePlus />{t('insertImage')}</Button>
      {extra}
      {!upload && <span className="text-xs text-muted-foreground">{t('saveLessonFirst')}</span>}
    </div>
    {busy && <p role="status" className="text-xs text-muted-foreground">{t('uploading')}</p>}
    {notice && <p role="status" className="text-xs text-tone-green-fg">{notice}</p>}
    {message && <p role="alert" className="text-sm text-danger">{message}</p>}
    <Label htmlFor={`${uid}-md`} className="sr-only">{label}</Label>
    <Textarea id={`${uid}-md`} ref={area} readOnly={disabled} spellCheck={false} value={value} onChange={e => onChange(e.target.value)} aria-invalid={invalid || undefined} aria-describedby={describedBy}
      className="h-[45vh] max-h-[70vh] resize-y overflow-y-auto font-mono text-sm leading-relaxed [field-sizing:fixed]" />
  </section>
}
