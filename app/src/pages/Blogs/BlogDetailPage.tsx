import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowRight, BookOpen, Briefcase, CalendarDays, ChevronDown, ChevronLeft, Clock3, Hash, LayoutGrid, Link2, ListTree, Newspaper, RefreshCw, Sparkles, Tag, Zap, type LucideIcon } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toneFor } from '@/lib/utils'
import { BackToTopButton } from '../../components/BackToTopButton'
import { EmptyState } from '../../components/EmptyState'
import { CopyButton, MarkdownContent } from '../../components/MarkdownContent'
import { UserAvatar } from '../../components/UserAvatar'
import { ArticleSaveButton } from '../../components/articles/ArticleSaveButton'
import { toneText, topicIcon } from '../../components/articles/ArticleCard'
import { readerErrorText, readerText } from '../../data/articleI18n'
import { ApiError } from '../../services/api/client'
import { publicArticles, readerBackTarget } from '../../services/articleService'
import type { PublicArticleDetail } from '../../types/articles'
import type { Language } from '../../types/preferences'
import { TONE_TILE, formatDate } from '../Author/AuthorBlogsPage'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const SECTION = 'gap-3 rounded-2xl px-4 py-4'
const SECTION_TITLE = 'flex items-center gap-2.5 text-sm font-semibold'
const QUICK = 'flex items-center gap-2.5 rounded-lg px-2 py-2 text-foreground transition hover:translate-x-0.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring'
type Heading = { id: string; text: string; level: 2 | 3 }

/** Reader detail (wireframe 2c-2): content ~880 px + sticky 280 px sidebar; on mobile the TOC folds under the summary and the sidebar follows the article. */
export function BlogDetailPage({ language = 'vi', canSave = true }: { language?: Language; canSave?: boolean }) {
  const t = readerText(language)
  const { id = '' } = useParams()
  const location = useLocation()
  const back = readerBackTarget(location.state)
  const [article, setArticle] = useState<PublicArticleDetail | null>(null)
  const [error, setError] = useState<{ missing: boolean; text: string } | null>(null)
  const [headings, setHeadings] = useState<Heading[]>([])
  const [active, setActive] = useState('')
  const body = useRef<HTMLDivElement>(null)
  const latest = useRef(0)

  const load = useCallback(async () => {
    const request = ++latest.current
    setArticle(null); setError(null); setHeadings([])
    try {
      const result = await publicArticles.detail(id)
      if (request === latest.current) setArticle(result)
    } catch (e) {
      if (request === latest.current) setError({ missing: e instanceof ApiError && e.status === 404, text: readerErrorText(e, language, t('loadError')) })
    }
  }, [id, language]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [load])

  // The TOC reads the ids MarkdownContent gave the headings, so TOC and anchors share one slug pass.
  useEffect(() => {
    const nodes = [...(body.current?.querySelectorAll<HTMLElement>('h2[id], h3[id]') ?? [])]
    setHeadings(nodes.map(node => ({ id: node.id, text: node.textContent ?? '', level: node.tagName === 'H3' ? 3 : 2 })))
    // Slugs are [a-z0-9-] only, so the raw fragment is compared as is (no decoding of untrusted input).
    // The router keeps the list's scroll position: start a newly opened article at the top unless a section is linked.
    const target = location.hash ? document.getElementById(location.hash.slice(1)) : null
    if (target) target.scrollIntoView()
    else if (article) window.scrollTo(0, 0)
  }, [article]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reading progress bar: share of the article scrolled past the bottom of the viewport.
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    if (!article) return
    const update = () => {
      const box = body.current?.closest('article')?.getBoundingClientRect()
      if (!box) return
      const total = box.height - window.innerHeight
      setProgress(Math.round(Math.min(1, Math.max(0, total > 0 ? -box.top / total : 1)) * 100))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [article])

  // Current section = last heading scrolled above the reading line.
  useEffect(() => {
    if (!headings.length) return
    const update = () => {
      const passed = headings.filter(heading => (document.getElementById(heading.id)?.getBoundingClientRect().top ?? Infinity) <= 120)
      setActive((passed.at(-1) ?? headings[0]).id)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [headings])

  const main = (content: ReactNode) => <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">{content}</main>
  const backLink = <Button asChild variant="outline" className={cn('self-start', touch)}><Link to={back}><ChevronLeft aria-hidden />{t('backToList')}</Link></Button>

  if (error?.missing) return main(<EmptyState icon={BookOpen} title={t('notFound')} description={t('notFoundText')} action={backLink} />)
  if (error) return main(<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
    <span>{error.text}</span><Button type="button" variant="outline" size="sm" className={touch} onClick={() => void load()}><RefreshCw aria-hidden />{t('retry')}</Button>
  </div>)
  if (!article) return main(<div role="status" aria-label={t('loading')} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
    <div className="flex max-w-[880px] flex-col gap-4"><Skeleton className="aspect-[2/1] rounded-2xl" /><Skeleton className="h-9 w-3/4" />{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
    <Skeleton className="h-64 rounded-2xl max-lg:hidden" />
  </div>)

  const tone = toneFor(article.topic.name)
  const topicLink = `/blogs?topicId=${encodeURIComponent(article.topic.id)}`
  const related = article.relatedArticles.slice(0, 5)
  const tocList = <ol className="flex flex-col gap-0.5 text-sm">
    {headings.map(heading => <li key={heading.id} className={heading.level === 3 ? 'pl-4' : ''}>
      <a href={`#${heading.id}`} aria-current={active === heading.id ? 'location' : undefined}
        className={cn('block rounded-md border-l-2 border-transparent px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring', touch,
          active === heading.id && 'border-accent-text bg-muted font-medium text-foreground')}>{heading.text}</a>
    </li>)}
  </ol>

  const TopicIcon = topicIcon(article.topic.name)
  const chip = 'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium'
  const sectionIcon = (Icon: LucideIcon, cardTone: keyof typeof TONE_TILE) => <span className={cn('flex size-7 items-center justify-center rounded-lg border', TONE_TILE[cardTone])}><Icon className="size-4" aria-hidden /></span>
  const enter = 'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-500'

  return main(<>
    <div role="progressbar" aria-label={t('progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="fixed inset-x-0 top-0 z-40 h-1">
      <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${progress}%` }} />
    </div>
    <Breadcrumb aria-label={t('breadcrumb')}>
      <BreadcrumbList className="max-sm:hidden">
        <BreadcrumbItem><BreadcrumbLink asChild><Link to={back} className={cn('inline-flex items-center gap-1.5', touch)}><Newspaper className="size-4" aria-hidden />{t('articles')}</Link></BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbLink asChild><Link to={topicLink} className={touch}>{article.topic.name}</Link></BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="truncate">{article.title}</BreadcrumbPage></BreadcrumbItem>
      </BreadcrumbList>
      <Link to={back} className={cn('inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:hidden', touch)}><ChevronLeft className="size-4" aria-hidden />{t('articles')}</Link>
    </Breadcrumb>

    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
      <article className={cn('min-w-0 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm', enter)}>
        {article.coverImageUrl
          ? <img src={article.coverImageUrl} alt={t('cover', { title: article.title })} className="max-h-[480px] w-full border-b border-border object-cover" />
          : <div aria-hidden className={cn('relative flex h-40 items-center justify-center overflow-hidden border-b sm:h-52', TONE_TILE[tone])}>
              <TopicIcon className="absolute -top-6 -left-6 size-40 rotate-12 opacity-10" />
              <Hash className="absolute -right-8 -bottom-10 size-48 -rotate-12 opacity-10" />
              <span className="flex size-20 items-center justify-center rounded-3xl border border-current/30 bg-card/60 shadow-lg"><TopicIcon className="size-10" /></span>
            </div>}
        <div className="flex flex-col gap-6 p-5 sm:p-8">
          <header className="flex flex-col gap-4">
            <Link to={topicLink} className={cn('inline-flex items-center gap-2 self-start text-sm font-semibold transition hover:opacity-80', toneText(tone), touch)}>
              <span className={cn('flex size-8 items-center justify-center rounded-lg border', TONE_TILE[tone])}><TopicIcon className="size-4" aria-hidden /></span>{article.topic.name}
            </Link>
            <h1 className="text-[28px] leading-tight font-bold tracking-tight sm:text-4xl sm:leading-[1.2]">{article.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(chip, 'border-border bg-muted/60 text-foreground')}><UserAvatar name={article.author.fullName} url={article.author.avatarUrl} className="size-5 text-[9px]" /><span className="font-semibold">{article.author.fullName}</span></span>
              <span className={cn(chip, 'border-border text-muted-foreground')}><CalendarDays className="size-3.5" aria-hidden /><time dateTime={article.publishedAt}>{formatDate(article.publishedAt, language)}</time></span>
              {article.versionNumber > 1 && <span className={cn(chip, TONE_TILE.green)}><RefreshCw className="size-3.5" aria-hidden /><time dateTime={article.approvedAt}>{t('updated', { date: formatDate(article.approvedAt, language) })}</time></span>}
              <span className={cn(chip, TONE_TILE.sky)}><Clock3 className="size-3.5" aria-hidden /><span>{t('minutes', { n: article.readingMinutes })}</span></span>
              <span className="ml-auto flex flex-wrap items-start gap-2">
                {canSave && <ArticleSaveButton key={article.id} articleId={article.id} saved={article.saved} language={language} withText />}
                <CopyButton language={language} label={t('copyLink')} text={() => window.location.href.split('#')[0]}
                  className="h-8 border border-border px-3 text-sm text-foreground"><Link2 className="size-4" aria-hidden /><span>{t('copyLink')}</span></CopyButton>
              </span>
            </div>
          </header>
          {article.summary && <section aria-label={t('summary')} className="rounded-r-xl border-l-4 border-tone-blue-fg bg-tone-blue-bg px-5 py-4">
            <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-tone-blue-fg"><Sparkles className="size-4" aria-hidden />{t('summary')}</p>
            <p className="text-[15px] leading-relaxed text-foreground/90">{article.summary}</p>
          </section>}
          {!!headings.length && <details className="group rounded-xl border border-border bg-muted/40 lg:hidden">
            <summary className={cn('flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold', touch)}>
              <span className="flex items-center gap-2"><ListTree className="size-4 text-accent-text" aria-hidden />{t('toc')}</span><ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <nav aria-label={t('toc')} className="px-2 pb-3">{tocList}</nav>
          </details>}
          <ul aria-label={t('tags')} className="flex flex-wrap gap-2">
            <li><Link to={topicLink} className={cn('inline-flex h-9 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-md', TONE_TILE.purple, touch)}><Tag className="size-4" aria-hidden />{article.topic.name}</Link></li>
            {article.tags.map(tag => <li key={tag.id}><span className={cn('inline-flex h-9 items-center gap-1 rounded-xl border px-3.5 text-sm', TONE_TILE[toneFor(tag.name)])}><Hash className="size-3.5" aria-hidden />{tag.name}</span></li>)}
          </ul>
          <div ref={body} className="[&>div]:text-base [&>div]:leading-[1.85]"><MarkdownContent content={article.content} anchors language={language} /></div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            {backLink}
            <span className="flex items-center gap-2 text-sm text-muted-foreground"><UserAvatar name={article.author.fullName} url={article.author.avatarUrl} className="size-7 text-[10px]" />{article.author.fullName}</span>
          </footer>
        </div>
      </article>

      <aside aria-label={t('sidebar')} className="flex flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pb-2 [&>*]:shrink-0">
        <Card className={cn('gap-0 overflow-hidden rounded-2xl py-0 shadow-sm', enter)} style={{ animationDelay: '80ms' }}>
          <div className="h-14 border-b border-tone-blue-border bg-tone-blue-bg" aria-hidden />
          <div className="-mt-8 flex flex-col gap-3 px-5 pb-5">
            <UserAvatar name={article.author.fullName} url={article.author.avatarUrl} className="size-16 text-lg ring-4 ring-card" />
            <div className="flex flex-col gap-1">
              <h2 className="text-[11px] font-semibold tracking-[.05em] text-muted-foreground uppercase">{t('aboutAuthor')}</h2>
              <p className="text-base font-bold">{article.author.fullName}</p>
              {article.author.expertise && <Badge tone="purple" className="mt-1 max-w-full rounded-lg whitespace-normal"><Briefcase aria-hidden />{article.author.expertise}</Badge>}
            </div>
            {article.author.bioExcerpt && <p className="text-sm leading-relaxed text-muted-foreground">{article.author.bioExcerpt}</p>}
          </div>
        </Card>
        {!!headings.length && <Card className={cn(SECTION, 'shadow-sm max-lg:hidden', enter)} style={{ animationDelay: '140ms' }}>
          <h2 className={SECTION_TITLE}>{sectionIcon(ListTree, 'sky')}{t('toc')}</h2>
          <nav aria-label={t('toc')}>{tocList}</nav>
        </Card>}
        {!!related.length && <Card className={cn(SECTION, 'shadow-sm', enter)} style={{ animationDelay: '200ms' }}>
          <h2 className={SECTION_TITLE}>{sectionIcon(BookOpen, 'amber')}{t('related')}</h2>
          <ul className="flex flex-col gap-1">{related.map(item => <li key={item.id}>
            <Link to={`/blogs/${item.id}`} state={location.state} className={cn('group flex gap-3 rounded-xl p-1.5 transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring', touch)}>
              <span className={cn('flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border', TONE_TILE[tone])}>
                {item.coverImageUrl ? <img src={item.coverImageUrl} alt="" loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-110" /> : <TopicIcon className="size-6 transition group-hover:scale-110" aria-hidden />}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5"><span className="line-clamp-2 text-sm font-medium transition-colors group-hover:text-accent-text">{item.title}</span>
                <time dateTime={item.publishedAt} className="text-xs text-muted-foreground">{formatDate(item.publishedAt, language)}</time></span>
            </Link>
          </li>)}</ul>
          <Button asChild variant="ghost" size="sm" className={cn('self-start text-accent-text', touch)}><Link to={topicLink}>{t('viewAll', { topic: article.topic.name })}<ArrowRight aria-hidden /></Link></Button>
        </Card>}
        <Card className={cn(SECTION, 'shadow-sm', enter)} style={{ animationDelay: '260ms' }}>
          <h2 className={SECTION_TITLE}>{sectionIcon(Zap, 'green')}{t('quickActions')}</h2>
          <ul className="flex flex-col gap-0.5 text-sm">
            <li><Link to={back} className={cn(QUICK, touch)}><LayoutGrid className="size-4 text-tone-blue-fg" aria-hidden />{t('allArticles')}</Link></li>
            <li><Link to={topicLink} className={cn(QUICK, touch)}><TopicIcon className={cn('size-4', toneText(tone))} aria-hidden />{t('sameTopic', { topic: article.topic.name })}</Link></li>
          </ul>
        </Card>
      </aside>
    </div>
    <BackToTopButton label={t('backToTop')} />
  </>)
}
