import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ExternalLink, ImageOff, Info, Loader2, Receipt, RefreshCw } from 'lucide-react'
// Not a React hook despite the name: it only builds an iframe controller, so it is called inside an effect.
import { usePayOS as payosCheckout } from '@payos/payos-checkout'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '../../components/MarkdownContent'
import { EmptyState } from '../../components/EmptyState'
import { courseErrorText, orderText } from '../../data/courseI18n'
import { ApiError } from '../../services/api/client'
import { orders, payosSrc, qrSrc, vnd } from '../../services/courseService'
import { formatDate } from '../Author/AuthorBlogsPage'
import { touch } from '../Courses/courseParts'
import { ORDER_TONE, statusKey } from './OrdersPage'
import type { CourseOrder } from '../../types/courses'
import type { Language } from '../../types/preferences'

const alertBox = 'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm'
const RETRY_DELAYS = [3_000, 6_000, 12_000]
const MAX_REBUILDS = 3

/** payOS draws the frame; it only signals the UI. onCancel/onExit rebuild it; no load within 10 s (or no iframe at all) counts as failed. */
function PayosFrame({ url, title, onSuccess, onFailed }: { url: string; title: string; onSuccess: () => void; onFailed: () => void }) {
  const id = useId()
  const box = useRef<HTMLDivElement>(null)
  const [round, setRound] = useState(0)
  const handlers = useRef({ onSuccess, onFailed })
  handlers.current = { onSuccess, onFailed }
  // Layout effect: the cleanup runs while the element is still in the document, which the library's exit() needs.
  useLayoutEffect(() => {
    let closed = false
    const close = (next: () => void) => () => { closed = true; next() }
    // The library also reports iframe errors through onExit: after MAX_REBUILDS the frame counts as failed instead of looping.
    const rebuild = close(() => round >= MAX_REBUILDS ? handlers.current.onFailed() : setRound(round + 1))
    const { open, exit } = payosCheckout({ RETURN_URL: window.location.href, ELEMENT_ID: id, CHECKOUT_URL: url, embedded: true, onSuccess: close(() => handlers.current.onSuccess()), onCancel: rebuild, onExit: rebuild })
    open()
    const iframe = box.current?.querySelector('iframe')
    if (!iframe) { handlers.current.onFailed(); return }
    iframe.title = title
    let loaded = false
    iframe.addEventListener('load', () => { loaded = true }, { once: true })
    const timer = setTimeout(() => { if (!loaded) handlers.current.onFailed() }, 10_000)
    return () => { clearTimeout(timer); if (!closed) exit() }
  }, [url, round, id, title])
  return <div id={id} ref={box} className="h-[520px] w-full" />
}

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

  // payOS (wireframe 8): the server sync is the only source of "paid"; timers die with the view (it is keyed by order code).
  const [syncing, setSyncing] = useState<'auto' | 'manual' | null>(null)
  const [syncNote, setSyncNote] = useState<{ text: string; tone: 'amber' | 'rose' } | null>(null)
  const [afterPay, setAfterPay] = useState<'idle' | 'checking' | 'unseen'>('idle')
  const [cooldown, setCooldown] = useState(false)
  const [frameFailed, setFrameFailed] = useState(false)
  const [deadlinePassed, setDeadlinePassed] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const alive = useRef(true)
  const autoSynced = useRef(false)
  useEffect(() => { alive.current = true; const pending = timers.current; return () => { alive.current = false; pending.forEach(clearTimeout); pending.clear() } }, [])
  const later = (fn: () => void, ms: number) => {
    if (!alive.current) return
    const id = setTimeout(() => { timers.current.delete(id); fn() }, ms)
    timers.current.add(id)
  }

  // Syncs run one at a time (a queue), so replies apply in order and a PAID reply is never dropped for a newer one;
  // after a 429 every automatic sync and pending retry is skipped until the 30 s cooldown ends.
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const limited = useRef(false)
  const runSync = async (mode: 'auto' | 'manual'): Promise<CourseOrder | 'limited' | null> => {
    if (!alive.current || (limited.current && mode === 'auto')) return limited.current ? 'limited' : null
    const id = ++latest.current
    setSyncing(mode); if (mode === 'manual') setSyncNote(null)
    try {
      const result = await orders.sync(orderCode)
      if (id === latest.current) setOrder(result)
      return result
    } catch (e) {
      const code = e instanceof ApiError ? e.code : ''
      if (code === 'ORDER_RATE_LIMITED') {
        limited.current = true
        timers.current.forEach(clearTimeout); timers.current.clear()
        setAfterPay(state => state === 'checking' ? 'unseen' : state) // the cancelled retries would have ended "checking"
        setSyncNote({ text: courseErrorText(e, language, t('checkFailed')), tone: 'amber' })
        setCooldown(true); later(() => { limited.current = false; setCooldown(false) }, 30_000)
        return 'limited'
      }
      if (code === 'PAYMENT_STATE_INVALID') void load()
      else if (mode === 'manual') setSyncNote({ text: courseErrorText(e, language, t('checkFailed')), tone: 'rose' })
      return null
    } finally { if (alive.current) setSyncing(null) }
  }
  const sync = (mode: 'auto' | 'manual') => {
    const next = queue.current.then(() => runSync(mode))
    queue.current = next
    return next
  }
  const afterSuccess = () => {
    setAfterPay('checking')
    const attempt = async (i: number) => {
      const result = await sync('auto')
      if (result === 'limited') { setAfterPay('unseen'); return }
      if (result && result.status !== 'PENDING') return
      if (i < RETRY_DELAYS.length) later(() => void attempt(i + 1), RETRY_DELAYS[i])
      else setAfterPay('unseen')
    }
    void attempt(0)
  }

  const payosOpen = order?.provider === 'PAYOS' && (order.status === 'PENDING' || order.status === 'EXPIRED')
  useEffect(() => {
    if (!payosOpen || autoSynced.current) return
    autoSynced.current = true
    void sync('auto')
  }, [payosOpen]) // eslint-disable-line react-hooks/exhaustive-deps
  const ticking = order?.provider === 'PAYOS' && order.status === 'PENDING' && !deadlinePassed
  const msLeft = order ? Date.parse(order.expiresAt) - now : 0
  useEffect(() => {
    if (!ticking) return
    const id = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(id)
  }, [ticking])
  const due = ticking && msLeft <= 0
  useEffect(() => {
    if (!due) return
    setDeadlinePassed(true)
    void sync('auto')
  }, [due]) // eslint-disable-line react-hooks/exhaustive-deps

  const main = 'mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8'
  if (loading && !order) return <main className={main}><div role="status" aria-label={t('loading')} className="flex flex-col gap-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div></main>
  if (!order) {
    const missing = error instanceof ApiError && error.code === 'ORDER_NOT_FOUND'
    return <main className={main}>{missing
      ? <EmptyState icon={Receipt} title={courseErrorText(error, language, t('loadError'))} action={<Button asChild className={touch}><Link to="/me/orders">{t('notFoundBack')}</Link></Button>} />
      : <div role="alert" className={cn(alertBox, 'bg-tone-rose-bg text-danger')}><span>{courseErrorText(error, language, t('loadError'))}</span><Button type="button" variant="outline" size="sm" className={touch} onClick={() => void load()}><RefreshCw aria-hidden />{t('retry')}</Button></div>}</main>
  }

  const payos = order.provider === 'PAYOS'
  const open = !payos && (order.status === 'PENDING' || order.status === 'EXPIRED')
  const link = payos && order.status === 'PENDING' && !deadlinePassed ? payosSrc(order.checkoutUrl) : null
  const short = payos && order.amountPaid !== null && order.amountPaid > 0 && order.amountPaid < order.amount ? { paid: vnd(order.amountPaid, language), remaining: vnd(order.amount - order.amountPaid, language) } : null
  const secs = Math.max(0, Math.floor(msLeft / 1000))
  const clock = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
  const checkButton = <Button type="button" variant="outline" className={cn('max-sm:w-full', touch)} disabled={syncing !== null || cooldown || busy} onClick={() => void sync('manual')}>
    {syncing ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}{t('checkAgain')}</Button>
  const qr = order.vietQr
  const src = qr ? qrSrc(qr.imageUrl) : null
  const hoursLeft = Math.floor((Date.parse(order.expiresAt) - Date.now()) / 3_600_000)
  const left = order.status !== 'PENDING' || payos ? '' : hoursLeft >= 1 ? t('remaining', { n: hoursLeft }) : t('remainingMin', { n: Math.max(1, Math.ceil((Date.parse(order.expiresAt) - Date.now()) / 60_000)) })
  const rows = qr ? [
    { label: t('bank'), value: qr.bankId }, { label: t('accountNo'), value: qr.accountNo, copy: qr.accountNo }, { label: t('accountName'), value: qr.accountName },
    { label: t('amount'), value: vnd(qr.amount, language), copy: String(qr.amount) }, { label: t('content'), value: qr.content, copy: qr.content },
  ] : []

  return <main className={main} aria-busy={loading}>
    <header className="flex flex-col gap-3">
      <Button asChild variant="ghost" size="sm" className={cn('self-start', touch)}><Link to="/me/orders"><ChevronLeft aria-hidden />{t('myOrders')}</Link></Button>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('openOrder', { code: order.orderCode })}</h1>
        <Badge tone={ORDER_TONE[order.status]}>{t(statusKey(order))}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{t('created', { when: formatDate(order.createdAt, language, true) })} · {order.status === 'PAID' && order.paidAt ? t('paidOn', { when: formatDate(order.paidAt, language, true) }) : t('expires', { when: formatDate(order.expiresAt, language, true) })}{left && ` · ${left}`}
        {ticking && <> · <span className={cn('font-medium tabular-nums', secs < 120 && 'text-tone-amber-fg')}>{t('countdown', { time: clock })}</span></>}</p>
      {deadlinePassed && <p role="status" className="sr-only">{t('expiredNow')}</p>}
      <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1"><span className="font-semibold">{order.courseTitle}</span><span className="text-sm text-muted-foreground">{t('total')}: <span className="font-semibold tabular-nums text-foreground">{vnd(order.amount, language)}</span></span></p>
    </header>

    {order.status === 'PAID' && <div role="alert" className={cn(alertBox, 'bg-tone-green-bg text-tone-green-fg')}><span>{t('paidAlert')}</span><Button asChild className={touch}><Link to={`/courses/${order.courseId}`}>{t('learn')}</Link></Button></div>}
    {order.status === 'EXPIRED' && <div role="alert" className={cn(alertBox, 'bg-tone-amber-bg text-tone-amber-fg')}>
      <p className="flex flex-col gap-1"><span>{t('expiredAlert')}</span>{short && <span>{t('underpaidShort', short)}</span>}</p>
      <div className="flex flex-wrap gap-2 max-sm:w-full max-sm:flex-col">{payos && checkButton}<Button type="button" variant="outline" className={touch} disabled={busy} onClick={() => void buyAgain()}>{t('buyAgain')}</Button></div></div>}
    {(order.status === 'FAILED' || order.status === 'CANCELLED') && <div role="alert" className={cn(alertBox, 'bg-tone-rose-bg text-danger')}><span>{t('invalidAlert')}</span><Button type="button" variant="outline" className={touch} disabled={busy} onClick={() => void buyAgain()}>{t('buyAgain')}</Button></div>}
    {actionError && <div role="alert" className={cn(alertBox, 'bg-tone-rose-bg text-danger')}>{actionError}</div>}
    {syncNote && <div role="alert" className={cn(alertBox, syncNote.tone === 'amber' ? 'bg-tone-amber-bg text-tone-amber-fg' : 'bg-tone-rose-bg text-danger')}>{syncNote.text}</div>}

    {payos && order.status === 'PENDING' && <>
      <section aria-labelledby="payos-title" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm max-sm:px-3">
        <h2 id="payos-title" className="text-base font-bold">{t('payosTitle')}</h2>
        {short && <p className={cn(alertBox, 'bg-tone-amber-bg text-tone-amber-fg')}>{t('underpaid', short)}</p>}
        {deadlinePassed ? null
          : !link ? <div role="alert" className={cn(alertBox, 'bg-tone-amber-bg text-tone-amber-fg')}><span>{t('noLink')}</span>
              <Button type="button" variant="outline" size="sm" className={touch} disabled={loading} onClick={() => void load()}><RefreshCw aria-hidden />{t('retry')}</Button></div>
          : afterPay === 'checking' ? <p role="status" aria-live="polite" className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 aria-hidden className="size-5 animate-spin" />{t('checking')}</p>
          : afterPay === 'unseen' ? <p role="status" className={cn(alertBox, 'bg-tone-sky-bg text-tone-sky-fg')}>{t('unseen')}</p>
          : frameFailed ? <p className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground">{t('frameFailed')}</p>
          : <><p className="text-sm text-muted-foreground">{t('payosHint')}</p>
              <div className="mx-auto w-full max-w-[480px] overflow-hidden rounded-lg border border-border bg-white">
                <PayosFrame url={link} title={t('payosFrame')} onSuccess={afterSuccess} onFailed={() => setFrameFailed(true)} /></div></>}
        {(link || deadlinePassed) && <div className="flex flex-wrap items-center gap-2 max-sm:flex-col max-sm:items-stretch">
          {link && <Button asChild variant={frameFailed ? 'default' : 'outline'} className={cn('max-sm:w-full', touch)}><a href={link} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden />{t('payosOpen')}</a></Button>}
          {checkButton}
          {syncing === 'manual' && afterPay !== 'checking' && <span role="status" className="text-sm text-muted-foreground">{t('checking')}</span>}
        </div>}
      </section>
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><Info aria-hidden className="size-4 shrink-0" />{t('noRefund')}</p>
    </>}

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
