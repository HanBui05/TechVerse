import { ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { moderatorText } from '../../data/articleI18n'
import type { Language } from '../../types/preferences'
import { ArticleStats, useArticleStats } from './ArticleStats'

export function ModeratorDashboardPage({ language }: { language: Language }) {
  const t = moderatorText(language)
  const [stats] = useArticleStats()
  const pending = stats[0]
  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold sm:text-3xl">{t('dashboardTitle')}</h1>
      <p className="text-sm text-muted-foreground">{t('dashboardSubtitle')}</p>
    </header>
    <ArticleStats stats={stats} language={language} />
    <Card className="flex-row flex-wrap items-center gap-4 rounded-2xl p-6">
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-tone-amber-border bg-tone-amber-bg text-tone-amber-fg"><ClipboardList className="size-5" /></span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="text-base font-bold">{t('queueTitle')}</h2>
        <p className="text-sm text-muted-foreground">{pending === null ? t('queueFallback') : t('queueText', { n: pending })}</p>
      </div>
      <Button asChild className="pointer-coarse:min-h-11"><Link to="/moderator/articles">{t('openQueue')}</Link></Button>
    </Card>
  </main>
}
