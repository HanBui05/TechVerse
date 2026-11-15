import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Receipt, RefreshCw, Search, TriangleAlert, X } from 'lucide-react'
import { cn } from 'cn'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '../../../components/EmptyState'
import { courseErrorText, payAdminText } from '../../../data/courseI18n'
import { ADMIN_ORDER_SIZE, adminOrders, amountText, vnd } from '../../../services/courseService'
import { ApiError } from '../../../services/api/client'
import { formatDate } from '../../Author/AuthorBlogsPage'
import { touch } from '../../Courses/courseParts'
import { ORDER_TONE } from '../../Payments/OrdersPage'
import { AdminPagination } from '../AdminPagination'
import type { Page } from '../../../types/articles'
import type { AdminOrder, OrderStatus } from '../../../types/courses'
import type { Language } from '../../../types/preferences'

const STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'EXPIRED']
const fieldLabel = 'text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground'
const alertBox = 'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger'
type T = ReturnType<typeof payAdminText>

/** Admin orders (wireframe 4c-1/4c-2): filters live in the URL; every success reloads the list from the server, nothing is patched locally. */
export function AdminOrdersPage({ language = 'vi' }: { language?: Language }) {
  const t = payAdminText(language)
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status') ?? ''
  const status = statusParam === 'ALL' ? '' : (STATUSES as string[]).includes(statusParam) ? statusParam as OrderStatus : 'PENDING'
  const code = params.get('code') ?? ''
  const reported = params.get('transferReported') === 'true'
  const reconcile = params.get('needsReconciliation') === 'true'
  const raw = Number(params.get('page'))
  const page = Number.isInteger(raw) && raw > 0 ? raw : 0
  const [codeInput, setCodeInput] = useState(code)
  const [data, setData] = useState<Page<AdminOrder> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const latest = useRef(0)

  const load = useCallback(async () => {
    const id = ++latest.current
    setLoading(true); setError('')
    try {
      const result = await adminOrders.list({ status: status || undefined, code: code || undefined, transferReported: reported || undefined, needsReconciliation: reconcile || undefined, page })
      if (id === latest.current) setData(result)
    } catch (e) {
      if (id === latest.current) { setData(null); setError(courseErrorText(e, language, t('loadError'))) }
    } finally {
      if (id === latest.current) setLoading(false)
    }
  }, [page, status, code, reported, reconcile, language]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [load])
  useEffect(() => { setCodeInput(code) }, [code])

  const change = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) value === null ? next.delete(key) : next.set(key, value)
    next.delete('page'); setParams(next)
  }
  const search = (e: FormEvent) => { e.preventDefault(); change({ code: codeInput.trim() || null }) }
  const order = data?.content.find(item => item.orderCode === selected) ?? null

  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-2">
      <Badge tone="sky" className="self-start font-semibold"><Receipt aria-hidden />{t('kicker')}</Badge>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('ordersTitle')} {data && <span className="text-base font-normal text-muted-foreground">({t('count', { n: data.totalElements })})</span>}</h1>
    </header>

    <section aria-label={t('filters')} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <form onSubmit={search} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="f-code" className={fieldLabel}>{t('code')}</Label>
          <div className="flex gap-2">
            <Input id="f-code" className="pointer-coarse:min-h-11" value={codeInput} placeholder={t('codePlaceholder')} onChange={e => setCodeInput(e.target.value)} />
            {codeInput && <Button type="button" variant="ghost" size="icon" className={touch} aria-label={t('clearCode')} onClick={() => change({ code: null })}><X /></Button>}
            <Button type="submit" variant="outline" size="icon" className={touch} aria-label={t('applyCode')}><Search /></Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="f-status" className={fieldLabel}>{t('status')}</Label>
          <NativeSelect id="f-status" className="pointer-coarse:min-h-11" value={status || 'ALL'} onChange={e => change({ status: e.target.value === 'PENDING' ? null : e.target.value })}>
            <NativeSelectOption value="ALL">{t('all')}</NativeSelectOption>
            {STATUSES.map(value => <NativeSelectOption key={value} value={value}>{t(value)}</NativeSelectOption>)}
          </NativeSelect>
        </div>
      </form>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {([['f-reported', 'transferReported', reported, 'reportedFilter'], ['f-recon', 'needsReconciliation', reconcile, 'reconFilter']] as const).map(([id, key, checked, label]) =>
          <div key={id} className="flex items-center gap-2 pointer-coarse:min-h-11">
            <Checkbox id={id} checked={checked} onCheckedChange={value => change({ [key]: value === true ? 'true' : null })} />
            <Label htmlFor={id} className="text-sm">{t(label)}</Label>
          </div>)}
      </div>
    </section>

    {notice && <p role="status" className="rounded-lg border border-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">{notice}</p>}
    {error
      ? <div role="alert" className={alertBox}><span>{error}</span><Button type="button" variant="outline" size="sm" className={touch} onClick={() => void load()}><RefreshCw aria-hidden />{t('retry')}</Button></div>
      : loading && !data
        ? <ul role="status" aria-label={t('loading')} className="flex flex-col gap-3">{Array.from({ length: 5 }, (_, i) => <li key={i}><Skeleton className="h-24 rounded-2xl" /></li>)}</ul>
        : data && !data.content.length
          ? <EmptyState icon={Receipt} title={t('empty')} action={<Button className={touch} onClick={() => setParams({})}>{t('clearFilters')}</Button>} />
          : data && <ul aria-busy={loading} className="flex flex-col gap-3">{data.content.map(item => {
            const open = item.status === 'PENDING' || item.status === 'EXPIRED'
            // Every PAID order opens the sheet: a second real transfer must be recordable even before (or after closing) the duplicate flag.
            const review = item.status === 'PAID'
            return <li key={item.orderCode} className={cn('flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm max-sm:flex-col max-sm:items-stretch',
              item.needsReconciliation ? 'border-l-4 border-l-tone-rose-fg' : open && item.transferReportedAt && 'border-l-4 border-l-tone-amber-fg')}>
              <div className="flex min-w-0 flex-col gap-2">
                <h2 className="flex flex-wrap items-baseline gap-x-2 text-base font-bold leading-snug [overflow-wrap:anywhere]"><span className="tabular-nums">{item.orderCode}</span> · {item.courseTitle}
                  <span className="font-semibold tabular-nums">{vnd(item.amount, language)}</span></h2>
                <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{item.buyerName} · {item.buyerEmail} · {t('created', { when: formatDate(item.createdAt, language) })}{open && ` · ${t('expires', { when: formatDate(item.expiresAt, language) })}`}{item.paidAt && ` · ${t('paidOn', { when: formatDate(item.paidAt, language, true) })}`}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone={ORDER_TONE[item.status]}>{t(item.status)}</Badge>
                  {item.transferReportedAt && <Badge tone="sky" title={t('reportedHint')}>{t('reportedAt', { time: formatDate(item.transferReportedAt, language, true) })}</Badge>}
                  {item.needsReconciliation && <Badge tone="rose"><TriangleAlert aria-hidden />{t('duplicate')}</Badge>}
                  {!item.needsReconciliation && item.reconciledAt && <Badge tone="slate">{t('reconciled')}</Badge>}
                </p>
              </div>
              {(open || review) && <Button variant={open ? 'default' : 'outline'} className={cn('max-sm:w-full', touch)} onClick={() => setSelected(item.orderCode)}>{open ? t('confirmBtn') : t('viewBtn')}</Button>}
            </li>
          })}</ul>}

    {data && !error && <AdminPagination language={language} page={page} size={ADMIN_ORDER_SIZE} total={data.totalElements} loading={loading} onPageChange={next => { const p = new URLSearchParams(params); next > 0 ? p.set('page', String(next)) : p.delete('page'); setParams(p) }} />}

    <Sheet open={order !== null} onOpenChange={next => { if (!next) setSelected(null) }}>
      <SheetContent closeLabel={t('close')} className="w-full gap-0 overflow-y-auto sm:max-w-[480px]">
        {order && <ReviewSheet key={order.orderCode} order={order} language={language} t={t} reload={() => void load()} done={key => { setSelected(null); setNotice(t(key)); void load() }} />}
      </SheetContent>
    </Sheet>
  </main>
}

/** Confirm (PENDING/EXPIRED) or review (PAID with the duplicate flag): amount is prefilled from the order but always re-checked by the admin; the server compares it. */
function ReviewSheet({ order, language, t, reload, done }: { order: AdminOrder; language: Language; t: T; reload: () => void; done: (key: 'okConfirm' | 'okDuplicate' | 'okReconciled') => void }) {
  const [amount, setAmount] = useState(String(order.amount))
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [reloadable, setReloadable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [askConfirm, setAskConfirm] = useState(false)
  const [askClose, setAskClose] = useState(false)
  const value = amountText(amount)
  const ref = reference.trim()
  const valid = value !== null && ref.length >= 1 && ref.length <= 255
  const review = order.status === 'PAID'
  const money = (n: number) => vnd(n, language)

  const run = async (action: () => Promise<AdminOrder>, success: (result: AdminOrder) => 'okConfirm' | 'okDuplicate' | 'okReconciled', failure: string) => {
    setBusy(true); setError(''); setReloadable(false)
    try { done(success(await action())) } catch (e) {
      setError(courseErrorText(e, language, failure))
      const code = e instanceof ApiError ? e.code : ''
      setReloadable(code === 'PAYMENT_STATE_INVALID' || code === 'ORDER_NOT_FOUND')
      // A newer payment (or no flag at all) means the list the admin saw is stale: refresh it, keep the flag as the server has it.
      if (code === 'PAYMENT_RECONCILIATION_STALE' || code === 'PAYMENT_RECONCILIATION_NOT_REQUIRED') reload()
    } finally { setBusy(false) }
  }
  const confirm = () => run(() => adminOrders.confirm(order.orderCode, value!, ref), result => result.needsReconciliation ? 'okDuplicate' : 'okConfirm', t('confirmFailed'))
  const close = () => run(() => adminOrders.reconcile(order.orderCode, order.payments.length), () => 'okReconciled', t('reconcileFailed'))

  return <>
    <SheetHeader className="gap-1 border-b border-border p-6">
      <SheetTitle>{t(review ? 'reviewTitle' : 'sheetTitle', { code: order.orderCode })}</SheetTitle>
      <SheetDescription>{order.courseTitle} · {order.buyerName}</SheetDescription>
    </SheetHeader>
    <div className="flex flex-col gap-4 p-6">
      {error && <div role="alert" className={alertBox}><span>{error}</span>{reloadable && <Button type="button" variant="outline" size="sm" className={touch} onClick={reload}><RefreshCw aria-hidden />{t('reload')}</Button>}</div>}
      {order.needsReconciliation && <p className="rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-tone-rose-fg">{t('dupBlock')}</p>}
      <p className="flex items-baseline justify-between gap-3 text-sm"><span className="text-muted-foreground">{t('due')}</span><span className="text-lg font-bold tabular-nums">{money(order.amount)}</span></p>
      <p className="text-sm text-muted-foreground">{t('check')}</p>
      {order.payments.length > 0 && <div className="flex flex-col gap-1 text-sm">
        <p className="font-semibold">{t('paymentsTitle', { n: order.payments.length })}</p>
        <ul className="flex flex-col gap-1 text-muted-foreground">{order.payments.map(p => <li key={`${p.reference}-${p.confirmedAt}`} className="[overflow-wrap:anywhere]">{p.reference} · {money(p.amount)} · {p.source} · {formatDate(p.confirmedAt, language, true)}</li>)}</ul>
      </div>}
      {review && <p className="text-sm font-semibold">{t('addPayment')}</p>}
      <div className="flex flex-col gap-2">
        <Label htmlFor="s-amount" className={fieldLabel}>{t('stmtAmount')} *</Label>
        <Input id="s-amount" inputMode="numeric" className="pointer-coarse:min-h-11" value={amount} aria-invalid={value === null} onChange={e => setAmount(e.target.value)} />
        {value === null && <p className="text-xs text-danger">{t('amountInvalid')}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="s-ref" className={fieldLabel}>{t('stmtRef')} *</Label>
        <Input id="s-ref" maxLength={255} className="pointer-coarse:min-h-11" value={reference} aria-invalid={reference.length > 0 && !ref} onChange={e => setReference(e.target.value)} />
        <p className="flex justify-between text-xs text-muted-foreground"><span className="text-danger">{reference.length > 0 && !ref ? t('refInvalid') : ''}</span><span>{reference.length}/255</span></p>
      </div>
      <div className="flex flex-wrap justify-end gap-2 max-sm:flex-col">
        {order.needsReconciliation && <Button type="button" variant="outline" className={cn('sm:mr-auto', touch)} disabled={busy} onClick={() => setAskClose(true)}>{t('closeFlag')}</Button>}
        <Button type="button" disabled={!valid || busy} className={touch} onClick={() => setAskConfirm(true)}>{t('review')}</Button>
      </div>
    </div>

    <AlertDialog open={askConfirm} onOpenChange={setAskConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t('confirmReceived')}</AlertDialogTitle>
          <AlertDialogDescription>{t('confirmQ', { amount: money(value ?? 0), code: order.orderCode, ref })}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel className={touch}>{t('back')}</AlertDialogCancel><AlertDialogAction className={touch} onClick={() => void confirm()}>{t('confirmReceived')}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={askClose} onOpenChange={setAskClose}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t('closeFlag')}</AlertDialogTitle>
          <AlertDialogDescription>{t('closeFlagQ', { n: order.payments.length })}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel className={touch}>{t('cancel')}</AlertDialogCancel><AlertDialogAction className={touch} onClick={() => void close()}>{t('markReconciled')}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
}
