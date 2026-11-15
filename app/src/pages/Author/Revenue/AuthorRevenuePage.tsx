import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '../../../components/EmptyState'
import { Pagination } from '../../../components/Pagination'
import { courseErrorText, payAdminText } from '../../../data/courseI18n'
import { revenue, vnd } from '../../../services/courseService'
import { formatDate } from '../AuthorBlogsPage'
import { touch } from '../../Courses/courseParts'
import type { AuthorRevenue } from '../../../types/courses'
import type { Language } from '../../../types/preferences'

/** Author revenue (wireframe 3b): totals and rows are the server's order-time snapshot, never recomputed here. No buyer data, no payout wording. */
export function AuthorRevenuePage({ language = 'vi' }: { language?: Language }) {
  const t = payAdminText(language)
  const [params, setParams] = useSearchParams()
  const raw = Number(params.get('page'))
  const page = Number.isInteger(raw) && raw > 0 ? raw : 0
  const [data, setData] = useState<AuthorRevenue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const latest = useRef(0)

  const load = useCallback(async () => {
    const id = ++latest.current
    setLoading(true); setError('')
    try {
      const result = await revenue(page)
      if (id === latest.current) setData(result)
    } catch (e) {
      if (id === latest.current) { setData(null); setError(courseErrorText(e, language, t('revenueLoadError'))) }
    } finally {
      if (id === latest.current) setLoading(false)
    }
  }, [page, language]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [load])

  const tiles = data && [['orders', String(data.totals.itemCount)], ['gross', vnd(data.totals.grossAmount, language)], ['platformShare', vnd(data.totals.platformAmount, language)], ['yourShare', vnd(data.totals.authorAmount, language)]] as const
  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-2">
      <Badge tone="purple" className="self-start font-semibold"><Wallet aria-hidden />{t('authorSpace')}</Badge>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('revenueTitle')}</h1>
    </header>

    {error
      ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger"><span>{error}</span>
          <Button type="button" variant="outline" size="sm" className={touch} onClick={() => void load()}><RefreshCw aria-hidden />{t('retry')}</Button></div>
      : loading && !data
        ? <div role="status" aria-label={t('revenueLoading')} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        : data && tiles && <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{tiles.map(([key, value]) => <div key={key} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <dt className="text-xs font-semibold uppercase tracking-[.05em] text-muted-foreground">{t(key)}</dt><dd className="text-xl font-bold tabular-nums [overflow-wrap:anywhere]">{value}</dd></div>)}</dl>
          <p className="text-sm text-muted-foreground">{t('snapshotNote')}</p>
          {!data.items.content.length
            ? <EmptyState icon={Wallet} title={t('revenueEmpty')} description={t('revenueEmptyText')} />
            : <ul aria-busy={loading} className="flex flex-col gap-3">{data.items.content.map((item, i) => <li key={`${item.courseId}-${item.paidAt}-${i}`} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3"><span className="font-bold [overflow-wrap:anywhere]">{item.courseTitle}</span><span className="text-xs text-muted-foreground">{t('paidOn', { when: formatDate(item.paidAt, language, true) })}</span></p>
                <p className="text-sm text-muted-foreground">{t('itemLine', { price: vnd(item.unitPriceAmount, language), rate: item.commissionRateBps / 100, platform: vnd(item.commissionAmount, language), author: vnd(item.authorNetAmount, language) })}</p>
              </li>)}</ul>}
          <Pagination language={language} page={page} totalPages={data.items.totalPages} loading={loading} onPageChange={next => setParams(next > 0 ? { page: String(next) } : {})} />
        </>}
  </main>
}
