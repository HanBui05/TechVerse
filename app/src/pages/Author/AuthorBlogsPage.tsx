import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, Eye, FileText, Layers, MoreHorizontal, PencilLine, Plus, RefreshCw, Search, SlidersHorizontal, SquarePen } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toneFor } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { EmptyState } from '../../components/EmptyState'
import { ArticleStatusBadges } from '../../components/articles/ArticleStatusBadges'
import { AdminPagination } from '../Admin/AdminPagination'
import { articleErrorText, articleText, historyActionLabel, publicationLabel, workflowLabel } from '../../data/articleI18n'
import { authorActions, authorArticles } from '../../services/articleService'
import type { ArticleOption, ArticleStatus, AuthorAction, AuthorArticle, AuthorArticleFilter, AuthorArticleSummary, HistoryAction, HistoryEntry, Page, PublicationStatus, WorkflowStatus } from '../../types/articles'
import type { Language } from '../../types/preferences'

const SIZE = 20
export const fieldLabel = 'text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground'
const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
export const formatDate = (value: string, language: Language, time = false) => new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', time ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }).format(new Date(value))

type Target = ArticleStatus & { id: string; title: string }
const DANGER: AuthorAction[] = ['deleteHard', 'deleteSoft', 'discard']

/** Confirm dialogs + history sheet shared by the workspace rows and the editor. `onDone(null)` means the article was deleted. */
export function useArticleActions(language: Language, onDone: (action: AuthorAction, updated: AuthorArticle | null) => void) {
  const t = articleText(language)
  const [pending, setPending] = useState<{ action: AuthorAction; article: Target } | null>(null)
  const [history, setHistory] = useState<Target | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ask = (action: AuthorAction, article: Target) => { setError(''); if (action === 'history') setHistory(article); else setPending({ action, article }) }
  const run = async () => {
    if (!pending) return
    const { action, article } = pending
    setPending(null); setBusy(true); setError('')
    try {
      const id = article.id
      const updated = action === 'withdraw' ? await authorArticles.withdraw(id)
        : action === 'discard' ? await authorArticles.discard(id)
          : action === 'hide' || action === 'unhide' ? await authorArticles.publication(id, action === 'hide' ? 'HIDE' : 'UNHIDE')
            : (await authorArticles.remove(id), null)
      onDone(action, updated)
    } catch (e) { setError(articleErrorText(e, language, t('loadError'))) }
    finally { setBusy(false) }
  }
  const text = pending && t(`${pending.action}Text` as Parameters<typeof t>[0])
  const elements = <>
    <AlertDialog open={pending !== null} onOpenChange={open => { if (!open) setPending(null) }}>
      {pending && <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(pending.action as Parameters<typeof t>[0])}</AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]"><strong className="text-foreground">{pending.article.title}</strong> — {text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction variant={DANGER.includes(pending.action) ? 'destructive' : 'default'} onClick={() => void run()}>{t(pending.action as Parameters<typeof t>[0])}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
    <ArticleHistorySheet target={history} language={language} onClose={() => setHistory(null)} />
  </>
  return { ask, elements, error, busy }
}

/** The `⋯` menu: exactly the backend-accepted actions for this state (see authorActions). */
export function ArticleActionMenu({ article, language, onAsk, exclude = [], disabled }: { article: Target; language: Language; onAsk: (action: AuthorAction, article: Target) => void; exclude?: AuthorAction[]; disabled?: boolean }) {
  const t = articleText(language)
  const [open, setOpen] = useState(false)
  const items = authorActions(article).menu.filter(action => !exclude.includes(action))
  const item = `flex min-h-9 w-full items-center rounded-md border-0 bg-transparent px-3 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted ${touch}`
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="outline" size="icon" disabled={disabled} aria-label={t('more', { title: article.title })} className={touch}><MoreHorizontal /></Button></PopoverTrigger>
    <PopoverContent align="end" className="w-56 p-1">
      <div role="menu" aria-label={t('moreShort')} className="flex flex-col">
        {items.map(action => action === 'viewLive'
          ? <Link key={action} role="menuitem" to={`/blogs/${article.id}`} target="_blank" rel="noopener" className={item}>{t('viewLive')}</Link>
          : <button key={action} type="button" role="menuitem" className={`${item} ${DANGER.includes(action) ? 'text-danger' : ''}`} onClick={() => { setOpen(false); onAsk(action, article) }}>{t(action as Parameters<typeof t>[0])}</button>)}
      </div>
    </PopoverContent>
  </Popover>
}

const HISTORY_TONE: Record<HistoryAction, string> = {
  APPROVE: 'bg-tone-green-fg', REQUEST_CHANGES: 'bg-tone-sky-fg', HIDE: 'bg-tone-rose-fg', REMOVE: 'bg-tone-rose-fg', AUTHOR_DELETE: 'bg-tone-rose-fg',
  RESTORE: 'bg-tone-amber-fg', AUTHOR_HIDE: 'bg-tone-slate-fg', AUTHOR_UNHIDE: 'bg-tone-slate-fg',
}

export function ArticleHistorySheet({ target, language, onClose }: { target: Target | null; language: Language; onClose: () => void }) {
  const t = articleText(language)
  const [page, setPage] = useState<Page<HistoryEntry> | null>(null)
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const load = useCallback(async (id: string, number: number) => {
    setLoading(true); setError('')
    try {
      const next = await authorArticles.history(id, number)
      setPage(next); setEntries(old => number === 0 ? next.content : [...old, ...next.content])
    } catch (e) { setError(articleErrorText(e, language, t('loadError'))) }
    finally { setLoading(false) }
  }, [language])
  useEffect(() => { setEntries([]); setPage(null); if (target) void load(target.id, 0) }, [target, load])
  return <Sheet open={target !== null} onOpenChange={open => { if (!open) onClose() }}>
    <SheetContent closeLabel={t('close')} className="w-full gap-0 sm:max-w-md">
      <SheetHeader className="border-b border-border p-6 pr-14"><SheetTitle>{t('historyTitle')}</SheetTitle><p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{target?.title}</p></SheetHeader>
      <div role="region" aria-label={t('historyTitle')} tabIndex={0} className="flex-1 overflow-y-auto overscroll-contain p-6 outline-none [scrollbar-width:thin] focus-visible:ring-2 focus-visible:ring-ring">
        {error && <div role="alert" className="flex flex-col items-start gap-2 text-sm text-danger">{error}<Button size="sm" variant="outline" onClick={() => target && void load(target.id, 0)}><RefreshCw />{t('retry')}</Button></div>}
        {loading && !entries.length && <div aria-busy="true" className="flex flex-col gap-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>}
        {!loading && !error && page && !entries.length && <p className="text-sm text-muted-foreground">{t('historyEmpty')}</p>}
        <ol className="m-0 flex list-none flex-col gap-5 p-0">
          {entries.map(entry => <li key={entry.id} className="flex gap-3">
            <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${HISTORY_TONE[entry.action]}`} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold"><span>{historyActionLabel[entry.action][language]}</span>{entry.versionNumber ? ` · ${t('version', { n: entry.versionNumber })}` : ''}{entry.actor ? ` · ${entry.actor.fullName}` : ''}</span>
              <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt, language, true)}</span>
              {entry.note && <p className="text-sm whitespace-pre-line [overflow-wrap:anywhere]">“{entry.note}”</p>}
            </div>
          </li>)}
        </ol>
        {page?.hasNext && <Button variant="outline" className={`mt-4 ${touch}`} disabled={loading} onClick={() => target && void load(target.id, page.page + 1)}>{t('loadMore')}</Button>}
      </div>
    </SheetContent>
  </Sheet>
}

type StatKey = 'total' | 'DRAFT' | 'PENDING' | 'CHANGES_REQUESTED' | 'live'
const STATS: [StatKey, Pick<AuthorArticleFilter, 'workflowStatus' | 'publicationStatus'>, ComponentType<{ className?: string }>, BadgeTone][] = [
  ['total', {}, Layers, 'blue'],
  ['DRAFT', { workflowStatus: 'DRAFT' }, SquarePen, 'slate'],
  ['PENDING', { workflowStatus: 'PENDING' }, Clock, 'amber'],
  ['CHANGES_REQUESTED', { workflowStatus: 'CHANGES_REQUESTED' }, PencilLine, 'sky'],
  ['live', { publicationStatus: 'PUBLISHED' }, CheckCircle2, 'green'],
]
const WORKFLOWS: WorkflowStatus[] = ['DRAFT', 'PENDING', 'CHANGES_REQUESTED', 'PUBLISHED']
const PUBLICATIONS: PublicationStatus[] = ['UNPUBLISHED', 'PUBLISHED', 'AUTHOR_HIDDEN', 'HIDDEN', 'REMOVED']
const SORTS = { newest: 'CREATED_AT:DESC', oldest: 'CREATED_AT:ASC', recentlyEdited: 'UPDATED_AT:DESC', titleAz: 'TITLE:ASC' } as const
const ATTENTION: Partial<Record<string, string>> = { PENDING: 'border-l-tone-amber-fg', CHANGES_REQUESTED: 'border-l-tone-sky-fg', HIDDEN: 'border-l-tone-rose-fg', REMOVED: 'border-l-tone-rose-fg', AUTHOR_HIDDEN: 'border-l-tone-rose-fg' }
// Literal class names so Tailwind generates them (fallback cover tile toned by topic).
export const TONE_TILE: Record<BadgeTone, string> = {
  blue: 'border-tone-blue-border bg-tone-blue-bg text-tone-blue-fg', green: 'border-tone-green-border bg-tone-green-bg text-tone-green-fg',
  purple: 'border-tone-purple-border bg-tone-purple-bg text-tone-purple-fg', amber: 'border-tone-amber-border bg-tone-amber-bg text-tone-amber-fg',
  rose: 'border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg', sky: 'border-tone-sky-border bg-tone-sky-bg text-tone-sky-fg',
  cyan: 'border-tone-cyan-border bg-tone-cyan-bg text-tone-cyan-fg', slate: 'border-tone-slate-border bg-tone-slate-bg text-tone-slate-fg',
}
const EMPTY_FILTERS = { workflowStatus: '' as WorkflowStatus | '', publicationStatus: '' as PublicationStatus | '', topicId: '', tagId: '', sort: SORTS.newest as string }

export function AuthorBlogsPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = articleText(language)
  const navigate = useNavigate()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [keyword, setKeyword] = useState('')
  const query = useDebouncedValue(keyword.trim())
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Page<AuthorArticleSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [stats, setStats] = useState<(number | null)[]>(STATS.map(() => null))
  const [options, setOptions] = useState<{ topics: ArticleOption[]; tags: ArticleOption[] }>({ topics: [], tags: [] })
  const latest = useRef(0)

  const load = useCallback(async () => {
    const id = ++latest.current
    setLoading(true); setError('')
    const [sortBy, direction] = filters.sort.split(':') as [AuthorArticleFilter['sortBy'], AuthorArticleFilter['direction']]
    try {
      const result = await authorArticles.list({ page, size: SIZE, keyword: query, workflowStatus: filters.workflowStatus, publicationStatus: filters.publicationStatus, topicId: filters.topicId, tagId: filters.tagId, sortBy, direction })
      if (id === latest.current) setData(result)
    } catch (e) { if (id === latest.current) setError(articleErrorText(e, language, t('loadError'))) }
    finally { if (id === latest.current) setLoading(false) }
  }, [filters, page, query, language])
  // Counts are decoration: each failing count shows “—” without blocking the list.
  const loadStats = useCallback(() => {
    STATS.forEach(([, filter], i) => authorArticles.list({ page: 0, size: 1, ...filter })
      .then(result => result.totalElements, () => null)
      .then(value => setStats(old => old.map((v, j) => j === i ? value : v))))
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { authorArticles.options().then(o => setOptions({ topics: o.topics.content, tags: o.tags.content }), () => {}) }, [])
  useEffect(() => { setPage(0) }, [query])

  const actions = useArticleActions(language, action => {
    setMessage(action === 'deleteHard' || action === 'deleteSoft' ? t('deleted') : t('actionDone'))
    void load(); loadStats()
  })
  const setFilter = (next: Partial<typeof EMPTY_FILTERS>) => { setFilters(old => ({ ...old, ...next })); setPage(0); setMessage('') }
  const filtered = Boolean(query || filters.workflowStatus || filters.publicationStatus || filters.topicId || filters.tagId)
  const clear = () => { setKeyword(''); setFilter(EMPTY_FILTERS) }
  const items = data?.content ?? []

  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <Badge tone="purple" className="self-start"><SquarePen aria-hidden />{t('kicker')}</Badge>
        <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <Button asChild className={touch}><Link to="/author/blogs/new"><Plus />{t('newArticle')}</Link></Button>
    </header>

    <section aria-label={t('stats')} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {STATS.map(([key, filter, Icon, tone], i) => {
        const active = (filter.workflowStatus ?? '') === filters.workflowStatus && (filter.publicationStatus ?? '') === filters.publicationStatus
        const label = key === 'total' ? t('total') : key === 'live' ? publicationLabel.PUBLISHED[language] : workflowLabel[key][language]
        return <button key={key} type="button" aria-pressed={active} onClick={() => setFilter({ workflowStatus: filter.workflowStatus ?? '', publicationStatus: filter.publicationStatus ?? '' })}
          className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-left shadow-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring ${touch} ${active ? TONE_TILE[tone] : 'border-border bg-card text-card-foreground hover:bg-muted/50'}`}>
          <span className="flex min-w-0 flex-col gap-1"><span className={`${fieldLabel} ${active ? 'text-current' : ''}`}>{label}</span><span className="text-2xl font-bold tabular-nums">{stats[i] ?? '—'}</span></span>
          <span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${TONE_TILE[tone]}`}><Icon className="size-5" /></span>
        </button>
      })}
    </section>

    <Card className="gap-0 rounded-2xl py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold"><span aria-hidden className="flex size-8 items-center justify-center rounded-lg border border-tone-sky-border bg-tone-sky-bg text-tone-sky-fg"><SlidersHorizontal className="size-4" /></span>{t('filters')}</h2>
        {data && <Badge tone="blue" aria-live="polite">{t('count', { n: data.totalElements })}</Badge>}
      </div>
      <div className="flex flex-col gap-4 p-6">
        <div className="grid gap-4 md:grid-cols-12">
          <div className="flex flex-col gap-2 md:col-span-5">
            <Label htmlFor="author-search" className={fieldLabel}>{t('search')}</Label>
            <div className="relative"><Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="author-search" type="search" maxLength={255} className={`pl-9 ${touch}`} placeholder={t('searchPlaceholder')} value={keyword} onChange={e => setKeyword(e.target.value)} /></div>
          </div>
          {([['topicId', 'topic', 'allTopics', options.topics], ['tagId', 'tag', 'allTags', options.tags]] as const).map(([key, label, all, list]) => <div key={key} className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor={`author-${key}`} className={fieldLabel}>{t(label)}</Label>
            <NativeSelect id={`author-${key}`} className={touch} value={filters[key]} onChange={e => setFilter({ [key]: e.target.value })}>
              <NativeSelectOption value="">{t(all)}</NativeSelectOption>
              {list.map(o => <NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}
            </NativeSelect>
          </div>)}
          <div className="flex flex-col gap-2 md:col-span-3">
            <Label htmlFor="author-sort" className={fieldLabel}>{t('sort')}</Label>
            <NativeSelect id="author-sort" className={touch} value={filters.sort} onChange={e => setFilter({ sort: e.target.value })}>
              {(Object.keys(SORTS) as (keyof typeof SORTS)[]).map(key => <NativeSelectOption key={key} value={SORTS[key]}>{t(key)}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        </div>
        {([['workflowFilter', 'workflowStatus', WORKFLOWS, workflowLabel], ['publicationFilter', 'publicationStatus', PUBLICATIONS, publicationLabel]] as const).map(([label, key, values, labels]) => <div key={key} className="flex flex-wrap items-center gap-2">
          <span className={`${fieldLabel} w-24`}>{t(label)}</span>
          <div role="group" aria-label={t(label)} className="flex flex-wrap gap-2">
            {(['', ...values] as string[]).map(value => <Button key={value || 'all'} size="sm" variant={filters[key] === value ? 'default' : 'outline'} className={`rounded-full ${touch}`} aria-pressed={filters[key] === value} onClick={() => setFilter({ [key]: value })}>
              {value ? (labels as Record<string, { vi: string; en: string }>)[value][language] : t('all')}
            </Button>)}
          </div>
        </div>)}
      </div>
    </Card>

    {(error || actions.error) && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
      <span>{error || actions.error}</span>
      {error && <Button size="sm" variant="outline" className={touch} onClick={() => void load()}><RefreshCw />{t('retry')}</Button>}
    </div>}
    {message && <p role="status" className="rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">{message}</p>}

    <Card className="gap-0 overflow-hidden rounded-2xl py-0">
      <h2 className="border-b border-border px-6 py-4 text-base font-bold">{t('list')}</h2>
      {loading && !data
        ? <div aria-busy="true" aria-label={t('loading')} className="flex flex-col divide-y divide-border">{[0, 1, 2, 3, 4].map(i => <div key={i} className="flex gap-4 px-6 py-4"><Skeleton className="hidden h-10 w-16 sm:block" /><div className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-64 max-w-full" /><Skeleton className="h-3 w-40" /></div></div>)}</div>
        : error && !data ? null
          : !items.length
            ? filtered
              ? <EmptyState className="m-6" icon={Search} title={t('noMatch')} action={<Button variant="outline" className={touch} onClick={clear}>{t('clearFilters')}</Button>} />
              : <EmptyState className="m-6" icon={PencilLine} title={t('emptyTitle')} description={<span className="flex flex-col items-center gap-3">{t('emptyText')}<span className="flex flex-wrap justify-center gap-2">{t('steps').split('|').map((step, i) => <Badge key={step} tone={(['slate', 'amber', 'green'] as const)[i]}>{i + 1}. {step}</Badge>)}</span></span>}
                action={<Button asChild className={touch}><Link to="/author/blogs/new"><Plus />{t('writeFirst')}</Link></Button>} />
            : <ul className={`m-0 flex list-none flex-col divide-y divide-border p-0 transition-opacity ${loading ? 'opacity-60' : ''}`}>
              {items.map(item => {
                const { primary } = authorActions(item)
                const attention = ATTENTION[item.publicationStatus] ?? ATTENTION[item.workflowStatus]
                return <li key={item.id} onClick={e => { if (!(e.target as Element).closest('a,button')) navigate(`/author/blogs/${item.id}/edit`) }}
                  className={`flex cursor-pointer flex-wrap items-start gap-4 border-l-[3px] px-6 py-4 transition-colors hover:bg-muted/50 sm:flex-nowrap ${attention ?? 'border-l-transparent'}`}>
                  {item.coverImageUrl
                    ? <img src={item.coverImageUrl} alt="" className="hidden h-10 w-16 shrink-0 rounded-md border border-border object-cover sm:block" />
                    : <span aria-hidden className={`hidden h-10 w-16 shrink-0 items-center justify-center rounded-md border sm:flex ${TONE_TILE[toneFor(item.topic.name)]}`}><FileText className="size-4" /></span>}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="line-clamp-2 font-semibold [overflow-wrap:anywhere]">{item.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <Badge tone={toneFor(item.topic.name)} className="max-w-full whitespace-normal">{item.topic.name}</Badge>
                      <span>{t('updated', { date: formatDate(item.updatedAt, language) })}</span>
                      {item.publishedAt && <span>· {t('publishedOn', { date: formatDate(item.publishedAt, language) })}</span>}
                    </span>
                    <ArticleStatusBadges article={item} language={language} />
                    {item.publicationStatus === 'HIDDEN' && <span className="text-xs text-tone-rose-fg"><span aria-hidden>ⓘ </span>{t('moderatorHidden')}</span>}
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <Button asChild size="sm" variant={primary === 'edit' ? 'default' : 'outline'} className={touch}>
                      <Link to={`/author/blogs/${item.id}/edit`} aria-label={`${t(primary)} ${item.title}`}>{primary === 'edit' ? <PencilLine /> : <Eye />}{t(primary)}</Link>
                    </Button>
                    <ArticleActionMenu article={item} language={language} onAsk={actions.ask} disabled={actions.busy} />
                  </div>
                </li>
              })}
            </ul>}
      {!!data?.totalElements && <div className="border-t border-border px-6 py-4"><AdminPagination language={language} page={page} size={SIZE} total={data.totalElements} loading={loading} onPageChange={setPage} /></div>}
    </Card>
    {actions.elements}
  </main>
}
