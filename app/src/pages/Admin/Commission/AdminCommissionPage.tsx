import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { courseErrorText, payAdminText } from '../../../data/courseI18n'
import { authorShare, commission, rateBps, vnd } from '../../../services/courseService'
import { formatDate } from '../../Author/AuthorBlogsPage'
import { touch } from '../../Courses/courseParts'
import type { CommissionPolicy } from '../../../types/courses'
import type { Language } from '../../../types/preferences'

const EXAMPLE_PRICE = 350_000
const fieldLabel = 'text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground'
const percent = (bps: number) => `${bps / 100}%`

/** Platform commission (wireframe 4c-3): only the active policy exists in the API; every change reloads it from the server. */
export function AdminCommissionPage({ language = 'vi' }: { language?: Language }) {
  const t = payAdminText(language)
  const [policy, setPolicy] = useState<CommissionPolicy | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [notice, setNotice] = useState('')
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const latest = useRef(0)
  const bps = rateBps(text)

  const load = useCallback(async () => {
    const id = ++latest.current
    setError('')
    try {
      const result = await commission.get()
      if (id === latest.current) { setPolicy(result); setLoaded(true) }
    } catch (e) {
      if (id === latest.current) { setLoaded(false); setError(courseErrorText(e, language, t('rateLoadError'))) }
    }
  }, [language]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [load])

  const save = async () => {
    setBusy(true); setFieldError(''); setNotice('')
    try {
      const next = await commission.change(bps!)
      // The server returns the existing policy when the rate is the same.
      setNotice(t(policy && next.id === policy.id ? 'rateUnchanged' : 'rateUpdated')); setText('')
      await load()
    } catch (e) { setFieldError(courseErrorText(e, language, t('rateFailed'))) } finally { setBusy(false) }
  }
  const shown = text.trim() !== '' && bps === null ? t('rateInvalid') : fieldError
  const example = bps === null ? null : authorShare(EXAMPLE_PRICE, bps)

  return <main className="tw-page mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-1 border-b border-border pb-5">
      <span className={fieldLabel}>{t('kicker')}</span>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('commissionTitle')}</h1>
    </header>
    {notice && <p role="status" className="rounded-lg border border-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">{notice}</p>}
    {error
      ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger"><span>{error}</span>
          <Button type="button" variant="outline" size="sm" className={touch} onClick={() => void load()}><RefreshCw aria-hidden />{t('retry')}</Button></div>
      : !loaded
        ? <div role="status" aria-label={t('rateLoading')} className="flex flex-col gap-4"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>
        : <>
          <section aria-label={t('current')} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 shadow-sm">
            {policy
              ? <>
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="text-sm text-muted-foreground">{t('platformKeeps')}</span><span className="text-3xl font-bold tabular-nums">{percent(policy.rateBps)}</span><span className="text-sm text-muted-foreground">({policy.rateBps} bps)</span></p>
                <p className="text-sm text-muted-foreground">{t('policy', { date: formatDate(policy.effectiveFrom, language, true) })}</p>
                <p className="text-sm text-muted-foreground">{t('policyNote')}</p>
              </>
              : <p className="rounded-lg border border-border bg-tone-amber-bg px-4 py-3 text-sm text-tone-amber-fg">{t('noPolicy')}</p>}
          </section>
          <form onSubmit={e => { e.preventDefault(); if (bps !== null) setAsk(true) }} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-bold">{t('changeTitle')}</h2>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rate" className={fieldLabel}>{t('newRate')} *</Label>
              <div className="flex flex-wrap items-center gap-3 max-sm:flex-col max-sm:items-stretch">
                <Input id="rate" inputMode="decimal" className="pointer-coarse:min-h-11 sm:max-w-40" value={text} aria-invalid={Boolean(shown)} onChange={e => { setText(e.target.value); setFieldError('') }} />
                {bps !== null && <span className="text-sm text-muted-foreground">= {bps} bps</span>}
                <Button type="submit" disabled={bps === null || busy} className={touch}>{t('saveRate')}</Button>
              </div>
              {shown && <p className="text-xs text-danger">{shown}</p>}
            </div>
            {example && <p className="text-sm text-muted-foreground">{t('example', { price: vnd(EXAMPLE_PRICE, language), platform: vnd(example.platform, language), author: vnd(example.author, language) })}</p>}
          </form>
        </>}

    <AlertDialog open={ask} onOpenChange={setAsk}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t('changeRate')}</AlertDialogTitle><AlertDialogDescription>{t('rateQ', { rate: bps === null ? '' : bps / 100 })}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel className={touch}>{t('cancel')}</AlertDialogCancel><AlertDialogAction className={touch} onClick={() => void save()}>{t('changeRate')}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </main>
}
