import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, BookCheck, Eye, PencilLine, Plus, RefreshCw, Search, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { statusTone } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { EmptyState } from '../../../components/EmptyState'
import { AdminPagination } from '../../Admin/AdminPagination'
import { fieldLabel, formatDate } from '../AuthorBlogsPage'
import { difficultyLabel, exerciseErrorText, exerciseText, statusLabel, typeLabel } from '../../../data/exerciseI18n'
import { authorExercises, exerciseActions, type ExerciseAction } from '../../../services/exerciseService'
import type { Page } from '../../../types/articles'
import type { ExerciseStatus, ExerciseSummary, ExerciseType } from '../../../types/exercises'
import type { Language } from '../../../types/preferences'

const SIZE = 20
const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const STATUSES: ExerciseStatus[] = ['DRAFT', 'PENDING', 'CHANGES_REQUESTED', 'PUBLISHED', 'AUTHOR_HIDDEN', 'HIDDEN', 'REMOVED']
const TYPES: ExerciseType[] = ['MULTIPLE_CHOICE', 'FLASHCARD']
/** Status badge tone: HIDDEN (by a moderator) is a refusal, so danger, unlike the neutral Author-hidden state. */
export const exerciseTone = (status: ExerciseStatus) => status === 'HIDDEN' ? 'rose' : statusTone(status)

type Ask = { action: Extract<ExerciseAction, 'delete' | 'withdraw'>; item: ExerciseSummary }

/** `/author/exercises`: own sets with status/type/keyword filters; each row shows only the actions the status allows (wireframe 1). */
export function AuthorExercisesPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = exerciseText(language)
  const navigate = useNavigate()
  const [status, setStatus] = useState<ExerciseStatus | ''>('')
  const [type, setType] = useState<ExerciseType | ''>('')
  const [keyword, setKeyword] = useState('')
  const query = useDebouncedValue(keyword.trim())
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Page<ExerciseSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [ask, setAsk] = useState<Ask | null>(null)
  const [busy, setBusy] = useState(false)
  const latest = useRef(0)

  const load = useCallback(async () => {
    const id = ++latest.current
    setLoading(true); setError('')
    try {
      const result = await authorExercises.list({ page, size: SIZE, status, type, keyword: query })
      if (id === latest.current) setData(result)
    } catch (e) { if (id === latest.current) setError(exerciseErrorText(e, language, t('loadError'))) }
    finally { if (id === latest.current) setLoading(false) }
  }, [page, status, type, query, language])
  useEffect(() => { void load() }, [load])
  useEffect(() => { setPage(0) }, [query])

  const run = async (action: ExerciseAction, item: ExerciseSummary) => {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      if (action === 'copy') { await authorExercises.copy(item.id); setMessage(t('copied')) }
      else if (action === 'delete') { await authorExercises.remove(item.id); setMessage(t('deleted')) }
      else if (action === 'withdraw') { await authorExercises.withdraw(item.id); setMessage(t('done')) }
      else { await authorExercises.visibility(item.id, action === 'hide' ? 'HIDE' : 'UNHIDE'); setMessage(t('done')) }
      setAsk(null); void load()
    } catch (e) { setAsk(null); setError(exerciseErrorText(e, language, t('loadError'))) }
    finally { setBusy(false) }
  }
  const filtered = Boolean(query || status || type)
  const items = data?.content ?? []
  const clear = () => { setKeyword(''); setStatus(''); setType(''); setPage(0) }

  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
      <Button asChild className={touch}><Link to="/author/exercises/new"><Plus />{t('newSet')}</Link></Button>
    </header>

    <Card className="gap-4 rounded-2xl p-6">
      <div className="grid gap-4 md:grid-cols-12">
        {([['status', STATUSES, status, setStatus, statusLabel], ['type', TYPES, type, setType, typeLabel]] as const).map(([key, values, value, set, labels]) => <div key={key} className="flex flex-col gap-2 md:col-span-3">
          <Label htmlFor={`exercise-${key}`} className={fieldLabel}>{t(key)}</Label>
          <NativeSelect id={`exercise-${key}`} className={touch} value={value} onChange={e => { (set as (v: string) => void)(e.target.value); setPage(0); setMessage('') }}>
            <NativeSelectOption value="">{t('all')}</NativeSelectOption>
            {values.map(v => <NativeSelectOption key={v} value={v}>{(labels as Record<string, { vi: string; en: string }>)[v][language]}</NativeSelectOption>)}
          </NativeSelect>
        </div>)}
        <div className="flex flex-col gap-2 md:col-span-6">
          <Label htmlFor="exercise-search" className={fieldLabel}>{t('search')}</Label>
          <div className="relative"><Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="exercise-search" type="search" maxLength={100} className={`pl-9 ${touch}`} placeholder={t('searchPlaceholder')} value={keyword} onChange={e => setKeyword(e.target.value)} /></div>
        </div>
      </div>
    </Card>

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
      <span>{error}</span>
      <Button size="sm" variant="outline" className={touch} onClick={() => void load()}><RefreshCw />{t('retry')}</Button>
    </div>}
    {message && <p role="status" className="rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">{message}</p>}

    <Card className="gap-0 overflow-hidden rounded-2xl py-0">
      <h2 className="border-b border-border px-6 py-4 text-base font-bold">{t('list')}</h2>
      {loading && !data
        ? <div aria-busy="true" aria-label={t('loading')} className="flex flex-col divide-y divide-border">{[0, 1, 2].map(i => <div key={i} className="flex flex-col gap-2 px-6 py-4"><Skeleton className="h-4 w-64 max-w-full" /><Skeleton className="h-3 w-40" /></div>)}</div>
        : error && !data ? null
          : !items.length
            ? filtered
              ? <EmptyState className="m-6" icon={Search} title={t('noMatch')} action={<Button variant="outline" className={touch} onClick={clear}>{t('clearFilters')}</Button>} />
              : <EmptyState className="m-6" icon={BookCheck} title={t('emptyTitle')} action={<Button asChild className={touch}><Link to="/author/exercises/new"><Plus />{t('newSet')}</Link></Button>} />
            : <ul className={`m-0 flex list-none flex-col divide-y divide-border p-0 transition-opacity ${loading ? 'opacity-60' : ''}`}>
              {items.map(item => {
                const { primary, actions } = exerciseActions(item)
                return <li key={item.id} onClick={e => { if (!(e.target as Element).closest('a,button')) navigate(`/author/exercises/${item.id}/edit`) }}
                  className="flex cursor-pointer flex-col gap-3 px-6 py-4 transition-colors hover:bg-muted/50">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="line-clamp-2 font-semibold [overflow-wrap:anywhere]">{item.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <Badge tone={exerciseTone(item.status)}>{statusLabel[item.status][language]}</Badge>
                      <Badge variant="outline">{typeLabel[item.type][language]}</Badge>
                      <Badge variant="outline">{difficultyLabel[item.difficulty][language]}</Badge>
                      <span>{t(item.type === 'FLASHCARD' ? 'cards' : 'questions', { n: item.questionCount })}</span>
                      <span>{t('updated', { date: formatDate(item.updatedAt, language) })}</span>
                      {item.aiAssisted && <Badge tone="purple"><Sparkles aria-hidden />{t('aiUsed')}</Badge>}
                    </span>
                    {item.moderationNote && (item.status === 'CHANGES_REQUESTED' || item.status === 'HIDDEN' || item.status === 'REMOVED') &&
                      <span className="flex items-start gap-1.5 text-xs text-tone-amber-fg"><AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" /><span>{t('moderatorNote')}: “{item.moderationNote}”</span></span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant={primary === 'edit' ? 'default' : 'outline'} className={touch}>
                      <Link to={`/author/exercises/${item.id}/edit`} aria-label={`${t(primary)} ${item.title}`}>{primary === 'edit' ? <PencilLine /> : <Eye />}{t(primary)}</Link>
                    </Button>
                    {actions.map(action => <Button key={action} size="sm" variant="outline" disabled={busy} className={touch} aria-label={`${t(action)} ${item.title}`}
                      onClick={() => action === 'delete' || action === 'withdraw' ? setAsk({ action, item }) : void run(action, item)}>{t(action)}</Button>)}
                  </div>
                </li>
              })}
            </ul>}
      {!!data?.totalElements && <div className="border-t border-border px-6 py-4"><AdminPagination language={language} page={page} size={SIZE} total={data.totalElements} loading={loading} onPageChange={setPage} /></div>}
    </Card>

    <AlertDialog open={ask !== null} onOpenChange={open => { if (!open && !busy) setAsk(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{ask && t(ask.action === 'delete' ? 'deleteTitle' : 'withdrawTitle')}</AlertDialogTitle></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} className={touch}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction disabled={busy} className={touch} onClick={e => { e.preventDefault(); if (ask) void run(ask.action, ask.item) }}>{ask && t(ask.action)}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </main>
}
