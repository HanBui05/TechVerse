import { useSearchParams, Link } from 'react-router-dom'
import type { ComponentType } from 'react'
import { ArrowUpRight, CheckCircle2, ChevronRight, Clock, Layers, Percent, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '../../../components/EmptyState'
import { Pagination } from '../../../components/Pagination'
import { payAdminText } from '../../../data/courseI18n'
import { adminRevenue, vnd } from '../../../services/courseService'
import { touch } from '../../Courses/courseParts'
import { DateField, ISO_DAY, RetryAlert, fieldLabel, useLoad } from '../../Author/Revenue/AuthorRevenuePage'
import type { Language } from '../../../types/preferences'

const KPI_ICON: Record<'paidOrders' | 'totalIn' | 'platformFee' | 'authorShare', ComponentType<{ className?: string }>> = {
  paidOrders: Receipt,
  totalIn: TrendingUp,
  platformFee: Percent,
  authorShare: Wallet,
}

const LEDGER_ICON: Record<'earnedTile' | 'spentTile' | 'owedTile', ComponentType<{ className?: string }>> = {
  earnedTile: Layers,
  spentTile: CheckCircle2,
  owedTile: Clock,
}

/** Admin marketplace revenue: clean financial dashboard layout. */
export function AdminRevenuePage({ language = 'vi' }: { language?: Language }) {
  const t = payAdminText(language)
  const vi = language === 'vi'
  const [params, setParams] = useSearchParams()
  const raw = Number(params.get('page'))
  const page = Number.isInteger(raw) && raw > 0 ? raw : 0
  const day = (name: string) => { const v = params.get(name) ?? ''; return ISO_DAY.test(v) ? v : '' }
  const from = day('from'), to = day('to')
  const rangeInvalid = Boolean(from && to && from > to)
  const filtered = Boolean(from || to)
  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params)
    next.delete('page')
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key) }
    setParams(next)
  }
  const rev = useLoad(rangeInvalid ? null : () => adminRevenue(page, { from, to }), `${from}|${to}|${page}`, language, t('adminRevenueLoadError'))
  const money = (n: number) => vnd(n, language)
  const data = rev.data

  const tile = (key: keyof typeof KPI_ICON, value: string) => {
    const Icon = KPI_ICON[key]
    return <div key={key} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex min-w-0 flex-col gap-1.5">
        <dt className={fieldLabel}>{t(key)}</dt>
        <dd className="m-0 text-2xl font-semibold tracking-tight text-foreground tabular-nums [overflow-wrap:anywhere]">{value}</dd>
      </div>
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </div>
  }

  const maxCourseGross = Math.max(1, ...(data?.courses.content.map(c => c.grossAmount) ?? [1]))

  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div className="flex flex-col gap-1">
        <span className={fieldLabel}>{t('kicker')}</span>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('adminRevenueTitle')}</h1>
      </div>
      <div className="flex flex-wrap items-end gap-2.5">
        <DateField label={t('fromDate')} value={from} onChange={v => update({ from: v })} language={language} t={t} />
        <DateField label={t('toDate')} value={to} onChange={v => update({ to: v })} language={language} t={t} invalid={rangeInvalid} />
        {filtered && <Button type="button" variant="ghost" size="sm" className={touch} onClick={() => update({ from: '', to: '' })}>{t('clearFilters')}</Button>}
      </div>
    </header>
    {rangeInvalid && <p className="text-sm text-danger">{t('rangeInvalid')}</p>}

    {rev.error
      ? <RetryAlert message={rev.error} t={t} onRetry={() => void rev.reload()} />
      : rev.loading
        ? <div role="status" aria-label={t('adminRevenueLoading')} className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        : data && <>
            <section aria-label={t('filteredHeading')} className="flex flex-col gap-3" aria-busy={rev.loading}>
              <h2 className={fieldLabel}>{t('filteredHeading')}</h2>
              <dl className="m-0 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {tile('paidOrders', String(data.totals.itemCount))}{tile('totalIn', money(data.totals.grossAmount))}{tile('platformFee', money(data.totals.platformAmount))}{tile('authorShare', money(data.totals.authorAmount))}
              </dl>
            </section>

            <section aria-label={t('allTimeHeading')} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className={fieldLabel}>{t('allTimeHeading')}</h2>
                <Button asChild variant="ghost" size="sm" className={touch}><Link to="/admin/payouts">{t('goPayouts')}<ChevronRight aria-hidden /></Link></Button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{([['earnedTile', data.ledger.earnedAmount], ['spentTile', data.ledger.paidOutAmount], ['owedTile', data.ledger.owedAmount]] as const).map(([key, value]) => {
                const Icon = LEDGER_ICON[key]
                return <Link key={key} to="/admin/payouts" className={`group flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring ${touch}`}>
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className={fieldLabel}>{t(key)}</span>
                    <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums [overflow-wrap:anywhere]">{money(value)}</span>
                  </span>
                  <Icon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden />
                </Link>
              })}</div>
              <p className="text-xs text-muted-foreground">{t('allTimeNote')}</p>
            </section>

            {data.courses.content.length === 0
              ? <EmptyState icon={Wallet} title={filtered ? t('filterEmpty') : t('revenueEmpty')} description={filtered ? undefined : t('revenueEmptyText')} />
              : <Card className="gap-0 overflow-hidden rounded-xl py-0">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
                    <h2 className="text-sm font-semibold">{vi ? 'Doanh thu theo khóa học' : 'Revenue by course'}</h2>
                    <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden />
                  </div>
                  <ul aria-busy={rev.loading} className="m-0 flex list-none flex-col divide-y divide-border p-0">{data.courses.content.map(row => {
                    const barPct = Math.max(4, Math.round((row.grossAmount / maxCourseGross) * 100))
                    return <li key={row.courseId} className="flex flex-col gap-2 px-6 py-4 transition-colors hover:bg-muted/30">
                      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-semibold text-foreground [overflow-wrap:anywhere]">{row.courseTitle} · <span className="font-normal text-muted-foreground">{row.authorName}</span></span>
                        <span className="text-xs font-medium text-muted-foreground tabular-nums">{t('salesCount', { n: row.itemCount })}</span>
                      </p>
                      <div aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-foreground/70" style={{ width: `${barPct}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground">{t('adminCourseLine', { gross: money(row.grossAmount), platform: money(row.platformAmount), author: money(row.authorAmount) })}</p>
                    </li>
                  })}</ul>
                  <div className="border-t border-border px-6 py-4">
                    <Pagination language={language} page={page} totalPages={data.courses.totalPages} loading={rev.loading} onPageChange={next => setParams(prev => { const p = new URLSearchParams(prev); if (next > 0) p.set('page', String(next)); else p.delete('page'); return p })} />
                  </div>
                </Card>}
          </>}
  </main>
}
