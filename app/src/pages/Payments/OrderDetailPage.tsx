import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ImageOff, Receipt, RefreshCw } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '../../components/MarkdownContent'
import { EmptyState } from '../../components/EmptyState'
import { courseErrorText, orderText } from '../../data/courseI18n'
import { ApiError } from '../../services/api/client'
import { orders, qrSrc, vnd } from '../../services/courseService'
import { formatDate } from '../Author/AuthorBlogsPage'
import { touch } from '../Courses/courseParts'
import { ORDER_TONE } from './OrdersPage'
import type { CourseOrder } from '../../types/courses'
import type { Language } from '../../types/preferences'

const alertBox = 'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm'

/** Order page (wireframe 2b-1/2b-2). Status comes only from the server; refresh is a user action, never polling, and the URL query is ignored. */
export function OrderDetailPage({ language = 'vi' }: { language?: Language }) {
  const { orderCode = '' } = useParams()
  // Keyed by code: opening another order (Buy again) drops the old order's QR, details and actions at once.
  return <OrderView key={orderCode} orderCode={orderCode} language={language} />
}

function OrderView({ orderCode, language }: { orderCode: string; language: Language }) {
  const t = orderText(language)
  const navigate = useNavigate()
  const [order, setOrder] = useState<CourseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [qrFailed, setQrFailed] = useState(false)
  const [qrKey, setQrKey] = useState(0)
  const latest = useRef(0)

  const load = useCallback(async () => {
    const id = ++latest.current
    setLoading(true); setError(null)
    try {
      const result = await orders.get(orderCode)
      if (id === latest.current) { setOrder(result); setQrFailed(false) }
    } catch (e) {
      if (id === latest.current) { setOrder(null); setError(e) }
    } finally {
      if (id === latest.current) setLoading(false)
    }
  }, [orderCode])
  useEffect(() => { void load() }, [load])

  const run = async (action: () => Promise<void>, fallback: string) => {
    if (busy || loading) return
    setBusy(true); setActionError('')
    try { await action() } catch (e) {
      setActionError(courseErrorText(e, language, fallback))
      if (e instanceof ApiError && e.status === 409) void load()
    } finally { setBusy(false) }
  }
  const report = () => run(async () => { setOrder(await orders.reportTransfer(orderCode)) }, t('reportFailed'))
  const buyAgain = () => run(async () => { if (order) navigate(`/me/orders/${(await orders.create(order.courseId)).orderCode}`) }, t('buyFailed'))

  const main = 'mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8'
  if (loading && !order) return <main className={main}><div role="status" aria-label={t('loading')} className="flex flex-col gap-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div></main>
  if (!order) {
    const missing = error instanceof ApiError && error.code === 'ORDER_NOT_FOUND'
    return <main className={main}>{missing
      ? <EmptyState icon={Receipt} title={courseErrorText(error, language, t('loadError'))} action={<Button asChild className={touch}><Link to="/me/orders">{t('notFoundBack')}</Link></Button>} />
      : <div role="alert" className={cn(alertBox, 'bg-tone-rose-bg text-danger')}><span>{courseErrorText(error, language, t('loadError'))}</span><Button type="button" variant="outline" size="sm" className={touch} onClick={() => void load()}><RefreshCw aria-hidden />{t('retry')}</Button></div>}</main>
  }

  const open = order.status === 'PENDING' || order.status === 'EXPIRED'
  const qr = order.vietQr
  const src = qr ? qrSrc(qr.imageUrl) : null
  const hoursLeft = Math.floor((Date.parse(order.expiresAt) - Date.now()) / 3_600_000)
  const left = order.status !== 'PENDING' ? '' : hoursLeft >= 1 ? t('remaining', { n: hoursLeft }) : t('remainingMin', { n: Math.max(1, Math.ceil((Date.parse(order.expiresAt) - Date.now()) / 60_000)) })
  const rows = qr ? [
    { label: t('bank'), value: qr.bankId }, { label: t('accountNo'), value: qr.accountNo, copy: qr.accountNo }, { label: t('accountName'), value: qr.accountName },
    { label: t('amount'), value: vnd(qr.amount, language), copy: String(qr.amount) }, { label: t('content'), value: qr.content, copy: qr.content },
  ] : []

  return <main className={main} aria-busy={loading}>
    <header className="flex flex-col gap-3">
      <Button asChild variant="ghost" size="sm" className={cn('self-start', touch)}><Link to="/me/orders"><ChevronLeft aria-hidden />{t('myOrders')}</Link></Button>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('openOrder', { code: order.orderCode })}</h1>
        <Badge tone={ORDER_TONE[order.status]}>{t(order.status)}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{t('created', { when: formatDate(order.createdAt, language, true) })} · {order.status === 'PAID' && order.paidAt ? t('paidOn', { when: formatDate(order.paidAt, language, true) }) : t('expires', { when: formatDate(order.expiresAt, language, true) })}{left && ` · ${left}`}</p>
      <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1"><span className="font-semibold">{order.courseTitle}</span><span className="text-sm text-muted-foreground">{t('total')}: <span className="font-semibold tabular-nums text-foreground">{vnd(order.amount, language)}</span></span></p>
    </header>

    {order.status === 'PAID' && <div role="alert" className={cn(alertBox, 'bg-tone-green-bg text-tone-green-fg')}><span>{t('paidAlert')}</span><Button asChild className={touch}><Link to={`/courses/${order.courseId}`}>{t('learn')}</Link></Button></div>}
    {order.status === 'EXPIRED' && <div role="alert" className={cn(alertBox, 'bg-tone-amber-bg text-tone-amber-fg')}><span>{t('expiredAlert')}</span><Button type="button" variant="outline" className={touch} disabled={busy} onClick={() => void buyAgain()}>{t('buyAgain')}</Button></div>}
    {(order.status === 'FAILED' || order.status === 'CANCELLED') && <div role="alert" className={cn(alertBox, 'bg-tone-rose-bg text-danger')}><span>{t('invalidAlert')}</span><Button type="button" variant="outline" className={touch} disabled={busy} onClick={() => void buyAgain()}>{t('buyAgain')}</Button></div>}
    {actionError && <div role="alert" className={cn(alertBox, 'bg-tone-rose-bg text-danger')}>{actionError}</div>}

    {open && <>
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        {rows.length > 0 && <section aria-labelledby="transfer-title" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 id="transfer-title" className="mb-3 text-base font-bold">{t('transferTitle')}</h2>
          <dl className="flex flex-col gap-3">{rows.map(row => <div key={row.label} className="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start max-sm:gap-1">
            <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{row.label}</dt>
            <dd className="flex items-center gap-1 font-medium tabular-nums [overflow-wrap:anywhere]">{row.value}{row.copy && <CopyButton language={language} label={t('copy', { what: row.label })} text={() => row.copy!} />}</dd>
          </div>)}</dl>
          <p className="mt-4 text-sm text-tone-amber-fg">{t('matchNote')}</p>
        </section>}
        <section aria-labelledby="qr-title" className={cn('flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm max-md:order-first', rows.length === 0 && 'md:col-span-2')}>
          <h2 id="qr-title" className="text-base font-bold">{t('qrTitle')}</h2>
          {src && !qrFailed
            ? <><img key={qrKey} src={src} alt={t('qrAlt', { code: order.orderCode })} referrerPolicy="no-referrer" onError={() => setQrFailed(true)} className="size-full max-w-[280px] rounded-lg border border-border bg-white" width={280} height={280} /><p className="text-center text-xs text-muted-foreground">{t('qrHint')}</p></>
            : <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground"><ImageOff aria-hidden className="size-6" /><p>{t('qrFailed')}</p>
                {src && <Button type="button" variant="outline" size="sm" className={touch} onClick={() => { setQrFailed(false); setQrKey(k => k + 1) }}>{t('qrReload')}</Button>}</div>}
        </section>
      </div>

      <section aria-labelledby="after-title" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 id="after-title" className="text-base font-bold">{t('afterTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('afterText')}</p>
        {order.transferReportedAt && <p className="rounded-lg border border-border bg-tone-sky-bg px-4 py-3 text-sm text-tone-sky-fg">{t('reported', { time: formatDate(order.transferReportedAt, language, true) })}</p>}
        <div className="flex flex-wrap gap-2 max-sm:flex-col">
          {!order.transferReportedAt && <Button type="button" className={touch} disabled={busy} onClick={() => void report()}>{t('report')}</Button>}
          <Button type="button" variant="outline" className={touch} disabled={loading || busy} onClick={() => void load()}><RefreshCw aria-hidden />{t('refresh')}</Button>
        </div>
      </section>
    </>}
  </main>
}
