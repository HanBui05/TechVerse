import { useCallback, useEffect, useRef, useState, type ComponentType, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2, ChevronRight, Clock, Landmark, Percent, Receipt, RefreshCw, TrendingUp, TriangleAlert, Wallet, X } from 'lucide-react'
import { enUS, vi as viLocale } from 'date-fns/locale'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '../../../components/EmptyState'
import { Pagination } from '../../../components/Pagination'
import { courseErrorText, payAdminText } from '../../../data/courseI18n'
import { payoutAccount, payouts, revenue, revenueByCourse, vnd } from '../../../services/courseService'
import { ApiError } from '../../../services/api/client'
import { formatDate } from '../AuthorBlogsPage'
import { touch } from '../../Courses/courseParts'
import type { PayoutAccountView } from '../../../types/courses'
import type { Language } from '../../../types/preferences'

type Tab = 'sales' | 'courses' | 'payouts'
export type T = ReturnType<typeof payAdminText>
const TABS: Tab[] = ['sales', 'courses', 'payouts']
const TAB_KEY = { sales: 'tabSales', courses: 'tabCourses', payouts: 'tabPayouts' } as const
export const fieldLabel = 'text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground'
export const alertBox = 'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger'
export const card = 'flex flex-col gap-1.5 rounded-xl border border-border bg-card p-5'
export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const shown = (iso: string) => iso.split('-').reverse().join('/')

type AuthorKpiKey = 'orders' | 'gross' | 'platformShare' | 'yourShare' | 'paidOutTile' | 'pendingTile'
const AUTHOR_KPI_ICON: Record<AuthorKpiKey, ComponentType<{ className?: string }>> = {
  orders: Receipt,
  gross: TrendingUp,
  platformShare: Percent,
  yourShare: Wallet,
  paidOutTile: CheckCircle2,
  pendingTile: Clock,
}

/** One request per key; a newer key or a retry wins, a stale answer is dropped. `run = null` means nothing to load. */
export function useLoad<T>(run: (() => Promise<T>) | null, key: string, language: Language, fallback: string) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string }>({ data: null, loading: run !== null, error: '' })
  const latest = useRef(0)
  const load = useCallback(async () => {
    const id = ++latest.current
    if (!run) { setState({ data: null, loading: false, error: '' }); return }
    setState(s => ({ ...s, loading: true, error: '' }))
    try {
      const data = await run()
      if (id === latest.current) setState({ data, loading: false, error: '' })
    } catch (e) {
      if (id === latest.current) setState({ data: null, loading: false, error: courseErrorText(e, language, fallback) })
    }
  }, [key, language]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [load])
  return { ...state, reload: load }
}

export function RetryAlert({ message, t, onRetry }: { message: string; t: T; onRetry: () => void }) {
  return <div role="alert" className={alertBox}><span>{message}</span>
    <Button type="button" variant="outline" size="sm" className={touch} onClick={onRetry}><RefreshCw aria-hidden />{t('retry')}</Button></div>
}

export function DateField({ label, value, onChange, language, t, invalid }: { label: string; value: string; onChange: (iso: string) => void; language: Language; t: T; invalid?: boolean }) {
  const [open, setOpen] = useState(false)
  const [year, month, day] = value ? value.split('-').map(Number) : []
  const selected = value ? new Date(year, month - 1, day) : undefined
  return <div className="flex flex-col gap-1">
    <span className={fieldLabel}>{label}</span>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn('w-full justify-start sm:w-44', touch, invalid && 'border-danger')} aria-label={`${label}: ${value ? shown(value) : t('pickDate')}`} aria-invalid={invalid || undefined}>
          <CalendarDays aria-hidden />{value ? shown(value) : t('pickDate')}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" locale={language === 'vi' ? viLocale : enUS} captionLayout="dropdown" selected={selected} defaultMonth={selected}
          onSelect={date => { onChange(date ? isoDate(date) : ''); setOpen(false) }} />
      </PopoverContent>
    </Popover>
  </div>
}

/** The account form lives inside the Sheet so it starts fresh on every open. The server normalises the name; the client only mirrors its validation. */
function AccountForm({ view, language, t, onSaved }: { view: PayoutAccountView; language: Language; t: T; onSaved: () => void }) {
  const { account, banks } = view
  const [bankId, setBankId] = useState(account?.bankId ?? '')
  const [accountNo, setAccountNo] = useState(account?.accountNo ?? '')
  const [accountName, setAccountName] = useState(account?.accountName ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const invalid = () => courseErrorText(new ApiError('', 400, 'PAYOUT_ACCOUNT_INVALID'), language, '')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const no = accountNo.trim(), name = accountName.trim()
    if (!banks.some(b => b.id === bankId) || !/^[A-Za-z0-9]{6,30}$/.test(no) || !name || name.length > 100) { setError(invalid()); return }
    setSaving(true); setError('')
    try { await payoutAccount.save({ bankId, accountNo: no, accountName: name }); onSaved() }
    catch (e) { setError(courseErrorText(e, language, invalid())); setSaving(false) }
  }
  return <form onSubmit={e => void submit(e)} noValidate className="flex flex-col gap-4 p-6">
    {error && <div role="alert" className={alertBox}><span>{error}</span></div>}
    <div className="flex flex-col gap-1.5"><Label htmlFor="payout-bank">{t('bank')}</Label>
      <NativeSelect id="payout-bank" className={cn('w-full', touch)} value={bankId} onChange={e => setBankId(e.target.value)}>
        <NativeSelectOption value="">{t('pickBank')}</NativeSelectOption>
        {banks.map(b => <NativeSelectOption key={b.id} value={b.id}>{b.name}</NativeSelectOption>)}
      </NativeSelect></div>
    <div className="flex flex-col gap-1.5"><Label htmlFor="payout-no">{t('accountNo')}</Label>
      <Input id="payout-no" inputMode="numeric" autoComplete="off" maxLength={30} className="pointer-coarse:h-11" value={accountNo} onChange={e => setAccountNo(e.target.value)} /></div>
    <div className="flex flex-col gap-1.5"><Label htmlFor="payout-name">{t('accountName')}</Label>
      <Input id="payout-name" autoComplete="off" maxLength={100} className="pointer-coarse:h-11" value={accountName} onChange={e => setAccountName(e.target.value)} /></div>
    <Button type="submit" className={touch} disabled={saving}>{saving ? t('saving') : t('saveAccount')}</Button>
  </form>
}

/** Author revenue: totals and rows are the server's order-time snapshot, never recomputed here. Filters and tab live in the URL. */
export function AuthorRevenuePage({ language = 'vi' }: { language?: Language }) {
  const t = payAdminText(language)
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.find(x => x === params.get('tab')) ?? 'sales'
  const raw = Number(params.get('page'))
  const page = Number.isInteger(raw) && raw > 0 ? raw : 0
  const day = (name: string) => { const v = params.get(name) ?? ''; return ISO_DAY.test(v) ? v : '' }
  const from = day('from'), to = day('to')
  const courseId = params.get('courseId') ?? '', courseName = params.get('course') ?? ''
  const rangeInvalid = Boolean(from && to && from > to)
  const [formOpen, setFormOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params)
    next.delete('page')
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key) }
    setParams(next)
  }
  const goPage = (next: number) => setParams(prev => { const p = new URLSearchParams(prev); if (next > 0) p.set('page', String(next)); else p.delete('page'); return p })
  const filterKey = `${from}|${to}|${courseId}|${page}`
  const rev = useLoad(rangeInvalid ? null : () => revenue(tab === 'sales' ? page : 0, { from, to, courseId }), `${tab}|${filterKey}`, language, t('revenueLoadError'))
  const byCourse = useLoad(tab === 'courses' && !rangeInvalid ? () => revenueByCourse(page, { from, to }) : null, `${tab}|${filterKey}`, language, t('revenueLoadError'))
  const account = useLoad(() => payoutAccount.get(), 'account', language, t('accountLoadError'))
  const history = useLoad(tab === 'payouts' ? () => payouts(page) : null, `${tab}|${page}`, language, t('payoutsLoadError'))
  const filtered = Boolean(from || to || courseId)

  const tiles = rev.data && [['orders', String(rev.data.totals.itemCount)], ['gross', vnd(rev.data.totals.grossAmount, language)], ['platformShare', vnd(rev.data.totals.platformAmount, language)], ['yourShare', vnd(rev.data.totals.authorAmount, language)]] as const
  const allTime = rev.data && [['paidOutTile', vnd(rev.data.totals.paidOutAmount, language)], ['pendingTile', vnd(rev.data.totals.balanceAmount, language)]] as const
  const tile = ([key, value]: readonly [AuthorKpiKey, string]) => {
    const Icon = AUTHOR_KPI_ICON[key]
    return <div key={key} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex min-w-0 flex-col gap-1.5">
        <dt className={fieldLabel}>{t(key)}</dt>
        <dd className="m-0 text-2xl font-semibold tracking-tight text-foreground tabular-nums [overflow-wrap:anywhere]">{value}</dd>
      </div>
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </div>
  }
  const skeletonRows = <>{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</>
  const accountView = account.data
  const accountBox = accountView && (accountView.account
    ? <section aria-labelledby="payout-account-title" className={cn(card, 'gap-4')}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Landmark className="size-4 text-muted-foreground" aria-hidden />
            <h2 id="payout-account-title" className="text-sm font-semibold">{t('accountTitle')}</h2>
          </div>
          <Button type="button" variant="outline" size="sm" className={touch} onClick={() => setFormOpen(true)}>{t('editAccount')}</Button>
        </div>
        <dl className="m-0 grid gap-4 rounded-lg border border-border bg-background/50 p-4 sm:grid-cols-3">{([['bank', accountView.account.bankName], ['accountNo', accountView.account.accountNo], ['accountName', accountView.account.accountName]] as const).map(([key, value]) =>
          <div key={key} className="flex flex-col gap-1"><dt className={fieldLabel}>{t(key)}</dt><dd className="m-0 font-semibold tabular-nums [overflow-wrap:anywhere]">{value}</dd></div>)}</dl>
        <p className="text-xs text-muted-foreground">{t('payoutNote')}</p>
      </section>
    : <EmptyState icon={Landmark} title={t('accountTitle')} description={t('noAccount')} action={<Button type="button" className={touch} onClick={() => setFormOpen(true)}>{t('addAccount')}</Button>} />)

  const maxCourseGross = Math.max(1, ...(byCourse.data?.content.map(c => c.grossAmount) ?? [1]))

  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div className="flex flex-col gap-1">
        <span className={fieldLabel}>{t('authorSpace')}</span>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('revenueTitle')}</h1>
      </div>
      {tab !== 'payouts' && <div className="flex flex-wrap items-end gap-2.5">
        <DateField label={t('fromDate')} value={from} onChange={v => update({ from: v })} language={language} t={t} />
        <DateField label={t('toDate')} value={to} onChange={v => update({ to: v })} language={language} t={t} invalid={rangeInvalid} />
        {filtered && <Button type="button" variant="ghost" size="sm" className={touch} onClick={() => update({ from: '', to: '', courseId: '', course: '' })}>{t('clearFilters')}</Button>}
      </div>}
    </header>

    {notice && <p role="status" className="rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">{notice}</p>}
    {account.error && <RetryAlert message={account.error} t={t} onRetry={() => void account.reload()} />}
    {accountView && !accountView.account && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
      <span className="flex items-center gap-2"><TriangleAlert className="size-4 text-muted-foreground" aria-hidden />{t('noAccount')}</span>
      <Button type="button" size="sm" variant="outline" className={touch} onClick={() => setFormOpen(true)}>{t('addAccount')}</Button></div>}

    {rev.error
      ? <RetryAlert message={rev.error} t={t} onRetry={() => void rev.reload()} />
      : rev.loading
        ? <div role="status" aria-label={t('revenueLoading')} className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        : tiles && allTime && <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <section aria-label={t('filteredHeading')} className="flex flex-col gap-3">
              <h2 className={fieldLabel}>{t('filteredHeading')}</h2>
              <dl className="m-0 grid grid-cols-2 gap-4 sm:grid-cols-4">{tiles.map(tile)}</dl>
            </section>
            <section aria-label={t('allTimeHeading')} className="flex flex-col gap-3">
              <h2 className={fieldLabel}>{t('allTimeHeading')}</h2>
              <dl className="m-0 grid grid-cols-2 gap-4">{allTime.map(tile)}</dl>
              <p className="text-xs text-muted-foreground">{t('allTimeNote')}</p>
            </section>
          </div>}

    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <div role="tablist" aria-label={t('tabs')} className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {TABS.map(key => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => update({ tab: key === 'sales' ? '' : key, ...(key === 'courses' ? { courseId: '', course: '' } : {}), ...(key === 'payouts' ? { courseId: '', course: '', from: '', to: '' } : {}) } )}
          className={cn('inline-flex h-8 cursor-pointer items-center rounded-md px-3.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring', touch, tab === key ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground')}>{t(TAB_KEY[key])}</button>)}
      </div>
      {tab !== 'payouts' && courseId && <p className="flex items-center gap-2 text-sm"><span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1 text-xs font-medium">
        <span>{t('filtering', { course: courseName })}</span>
        <button type="button" aria-label={t('removeCourse')} className={cn('rounded-full text-muted-foreground hover:text-foreground', touch)} onClick={() => update({ courseId: '', course: '' })}><X className="size-3.5" aria-hidden /></button></span></p>}
    </div>
    {tab !== 'payouts' && rangeInvalid && <p className="text-sm text-danger">{t('rangeInvalid')}</p>}

    <div role="tabpanel" className="flex flex-col gap-3.5">
      {tab === 'sales' && !rev.error && (rev.loading ? skeletonRows : rev.data && (!rev.data.items.content.length
        ? <EmptyState icon={Wallet} title={filtered ? t('filterEmpty') : t('revenueEmpty')} description={filtered ? undefined : t('revenueEmptyText')} />
        : <Card className="gap-0 overflow-hidden rounded-xl py-0">
            <div className="border-b border-border bg-muted/20 px-6 py-3"><p className="text-xs text-muted-foreground">{t('snapshotNote')}</p></div>
            <ul aria-busy={rev.loading} className="m-0 flex list-none flex-col divide-y divide-border p-0">{rev.data.items.content.map((item, i) => <li key={`${item.courseId}-${item.paidAt}-${i}`} className="flex flex-col gap-1.5 px-6 py-4 transition-colors hover:bg-muted/30">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><span className="font-semibold text-foreground [overflow-wrap:anywhere]">{item.courseTitle}</span><span className="text-xs text-muted-foreground tabular-nums">{t('paidOn', { when: formatDate(item.paidAt, language, true) })}</span></p>
              <p className="text-xs text-muted-foreground">{t('itemLine', { price: vnd(item.unitPriceAmount, language), rate: item.commissionRateBps / 100, platform: vnd(item.commissionAmount, language), author: vnd(item.authorNetAmount, language) })}</p>
            </li>)}</ul>
            <div className="border-t border-border px-6 py-4"><Pagination language={language} page={page} totalPages={rev.data.items.totalPages} loading={rev.loading} onPageChange={goPage} /></div>
          </Card>))}

      {tab === 'courses' && (byCourse.error ? <RetryAlert message={byCourse.error} t={t} onRetry={() => void byCourse.reload()} />
        : byCourse.loading ? skeletonRows
        : byCourse.data && (!byCourse.data.content.length
          ? <EmptyState icon={Wallet} title={filtered ? t('filterEmpty') : t('revenueEmpty')} description={filtered ? undefined : t('revenueEmptyText')} />
          : <Card className="gap-0 overflow-hidden rounded-xl py-0">
              <ul aria-busy={byCourse.loading} className="m-0 flex list-none flex-col divide-y divide-border p-0">{byCourse.data.content.map(row => {
                const barPct = Math.max(4, Math.round((row.grossAmount / maxCourseGross) * 100))
                return <li key={row.courseId}>
                  <button type="button" onClick={() => update({ tab: '', courseId: row.courseId, course: row.courseTitle })} className={cn('group flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-ring', touch)}>
                    <span className="flex min-w-0 flex-1 flex-col gap-2">
                      <span className="font-semibold text-foreground [overflow-wrap:anywhere]">{row.courseTitle}</span>
                      <span aria-hidden className="h-1 w-full max-w-md overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-foreground/70" style={{ width: `${barPct}%` }} /></span>
                      <span className="text-xs text-muted-foreground">{t('courseLine', { n: row.itemCount, gross: vnd(row.grossAmount, language), platform: vnd(row.platformAmount, language), author: vnd(row.authorAmount, language) })}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden />
                  </button>
                </li>
              })}</ul>
              <div className="border-t border-border px-6 py-4"><Pagination language={language} page={page} totalPages={byCourse.data.totalPages} loading={byCourse.loading} onPageChange={goPage} /></div>
            </Card>))}

      {tab === 'payouts' && <>
        {accountBox}
        <h2 className="mt-2 text-sm font-semibold">{t('payoutHistory')}</h2>
        {history.error ? <RetryAlert message={history.error} t={t} onRetry={() => void history.reload()} />
          : history.loading && !history.data ? skeletonRows
          : history.data && (!history.data.content.length
            ? <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{t('payoutEmpty')}</p>
            : <Card className="gap-0 overflow-hidden rounded-xl py-0">
                <ul aria-busy={history.loading} className="m-0 flex list-none flex-col divide-y divide-border p-0">{history.data.content.map(p => <li key={`${p.bankReference}`} className="flex flex-col gap-1 px-6 py-4">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3"><span className="font-semibold text-foreground tabular-nums">{vnd(p.amount, language)}</span><span className="text-xs text-muted-foreground tabular-nums">{formatDate(p.createdAt, language, true)}</span></p>
                  <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{t('payoutLine', { ref: p.bankReference, account: p.accountNo })}</p></li>)}</ul>
                <div className="border-t border-border px-6 py-4"><Pagination language={language} page={page} totalPages={history.data.totalPages} loading={history.loading} onPageChange={goPage} /></div>
              </Card>)}
      </>}
    </div>

    <Sheet open={formOpen && accountView !== null} onOpenChange={setFormOpen}>
      <SheetContent closeLabel={t('close')} className="w-full gap-0 overflow-y-auto sm:max-w-[480px]">
        <SheetHeader className="gap-1 border-b border-border p-6"><SheetTitle>{t('accountTitle')}</SheetTitle><SheetDescription>{t('payoutNote')}</SheetDescription></SheetHeader>
        {accountView && <AccountForm view={accountView} language={language} t={t} onSaved={() => { setFormOpen(false); setNotice(t('accountSaved')); void account.reload() }} />}
      </SheetContent>
    </Sheet>
  </main>
}
