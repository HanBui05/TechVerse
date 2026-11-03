import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { CheckCircle2, Clock, EyeOff, PencilLine } from 'lucide-react'
import { statusLabel } from '../../data/managementI18n'
import type { Language } from '../../types/preferences'
import { request } from '../../services/api/client'

const KEYS = ['PENDING', 'PUBLISHED', 'CHANGES_REQUESTED', 'HIDDEN'] as const
type Stats = Record<(typeof KEYS)[number], number>
const fieldLabel = 'text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground'
const cards: [(typeof KEYS)[number], ComponentType<{ className?: string }>, string, string][] = [
  ['PENDING', Clock, 'text-tone-amber-fg', 'border-tone-amber-border bg-tone-amber-bg text-tone-amber-fg'],
  ['PUBLISHED', CheckCircle2, 'text-tone-green-fg', 'border-tone-green-border bg-tone-green-bg text-tone-green-fg'],
  ['CHANGES_REQUESTED', PencilLine, 'text-tone-sky-fg', 'border-tone-sky-border bg-tone-sky-bg text-tone-sky-fg'],
  ['HIDDEN', EyeOff, 'text-tone-slate-fg', 'border-tone-slate-border bg-tone-slate-bg text-tone-slate-fg'],
]

// Article counts per status (count-only requests). Statistics are decoration: a failure leaves "—" instead of blocking the page.
export function useArticleStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  // Only the newest request may write: an older one answering late would show counts from before a review.
  const latest = useRef(0)
  const load = useCallback(async () => {
    const id = ++latest.current
    try {
      const counts = await Promise.all(KEYS.map(key => request<{ totalElements: number }>(`/api/v1/moderator/articles?${new URLSearchParams({ page: '0', size: '1', status: key })}`)))
      if (id !== latest.current) return
      setStats(Object.fromEntries(KEYS.map((key, i) => [key, counts[i].totalElements ?? 0])) as Stats)
    } catch { if (id === latest.current) setStats(null) }
  }, [])
  useEffect(() => { void load() }, [load])
  return [stats, load] as const
}

export function ArticleStats({ stats, language }: { stats: Stats | null; language: Language }) {
  return <dl className="m-0 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
    {cards.map(([key, Icon, number, tile]) => <div key={key} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
      <div className="flex min-w-0 flex-col gap-2">
        <dt className={fieldLabel}>{statusLabel(key, 'article', language)}</dt>
        <dd className={`m-0 text-2xl font-bold tabular-nums sm:text-3xl ${number}`}>{stats ? stats[key].toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US') : '—'}</dd>
      </div>
      <span aria-hidden className={`hidden size-11 shrink-0 items-center justify-center rounded-xl border sm:flex ${tile}`}><Icon className="size-5" /></span>
    </div>)}
  </dl>
}
