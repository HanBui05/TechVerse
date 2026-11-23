import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Ban,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Dumbbell,
  FileText,
  GraduationCap,
  Languages,
  Lock,
  MessageSquareQuote,
  MessagesSquare,
  Palette,
  RefreshCw,
  Tag,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/use-mobile'
import { dashboardText, formatCount, formatMoney } from '../../data/dashboardI18n'
import { managementText } from '../../data/managementI18n'
import { dashboard } from '../../services/dashboardService'
import type { AdminDashboard, DashboardRevenuePeriod } from '../../types/dashboard'
import type { Language } from '../../types/preferences'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'

// Tile colours follow the matching sidebar icon so each admin area keeps one colour across the shell.
const shortcuts = [
  { path: '/admin/author-applications', icon: UserCheck, tile: 'border-tone-purple-border bg-tone-purple-bg text-tone-purple-fg', title: { vi: 'Hồ sơ tác giả', en: 'Author applications' }, text: { vi: 'Duyệt, từ chối, đình chỉ hoặc khôi phục quyền tác giả.', en: 'Approve, reject, suspend or restore author access.' } },
  { path: '/admin/users', icon: Users, tile: 'border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg', title: { vi: 'Quản lý người dùng', en: 'Manage users' }, text: { vi: 'Tìm kiếm, xem chi tiết và khóa hoặc mở khóa tài khoản.', en: 'Search, view details and lock or unlock accounts.' } },
  { path: '/admin/topics', icon: BookOpen, tile: 'border-tone-amber-border bg-tone-amber-bg text-tone-amber-fg', title: { vi: 'Chủ đề', en: 'Topics' }, text: { vi: 'Tạo, sửa và bật tắt chủ đề cho bài viết.', en: 'Create, edit and toggle article topics.' } },
  { path: '/admin/tags', icon: Tag, tile: 'border-tone-green-border bg-tone-green-bg text-tone-green-fg', title: { vi: 'Thẻ', en: 'Tags' }, text: { vi: 'Tạo, sửa và bật tắt thẻ gắn cho bài viết.', en: 'Create, edit and toggle article tags.' } },
]

/** Shared latest-request-wins hook for Admin and Moderator overview pages. Keeps current data visible while refreshing. */
export function useDashboardData<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const latest = useRef(0)

  const load = useCallback(() => {
    const round = ++latest.current
    setLoading(true)
    setError(false)
    fetcher()
      .then(result => {
        if (round !== latest.current) return
        setData(result)
        setError(false)
        setLoading(false)
      })
      .catch(() => {
        if (round !== latest.current) return
        setData(null)
        setError(true)
        setLoading(false)
      })
  }, [fetcher])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, reload: load }
}

export type StatTileItem = {
  key: string
  label: string
  value: number | undefined
  icon: ComponentType<{ className?: string }>
  to?: string
  attention?: boolean
}

/** Shared stat tile for Admin and Moderator overview pages. Equal height in row; number aligned to bottom (`mt-auto`). */
export function DashboardStatTile({
  label,
  value,
  icon: Icon,
  to,
  attention = false,
  initialLoading = false,
  language,
}: {
  label: string
  value: number | undefined
  icon: ComponentType<{ className?: string }>
  to?: string
  attention?: boolean
  initialLoading?: boolean
  language: Language
}) {
  const hasAttention = attention && typeof value === 'number' && value > 0
  const formatted = formatCount(value, language)
  const body = (
    <>
      <span className="flex w-full items-start justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] leading-snug font-semibold tracking-[.05em] text-muted-foreground uppercase">
          {hasAttention && <span aria-hidden className="size-2 shrink-0 rounded-full bg-tone-amber-fg" />}
          <span className="wrap-break-word">{label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
          <Icon aria-hidden className="size-4 shrink-0" />
          {to && <ArrowUpRight aria-hidden className="size-3.5 shrink-0" />}
        </span>
      </span>
      {initialLoading ? (
        <Skeleton data-slot="stat-skeleton" className="mt-auto h-8 w-20 rounded-md" />
      ) : (
        <span className="mt-auto text-2xl font-semibold tracking-tight text-foreground tabular-nums">
          {formatted}
        </span>
      )}
    </>
  )

  const baseClass = cn(
    'flex h-full flex-col justify-between gap-3 rounded-xl border bg-card p-5 text-left text-card-foreground',
    hasAttention ? 'border-tone-amber-border' : 'border-border',
  )

  if (to) {
    return (
      <Link
        to={to}
        aria-label={initialLoading ? label : `${label}: ${formatted}`}
        className={cn(
          baseClass,
          touch,
          'outline-none transition-colors hover:bg-muted/30 focus-visible:ring-[3px] focus-visible:ring-ring',
        )}
      >
        {body}
      </Link>
    )
  }

  return <div className={baseClass}>{body}</div>
}

type RevenueColumnKey = keyof DashboardRevenuePeriod

export function AdminDashboardPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = (message: string) => managementText(message, language)
  const dt = dashboardText(language)
  const vi = language === 'vi'
  const { data, loading, error, reload } = useDashboardData(dashboard.admin)
  const compact = useIsMobile()

  const initialLoading = loading && data === null && !error
  const showPlaceholder = initialLoading || error

  const userTiles: StatTileItem[] = [
    { key: 'total', label: dt('totalUsers'), value: data?.users?.total, icon: Users },
    { key: 'active', label: dt('activeUsers'), value: data?.users?.active, icon: CheckCircle2 },
    { key: 'locked', label: dt('lockedUsers'), value: data?.users?.locked, icon: Lock },
    { key: 'new7d', label: dt('newLast7Days'), value: data?.users?.newLast7Days, icon: UserPlus },
  ]

  const authorTiles: StatTileItem[] = [
    { key: 'approved', label: dt('approvedAuthors'), value: data?.authors?.approved, icon: UserCheck },
    { key: 'suspended', label: dt('suspendedAuthors'), value: data?.authors?.suspended, icon: Ban },
    {
      key: 'pendingApps',
      label: dt('pendingApplications'),
      value: data?.authors?.pendingApplications,
      icon: Clock,
      to: '/admin/author-applications',
      attention: true,
    },
  ]

  const contentTiles: StatTileItem[] = [
    { key: 'articles', label: dt('articles'), value: data?.content?.articles, icon: FileText },
    { key: 'courses', label: dt('courses'), value: data?.content?.courses, icon: GraduationCap },
    { key: 'exercises', label: dt('exerciseSets'), value: data?.content?.exerciseSets, icon: Dumbbell },
    { key: 'interviews', label: dt('interviewQuestions'), value: data?.content?.interviewQuestions, icon: MessageSquareQuote },
    { key: 'forum', label: dt('forumQuestions'), value: data?.content?.forumQuestions, icon: MessagesSquare },
  ]

  const orderTiles: StatTileItem[] = [
    {
      key: 'awaiting',
      label: dt('awaitingConfirmation'),
      value: data?.orders?.awaitingConfirmation,
      icon: ClipboardCheck,
      // ALL: the count includes reported EXPIRED orders, which the page's default PENDING filter hides.
      to: '/admin/orders?status=ALL&transferReported=true',
      attention: true,
    },
    {
      key: 'reconcile',
      label: dt('needsReconciliation'),
      value: data?.orders?.needsReconciliation,
      icon: AlertTriangle,
      to: '/admin/orders?status=ALL&needsReconciliation=true',
      attention: true,
    },
  ]

  const filterVisible = (items: StatTileItem[]) =>
    showPlaceholder ? items : items.filter(item => typeof item.value === 'number')

  const visibleUsers = filterVisible(userTiles)
  const visibleAuthors = filterVisible(authorTiles)
  const visibleContent = filterVisible(contentTiles)
  const visibleOrders = filterVisible(orderTiles)

  const revenueColumns: { key: RevenueColumnKey; label: string; isMoney: boolean }[] = [
    { key: 'paidOrders', label: dt('paidOrders'), isMoney: false },
    { key: 'grossAmount', label: dt('grossAmount'), isMoney: true },
    { key: 'platformAmount', label: dt('platformAmount'), isMoney: true },
    { key: 'authorAmount', label: dt('authorAmount'), isMoney: true },
  ]

  const rawPeriods: { key: 'allTime' | 'last30Days'; label: string; period?: DashboardRevenuePeriod }[] = [
    { key: 'allTime', label: dt('allTime'), period: data?.revenue?.allTime },
    { key: 'last30Days', label: dt('last30Days'), period: data?.revenue?.last30Days },
  ]

  const visiblePeriods = showPlaceholder
    ? rawPeriods
    : rawPeriods.filter(p => p.period && revenueColumns.some(col => typeof p.period?.[col.key] === 'number'))

  const visibleRevenueCols = showPlaceholder
    ? revenueColumns
    : revenueColumns.filter(col => visiblePeriods.some(p => typeof p.period?.[col.key] === 'number'))

  const showRevenueCard = visiblePeriods.length > 0 && visibleRevenueCols.length > 0
  const showOrdersRevenueGroup = visibleOrders.length > 0 || showRevenueCard

  const renderCell = (period: DashboardRevenuePeriod | undefined, col: { key: RevenueColumnKey; isMoney: boolean }) => {
    if (initialLoading) return <Skeleton data-slot="stat-skeleton" className="ml-auto h-6 w-24 rounded-md" />
    const raw = period?.[col.key]
    // "—" means a failed load; a field the response leaves out stays blank (table cells cannot be hidden).
    if (!showPlaceholder && typeof raw !== 'number') return null
    return col.isMoney ? formatMoney(raw, language) : formatCount(raw, language)
  }

  return (
    <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">{t('TechVerse administration')}</span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Chào mừng trở lại!')}</h1>
          <p className="text-sm text-muted-foreground">{vi ? 'Chọn một khu vực để bắt đầu quản trị TechVerse.' : 'Pick an area to start managing TechVerse.'}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className={touch}><Link to="/settings/language"><Languages />{vi ? 'Tiếng Việt' : 'English'}</Link></Button>
          <Button asChild variant="outline" size="sm" className={touch}><Link to="/settings/theme"><Palette />{vi ? 'Giao diện' : 'Appearance'}</Link></Button>
        </div>
      </header>

      <section aria-labelledby="admin-overview" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="admin-overview" className="text-base font-semibold tracking-tight">{dt('overview')}</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={reload}
            className={touch}
          >
            <RefreshCw aria-hidden className={cn('size-4', loading && 'animate-spin')} />
            {dt('refresh')}
          </Button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-danger"
          >
            <span>{dt('loadError')}</span>
            <Button type="button" variant="outline" size="sm" onClick={reload} className={touch}>
              <RefreshCw aria-hidden className="size-4" />
              {dt('retry')}
            </Button>
          </div>
        )}

        {visibleUsers.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-[.05em] text-muted-foreground uppercase">{dt('groupUsers')}</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {visibleUsers.map(tile => (
                <DashboardStatTile
                  key={tile.key}
                  label={tile.label}
                  value={tile.value}
                  icon={tile.icon}
                  to={tile.to}
                  attention={tile.attention}
                  initialLoading={initialLoading}
                  language={language}
                />
              ))}
            </div>
          </div>
        )}

        {visibleAuthors.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-[.05em] text-muted-foreground uppercase">{dt('groupAuthors')}</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {visibleAuthors.map(tile => (
                <DashboardStatTile
                  key={tile.key}
                  label={tile.label}
                  value={tile.value}
                  icon={tile.icon}
                  to={tile.to}
                  attention={tile.attention}
                  initialLoading={initialLoading}
                  language={language}
                />
              ))}
            </div>
          </div>
        )}

        {visibleContent.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-[.05em] text-muted-foreground uppercase">{dt('groupContent')}</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
              {visibleContent.map(tile => (
                <DashboardStatTile
                  key={tile.key}
                  label={tile.label}
                  value={tile.value}
                  icon={tile.icon}
                  to={tile.to}
                  attention={tile.attention}
                  initialLoading={initialLoading}
                  language={language}
                />
              ))}
            </div>
          </div>
        )}

        {showOrdersRevenueGroup && (
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-semibold tracking-[.05em] text-muted-foreground uppercase">{dt('groupOrdersRevenue')}</h3>

            {visibleOrders.length > 0 && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {visibleOrders.map(tile => (
                  <DashboardStatTile
                    key={tile.key}
                    label={tile.label}
                    value={tile.value}
                    icon={tile.icon}
                    to={tile.to}
                    attention={tile.attention}
                    initialLoading={initialLoading}
                    language={language}
                  />
                ))}
              </div>
            )}

            {showRevenueCard && (
              <Card className="gap-4 rounded-xl border border-border bg-card p-5">
                <h4 className="text-sm font-semibold text-foreground">{dt('revenue')}</h4>
                {compact ? (
                  <div className="flex flex-col divide-y divide-border">
                    {visiblePeriods.map(p => {
                      const periodCols = showPlaceholder
                        ? visibleRevenueCols
                        : visibleRevenueCols.filter(col => typeof p.period?.[col.key] === 'number')
                      return (
                        <div key={p.key} className="flex flex-col gap-2.5 py-3 first:pt-0 last:pb-0">
                          <span className="text-xs font-semibold tracking-[.05em] text-muted-foreground uppercase">
                            {p.label}
                          </span>
                          <dl className="flex flex-col gap-2 text-sm">
                            {periodCols.map(col => (
                              <div key={col.key} className="flex flex-wrap items-baseline justify-between gap-2">
                                <dt className="text-xs text-muted-foreground">{col.label}</dt>
                                <dd className="font-semibold text-foreground tabular-nums break-all">
                                  {renderCell(p.period, col)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] font-semibold tracking-[.05em] text-muted-foreground uppercase">
                          <th scope="col" className="pb-3 pr-4">
                            <span className="sr-only">{dt('revenue')}</span>
                          </th>
                          {visibleRevenueCols.map(col => (
                            <th key={col.key} scope="col" className="px-3 pb-3 text-right last:pr-0">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/70">
                        {visiblePeriods.map(p => (
                          <tr key={p.key}>
                            <th scope="row" className="py-3.5 pr-4 text-left font-medium text-foreground">
                              {p.label}
                            </th>
                            {visibleRevenueCols.map(col => (
                              <td
                                key={col.key}
                                className="px-3 py-3.5 text-right font-semibold text-foreground tabular-nums last:pr-0"
                              >
                                {renderCell(p.period, col)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="admin-shortcuts" className="flex flex-col gap-4">
        <h2 id="admin-shortcuts" className="text-base font-semibold tracking-tight">{vi ? 'Khu vực quản trị' : 'Admin areas'}</h2>
        <ul data-slot="admin-shortcuts" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map(({ path, icon: Icon, title, text }) => <li key={path} className="flex">
            <Link to={path} className="group flex w-full flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground outline-none transition-colors hover:bg-muted/30 focus-visible:ring-[3px] focus-visible:ring-ring">
              <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-secondary/60 text-foreground"><Icon aria-hidden className="size-5" /></span>
              <span className="flex flex-col gap-1">
                <span className="text-sm font-semibold">{title[language]}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{text[language]}</span>
              </span>
              <span aria-hidden className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-medium text-foreground">{vi ? 'Mở' : 'Open'}<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          </li>)}
        </ul>
      </section>
    </main>
  )
}
