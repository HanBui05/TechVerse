import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Hash } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { toneFor } from '@/lib/utils'
import { UserAvatar } from '../../components/UserAvatar'
import { topicIcon } from '../../components/articles/ArticleCard'
import { readerCourseText } from '../../data/courseI18n'
import { TONE_TILE, formatDate } from '../Author/AuthorBlogsPage'
import type { CourseLevel, PublicCourseSummary } from '../../types/courses'
import type { Language } from '../../types/preferences'

export const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
export const LEVEL_TONE: Record<CourseLevel, 'green' | 'amber' | 'rose'> = { BEGINNER: 'green', INTERMEDIATE: 'amber', ADVANCED: 'rose' }

/** Accessible progress bar: the label carries the numbers, the bar is decoration for sighted users. */
export function ProgressBar({ percent, label, className }: { percent: number; label: string; className?: string }) {
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
    <div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${percent}%` }} />
  </div>
}

/** Cover image, or the tone tile with the topic icon (same fallback as article cards). */
export function CourseCover({ course, className }: { course: Pick<PublicCourseSummary, 'coverImageUrl' | 'topic'>; className?: string }) {
  const tone = toneFor(course.topic.name)
  const Icon = topicIcon(course.topic.name)
  return course.coverImageUrl
    ? <img src={course.coverImageUrl} alt="" loading="lazy" className={cn('size-full object-cover', className)} />
    : <span className={cn('flex size-full items-center justify-center', TONE_TILE[tone], className)}><Icon className="size-8" aria-hidden /></span>
}

/** Catalog card: whole title is the link; no chapter/lesson counts (the list does not return them). */
export function CourseCard({ course, language }: { course: PublicCourseSummary; language: Language }) {
  const t = readerCourseText(language)
  const to = `/courses/${course.id}`
  const tone = toneFor(course.topic.name)
  const Icon = topicIcon(course.topic.name)
  const extra = course.tags.length - 3
  return <article className="group flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm transition duration-300 hover:-translate-y-1 hover:border-accent-text/40 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0">
    <Link to={to} tabIndex={-1} aria-hidden className="relative block aspect-[16/10] overflow-hidden border-b border-border">
      <CourseCover course={course} />
      <Badge tone={LEVEL_TONE[course.level]} className="absolute top-3 left-3 rounded-full px-2.5 py-1 font-semibold">{t(course.level)}</Badge>
    </Link>
    <div className="flex flex-1 flex-col gap-3 p-5">
      <h2 className="text-[17px] font-bold leading-snug"><Link to={to} className={cn('line-clamp-2 group-hover:text-accent-text focus-visible:outline-2 focus-visible:outline-ring', touch)}>{course.title}</Link></h2>
      {course.summary && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{course.summary}</p>}
      <ul className="flex flex-wrap gap-1.5">
        <li><Badge tone={tone} className="rounded-lg px-2 py-1 font-semibold"><Icon aria-hidden />{course.topic.name}</Badge></li>
        {course.tags.slice(0, 3).map(tag => <li key={tag.id}><Badge tone={toneFor(tag.name)} className="rounded-lg px-2 py-1"><Hash aria-hidden />{tag.name}</Badge></li>)}
        {extra > 0 && <li><Badge variant="outline" className="rounded-lg px-2 py-1 font-semibold text-muted-foreground">{t('moreTags', { n: extra })}</Badge></li>}
      </ul>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden /><time dateTime={course.updatedAt}>{t('updated', { date: formatDate(course.updatedAt, language) })}</time></p>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
        <span className="flex min-w-0 items-center gap-2.5">
          <UserAvatar name={course.author.fullName} url={course.author.avatarUrl} className="size-9 text-xs ring-2 ring-accent-text/30 ring-offset-2 ring-offset-card" />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-foreground">{course.author.fullName}</span>
            <span className="text-[11px] tracking-wide text-muted-foreground uppercase">{t('author')}</span>
          </span>
        </span>
        <Link to={to} aria-label={t('viewCourseOf', { title: course.title })} className={cn('inline-flex h-9 shrink-0 items-center gap-1 rounded-md bg-primary/10 px-3 text-sm font-semibold text-accent-text transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring', touch)}>
          {t('viewCourse')}<ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  </article>
}
