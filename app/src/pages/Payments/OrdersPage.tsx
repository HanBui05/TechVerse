import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Receipt, RefreshCw } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import type { BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '../../components/EmptyState'
import { Pagination } from '../../components/Pagination'
import { courseErrorText, orderText } from '../../data/courseI18n'
import { orders, vnd } from '../../services/courseService'
import { formatDate } from '../Author/AuthorBlogsPage'
import { touch } from '../Courses/courseParts'
import type { Page } from '../../types/articles'
import type { CourseOrder, OrderStatus } from '../../types/courses'
import type { Language } from '../../types/preferences'

/** Wireframe section 0: PENDING amber, PAID green, EXPIRED slate, FAILED/CANCELLED rose. */
export const ORDER_TONE: Record<OrderStatus, BadgeTone> = { PENDING: 'amber', PAID: 'green', EXPIRED: 'slate', FAILED: 'rose', CANCELLED: 'rose' }

/** “My orders” (wireframe 2b-3): newest first from the backend; each row opens the order, PAID rows also go straight to the course. */
export function OrdersPage({ language = 'vi' }: { language?: Language }) {
  const t = orderText(language)
  const [params, setParams] = useSearchParams()
  const raw = Number(params.get('page'))
  const page = Number.isInteger(raw) && raw > 0 ? raw : 0
  const [data, setData] = useState<Page<CourseOrder> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const latest = useRef(0)

  const load = useCallback(async () => {
    const id = ++latest.current
    setLoading(true); setError('')
    try {
      const result = await orders.mine(page)
      if (id === latest.current) setData(result)
    } catch (e) {
      if (id === latest.current) { setData(null); setError(courseErrorText(e, language, t('loadError'))) }
    } finally {
      if (id === latest.current) setLoading(false)
    }
  }, [page, language]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [load])

  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-2">
        <Badge tone="amber" className="self-start font-semibold"><Receipt aria-hidden />{t('kicker')}</Badge>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('myOrders')} {data && <span className="text-base font-normal text-muted-foreground">({t('count', { n: data.totalElements })})</span>}</h1>
      </div>
      <Button asChild variant="outline" className={touch}><Link to="/courses"><ChevronLeft aria-hidden />{t('allCourses')}</Link></Button>
    </header>

    {error
      ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
          <span>{error}</span><Button type="button" variant="outline" size="sm" className={touch} onClick={() => void load()}><RefreshCw aria-hidden />{t('retry')}</Button></div>
      : loading && !data
        ? <ul role="status" aria-label={t('loading')} className="flex flex-col gap-3">{Array.from({ length: 4 }, (_, i) => <li key={i}><Skeleton className="h-20 rounded-2xl" /></li>)}</ul>
        : data && !data.content.length
          ? <EmptyState icon={Receipt} title={t('empty')} description={t('emptyText')} action={<Button asChild className={touch}><Link to="/courses">{t('explore')}</Link></Button>} />
          : data && <ul aria-busy={loading} className="flex flex-col gap-3">{data.content.map(item => <li key={item.orderCode} className={cn('flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm max-sm:flex-col max-sm:items-stretch', item.status === 'PENDING' && 'border-l-4 border-l-tone-amber-fg')}>
              <div className="flex min-w-0 flex-col gap-2">
                <h2 className="text-base font-bold leading-snug [overflow-wrap:anywhere]"><Link to={`/me/orders/${item.orderCode}`} className={cn('inline-flex items-center hover:text-accent-text focus-visible:outline-2 focus-visible:outline-ring', touch)}><span className="tabular-nums">{item.orderCode}</span> · {item.courseTitle}</Link></h2>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge tone={ORDER_TONE[item.status]}>{t(item.status)}</Badge>
                  {item.transferReportedAt && <Badge tone="sky">{t('reportedBadge')}</Badge>}
                  <span className="font-semibold tabular-nums text-foreground">{vnd(item.amount, language)}</span>
                  <span>{t('created', { when: formatDate(item.createdAt, language) })}{item.status !== 'PAID' && ` · ${t('expires', { when: formatDate(item.expiresAt, language) })}`}</span>
                </p>
              </div>
              {item.status === 'PAID'
                ? <Button asChild className={cn('max-sm:w-full', touch)}><Link to={`/courses/${item.courseId}`}>{t('learn')}</Link></Button>
                : <Button asChild variant="outline" className={cn('max-sm:w-full', touch)}><Link to={`/me/orders/${item.orderCode}`}>{t('viewOrder')}</Link></Button>}
            </li>)}</ul>}

    {data && !error && <Pagination language={language} page={page} totalPages={data.totalPages} loading={loading} onPageChange={next => setParams(next > 0 ? { page: String(next) } : {})} />}
  </main>
}
