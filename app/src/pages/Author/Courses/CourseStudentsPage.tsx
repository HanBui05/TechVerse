import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, RefreshCw, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { ApiError } from '../../../services/api/client'
import { EmptyState } from '../../../components/EmptyState'
import { UserAvatar } from '../../../components/UserAvatar'
import { AdminPagination } from '../../Admin/AdminPagination'
import { fieldLabel, formatDate } from '../AuthorBlogsPage'
import { courseErrorText, courseText } from '../../../data/courseI18n'
import { authorCourses } from '../../../services/courseService'
import type { CourseStudents, StudentProgress } from '../../../types/courses'
import type { Language } from '../../../types/preferences'

const SIZE = 20
const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const PROGRESS = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const
const PROGRESS_KEY = { NOT_STARTED: 'studentsNotStarted', IN_PROGRESS: 'studentsInProgress', COMPLETED: 'studentsCompleted' } as const

/** `/author/courses/:id/students`: learners of one course (name, avatar, progress); filters live in the URL. */
export function CourseStudentsPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = courseText(language)
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const urlQ = params.get('q') ?? ''
  const progress = (PROGRESS as readonly string[]).includes(params.get('progress') ?? '') ? params.get('progress') as StudentProgress : ''
  const page = Math.max(0, Number(params.get('page')) || 0)
  const [keyword, setKeyword] = useState(urlQ)
  const debounced = useDebouncedValue(keyword.trim())
  const [title, setTitle] = useState('')
  const [data, setData] = useState<CourseStudents | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [missing, setMissing] = useState(false)
  const latest = useRef(0)

  const update = (next: Record<string, string>) => setParams(old => {
    const merged = new URLSearchParams(old)
    for (const [key, value] of Object.entries(next)) value && !(key === 'page' && value === '0') ? merged.set(key, value) : merged.delete(key)
    return merged
  }, { replace: true })
  // A typed query replaces the URL one only once the debounce settles, and starts again from page 0.
  useEffect(() => { if (debounced !== urlQ) update({ q: debounced, page: '0' }) }, [debounced]) // eslint-disable-line react-hooks/exhaustive-deps
  // Back/forward changes the URL under the page: the box follows it (the debounce only settles after the same value).
  useEffect(() => { setKeyword(k => k.trim() === urlQ ? k : urlQ) }, [urlQ])
  useEffect(() => { authorCourses.detail(id).then(c => setTitle(c.title), () => {}) }, [id])

  const load = useCallback(async () => {
    const run = ++latest.current
    setLoading(true); setError(''); setMissing(false)
    try {
      const result = await authorCourses.students(id, { q: urlQ, progress, page, size: SIZE })
      if (run === latest.current) setData(result)
    } catch (e) {
      if (run !== latest.current) return
      setData(null) // a failed load must not leave the previous filter's rows under the new controls
      if (e instanceof ApiError && e.status === 404) setMissing(true)
      else setError(courseErrorText(e, language, t('studentsError')))
    } finally { if (run === latest.current) setLoading(false) }
  }, [id, urlQ, progress, page, language]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [load])

  const back = <Link to="/author/courses" className={`inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground ${touch}`}><ArrowLeft aria-hidden className="size-4" />{t('back')}</Link>
  if (missing) return <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <EmptyState icon={AlertTriangle} title={t('notFound')} action={<Button asChild className={touch}><Link to="/author/courses">{t('backToList')}</Link></Button>} />
  </main>

  const items = data?.students.content ?? []
  const summary = data?.summary
  const filtered = Boolean(urlQ || progress)
  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-2">
      {back}
      <h1 className="text-2xl font-bold [overflow-wrap:anywhere] sm:text-3xl">{t('studentsTitle')}{title && <span className="font-normal text-muted-foreground"> · {title}</span>}</h1>
    </header>

    <section aria-label={t('studentsTitle')} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {([['studentsTotal', summary?.total], ['studentsNotStarted', summary?.notStarted], ['studentsCompleted', summary?.completed]] as const).map(([key, value]) =>
        <div key={key} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm">
          <span className={fieldLabel}>{t(key)}</span><span className="text-2xl font-bold tabular-nums">{value ?? '—'}</span>
        </div>)}
    </section>

    <div className="grid gap-4 md:grid-cols-12">
      <div className="flex flex-col gap-2 md:col-span-8">
        <Label htmlFor="student-search" className={fieldLabel}>{t('studentSearch')}</Label>
        <div className="relative"><Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="student-search" type="search" maxLength={100} className={`pl-9 ${touch}`} placeholder={t('studentSearch')} value={keyword} onChange={e => setKeyword(e.target.value)} /></div>
      </div>
      <div className="flex flex-col gap-2 md:col-span-4 max-md:[&>[data-slot=native-select-wrapper]]:w-full">
        <Label htmlFor="student-progress" className={fieldLabel}>{t('studentProgress')}</Label>
        <NativeSelect id="student-progress" className={touch} value={progress} onChange={e => update({ progress: e.target.value, page: '0' })}>
          <NativeSelectOption value="">{t('all')}</NativeSelectOption>
          {PROGRESS.map(value => <NativeSelectOption key={value} value={value}>{t(PROGRESS_KEY[value])}</NativeSelectOption>)}
        </NativeSelect>
      </div>
    </div>

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
      <span>{error}</span><Button size="sm" variant="outline" className={touch} onClick={() => void load()}><RefreshCw />{t('retry')}</Button>
    </div>}

    <Card className="gap-0 overflow-hidden rounded-2xl py-0">
      {loading && !data
        ? <div aria-busy="true" aria-label={t('loading')} className="flex flex-col divide-y divide-border">{[0, 1, 2, 3].map(i => <div key={i} className="flex items-center gap-4 px-6 py-4"><Skeleton className="size-10 rounded-full" /><Skeleton className="h-4 w-48 max-w-full" /></div>)}</div>
        : error && !data ? null
          : !items.length
            ? <EmptyState className="m-6" icon={filtered ? Search : Users} title={filtered ? t('studentsNoMatch') : t('studentsEmpty')} />
            : <ul className={`m-0 flex list-none flex-col divide-y divide-border p-0 transition-opacity ${loading ? 'opacity-60' : ''}`}>
              {items.map((s, i) => {
                const percent = s.totalLessons ? Math.round(s.completedLessons * 100 / s.totalLessons) : 0
                return <li key={`${s.fullName}-${s.enrolledAt}-${i}`} className="flex flex-col gap-3 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={s.fullName} url={s.avatarUrl} className="size-10 shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
                      <span className="font-semibold [overflow-wrap:anywhere]">{s.fullName}</span>
                      <span className="text-xs text-muted-foreground">{t('enrolledOn', { date: formatDate(s.enrolledAt, language) })}{s.lastAccessedAt && ` · ${t('lastSeen', { date: formatDate(s.lastAccessedAt, language) })}`}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm tabular-nums">{s.completedLessons ? t('studentLessons', { done: s.completedLessons, total: s.totalLessons }) : t('studentNone')}</span>
                    <div role="progressbar" aria-label={`${s.fullName}: ${t('studentProgress')}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </li>
              })}
            </ul>}
      {!!data?.students.totalElements && <div className="border-t border-border px-6 py-4"><AdminPagination language={language} page={page} size={SIZE} total={data.students.totalElements} loading={loading} onPageChange={next => update({ page: String(next) })} /></div>}
    </Card>
  </main>
}
