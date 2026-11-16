import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, ChevronRight, Landmark, RefreshCw, TriangleAlert, Wallet, X } from 'lucide-react'
import { enUS, vi as viLocale } from 'date-fns/locale'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
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
type T = ReturnType<typeof payAdminText>
const TABS: Tab[] = ['sales', 'courses', 'payouts']
const TAB_KEY = { sales: 'tabSales', courses: 'tabCourses', payouts: 'tabPayouts' } as const
const fieldLabel = 'text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground'
const alertBox = 'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger'
const card = 'flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 shadow-sm'
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const shown = (iso: string) => iso.split('-').reverse().join('/')

/** One request per key; a newer key or a retry wins, a stale answer is dropped. `run = null` means nothing to load. */
function useLoad<T>(run: (() => Promise<T>) | null, key: string, language: Language, fallback: string) {
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

function RetryAlert({ message, t, onRetry }: { message: string; t: T; onRetry: () => void }) {
  return <div role="alert" className={alertBox}><span>{message}</span>
    <Button type="button" variant="outline" size="sm" className={touch} onClick={onRetry}><RefreshCw aria-hidden />{t('retry')}</Button></div>
}

function DateField({ label, value, onChange, language, t, invalid }: { label: string; value: string; onChange: (iso: string) => void; language: Language; t: T; invalid?: boolean }) {
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
  const tile = ([key, value]: readonly [Parameters<T>[0], string]) => <div key={key} className={card}>
    <dt className={fieldLabel}>{t(key)}</dt><dd className="text-xl font-bold tabular-nums [overflow-wrap:anywhere]">{value}</dd></div>
  const skeletonRows = <>{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</>
  const accountView = account.data
  const accountBox = accountView && (accountView.account
    ? <section aria-labelledby="payout-account-title" className={cn(card, 'gap-3')}>
        <div className="flex items-center justify-between gap-3"><h2 id="payout-account-title" className="font-bold">{t('accountTitle')}</h2>
          <Button type="button" variant="outline" size="sm" className={touch} onClick={() => setFormOpen(true)}>{t('editAccount')}</Button></div>
        <dl className="grid gap-3 sm:grid-cols-3">{([['bank', accountView.account.bankName], ['accountNo', accountView.account.accountNo], ['accountName', accountView.account.accountName]] as const).map(([key, value]) =>
          <div key={key} className="flex flex-col gap-1"><dt className={fieldLabel}>{t(key)}</dt><dd className="font-semibold tabular-nums [overflow-wrap:anywhere]">{value}</dd></div>)}</dl>
        <p className="text-sm text-muted-foreground">{t('payoutNote')}</p>
      </section>
    : <EmptyState icon={Landmark} title={t('accountTitle')} description={t('noAccount')} action={<Button type="button" className={touch} onClick={() => setFormOpen(true)}>{t('addAccount')}</Button>} />)

  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-2">
      <Badge tone="purple" className="self-start font-semibold"><Wallet aria-hidden />{t('authorSpace')}</Badge>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('revenueTitle')}</h1>
    </header>

    {notice && <p role="status" className="rounded-lg border border-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">{notice}</p>}
    {account.error && <RetryAlert message={account.error} t={t} onRetry={() => void account.reload()} />}
    {accountView && !accountView.account && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-amber-bg px-4 py-3 text-sm text-tone-amber-fg">
      <span className="flex items-center gap-2"><TriangleAlert className="size-4" aria-hidden />{t('noAccount')}</span>
      <Button type="button" size="sm" className={touch} onClick={() => setFormOpen(true)}>{t('addAccount')}</Button></div>}

    {rev.error
      ? <RetryAlert message={rev.error} t={t} onRetry={() => void rev.reload()} />
      : rev.loading
        ? <div role="status" aria-label={t('revenueLoading')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        : tiles && allTime && <>
            <section aria-label={t('filteredHeading')} className="flex flex-col gap-2"><h2 className={fieldLabel}>{t('filteredHeading')}</h2>
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{tiles.map(tile)}</dl></section>
            <section aria-label={t('allTimeHeading')} className="flex flex-col gap-2"><h2 className={fieldLabel}>{t('allTimeHeading')}</h2>
              <dl className="grid grid-cols-2 gap-3 lg:max-w-md">{allTime.map(tile)}</dl>
              <p className="text-sm text-muted-foreground">{t('allTimeNote')}</p></section>
          </>}

    <div role="tablist" aria-label={t('tabs')} className="flex gap-1 border-b border-border">
      {TABS.map(key => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => update({ tab: key === 'sales' ? '' : key, ...(key === 'courses' ? { courseId: '', course: '' } : {}), ...(key === 'payouts' ? { courseId: '', course: '', from: '', to: '' } : {}) } )}
        className={cn('-mb-px border-b-2 px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', touch, tab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{t(TAB_KEY[key])}</button>)}
    </div>

    {tab !== 'payouts' && <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <DateField label={t('fromDate')} value={from} onChange={v => update({ from: v })} language={language} t={t} />
        <DateField label={t('toDate')} value={to} onChange={v => update({ to: v })} language={language} t={t} invalid={rangeInvalid} />
        {filtered && <Button type="button" variant="ghost" className={touch} onClick={() => update({ from: '', to: '', courseId: '', course: '' })}>{t('clearFilters')}</Button>}
      </div>
      {rangeInvalid && <p className="text-sm text-danger">{t('rangeInvalid')}</p>}
      {courseId && <p className="flex items-center gap-2 text-sm"><span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1">
        <span>{t('filtering', { course: courseName })}</span>
        <button type="button" aria-label={t('removeCourse')} className={cn('rounded-full', touch)} onClick={() => update({ courseId: '', course: '' })}><X className="size-3.5" aria-hidden /></button></span></p>}
    </div>}

    <div role="tabpanel" className="flex flex-col gap-3">
      {tab === 'sales' && !rev.error && (rev.loading ? skeletonRows : rev.data && (!rev.data.items.content.length
        ? <EmptyState icon={Wallet} title={filtered ? t('filterEmpty') : t('revenueEmpty')} description={filtered ? undefined : t('revenueEmptyText')} />
        : <>
            <p className="text-sm text-muted-foreground">{t('snapshotNote')}</p>
            <ul aria-busy={rev.loading} className="flex flex-col gap-3">{rev.data.items.content.map((item, i) => <li key={`${item.courseId}-${item.paidAt}-${i}`} className={card}>
              <p className="flex flex-wrap items-baseline justify-between gap-x-3"><span className="font-bold [overflow-wrap:anywhere]">{item.courseTitle}</span><span className="text-xs text-muted-foreground">{t('paidOn', { when: formatDate(item.paidAt, language, true) })}</span></p>
              <p className="text-sm text-muted-foreground">{t('itemLine', { price: vnd(item.unitPriceAmount, language), rate: item.commissionRateBps / 100, platform: vnd(item.commissionAmount, language), author: vnd(item.authorNetAmount, language) })}</p>
            </li>)}</ul>
            <Pagination language={language} page={page} totalPages={rev.data.items.totalPages} loading={rev.loading} onPageChange={goPage} />
          </>))}

      {tab === 'courses' && (byCourse.error ? <RetryAlert message={byCourse.error} t={t} onRetry={() => void byCourse.reload()} />
        : byCourse.loading ? skeletonRows
        : byCourse.data && (!byCourse.data.content.length
          ? <EmptyState icon={Wallet} title={filtered ? t('filterEmpty') : t('revenueEmpty')} description={filtered ? undefined : t('revenueEmptyText')} />
          : <>
              <ul aria-busy={byCourse.loading} className="flex flex-col gap-3">{byCourse.data.content.map(row => <li key={row.courseId}>
                <button type="button" onClick={() => update({ tab: '', courseId: row.courseId, course: row.courseTitle })} className={cn(card, 'w-full flex-row items-center justify-between gap-3 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring', touch)}>
                  <span className="flex min-w-0 flex-col gap-1"><span className="font-bold [overflow-wrap:anywhere]">{row.courseTitle}</span>
                    <span className="text-sm text-muted-foreground">{t('courseLine', { n: row.itemCount, gross: vnd(row.grossAmount, language), platform: vnd(row.platformAmount, language), author: vnd(row.authorAmount, language) })}</span></span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /></button></li>)}</ul>
              <Pagination language={language} page={page} totalPages={byCourse.data.totalPages} loading={byCourse.loading} onPageChange={goPage} />
            </>))}

      {tab === 'payouts' && <>
        {accountBox}
        <h2 className="mt-2 font-bold">{t('payoutHistory')}</h2>
        {history.error ? <RetryAlert message={history.error} t={t} onRetry={() => void history.reload()} />
          : history.loading && !history.data ? skeletonRows
          : history.data && (!history.data.content.length
            ? <p className="text-sm text-muted-foreground">{t('payoutEmpty')}</p>
            : <>
                <ul aria-busy={history.loading} className="flex flex-col gap-3">{history.data.content.map(p => <li key={`${p.bankReference}`} className={card}>
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3"><span className="font-bold tabular-nums">{vnd(p.amount, language)}</span><span className="text-xs text-muted-foreground">{formatDate(p.createdAt, language, true)}</span></p>
                  <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{t('payoutLine', { ref: p.bankReference, account: p.accountNo })}</p></li>)}</ul>
                <Pagination language={language} page={page} totalPages={history.data.totalPages} loading={history.loading} onPageChange={goPage} />
              </>)}
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
