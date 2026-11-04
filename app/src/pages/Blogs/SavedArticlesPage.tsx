import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, FileStack, Heart, HeartOff, RefreshCw, Search, Undo2, X } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '../../services/api/client'
import { EmptyState } from '../../components/EmptyState'
import { Pagination } from '../../components/Pagination'
import { ArticleCard } from '../../components/articles/ArticleCard'
import { SaveToggle, useSavedState } from '../../components/articles/ArticleSaveButton'
import { readerErrorText, readerText } from '../../data/articleI18n'
import { publicArticles } from '../../services/articleService'
import type { Page, SavedArticleSummary } from '../../types/articles'
import type { Language } from '../../types/preferences'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const GRID = 'grid list-none gap-6 sm:grid-cols-2 xl:grid-cols-3'

/**
 * One saved article (wireframe 2d). Unsaving swaps the card for an in-place “Removed · Undo” row until the page is left;
 * Undo re-saves through the same sequential `useSavedState`, and failures roll back to the confirmed state with the error inline.
 */
function SavedItem({ article, from, language }: { article: SavedArticleSummary; from: string; language: Language }) {
  const t = readerText(language)
  const { saved, error, setSaved } = useSavedState(article.id, true, language)
  // Keyboard users keep their place: focus follows the control that replaced the one they pressed.
  const [acted, setActed] = useState(false)
  const act = (value: boolean) => { setActed(true); setSaved(value) }
  if (saved) return <ArticleCard article={article} from={from} language={language}
    saveButton={<SaveToggle saved error={error} onToggle={() => act(false)} language={language} autoFocus={acted} />} />
  return <div className="flex w-full flex-col gap-1 self-start rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-2">
    <div className="flex min-h-11 items-center justify-between gap-2">
      <p role="status" className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
        <HeartOff className="size-4 shrink-0 text-tone-rose-fg" aria-hidden /><span className="shrink-0">{t('unsaved')}</span>
        <span className="truncate font-medium text-foreground">· {article.title}</span>
      </p>
      <Button type="button" variant="outline" size="sm" autoFocus={acted} className={cn('shrink-0', touch)} aria-label={t('undoOf', { title: article.title })} onClick={() => act(true)}>
        <Undo2 aria-hidden />{t('undo')}
      </Button>
    </div>
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
  </div>
}

/** `/me/saved-articles`: header + count + search, then the `/blogs` card grid (spec Task 2d). Only for accounts without ADMIN/MODERATOR. */
export function SavedArticlesPage({ language = 'vi' }: { language?: Language }) {
  const t = readerText(language)
  const location = useLocation()
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState({ keyword: '', page: 0 })
  const [data, setData] = useState<Page<SavedArticleSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Only the newest request may update the page.
  const latest = useRef(0)

  const load = useCallback(async () => {
    const id = ++latest.current
    setLoading(true); setError('')
    try {
      const result = await publicArticles.savedList(query)
      if (id === latest.current) setData(result)
    } catch (e) {
      if (id !== latest.current) return
      setData(null)
      setError(e instanceof ApiError && e.code === 'VALIDATION_ERROR' ? t('savedFilterError') : readerErrorText(e, language, t('savedLoadError')))
    } finally {
      if (id === latest.current) setLoading(false)
    }
  }, [query, language]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [load])

  // Articles hidden or unsaved elsewhere can shrink the list below the current page: go to the last page instead.
  useEffect(() => {
    if (data && !data.content.length && query.page > 0 && data.totalPages > 0) setQuery(q => ({ ...q, page: data.totalPages - 1 }))
  }, [data, query.page])

  const search = (value: string) => setQuery({ keyword: value.trim(), page: 0 })
  const submit = (event: FormEvent) => { event.preventDefault(); search(keyword) }
  const clear = () => { setKeyword(''); search('') }
  const from = location.pathname

  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex items-start gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
      <span className="hidden size-14 shrink-0 items-center justify-center rounded-2xl border border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg shadow-sm sm:flex"><Heart className="size-7" aria-hidden /></span>
      <div className="flex min-w-0 flex-col gap-2">
        <Badge tone="rose" className="self-start font-semibold"><Heart aria-hidden />{t('myCorner')}</Badge>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('savedTitle')}</h1>
          {data && <Badge tone="blue" className="rounded-xl px-3 py-1 text-sm font-semibold"><FileStack aria-hidden />{t('count', { n: data.totalElements })}</Badge>}
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{t('savedSubtitle')}</p>
      </div>
      <Button asChild variant="outline" className={cn('ml-auto shrink-0 max-sm:size-11 max-sm:px-0', touch)}>
        <Link to="/blogs" aria-label={t('allArticles')}><ArrowLeft aria-hidden /><span className="max-sm:sr-only">{t('allArticles')}</span></Link>
      </Button>
    </header>

    <Card className="rounded-2xl p-3 shadow-sm sm:p-4">
      <form role="search" onSubmit={submit} className="relative">
        <Label htmlFor="saved-search" className="sr-only">{t('savedSearch')}</Label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-accent-text" aria-hidden />
        <Input id="saved-search" type="search" enterKeyHint="search" maxLength={255} value={keyword} onChange={e => setKeyword(e.target.value)} placeholder={t('savedSearchPlaceholder')}
          className={cn('h-9 rounded-xl bg-muted/50 pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden', touch)} />
        {keyword && <button type="button" aria-label={t('clearSearch')} onClick={clear}
          className={cn('absolute top-1/2 right-1 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground', touch)}><X className="size-4" aria-hidden /></button>}
      </form>
    </Card>

    {error
      ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
          <span>{error}</span><Button type="button" variant="outline" size="sm" className={touch} onClick={() => void load()}><RefreshCw aria-hidden />{t('retry')}</Button>
        </div>
      : loading && !data
        ? <ul role="status" aria-label={t('savedLoading')} className={GRID}>{Array.from({ length: 6 }, (_, i) => <li key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
            <Skeleton className="aspect-[16/10] rounded-none" /><div className="flex flex-col gap-2.5 p-4"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-5 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-8 w-full" /></div>
          </li>)}</ul>
        : data && !data.content.length
          ? query.keyword
            ? <EmptyState icon={Search} title={t('savedEmptyFiltered')} description={t('savedEmptyFilteredText')}
                action={<Button type="button" variant="outline" className={touch} onClick={clear}>{t('clearSavedSearch')}</Button>} />
            : <EmptyState icon={Heart} title={t('savedEmpty')} description={t('savedEmptyText')}
                action={<Button asChild className={touch}><Link to="/blogs">{t('explore')}</Link></Button>} />
          : data && <ul aria-label={t('savedList')} aria-busy={loading} className={GRID}>{data.content.map(article => <li key={article.id} className="flex min-w-0">
              <SavedItem article={article} from={from} language={language} />
            </li>)}</ul>}

    {data && !error && <Pagination language={language} page={query.page} totalPages={data.totalPages} loading={loading} onPageChange={page => setQuery(q => ({ ...q, page }))} />}
  </main>
}
