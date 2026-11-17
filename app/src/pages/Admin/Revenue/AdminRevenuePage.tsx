import { useSearchParams, Link } from 'react-router-dom'
import { ChevronRight, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '../../../components/EmptyState'
import { Pagination } from '../../../components/Pagination'
import { payAdminText } from '../../../data/courseI18n'
import { adminRevenue, vnd } from '../../../services/courseService'
import { touch } from '../../Courses/courseParts'
import { DateField, ISO_DAY, RetryAlert, card, fieldLabel, useLoad } from '../../Author/Revenue/AuthorRevenuePage'
import type { Language } from '../../../types/preferences'

/** Admin marketplace revenue: totals and rows are the server's snapshot numbers; the date filter and page live in the URL. */
export function AdminRevenuePage({ language = 'vi' }: { language?: Language }) {
  const t = payAdminText(language)
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
  const tile = (key: Parameters<typeof t>[0], value: string) => <div key={key} className={card}><dt className={fieldLabel}>{t(key)}</dt><dd className="text-xl font-bold tabular-nums [overflow-wrap:anywhere]">{value}</dd></div>

  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-2">
      <Badge tone="sky" className="self-start font-semibold"><Wallet aria-hidden />{t('kicker')}</Badge>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('adminRevenueTitle')}</h1>
    </header>

    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <DateField label={t('fromDate')} value={from} onChange={v => update({ from: v })} language={language} t={t} />
        <DateField label={t('toDate')} value={to} onChange={v => update({ to: v })} language={language} t={t} invalid={rangeInvalid} />
        {filtered && <Button type="button" variant="ghost" className={touch} onClick={() => update({ from: '', to: '' })}>{t('clearFilters')}</Button>}
      </div>
      {rangeInvalid && <p className="text-sm text-danger">{t('rangeInvalid')}</p>}
    </div>

    {rev.error
      ? <RetryAlert message={rev.error} t={t} onRetry={() => void rev.reload()} />
      : rev.loading
        ? <div role="status" aria-label={t('adminRevenueLoading')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        : data && <>
            <section aria-label={t('filteredHeading')} className="flex flex-col gap-2" aria-busy={rev.loading}><h2 className={fieldLabel}>{t('filteredHeading')}</h2>
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {tile('paidOrders', String(data.totals.itemCount))}{tile('totalIn', money(data.totals.grossAmount))}{tile('platformFee', money(data.totals.platformAmount))}{tile('authorShare', money(data.totals.authorAmount))}
              </dl></section>
            <section aria-label={t('allTimeHeading')} className="flex flex-col gap-2"><div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={fieldLabel}>{t('allTimeHeading')}</h2>
              <Button asChild variant="ghost" size="sm" className={touch}><Link to="/admin/payouts">{t('goPayouts')}<ChevronRight aria-hidden /></Link></Button></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{([['earnedTile', data.ledger.earnedAmount], ['spentTile', data.ledger.paidOutAmount], ['owedTile', data.ledger.owedAmount]] as const).map(([key, value]) =>
                <Link key={key} to="/admin/payouts" className={`${card} hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ${touch}`}><span className={fieldLabel}>{t(key)}</span><span className="text-xl font-bold tabular-nums [overflow-wrap:anywhere]">{money(value)}</span></Link>)}</div>
              <p className="text-sm text-muted-foreground">{t('allTimeNote')}</p></section>

            {data.courses.content.length === 0
              ? <EmptyState icon={Wallet} title={filtered ? t('filterEmpty') : t('revenueEmpty')} description={filtered ? undefined : t('revenueEmptyText')} />
              : <>
                  <ul aria-busy={rev.loading} className="flex flex-col gap-3">{data.courses.content.map(row => <li key={row.courseId} className={card}>
                    <p className="flex flex-wrap items-baseline justify-between gap-x-3"><span className="font-bold [overflow-wrap:anywhere]">{row.courseTitle} · {row.authorName}</span><span className="text-sm text-muted-foreground tabular-nums">{t('salesCount', { n: row.itemCount })}</span></p>
                    <p className="text-sm text-muted-foreground">{t('adminCourseLine', { gross: money(row.grossAmount), platform: money(row.platformAmount), author: money(row.authorAmount) })}</p>
                  </li>)}</ul>
                  <Pagination language={language} page={page} totalPages={data.courses.totalPages} loading={rev.loading} onPageChange={next => setParams(prev => { const p = new URLSearchParams(prev); if (next > 0) p.set('page', String(next)); else p.delete('page'); return p })} />
                </>}
          </>}
  </main>
}
