import {
  ClipboardList,
  Dumbbell,
  EyeOff,
  FileText,
  GraduationCap,
  MessageSquareQuote,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { moderatorText } from '../../data/articleI18n'
import { dashboardText } from '../../data/dashboardI18n'
import { dashboard } from '../../services/dashboardService'
import type { Language } from '../../types/preferences'
import { DashboardStatTile, useDashboardData, type StatTileItem } from '../Admin/AdminDashboardPage'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'

export function ModeratorDashboardPage({ language }: { language: Language }) {
  const t = moderatorText(language)
  const dt = dashboardText(language)
  const { data, loading, error, reload } = useDashboardData(dashboard.moderator)

  const initialLoading = loading && data === null && !error
  const showPlaceholder = initialLoading || error

  const tiles: StatTileItem[] = [
    {
      key: 'articles',
      label: dt('articlesPending'),
      value: data?.pending?.articles,
      icon: FileText,
      to: '/moderator/articles',
      attention: true,
    },
    {
      key: 'courses',
      label: dt('coursesPending'),
      value: data?.pending?.courses,
      icon: GraduationCap,
      to: '/moderator/courses',
      attention: true,
    },
    {
      key: 'exercises',
      label: dt('exerciseSetsPending'),
      value: data?.pending?.exerciseSets,
      icon: Dumbbell,
      to: '/moderator/exercises',
      attention: true,
    },
    {
      key: 'interviews',
      label: dt('interviewQuestionsPending'),
      value: data?.pending?.interviewQuestions,
      icon: MessageSquareQuote,
      to: '/moderator/interview-questions',
      attention: true,
    },
    {
      key: 'reports',
      label: dt('openReports'),
      value: data?.reports?.open,
      icon: ShieldAlert,
      to: '/moderator/reports',
      attention: true,
    },
    {
      key: 'hidden',
      label: dt('hiddenContent'),
      value: data?.reports?.hiddenPosts,
      icon: EyeOff,
      to: '/moderator/reports?tab=hidden',
    },
  ]

  const visibleTiles = showPlaceholder ? tiles : tiles.filter(item => typeof item.value === 'number')
  const pendingArticles = typeof data?.pending?.articles === 'number' ? data.pending.articles : null

  return (
    <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('dashboardTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('dashboardSubtitle')}</p>
        </div>
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
      </header>

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

      {visibleTiles.length > 0 && (
        <section aria-label={dt('overview')} className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {visibleTiles.map(tile => (
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
        </section>
      )}

      <Card className="flex-row flex-wrap items-center gap-4 rounded-xl p-5">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/60 text-foreground">
          <ClipboardList className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-sm font-semibold">{t('queueTitle')}</h2>
          <p className="text-xs text-muted-foreground">
            {pendingArticles === null ? t('queueFallback') : t('queueText', { n: pendingArticles })}
          </p>
        </div>
        <Button asChild size="sm" className={touch}>
          <Link to="/moderator/articles">{t('openQueue')}</Link>
        </Button>
      </Card>
    </main>
  )
}
