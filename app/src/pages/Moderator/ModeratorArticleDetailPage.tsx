import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, Ban, CheckCircle2, CircleCheck, Eye, EyeOff, MoreHorizontal, PencilLine, RefreshCw, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { toneFor } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { BackToTopButton } from '../../components/BackToTopButton'
import { EmptyState } from '../../components/EmptyState'
import { MarkdownContent } from '../../components/MarkdownContent'
import { UserAvatar } from '../../components/UserAvatar'
import { ArticleStatusBadges } from '../../components/articles/ArticleStatusBadges'
import { ApiError } from '../../services/api/client'
import { historyActionLabel, isStaleError, moderatorErrorText, moderatorText, type ModeratorKey } from '../../data/articleI18n'
import { changedFromLive, isManagedImage, lastReturnNote, moderatorActions, moderatorArticles } from '../../services/articleService'
import type { ArticleOption, CompareField, ModeratorAction, ModeratorArticleDetail } from '../../types/articles'
import type { Language } from '../../types/preferences'
import { ArticleHistorySheet, HISTORY_TONE, fieldLabel, formatDate } from '../Author/AuthorBlogsPage'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const crumb = 'pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center'
const NOTE_REQUIRED:ModeratorAction[] = ['REQUEST_CHANGES', 'HIDE', 'REMOVE']
const ICONS: Record<ModeratorAction, typeof CheckCircle2> = { APPROVE: CheckCircle2, REQUEST_CHANGES: PencilLine, HIDE: EyeOff, RESTORE: RotateCcw, REMOVE: Ban }
const VARIANT: Record<ModeratorAction, 'default' | 'outline' | 'destructive'> = { APPROVE: 'default', REQUEST_CHANGES: 'outline', HIDE: 'outline', RESTORE: 'default', REMOVE: 'destructive' }
const FIELD_LABEL: Record<CompareField, ModeratorKey> = { title: 'fieldTitle', summary: 'fieldSummary', cover: 'fieldCover', topic: 'fieldTopic', tags: 'fieldTags', content: 'fieldContent' }

type Fields = { title: string; summary: string | null; coverImageUrl: string | null; topic: ArticleOption; tags: ArticleOption[]; content: string | null }
type Text = ReturnType<typeof moderatorText>

/** One side of the comparison; only the proposed side marks changed fields (amber chip + left border, wireframe “Phong cách”). */
function Version({ label, fields, changed, mark, t, imageAllowed }: { label: string; fields: Fields; changed: CompareField[]; mark: boolean; t: Text; imageAllowed: (src: string) => boolean }) {
  const field = (name: CompareField, body: ReactNode) => {
    const marked = mark && changed.includes(name)
    return <div className={`flex flex-col gap-1.5 ${marked ? 'border-l-2 border-l-tone-amber-fg pl-3' : ''}`}>
      <div className="flex items-center gap-2"><span className={fieldLabel}>{t(FIELD_LABEL[name])}</span>{marked && <Badge tone="amber">{t('changed')}</Badge>}</div>
      {body}
    </div>
  }
  return <section aria-label={label} className="flex min-w-0 flex-col gap-5 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
    <h2 className="text-base font-bold">{label}</h2>
    {field('title', <p className="text-lg font-semibold [overflow-wrap:anywhere]">{fields.title.trim() || t('untitled')}</p>)}
    {field('summary', fields.summary?.trim() ? <p className="border-l-4 border-primary pl-3 text-sm text-muted-foreground [overflow-wrap:anywhere]">{fields.summary}</p> : <p className="text-sm text-muted-foreground">{t('noSummary')}</p>)}
    {field('topic', <Badge tone={toneFor(fields.topic.name)} className="self-start">{fields.topic.name}</Badge>)}
    {field('tags', fields.tags.length
      ? <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">{fields.tags.map(tag => <li key={tag.id}><Badge tone={toneFor(tag.name)}>#{tag.name}</Badge></li>)}</ul>
      : <p className="text-sm text-muted-foreground">{t('noTags')}</p>)}
    {field('cover', fields.coverImageUrl && imageAllowed(fields.coverImageUrl)
      ? <img src={fields.coverImageUrl} alt="" className="aspect-video w-full rounded-lg border border-border object-cover" />
      : <p className="text-sm text-muted-foreground">{fields.coverImageUrl ? t('imagePlaceholder') : t('noCover')}</p>)}
    {field('content', <div className="min-w-0"><MarkdownContent content={fields.content ?? ''} imageAllowed={imageAllowed} imagePlaceholder={t('imagePlaceholder')} /></div>)}
  </section>
}

export function ModeratorArticleDetailPage({ language = 'vi' }: { language?: Language } = {}) {
  const { id = '' } = useParams()
  const t = moderatorText(language)
  const mobile = useIsMobile()
  const [detail, setDetail] = useState<ModeratorArticleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<ModeratorAction | null>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState(false)
  const [dialogError, setDialogError] = useState<{ text: string; stale: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'both' | 'proposed' | 'live'>('both')
  const [moreOpen, setMoreOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(''); setNotFound(false)
    try { setDetail(await moderatorArticles.detail(id)) }
    catch (e) { if (e instanceof ApiError && e.status === 404) setNotFound(true); else setError(moderatorErrorText(e, language, t('detailError'))) }
    finally { setLoading(false) }
  }, [id, language])
  useEffect(() => { void load() }, [load])

  const ask = (action: ModeratorAction) => { setMoreOpen(false); setPending(action); setNote(''); setNoteError(false); setDialogError(null); setMessage('') }
  const confirm = async () => {
    if (!detail || !pending || busy) return
    if (NOTE_REQUIRED.includes(pending) && !note.trim()) { setNoteError(true); return }
    setBusy(true); setDialogError(null)
    try {
      const { id: articleId } = detail.article
      const updated = pending === 'APPROVE' || pending === 'REQUEST_CHANGES'
        ? await moderatorArticles.review(articleId, pending, detail.reviewToken, note)
        : await moderatorArticles.publication(articleId, pending, detail.reviewToken, note)
      setDetail(updated); setMessage(t(`${pending}_done`)); setPending(null)
    } catch (e) { setDialogError({ text: moderatorErrorText(e, language, t('detailError')), stale: isStaleError(e) }) }
    finally { setBusy(false) }
  }
  // Drop the stale article (and its token) first, so a failed reload shows its error instead of the old actions.
  const reload = () => { setPending(null); setDetail(null); void load() }

  const main = (body: ReactNode, extra = '') => <main className={`tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 ${extra}`}>{body}</main>
  if (!detail) {
    if (loading) return main(<div aria-busy="true" aria-label={t('loading')} className="flex flex-col gap-4"><Skeleton className="h-4 w-60" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-6 w-80 max-w-full" /><div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-96" /><Skeleton className="h-96" /></div></div>)
    if (notFound) return main(<EmptyState icon={AlertTriangle} title={t('notFound')} action={<Button asChild variant="outline" className={touch}><Link to="/moderator/articles">{t('backToList')}</Link></Button>} />)
    return main(<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger"><span>{error}</span><Button size="sm" variant="outline" className={touch} onClick={() => void load()}><RefreshCw />{t('retry')}</Button></div>)
  }

  const { article, author } = detail
  const live = article.publishedVersion
  const actions = moderatorActions(article)
  const changed = changedFromLive(article)
  const imageAllowed = (src: string) => isManagedImage(src, article.authorId, article.id)
  const view = mobile && mode === 'both' ? 'proposed' : mode
  const ineligible = article.workflowStatus === 'PENDING' && !detail.authorEligible
  const returned = pending === 'APPROVE' ? lastReturnNote(article) : null
  // Mobile bar holds at most two buttons; the rest go into `⋯` (wireframe 2b-2).
  const [shown, extra] = mobile ? [actions.slice(0, 2), actions.slice(2)] : [actions, []]
  const actionButton = (action: ModeratorAction) => { const Icon = ICONS[action]; return <Button key={action} variant={VARIANT[action]} className={`max-md:min-h-11 max-md:flex-1 ${touch}`} disabled={busy || (action === 'APPROVE' && ineligible)} onClick={() => ask(action)}><Icon />{t(action)}</Button> }
  const proposedFields: Fields = article
  const liveFields: Fields | null = live

  return main(<>
    <Breadcrumb aria-label={t('breadcrumb')}>
      {/* m-0/list-none/p-0: preflight is still off, so the UA numbers and indents the `ol` (until Task 2c). */}
      <BreadcrumbList className="m-0 list-none p-0">
        <BreadcrumbItem><BreadcrumbLink asChild><Link to="/moderator" className={crumb}>{t('moderator')}</Link></BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbLink asChild><Link to="/moderator/articles" className={crumb}>{t('articles')}</Link></BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="truncate">{article.title}</BreadcrumbPage></BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>

    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-3">
        <h1 className="text-2xl font-bold [overflow-wrap:anywhere] sm:text-3xl">{article.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <ArticleStatusBadges article={article} language={language} moderator />
          {live && <Badge tone="green">v{live.versionNumber}</Badge>}
          <span className="inline-flex items-center gap-2 text-sm"><UserAvatar name={author.fullName} url={author.avatarUrl} className="size-6" />{author.fullName}
            {detail.authorEligible ? <span className="inline-flex items-center gap-1 text-tone-green-fg"><CircleCheck aria-hidden className="size-4" />{t('eligible')}</span> : <span className="inline-flex items-center gap-1 text-tone-rose-fg"><AlertTriangle aria-hidden className="size-4" />{t('ineligible')}</span>}
          </span>
        </div>
      </div>
      {actions.length > 0 && <div role="group" aria-label={t('actions')} className="flex flex-wrap gap-2 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-20 max-md:flex-nowrap max-md:border-t max-md:border-border max-md:bg-background max-md:p-3">
        {shown.map(actionButton)}
        {extra.length > 0 && <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild><Button variant="outline" size="icon" aria-label={t('actions')} className="min-h-11 min-w-11"><MoreHorizontal /></Button></PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-1"><div className="flex flex-col gap-1">{extra.map(action => { const Icon = ICONS[action]; return <Button key={action} variant="ghost" className={`justify-start ${touch} ${action === 'REMOVE' ? 'text-danger' : ''}`} onClick={() => ask(action)}><Icon />{t(action)}</Button> })}</div></PopoverContent>
        </Popover>}
      </div>}
    </header>

    {ineligible && <p className="flex items-center gap-2 rounded-lg border border-tone-rose-border bg-tone-rose-bg px-4 py-3 text-sm text-tone-rose-fg"><AlertTriangle aria-hidden className="size-4 shrink-0" />{t('ineligibleReason')}</p>}
    {article.publicationStatus === 'REMOVED' && <p className="rounded-lg border border-tone-rose-border bg-tone-rose-bg px-4 py-3 text-sm text-tone-rose-fg">{t('removedBanner')}</p>}
    {article.publicationStatus === 'AUTHOR_DELETED' && <p className="rounded-lg border border-tone-slate-border bg-tone-slate-bg px-4 py-3 text-sm text-tone-slate-fg">{t('deletedBanner')}</p>}
    {message && <p role="status" className="rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">{message}</p>}

    {live && liveFields
      ? <>
        <Card className="flex-row flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span id="changes-label" className="font-semibold">{t('changesFrom', { n: live.versionNumber })}</span>
            {changed.length
              ? <ul aria-labelledby="changes-label" className="m-0 flex list-none flex-wrap gap-1.5 p-0">{changed.map(name => <li key={name}><Badge tone="amber">{t(FIELD_LABEL[name])}</Badge></li>)}</ul>
              : <span className="text-muted-foreground">{t('noFieldChanged')}</span>}
          </div>
          <div role="group" aria-label={t('compareMode')} className="flex gap-1 rounded-lg border border-border p-1">
            {([...(mobile ? [] : ['both' as const]), 'proposed', 'live'] as const).map(value => <Button key={value} size="sm" variant={view === value ? 'default' : 'ghost'} aria-pressed={view === value} className={touch} onClick={() => setMode(value)}>
              {value === 'both' ? t('both') : value === 'proposed' ? t('proposedShort') : t('liveShort')}
            </Button>)}
          </div>
        </Card>
        <div className={view === 'both' ? 'grid items-start gap-4 md:grid-cols-2' : 'mx-auto w-full max-w-[880px]'}>
          {view !== 'proposed' && <Version label={t('live', { n: live.versionNumber })} fields={liveFields} changed={changed} mark={false} t={t} imageAllowed={imageAllowed} />}
          {view !== 'live' && <Version label={t('proposed')} fields={proposedFields} changed={changed} mark t={t} imageAllowed={imageAllowed} />}
        </div>
      </>
      : <div className="mx-auto w-full max-w-[880px]"><Version label={t('proposed')} fields={proposedFields} changed={[]} mark={false} t={t} imageAllowed={imageAllowed} /></div>}

    <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card className="gap-3 rounded-2xl p-5">
        <h2 className="text-base font-bold">{t('authorCard')}</h2>
        <div className="flex items-center gap-3"><UserAvatar name={author.fullName} url={author.avatarUrl} className="size-10" /><span className="font-semibold [overflow-wrap:anywhere]">{author.fullName}</span></div>
        {detail.authorEligible
          ? <Badge tone="green" className="self-start"><CircleCheck aria-hidden />{t('eligible')}</Badge>
          : <Badge tone="rose" className="self-start"><AlertTriangle aria-hidden />{t('ineligible')}</Badge>}
      </Card>
      <Card className="gap-3 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">{t('historyRecent')}</h2>
          <Button size="sm" variant="outline" className={touch} onClick={() => setHistoryOpen(true)}><Eye />{t('viewAll')}</Button>
        </div>
        {detail.history.length
          ? <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {detail.history.map(entry => <li key={entry.id} className="flex gap-3">
              <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${HISTORY_TONE[entry.action]}`} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold">{historyActionLabel[entry.action][language]}{entry.versionNumber ? ` · v${entry.versionNumber}` : ''}{entry.actor ? ` · ${entry.actor.fullName}` : ''}</span>
                <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt, language, true)}</span>
                {entry.note && <p className="text-sm whitespace-pre-line [overflow-wrap:anywhere]">“{entry.note}”</p>}
              </div>
            </li>)}
          </ol>
          : <p className="text-sm text-muted-foreground">{t('historyEmpty')}</p>}
      </Card>
    </div>

    {/* Mobile: sit above the fixed action bar (~76 px) when there is one. */}
    <BackToTopButton label={t('backToTop')} className={actions.length ? 'bottom-6 max-md:bottom-24' : 'bottom-6'} />
    <ArticleHistorySheet target={historyOpen ? article : null} language={language} onClose={() => setHistoryOpen(false)} fetchPage={moderatorArticles.history} />

    <AlertDialog open={pending !== null} onOpenChange={open => { if (!open && !busy) setPending(null) }}>
      {pending && <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`${pending}_title`)}</AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]">{t(`${pending}_text`, { n: (live?.versionNumber ?? 0) + 1 })}</AlertDialogDescription>
        </AlertDialogHeader>
        {returned && <div className="rounded-lg border border-tone-sky-border bg-tone-sky-bg px-4 py-3 text-sm text-tone-sky-fg"><span className="font-semibold">{t('lastReturn')}</span> <span className="whitespace-pre-line [overflow-wrap:anywhere]">“{returned}”</span></div>}
        <div className="flex flex-col gap-2">
          <Label htmlFor="moderation-note" className={fieldLabel}>{t(pending === 'REQUEST_CHANGES' ? 'noteRequired' : NOTE_REQUIRED.includes(pending) ? 'reasonRequired' : 'noteOptional')}</Label>
          <Textarea id="moderation-note" rows={4} maxLength={2000} className="max-h-48 overflow-y-auto" value={note} aria-invalid={noteError && !note.trim()} aria-describedby="moderation-note-hint"
            onChange={e => { setNote(e.target.value); setNoteError(false) }} />
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <p id="moderation-note-hint" className="text-danger">{noteError && !note.trim() ? t(pending === 'REQUEST_CHANGES' ? 'noteMissing' : 'reasonMissing') : ''}</p>
            <span className="text-muted-foreground tabular-nums">{note.length}/2000</span>
          </div>
        </div>
        {dialogError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-tone-rose-bg px-3 py-2 text-sm text-danger">
          <span>{dialogError.text}</span>
          {dialogError.stale && <Button size="sm" variant="outline" className={touch} onClick={reload}><RefreshCw />{t('reload')}</Button>}
        </div>}
        <AlertDialogFooter>
          <AlertDialogCancel className={touch} disabled={busy}>{t('cancel')}</AlertDialogCancel>
          <Button variant={VARIANT[pending] === 'outline' ? 'default' : VARIANT[pending]} className={touch} disabled={busy || dialogError?.stale} onClick={() => void confirm()}>{t(pending)}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
  </>, actions.length ? 'max-md:pb-28' : '')
}
