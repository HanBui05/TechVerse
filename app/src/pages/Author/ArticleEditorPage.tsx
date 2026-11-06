import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, FileUp, ImagePlus, Images, Info, RefreshCw, Send, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '../../components/EmptyState'
import { TagPicker } from '../../components/TagPicker'
import { ArticlePreview } from '../../components/articles/ArticlePreview'
import { ArticleStatusBadges } from '../../components/articles/ArticleStatusBadges'
import { ArticleActionMenu, fieldLabel, useArticleActions } from './AuthorBlogsPage'
import { ApiError } from '../../services/api/client'
import { articleErrorText, articleText } from '../../data/articleI18n'
import { aiText } from '../../data/aiAssistI18n'
import { authorActions, authorArticles, changedFields, countImages, imageSources, isManagedImage, removeImage, replaceImage, resolveIssue } from '../../services/articleService'
import type { ArticleFields, ArticleOption, AuthorArticle, ImageIssue } from '../../types/articles'
import type { Language } from '../../types/preferences'

const EMPTY: ArticleFields = { title: '', topicId: '', tagIds: [], summary: '', content: '', coverImageUrl: null }
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE = 5 * 1024 * 1024
const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const scroll = 'overflow-y-auto overscroll-contain outline-none [scrollbar-width:thin] focus-visible:ring-2 focus-visible:ring-ring'
type Row = { error?: string; uploading?: boolean; file?: File; uploadKey?: string }
type FieldKey = 'title' | 'topicId' | 'summary' | 'content'
const issueKey = (issue: ImageIssue) => `${issue.source}\u0000${issue.occurrence}`
const fieldsOf = (a: AuthorArticle): ArticleFields => ({ title: a.title, topicId: a.topic.id, tagIds: a.tags.map(tag => tag.id), summary: a.summary ?? '', content: a.content ?? '', coverImageUrl: a.coverImageUrl })

export function ArticleEditorPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = articleText(language)
  const { id } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const uid = useId()
  const [article, setArticle] = useState<AuthorArticle | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'notFound' | 'error'>(id ? 'loading' : 'ready')
  const [form, setForm] = useState<ArticleFields>(EMPTY)
  const [issues, setIssues] = useState<ImageIssue[]>([])
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [options, setOptions] = useState<{ topics: ArticleOption[]; tags: ArticleOption[] }>({ topics: [], tags: [] })
  const [optionsError, setOptionsError] = useState('')
  const [trusted, setTrusted] = useState<Set<string>>(() => new Set())
  const trust = (urls: (string | null | undefined)[]) => setTrusted(old => new Set([...old, ...urls.filter((url): url is string => Boolean(url))]))
  const [busy, setBusy] = useState(false)
  const inflight = useRef(0)
  const begin = () => { if (inflight.current) return false; inflight.current += 1; setBusy(true); return true }
  const end = () => { inflight.current -= 1; if (!inflight.current) setBusy(false) }
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [panelMessage, setPanelMessage] = useState('')
  const [contentMessage, setContentMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [metaOpen, setMetaOpen] = useState(!id) // wireframe 2a-2: open for a new article, collapsed for an existing one
  const [view, setView] = useState<'preview' | 'published'>('preview')
  const [mobileTab, setMobileTab] = useState<'compose' | 'preview'>('compose')
  const [issuesSheet, setIssuesSheet] = useState(false)
  const [leaveTo, setLeaveTo] = useState<string | null>(null)
  const [aiBannerClosed, setAiBannerClosed] = useState(false) // tab-only: closing never touches article.aiAssisted
  const createKey = useRef(crypto.randomUUID())
  const loadedId = useRef<string | null>(null)
  const formRef = useRef(form)
  formRef.current = form
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})

  const apply = useCallback((next: AuthorArticle) => {
    loadedId.current = next.id
    setArticle(next); setForm(fieldsOf(next)); setIssues(next.imageIssues); setRows({}); setPanelMessage(''); setFieldErrors({})
    // Preview loads only images the backend vouched for: saved ones it did not list as issues, and the approved snapshot.
    const flagged = new Set(next.imageIssues.map(issue => issue.source))
    const live = next.publishedVersion
    setTrusted(old => new Set([...old, ...[...imageSources(next.content ?? ''), next.coverImageUrl, ...(live ? [...imageSources(live.content), live.coverImageUrl] : [])]
      .filter((url): url is string => Boolean(url) && !flagged.has(url!))]))
  }, [])
  const load = useCallback(async (articleId: string) => {
    setStatus('loading'); setError('')
    try { apply(await authorArticles.detail(articleId)); setStatus('ready') }
    catch (e) { setStatus(e instanceof ApiError && e.status === 404 ? 'notFound' : 'error'); setError(articleErrorText(e, language, t('loadError'))) }
  }, [apply, language])
  // After the first auto-save the URL switches from /new to /:id/edit; that article is already loaded.
  useEffect(() => { if (id && loadedId.current !== id) void load(id) }, [id, load])
  const loadOptions = useCallback(() => {
    setOptionsError('')
    authorArticles.options().then(o => setOptions({ topics: o.topics.content, tags: o.tags.content }), e => setOptionsError(articleErrorText(e, language, t('loadError'))))
  }, [language])
  useEffect(() => { loadOptions() }, [loadOptions])

  const dirty = article ? Object.keys(changedFields(form, article)).length > 0 : JSON.stringify(form) !== JSON.stringify(EMPTY)
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const leave = (to: string) => (e: React.MouseEvent) => { if (dirty) { e.preventDefault(); setLeaveTo(to) } }

  const actions = useArticleActions(language, (action, updated) => {
    if (!updated) { navigate('/author/blogs'); return }
    if (action === 'hide' || action === 'unhide') setArticle(updated)
    else apply(updated)
    setMessage(t('actionDone'))
  })
  const matrix = article ? authorActions(article) : null
  const readOnly = Boolean(matrix?.readOnly)
  // While a write is in flight the form is frozen: its response replaces the form and would drop newer typing.
  const locked = readOnly || busy
  const set = <K extends keyof ArticleFields>(key: K, value: ArticleFields[K]) => { setForm(old => ({ ...old, [key]: value })); setFieldErrors(old => ({ ...old, [key]: undefined })) }
  const canAutoSave = Boolean(form.title.trim() && form.topicId)

  // Uploads need an article ID: a new article is auto-saved once (same Idempotency-Key on retry).
  const ensureArticle = async () => {
    if (article) return article
    if (!canAutoSave) return null
    const saved = await authorArticles.create({ action: 'SAVE', ...formRef.current }, createKey.current)
    apply(saved)
    navigate(`/author/blogs/${saved.id}/edit`, { replace: true })
    return saved
  }

  const save = async (action: 'SAVE' | 'SUBMIT') => {
    if (inflight.current || readOnly) return
    const errors: Partial<Record<FieldKey, string>> = {}
    if (!form.title.trim()) errors.title = t('titleRequired')
    if (!form.topicId) errors.topicId = t('topicRequired')
    if (action === 'SUBMIT' && !form.summary.trim()) errors.summary = t('summaryRequired')
    if (action === 'SUBMIT' && !form.content.trim()) errors.content = t('contentRequired')
    setFieldErrors(errors); setError(''); setMessage('')
    if (Object.keys(errors).length) { setMetaOpen(true); return }
    const diff = article ? changedFields(form, article) : form
    if (article && action === 'SAVE' && !Object.keys(diff).length) { setMessage(t('noChanges')); return }
    if (!begin()) return
    try {
      const saved = article ? await authorArticles.update(article.id, { action, ...diff }) : await authorArticles.create({ action, ...form }, createKey.current)
      apply(saved)
      setMessage(t(action === 'SUBMIT' ? 'submitted' : 'saved'))
      if (!article) navigate(`/author/blogs/${saved.id}/edit`, { replace: true })
    } catch (e) {
      if (action === 'SUBMIT' && article && e instanceof ApiError && e.code === 'ARTICLE_IMAGE_INVALID') {
        // The issue list is stale: save the working copy (or reload it) so the backend lists the images again.
        setError(t('imagesPending'))
        try { apply(Object.keys(diff).length ? await authorArticles.update(article.id, { action: 'SAVE', ...diff }) : await authorArticles.detail(article.id)) } catch { /* keep the message above */ }
      } else setError(articleErrorText(e, language, t('loadError')))
    } finally { end() }
  }

  const fileProblem = (file: File) => !IMAGE_TYPES.includes(file.type) ? t('fileType') : file.size > MAX_IMAGE ? t('tooLarge') : ''
  const setRow = (key: string, row: Row) => setRows(old => ({ ...old, [key]: row }))

  // Replace by source+occurrence only if the target still sits where the backend saw it; never rewrite another image.
  const replaceIssue = async (issue: ImageIssue, file: File) => {
    const key = issueKey(issue)
    const problem = fileProblem(file)
    if (problem) { setRow(key, { error: problem }); return }
    if (replaceImage(formRef.current.content, issue, '') === null) { setPanelMessage(t('stale')); return }
    const uploadKey = rows[key]?.file === file ? rows[key].uploadKey! : crypto.randomUUID()
    if (!begin()) return
    setRow(key, { uploading: true, file, uploadKey })
    try {
      const target = await ensureArticle()
      if (!target) { setRow(key, { error: t('saveFirst'), file, uploadKey }); return }
      const { url } = await authorArticles.uploadImage(target.id, file, uploadKey)
      trust([url])
      const next = replaceImage(formRef.current.content, issue, url)
      if (next === null) { setPanelMessage(t('stale')); setRow(key, {}); return }
      setForm(old => ({ ...old, content: next }))
      setIssues(old => resolveIssue(old, issue))
      setRow(key, {})
    } catch (e) { setRow(key, { error: articleErrorText(e, language, t('loadError')), file, uploadKey }) }
    finally { end() }
  }
  const dropIssue = (issue: ImageIssue) => {
    if (inflight.current) return
    const next = removeImage(formRef.current.content, issue)
    if (next === null) { setPanelMessage(t('stale')); return }
    setForm(old => ({ ...old, content: next })); setIssues(old => resolveIssue(old, issue))
  }
  const matchFiles = async (files: File[]) => {
    if (inflight.current) return
    const used = new Set<string>()
    const pairs: [ImageIssue, File][] = []
    const unmatched: string[] = []
    for (const file of files) {
      const issue = issues.find(i => !used.has(issueKey(i)) && i.filename?.toLowerCase() === file.name.toLowerCase())
      if (issue) { used.add(issueKey(issue)); pairs.push([issue, file]) } else unmatched.push(file.name)
    }
    setPanelMessage(unmatched.length ? t('unmatched', { names: unmatched.join(', ') }) : '')
    for (const [issue, file] of pairs) await replaceIssue(issue, file)
  }

  const uploadOther = async (file: File, kind: 'insert' | 'cover') => {
    setContentMessage('')
    const problem = fileProblem(file) || (kind === 'insert' && countImages(form.content) + (form.coverImageUrl ? 1 : 0) >= 50 ? t('tooMany') : '')
    if (problem) { setContentMessage(problem); return }
    if (!begin()) return
    try {
      const target = await ensureArticle()
      if (!target) { setContentMessage(t('saveFirst')); return }
      const { url } = await authorArticles.uploadImage(target.id, file, crypto.randomUUID())
      trust([url])
      if (kind === 'cover') { set('coverImageUrl', url); return }
      const at = editorRef.current?.selectionStart ?? formRef.current.content.length
      const content = formRef.current.content
      set('content', `${content.slice(0, at)}![](${url})${content.slice(at)}`)
    } catch (e) { setContentMessage(articleErrorText(e, language, t('loadError'))) }
    finally { end() }
  }
  const importFile = async (file: File) => {
    setContentMessage('')
    const local = !/\.(md|txt)$/i.test(file.name) ? new ApiError('', 415, 'ARTICLE_FILE_UNSUPPORTED') : file.size > 1024 * 1024 ? new ApiError('', 413, 'ARTICLE_FILE_TOO_LARGE') : null
    if (local) { setContentMessage(articleErrorText(local, language, '')); return }
    if (!begin()) return
    try {
      const result = await authorArticles.importFile(file)
      set('content', result.content); setIssues(result.imageIssues); setRows({}); setPanelMessage('')
      setMessage(t('imported'))
    } catch (e) { setContentMessage(articleErrorText(e, language, t('loadError'))) }
    finally { end() }
  }
  const fileInput = (name: string, label: string, onFiles: (files: File[]) => void, accept = IMAGE_TYPES.join(','), multiple = false) =>
    <input ref={el => { inputs.current[name] = el }} type="file" className="sr-only" tabIndex={-1} aria-label={label} accept={accept} multiple={multiple}
      onChange={e => { const files = [...(e.target.files ?? [])]; e.target.value = ''; if (files.length) onFiles(files) }} />
  const pick = (name: string) => inputs.current[name]?.click()

  if (status === 'loading') return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8" aria-busy="true">
    <Skeleton className="h-8 w-72 max-w-full" /><Skeleton className="h-40 w-full" />
    <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
  </main>
  if (status !== 'ready') return <main className="tw-page mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
    {status === 'notFound'
      ? <EmptyState icon={AlertTriangle} title={t('notFound')} action={<Button asChild className={touch}><Link to="/author/blogs">{t('backToList')}</Link></Button>} />
      : <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">{error}<Button variant="outline" size="sm" className={touch} onClick={() => id && void load(id)}><RefreshCw />{t('retry')}</Button></div>}
  </main>

  const published = article?.publishedVersion ?? null
  const allowed = (src: string) => trusted.has(src) && isManagedImage(src, article?.authorId, article?.id)
  const wf = article?.workflowStatus, pub = article?.publicationStatus
  const banner: [string, ReactNode, ReactNode?] | null = pub === 'REMOVED' ? ['border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg', article?.moderationNote ? t('removedBanner', { note: article.moderationNote }) : t('removedBannerNoNote')]
    : wf === 'PENDING' ? ['border-tone-amber-border bg-tone-amber-bg text-tone-amber-fg', t('pendingBanner'), <Button size="sm" variant="outline" className={touch} disabled={actions.busy} onClick={() => actions.ask('withdraw', article!)}>{t('withdraw')}</Button>]
      : pub === 'HIDDEN' ? ['border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg', t('hiddenBanner')]
        : pub === 'AUTHOR_HIDDEN' ? ['border-tone-slate-border bg-tone-slate-bg text-tone-slate-fg', t('authorHiddenBanner'), <Button size="sm" variant="outline" className={touch} disabled={actions.busy} onClick={() => actions.ask('unhide', article!)}>{t('unhide')}</Button>]
          : wf === 'CHANGES_REQUESTED' ? ['border-tone-sky-border bg-tone-sky-bg text-tone-sky-fg', article?.moderationNote ? t('changesBanner', { note: article.moderationNote }) : t('changesBannerNoNote')]
            : published && wf !== 'PUBLISHED' ? ['border-tone-blue-border bg-tone-blue-bg text-tone-blue-fg', t('liveBanner', { n: published.versionNumber })] : null
  const topics = article && !options.topics.some(o => o.id === article.topic.id) ? [article.topic, ...options.topics] : options.topics
  const tags = [...options.tags, ...(article?.tags.filter(tag => !options.tags.some(o => o.id === tag.id)) ?? [])]
  const submitBlocked = issues.length > 0
  const describe = (key: FieldKey) => fieldErrors[key] ? { 'aria-invalid': true, 'aria-describedby': `${uid}-${key}-error` } : {}
  const fieldError = (key: FieldKey) => fieldErrors[key] && <p id={`${uid}-${key}-error`} className="text-xs text-danger">{fieldErrors[key]}</p>

  const saveButtons = !readOnly && <>
    <Button variant="outline" className={touch} disabled={busy} onClick={() => void save('SAVE')}>{t('saveDraft')}</Button>
    <Button className={touch} disabled={busy || submitBlocked} aria-describedby={submitBlocked ? `${uid}-blocked` : undefined} onClick={() => void save('SUBMIT')}><Send />{t('submit')}</Button>
  </>

  const issuePanel = <div role="region" aria-label={t('issues', { n: issues.length })} className="flex flex-col gap-3">
    <p className="text-xs text-muted-foreground">{t('issuesHelp')}</p>
    <ul className={`m-0 flex max-h-80 list-none flex-col divide-y divide-border p-0 ${scroll}`}>
      {issues.map((issue, i) => {
        const row = rows[issueKey(issue)] ?? {}
        return <li key={issueKey(issue)} className="flex flex-col gap-2 py-2">
          <span className="text-sm [overflow-wrap:anywhere]"><span className="font-medium">{issue.alt ? `“${issue.alt}”` : t('noAlt')}</span> · <code className="text-xs">{issue.source}</code> · <span className="text-muted-foreground">{t('line', { line: issue.line, column: issue.column })}</span></span>
          <div className="flex flex-wrap items-center gap-2">
            {fileInput(`issue-${i}`, t('replaceInput', { n: i + 1 }), files => void replaceIssue(issue, files[0]))}
            <Button size="sm" variant="outline" className={touch} disabled={row.uploading || locked} onClick={() => pick(`issue-${i}`)}><Upload />{t('replace')}</Button>
            <Button size="sm" variant="ghost" className={touch} disabled={row.uploading || locked} onClick={() => dropIssue(issue)}><X />{t('removeImage')}</Button>
            {row.uploading && <span role="status" className="text-xs text-muted-foreground">{t('uploading')}</span>}
            {row.error && <span className="text-xs text-danger">{row.error}</span>}
            {row.error && row.file && <Button size="sm" variant="outline" className={touch} disabled={locked} onClick={() => void replaceIssue(issue, row.file!)}><RefreshCw />{t('retry')}</Button>}
          </div>
        </li>
      })}
    </ul>
    {fileInput('many', t('pickManyInput'), files => void matchFiles(files), IMAGE_TYPES.join(','), true)}
    <Button size="sm" variant="secondary" className={`self-start ${touch}`} disabled={locked} onClick={() => pick('many')}><Images />{t('pickMany')}</Button>
    {panelMessage && <p role="status" className="text-sm text-tone-amber-fg">{panelMessage}</p>}
  </div>

  const metadata = <Card className="gap-0 rounded-2xl py-0">
    <button type="button" aria-expanded={metaOpen} aria-controls={`${uid}-meta`} onClick={() => setMetaOpen(open => !open)} className={`flex w-full items-center justify-between gap-2 rounded-2xl border-0 bg-transparent px-6 py-4 text-left font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring ${touch}`}>
      {t('metadata')}<span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">{metaOpen ? t('collapse') : t('expand')}{metaOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</span>
    </button>
    {metaOpen && <div id={`${uid}-meta`} className="grid gap-4 border-t border-border p-6 md:grid-cols-2">
      <div className="flex flex-col gap-2 md:col-span-2">
        <Label htmlFor={`${uid}-title`} className={fieldLabel}>{t('titleField')}</Label>
        <Input id={`${uid}-title`} value={form.title} maxLength={255} readOnly={locked} className={touch} onChange={e => set('title', e.target.value)} {...describe('title')} />
        {fieldError('title')}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${uid}-topic`} className={fieldLabel}>{t('topic')}</Label>
        <NativeSelect id={`${uid}-topic`} value={form.topicId} disabled={locked} className={touch} onChange={e => set('topicId', e.target.value)} {...describe('topicId')}>
          <NativeSelectOption value="">{t('chooseTopic')}</NativeSelectOption>
          {topics.map(o => <NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}
        </NativeSelect>
        {fieldError('topicId')}
      </div>
      <TagPicker language={language} options={tags} selected={form.tagIds} disabled={locked} onChange={ids => set('tagIds', ids)} />
      <div className="flex flex-col gap-2 md:col-span-2">
        <div className="flex justify-between gap-2"><Label htmlFor={`${uid}-summary`} className={fieldLabel}>{t('summary')}</Label><span className="text-xs tabular-nums text-muted-foreground">{form.summary.length}/500</span></div>
        <Textarea id={`${uid}-summary`} rows={2} maxLength={500} readOnly={locked} className="max-h-32 overflow-y-auto" value={form.summary} onChange={e => set('summary', e.target.value)} {...describe('summary')} />
        {fieldError('summary')}
      </div>
      <div className="flex flex-col gap-2 md:col-span-2">
        <span className={fieldLabel}>{t('cover')}</span>
        <div className="flex flex-wrap items-center gap-3">
          {form.coverImageUrl && allowed(form.coverImageUrl) && <img src={form.coverImageUrl} alt="" className="h-16 w-28 rounded-md border border-border object-cover" />}
          {fileInput('cover', t('coverFile'), files => void uploadOther(files[0], 'cover'))}
          <Button size="sm" variant="outline" className={touch} disabled={busy || readOnly || (!article && !canAutoSave)} onClick={() => pick('cover')}><ImagePlus />{t('uploadCover')}</Button>
          {form.coverImageUrl && <Button size="sm" variant="ghost" className={touch} disabled={locked} onClick={() => set('coverImageUrl', null)}><Trash2 />{t('removeCover')}</Button>}
        </div>
      </div>
    </div>}
  </Card>

  const source = <section className="flex min-w-0 flex-col gap-3">
    <div className="flex flex-wrap items-center gap-2">
      {fileInput('import', t('importInput'), files => void importFile(files[0]), '.md,.txt,text/markdown,text/plain')}
      <Button size="sm" variant="outline" className={touch} disabled={busy || readOnly} onClick={() => pick('import')}><FileUp />{t('importFile')}</Button>
      {fileInput('insert', t('insertInput'), files => void uploadOther(files[0], 'insert'))}
      <Button size="sm" variant="outline" className={touch} disabled={busy || readOnly || (!article && !canAutoSave)} onClick={() => pick('insert')}><ImagePlus />{t('insertImage')}</Button>
      {!article && !canAutoSave && <span className="text-xs text-muted-foreground">{t('saveFirst')}</span>}
    </div>
    {contentMessage && <p role="alert" className="text-sm text-danger">{contentMessage}</p>}
    <Label htmlFor={`${uid}-content`} className="sr-only">{t('content')}</Label>
    <Textarea id={`${uid}-content`} ref={editorRef} readOnly={locked} spellCheck={false} value={form.content} onChange={e => set('content', e.target.value)} {...describe('content')}
      className="h-[60vh] max-h-[75vh] resize-y overflow-y-auto font-mono text-sm leading-relaxed [field-sizing:fixed] lg:h-[70vh]" />
    {fieldError('content')}
  </section>

  const preview = <section role="region" aria-label={view === 'published' && published ? t('published', { n: published.versionNumber }) : t('preview')} tabIndex={0}
    className={`flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-6 lg:h-[calc(70vh+3rem)] ${scroll}`}>
    {published && <div role="group" aria-label={t('previewMode')} className="flex gap-2">
      {(['preview', 'published'] as const).map(mode => <Button key={mode} size="sm" variant={view === mode ? 'default' : 'outline'} aria-pressed={view === mode} className={`rounded-full ${touch}`} onClick={() => setView(mode)}>
        {mode === 'preview' ? t('preview') : t('published', { n: published.versionNumber })}
      </Button>)}
    </div>}
    {view === 'published' && published
      ? <ArticlePreview title={published.title} summary={published.summary ?? ''} topic={published.topic.name} tags={published.tags.map(tag => tag.name)} coverUrl={published.coverImageUrl} content={published.content} imageAllowed={allowed} imagePlaceholder={t('imagePlaceholder')} untitled={t('untitled')} />
      : <ArticlePreview title={form.title} summary={form.summary} topic={topics.find(o => o.id === form.topicId)?.name} tags={form.tagIds.map(tagId => tags.find(o => o.id === tagId)?.name ?? '').filter(Boolean)} coverUrl={form.coverImageUrl} content={form.content} imageAllowed={allowed} imagePlaceholder={t('imagePlaceholder')} untitled={t('untitled')} />}
  </section>

  return <main className={`tw-page mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 ${isMobile && !readOnly ? 'pb-24' : ''}`}>
    <header className="sticky top-16 z-10 -mx-4 md:top-0 flex flex-col gap-2 border-b border-border bg-background/95 px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <Link to="/author/blogs" onClick={leave('/author/blogs')} className={`inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground ${touch}`}><ArrowLeft aria-hidden className="size-4" />{t('back')}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">{!article ? t('newTitle') : readOnly ? t('viewTitle') : t('editTitle')}</h1>
        {article && <ArticleStatusBadges article={article} language={language} />}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {article && <span className="text-xs text-muted-foreground">{t('savedAt', { time: new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { timeStyle: 'short' }).format(new Date(article.updatedAt)) })}</span>}
          {!isMobile && saveButtons}
          {article && <ArticleActionMenu article={article} language={language} onAsk={actions.ask} disabled={actions.busy} />}
        </div>
      </div>
      {submitBlocked && !readOnly && <p id={`${uid}-blocked`} className="text-xs text-tone-amber-fg sm:text-right">{t('submitBlocked', { n: issues.length })}</p>}
    </header>

    {banner && <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${banner[0]}`}><span className="inline-flex items-start gap-2 [overflow-wrap:anywhere]"><Info aria-hidden className="mt-0.5 size-4 shrink-0" />{banner[1]}</span>{banner[2]}</div>}
    {article?.aiAssisted && !aiBannerClosed && <div className="flex items-start justify-between gap-3 rounded-lg border border-tone-blue-border bg-tone-blue-bg px-4 py-3 text-sm text-tone-blue-fg">
      <span className="inline-flex items-start gap-2 [overflow-wrap:anywhere]"><Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" /><span className="flex flex-col gap-0.5"><strong>{aiText(language)('aiBadge')}</strong><span>{aiText(language)('aiBanner')}</span></span></span>
      <Button size="icon" variant="ghost" className={`size-7 shrink-0 ${touch}`} aria-label={aiText(language)('closeBanner')} onClick={() => setAiBannerClosed(true)}><X /></Button>
    </div>}
    {(error || actions.error) && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
      <span>{error || actions.error}</span>
      {article && <Button size="sm" variant="outline" className={touch} onClick={() => void load(article.id)}><RefreshCw />{t('reload')}</Button>}
    </div>}
    {optionsError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
      <span>{optionsError}</span>
      <Button size="sm" variant="outline" className={touch} onClick={loadOptions}><RefreshCw />{t('retry')}</Button>
    </div>}
    {message && <p role="status" className="rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">{message}</p>}

    {isMobile && <div role="group" aria-label={t('mobileView')} className="grid grid-cols-2 gap-2">
      {(['compose', 'preview'] as const).map(tab => <Button key={tab} variant={mobileTab === tab ? 'default' : 'outline'} aria-pressed={mobileTab === tab} className="h-11" onClick={() => setMobileTab(tab)}>{t(tab)}</Button>)}
    </div>}

    {(!isMobile || mobileTab === 'compose') && metadata}
    {issues.length > 0 && (!isMobile || mobileTab === 'compose') && (isMobile
      ? <Button variant="outline" className="h-11 justify-between border-tone-amber-border text-tone-amber-fg" onClick={() => setIssuesSheet(true)}>{t('issuesShort', { n: issues.length })}<ChevronDown className="-rotate-90" /></Button>
      : <Card className="gap-3 rounded-2xl border-tone-amber-border px-6 py-4"><h2 className="inline-flex items-center gap-2 text-sm font-semibold text-tone-amber-fg"><AlertTriangle aria-hidden className="size-4" />{t('issues', { n: issues.length })}</h2>{issuePanel}</Card>)}

    {isMobile
      ? (mobileTab === 'compose' ? source : preview)
      : <div className="grid gap-6 lg:grid-cols-2">{source}{preview}</div>}

    {isMobile && !readOnly && <div className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 gap-2 border-t border-border bg-background p-3">{saveButtons}</div>}

    <Sheet open={isMobile && issuesSheet && issues.length > 0} onOpenChange={setIssuesSheet}>
      <SheetContent side="bottom" closeLabel={t('close')} className="max-h-[85svh] gap-0">
        <SheetHeader className="border-b border-border p-4 pr-14"><SheetTitle>{t('issues', { n: issues.length })}</SheetTitle></SheetHeader>
        <div className="overflow-y-auto p-4">{issuePanel}</div>
      </SheetContent>
    </Sheet>

    <AlertDialog open={leaveTo !== null} onOpenChange={open => { if (!open) setLeaveTo(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t('leaveTitle')}</AlertDialogTitle><AlertDialogDescription>{t('leaveText')}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('stay')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => { const to = leaveTo!; setLeaveTo(null); navigate(to) }}>{t('leave')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {actions.elements}
  </main>
}
