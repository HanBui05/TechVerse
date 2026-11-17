import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Banknote, ImageOff, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '../../../components/EmptyState'
import { CopyButton } from '../../../components/MarkdownContent'
import { Pagination } from '../../../components/Pagination'
import { UserAvatar } from '../../../components/UserAvatar'
import { courseErrorText, payAdminText } from '../../../data/courseI18n'
import { adminPayouts, qrSrc, vnd } from '../../../services/courseService'
import { formatDate } from '../../Author/AuthorBlogsPage'
import { touch } from '../../Courses/courseParts'
import { RetryAlert, alertBox, card, fieldLabel, useLoad, type T } from '../../Author/Revenue/AuthorRevenuePage'
import type { AdminPayout, AuthorBalance } from '../../../types/courses'
import type { Language } from '../../../types/preferences'

type Tab = 'owed' | 'history'

/** Admin payouts: debt list + history tabs; every number comes from the server and the Sheet records exactly the account it shows. */
export function AdminPayoutsPage({ language = 'vi' }: { language?: Language }) {
  const t = payAdminText(language)
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'history' ? 'history' : 'owed'
  const raw = Number(params.get('page'))
  const page = Number.isInteger(raw) && raw > 0 ? raw : 0
  const all = params.get('all') === 'true'
  const [selected, setSelected] = useState<AuthorBalance | null>(null)
  const [notice, setNotice] = useState('')
  const [warning, setWarning] = useState('')
  const owed = useLoad(tab === 'owed' ? () => adminPayouts.authors(page, !all) : null, `${tab}|${all}|${page}`, language, t('owedLoadError'))
  const history = useLoad(tab === 'history' ? () => adminPayouts.list(page) : null, `${tab}|${page}`, language, t('historyLoadError'))
  const money = (n: number) => vnd(n, language)

  // The Sheet keeps the snapshot it was opened with (the transfer was made against it); a reload only feeds `current` for display. An emptied later page jumps back to the first.
  useEffect(() => { if (owed.data && !owed.data.content.length && page > 0) setParams(prev => { const p = new URLSearchParams(prev); p.delete('page'); return p }) }, [owed.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (changes: Record<string, string>) => setParams(() => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(changes)) if (v) p.set(k, v); return p })
  const goPage = (next: number) => setParams(prev => { const p = new URLSearchParams(prev); if (next > 0) p.set('page', String(next)); else p.delete('page'); return p })
  const skeleton = <div role="status" aria-label={t('owedLoading')} className="flex flex-col gap-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>

  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-2">
      <Badge tone="sky" className="self-start font-semibold"><Banknote aria-hidden />{t('kicker')}</Badge>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('payoutsTitle')}</h1>
    </header>

    <div role="tablist" aria-label={t('payoutsTitle')} className="flex gap-1 border-b border-border">
      {(['owed', 'history'] as const).map(key => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => go(key === 'owed' ? {} : { tab: key })}
        className={cn('-mb-px border-b-2 px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', touch, tab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{t(key === 'owed' ? 'tabOwed' : 'tabHistory')}</button>)}
    </div>

    {notice && <p role="status" className="rounded-lg border border-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">{notice}</p>}
    {warning && <div role="alert" className="flex items-center gap-2 rounded-lg border border-border bg-tone-amber-bg px-4 py-3 text-sm text-tone-amber-fg"><TriangleAlert className="size-4 shrink-0" aria-hidden />{warning}</div>}

    {tab === 'owed' && <div role="tabpanel" className="flex flex-col gap-3">
      <div className="flex items-center gap-2 pointer-coarse:min-h-11">
        <Checkbox id="show-all" checked={all} onCheckedChange={v => go(v === true ? { all: 'true' } : {})} />
        <Label htmlFor="show-all" className="text-sm">{t('showAll')}</Label>
      </div>
      {owed.error ? <RetryAlert message={owed.error} t={t} onRetry={() => void owed.reload()} />
        : owed.loading && !owed.data ? skeleton
        : owed.data && (!owed.data.content.length
          ? <EmptyState icon={Banknote} title={t('owedEmpty')} />
          : <>
              <ul aria-busy={owed.loading} className="flex flex-col gap-3">{owed.data.content.map(a => <li key={a.authorId} className={cn(card, 'flex-row flex-wrap items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch', a.balanceAmount > 0 && 'border-l-4 border-l-tone-amber-fg')}>
                <div className="flex min-w-0 flex-col gap-2">
                  <p className="flex items-center gap-2"><UserAvatar name={a.fullName} className="size-8" /><span className="font-bold [overflow-wrap:anywhere]">{a.fullName}</span><span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{a.email}</span></p>
                  <dl className="flex flex-wrap gap-x-6 gap-y-1">{([['earned', a.earnedAmount], ['paid', a.paidOutAmount], ['owed', a.balanceAmount]] as const).map(([key, value]) =>
                    <div key={key} className="flex flex-col"><dt className={fieldLabel}>{t(key)}</dt><dd className="font-semibold tabular-nums">{money(value)}</dd></div>)}</dl>
                </div>
                {a.balanceAmount > 0 && <Button className={cn('max-sm:w-full', touch)} aria-label={t('payBtnFor', { name: a.fullName })}onClick={() => { setNotice(''); setWarning(''); setSelected(a) }}>{t('payBtn')}</Button>}
              </li>)}</ul>
              <Pagination language={language} page={page} totalPages={owed.data.totalPages} loading={owed.loading} onPageChange={goPage} />
            </>)}
    </div>}

    {tab === 'history' && <div role="tabpanel" className="flex flex-col gap-3">
      {history.error ? <RetryAlert message={history.error} t={t} onRetry={() => void history.reload()} />
        : history.loading && !history.data ? skeleton
        : history.data && (!history.data.content.length
          ? <p className="text-sm text-muted-foreground">{t('payoutEmpty')}</p>
          : <>
              <ul aria-busy={history.loading} className="flex flex-col gap-3">{history.data.content.map(p => <PayoutRow key={p.id} p={p} language={language} t={t} withAuthor />)}</ul>
              <Pagination language={language} page={page} totalPages={history.data.totalPages} loading={history.loading} onPageChange={goPage} />
            </>)}
    </div>}

    <Sheet open={selected !== null} onOpenChange={next => { if (!next) setSelected(null) }}>
      <SheetContent closeLabel={t('close')} className="w-full gap-0 overflow-y-auto sm:max-w-[480px]">
        {selected && <PayoutSheet key={selected.authorId} author={selected} language={language} t={t} money={money}
          reload={() => void owed.reload()} current={owed.loading ? undefined : owed.data?.content.find(a => a.authorId === selected.authorId)}
          done={changed => { setSelected(null); setNotice(t('recordOk')); setWarning(changed ? t('accountChanged') : ''); void owed.reload() }} />}
      </SheetContent>
    </Sheet>
  </main>
}

function PayoutRow({ p, language, t, withAuthor }: { p: AdminPayout; language: Language; t: T; withAuthor?: boolean }) {
  return <li className={card}>
    <p className="flex flex-wrap items-baseline justify-between gap-x-3"><span className="font-bold tabular-nums">{vnd(p.amount, language)}{withAuthor && <span className="font-semibold"> · {p.authorName}</span>}</span><span className="text-xs text-muted-foreground">{formatDate(p.createdAt, language, true)}</span></p>
    <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{p.bankReference}</p>
    <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{t('historyLine', { bank: p.bankName, no: p.accountNo, holder: p.accountName })}</p>
    <p className="text-xs text-muted-foreground">{t('recordedBy', { name: p.recordedByName })}</p>
  </li>
}

function PayoutSheet({ author, current, language, t, money, reload, done }: { author: AuthorBalance; current?: AuthorBalance; language: Language; t: T; money: (n: number) => string; reload: () => void; done: (accountChanged: boolean) => void }) {
  const { account, vietQr } = author
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [qrFailed, setQrFailed] = useState(false)
  const [stale, setStale] = useState(false)
  const history = useLoad(() => adminPayouts.list(0, author.authorId), author.authorId, language, t('historyLoadError'))
  const ref = reference.trim()
  const valid = ref.length >= 1 && ref.length <= 255
  const src = vietQr ? qrSrc(vietQr.imageUrl) : null

  const record = async () => {
    if (!account) return
    setBusy(true); setError('')
    try {
      const result = await adminPayouts.record({ authorId: author.authorId, amount: author.balanceAmount, bankReference: ref, bankId: account.bankId, accountNo: account.accountNo, accountName: account.accountName })
      done(result.accountChanged === true)
    } catch (e) {
      setError(courseErrorText(e, language, t('recordFailed')))
      if ((e as { code?: string }).code === 'PAYOUT_EXCEEDS_BALANCE') { setStale(true); reload() }
      setBusy(false)
    }
  }
  const rows = account ? [{ label: t('bank'), value: account.bankName }, { label: t('accountNo'), value: account.accountNo, copy: true }, { label: t('accountName'), value: account.accountName, copy: true }] : []

  return <>
    <SheetHeader className="gap-1 border-b border-border p-6">
      <SheetTitle>{t('sheetPay', { name: author.fullName })}</SheetTitle>
      <SheetDescription>{author.email}</SheetDescription>
    </SheetHeader>
    <div className="flex flex-col gap-4 p-6">
      {error && <div role="alert" className={alertBox}><span>{error}</span></div>}
      {stale && <p className="text-sm text-tone-amber-fg">{current ? t('staleOwed', { amount: money(current.balanceAmount) }) : t('staleChanged')}</p>}
      {!account
        ? <div role="alert" className="rounded-lg border border-border bg-tone-amber-bg px-4 py-3 text-sm text-tone-amber-fg">{t('noAccountAuthor')}</div>
        : <>
            <p className="flex items-baseline justify-between gap-3 text-sm"><span className="text-muted-foreground">{t('amountToSend')}</span><span className="text-lg font-bold tabular-nums">{money(author.balanceAmount)} <span className="text-xs font-normal text-muted-foreground">({t('fixedAmount')})</span></span></p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              {src && !qrFailed
                ? <img src={src} alt={t('qrAlt', { name: author.fullName })} referrerPolicy="no-referrer" onError={() => setQrFailed(true)} width={160} height={160} className="size-40 shrink-0 rounded-lg border border-border bg-white" />
                : <div className="flex size-40 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-border p-2 text-center text-xs text-muted-foreground"><ImageOff className="size-5" aria-hidden />{t('qrUnavailable')}</div>}
              <dl className="flex min-w-0 flex-1 flex-col gap-2 self-stretch">{rows.map(row => <div key={row.label} className="flex flex-col">
                <dt className={fieldLabel}>{row.label}</dt>
                <dd className="flex items-center gap-1 font-medium tabular-nums [overflow-wrap:anywhere]">{row.value}{row.copy && <CopyButton language={language} label={t('copyWhat', { what: row.label.toLowerCase() })} text={() => row.value} />}</dd></div>)}</dl>
            </div>
            <p className="flex items-start gap-2 text-sm text-tone-amber-fg"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{t('holderCheck')}</p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="payout-ref" className={fieldLabel}>{t('reference')} *</Label>
              <Input id="payout-ref" maxLength={255} autoComplete="off" className="pointer-coarse:min-h-11" value={reference} onChange={e => setReference(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t('referenceHint')}</p>
            </div>
            <Button type="button" className={touch} disabled={!valid || busy || stale || author.balanceAmount <= 0} onClick={() => setAsking(true)}>{t('recordBtn')}</Button>
          </>}
      <section aria-label={t('authorHistory')} className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className={fieldLabel}>{t('authorHistory')}</h3>
        {history.error ? <RetryAlert message={history.error} t={t} onRetry={() => void history.reload()} />
          : history.data && (history.data.content.length
            ? <ul className="flex flex-col gap-2">{history.data.content.map(p => <PayoutRow key={p.id} p={p} language={language} t={t} />)}</ul>
            : <p className="text-sm text-muted-foreground">{t('payoutEmpty')}</p>)}
      </section>
    </div>
    <AlertDialog open={asking} onOpenChange={setAsking}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t('recordBtn')}</AlertDialogTitle>
          <AlertDialogDescription>{t('recordQ', { amount: money(author.balanceAmount), name: author.fullName })}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel className={touch}>{t('cancel')}</AlertDialogCancel><AlertDialogAction className={touch} onClick={() => void record()}>{t('confirm')}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
}
