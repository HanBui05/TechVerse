import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Boxes, Braces, CalendarDays, Clock3, Code2, Cpu, Database, Globe, Hash, Layers, Terminal, type LucideIcon } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { toneFor } from '@/lib/utils'
import { UserAvatar } from '../UserAvatar'
import { ArticleSaveButton } from './ArticleSaveButton'
import { readerText, relativeDate } from '../../data/articleI18n'
import { TONE_TILE } from '../../pages/Author/AuthorBlogsPage'
import type { PublicArticleSummary } from '../../types/articles'
import type { Language } from '../../types/preferences'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const ICONS: LucideIcon[] = [Code2, Database, Cpu, Globe, Layers, Terminal, Braces, Boxes]

/** Decorative icon for a topic: the same name always gets the same icon (like its `toneFor` color). */
export function topicIcon(name: string): LucideIcon {
  let hash = 7
  for (const char of name.trim().toLowerCase()) hash = (hash * 17 + char.charCodeAt(0)) >>> 0
  return ICONS[hash % ICONS.length]
}

/** Text color class of a tone (the tile classes already list it, so Tailwind sees it statically). */
export const toneText = (tone: keyof typeof TONE_TILE) => TONE_TILE[tone].split(' ').find(c => c.startsWith('text-'))

type CardProps = { article: PublicArticleSummary; from: string; language?: Language; canSave?: boolean; saveButton?: ReactNode }
/**
 * Reader grid card (javabuilder-patterns 4.3); `from` is the list URL the detail “Back to list” returns to. Shared with
 * `/me/saved-articles`, which passes its own `saveButton`. `canSave=false` (management accounts) renders no save control.
 */
export function ArticleCard({ article, from, language = 'vi', canSave = true, saveButton }: CardProps) {
  const t = readerText(language)
  const to = `/blogs/${article.id}`
  const state = { from }
  const tone = toneFor(article.topic.name)
  const Icon = topicIcon(article.topic.name)
  const extraTags = article.tags.length - 3
  return <article className="group flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm transition duration-300 hover:-translate-y-1 hover:border-accent-text/40 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0">
    <Link to={to} state={state} tabIndex={-1} aria-hidden className="relative block aspect-[16/10] overflow-hidden border-b border-border">
      {article.coverImageUrl
        ? <img src={article.coverImageUrl} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105 motion-reduce:transition-none" />
        : <span className={cn('relative flex size-full flex-col items-center justify-center gap-3 overflow-hidden', TONE_TILE[tone])}>
            <Icon className="absolute -top-4 -left-4 size-24 rotate-12 opacity-10" aria-hidden />
            <Hash className="absolute -right-3 -bottom-5 size-28 -rotate-12 opacity-10" aria-hidden />
            <span className="flex size-16 items-center justify-center rounded-2xl border border-current/30 bg-card/60 shadow-sm transition duration-500 group-hover:scale-110 group-hover:rotate-3 motion-reduce:transition-none"><Icon className="size-8" aria-hidden /></span>
            <span className="max-w-[80%] truncate text-sm font-semibold">{article.topic.name}</span>
          </span>}
      <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border border-border bg-card/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
        <Clock3 className="size-3.5 text-tone-sky-fg" aria-hidden />{t('minutes', { n: article.readingMinutes })}
      </span>
    </Link>
    <div className="flex flex-1 flex-col gap-3 p-5">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden /><time dateTime={article.publishedAt}>{relativeDate(article.publishedAt, language)}</time></p>
      <h2 className="text-[17px] font-bold leading-snug"><Link to={to} state={state} className="line-clamp-2 transition-colors pointer-coarse:min-h-11 group-hover:text-accent-text focus-visible:outline-2 focus-visible:outline-ring">{article.title}</Link></h2>
      {article.summary && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{article.summary}</p>}
      <ul className="flex flex-wrap gap-1.5">
        <li><Badge tone={tone} className="rounded-lg px-2 py-1 font-semibold"><Icon aria-hidden />{article.topic.name}</Badge></li>
        {article.tags.slice(0, 3).map(tag => <li key={tag.id}><Badge tone={toneFor(tag.name)} className="rounded-lg px-2 py-1"><Hash aria-hidden />{tag.name}</Badge></li>)}
        {extraTags > 0 && <li><Badge variant="outline" className="rounded-lg px-2 py-1 font-semibold text-muted-foreground" title={t('moreTagsLabel', { n: extraTags })}>{t('moreTags', { n: extraTags })}</Badge></li>}
      </ul>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
        <span className="flex min-w-0 items-center gap-2.5">
          <UserAvatar name={article.author.fullName} url={article.author.avatarUrl} className="size-9 text-xs ring-2 ring-accent-text/30 ring-offset-2 ring-offset-card" />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-foreground">{article.author.fullName}</span>
            <span className="text-[11px] tracking-wide text-muted-foreground uppercase">{t('author')}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-start gap-1.5">
          {canSave && (saveButton ?? <ArticleSaveButton key={article.id} articleId={article.id} saved={article.saved} language={language} />)}
          <Link to={to} state={state} aria-label={t('readMoreOf', { title: article.title })}
            className={cn('inline-flex h-9 items-center gap-1 rounded-md bg-primary/10 px-3 text-sm font-semibold text-accent-text transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring', touch)}>
            {t('readMore')}<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </span>
      </div>
    </div>
  </article>
}
