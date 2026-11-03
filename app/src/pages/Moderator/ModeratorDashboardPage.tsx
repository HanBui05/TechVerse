import { ClipboardList } from 'lucide-react'
import type { Language } from '../../types/preferences'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArticleStats, useArticleStats } from './ArticleStats'

export function ModeratorDashboardPage({ language }: { language: Language }) {
  const vi = language === 'vi'
  const [stats] = useArticleStats()
  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:px-8">
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold sm:text-3xl">{vi ? 'Không gian kiểm duyệt' : 'Moderation workspace'}</h1>
      <p className="text-sm text-muted-foreground">{vi ? 'Theo dõi nội dung và hoạt động của cộng đồng.' : 'Follow community content and activity.'}</p>
    </header>
    <ArticleStats stats={stats} language={language} />
    <Card className="flex-row flex-wrap items-center gap-4 rounded-2xl p-6">
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-tone-amber-border bg-tone-amber-bg text-tone-amber-fg"><ClipboardList className="size-5" /></span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="text-base font-bold">{vi ? 'Hàng đợi kiểm duyệt' : 'Moderation queue'}</h2>
        <p className="text-sm text-muted-foreground">{stats
          ? (vi ? `${stats.PENDING} bài đang chờ duyệt.` : `${stats.PENDING} ${stats.PENDING === 1 ? 'article is' : 'articles are'} awaiting review.`)
          : (vi ? 'Xem và xử lý các bài viết được gửi từ tác giả.' : 'Review articles submitted by authors.')}</p>
      </div>
      <Button asChild className="pointer-coarse:min-h-11"><Link to="/moderator/articles">{vi ? 'Mở danh sách bài viết' : 'Open article queue'}</Link></Button>
    </Card>
  </main>
}
