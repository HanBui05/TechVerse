import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { Ban, CheckCircle2, Clock, EyeOff, PencilLine } from 'lucide-react'
import type { BadgeTone } from '@/components/ui/badge'
import { moderatorPublicationLabel, moderatorText, workflowLabel } from '../../data/articleI18n'
import { moderatorArticles } from '../../services/articleService'
import type { PublicationStatus, WorkflowStatus } from '../../types/articles'
import type { Language } from '../../types/preferences'
import { TONE_TILE, fieldLabel } from '../Author/AuthorBlogsPage'

export type StatFilter = { workflowStatus: WorkflowStatus | ''; publicationStatus: PublicationStatus | '' }
// Two axes (wireframe 2b-1): queue counts by workflow, publication counts by what readers see.
export const STATS: [StatFilter, ComponentType<{ className?: string }>, BadgeTone][] = [
  [{ workflowStatus: 'PENDING', publicationStatus: '' }, Clock, 'amber'],
  [{ workflowStatus: 'CHANGES_REQUESTED', publicationStatus: '' }, PencilLine, 'sky'],
  [{ workflowStatus: '', publicationStatus: 'PUBLISHED' }, CheckCircle2, 'green'],
  [{ workflowStatus: '', publicationStatus: 'HIDDEN' }, EyeOff, 'rose'],
  [{ workflowStatus: '', publicationStatus: 'REMOVED' }, Ban, 'rose'],
]
const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const label = ({ workflowStatus, publicationStatus }: StatFilter, language: Language) => workflowStatus ? workflowLabel[workflowStatus][language] : moderatorPublicationLabel[publicationStatus as PublicationStatus][language]

/** Count-only requests (size=1). Counts are decoration: a failure shows “—” instead of blocking the page. */
/** `list` defaults to the article queue; the course queue passes its own (same filter, same statuses). */
export function useArticleStats(list: (filter: { page: number; size: number } & StatFilter) => Promise<{ totalElements: number }> = moderatorArticles.list) {
  const [stats, setStats] = useState<(number | null)[]>(STATS.map(() => null))
  // Only the newest round may write: an older one answering late would show counts from before a review.
  const latest = useRef(0)
  const load = useCallback(() => {
    const round = ++latest.current
    STATS.forEach(([filter], i) => list({ page: 0, size: 1, ...filter })
      .then(result => result.totalElements, () => null)
      .then(value => { if (round === latest.current) setStats(old => old.map((v, j) => j === i ? value : v)) }))
  }, [list])
  useEffect(() => { load() }, [load])
  return [stats, load] as const
}

/** Tiles; with `onSelect` each tile is a filter toggle (pressed when it matches the current filter). */
export function ArticleStats({ stats, language, active, onSelect, label: name }: { stats: (number | null)[]; language: Language; active?: StatFilter; onSelect?: (filter: StatFilter) => void; label?: string }) {
  const t = moderatorText(language)
  const format = (n: number | null) => n === null ? '—' : n.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')
  return <section aria-label={name ?? t('stats')} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    {STATS.map(([filter, Icon, tone], i) => {
      const pressed = Boolean(active && active.workflowStatus === filter.workflowStatus && active.publicationStatus === filter.publicationStatus)
      const body = <>
        <span className="flex min-w-0 flex-col gap-1"><span className={`${fieldLabel} ${pressed ? 'text-current' : ''}`}>{label(filter, language)}</span><span className="text-2xl font-bold tabular-nums">{format(stats[i])}</span></span>
        <span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${TONE_TILE[tone]}`}><Icon className="size-5" /></span>
      </>
      const frame = 'flex items-center justify-between gap-3 rounded-2xl border p-4 text-left shadow-sm'
      return onSelect
        ? <button key={i} type="button" aria-pressed={pressed} onClick={() => onSelect(filter)} className={`${frame} outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring ${touch} ${pressed ? TONE_TILE[tone] : 'border-border bg-card text-card-foreground hover:bg-muted/50'}`}>{body}</button>
        : <div key={i} className={`${frame} border-border bg-card text-card-foreground`}>{body}</div>
    })}
  </section>
}
