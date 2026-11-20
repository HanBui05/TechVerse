import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Languages, Palette, Tag, UserCheck, Users } from 'lucide-react'
import { managementText } from '../../data/managementI18n'
import type { Language } from '../../types/preferences'
import { Button } from '@/components/ui/button'

// Tile colours follow the matching sidebar icon so each admin area keeps one colour across the shell.
const shortcuts = [
  { path: '/admin/author-applications', icon: UserCheck, tile: 'border-tone-purple-border bg-tone-purple-bg text-tone-purple-fg', title: { vi: 'Hồ sơ tác giả', en: 'Author applications' }, text: { vi: 'Duyệt, từ chối, đình chỉ hoặc khôi phục quyền tác giả.', en: 'Approve, reject, suspend or restore author access.' } },
  { path: '/admin/users', icon: Users, tile: 'border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg', title: { vi: 'Quản lý người dùng', en: 'Manage users' }, text: { vi: 'Tìm kiếm, xem chi tiết và khóa hoặc mở khóa tài khoản.', en: 'Search, view details and lock or unlock accounts.' } },
  { path: '/admin/topics', icon: BookOpen, tile: 'border-tone-amber-border bg-tone-amber-bg text-tone-amber-fg', title: { vi: 'Chủ đề', en: 'Topics' }, text: { vi: 'Tạo, sửa và bật tắt chủ đề cho bài viết.', en: 'Create, edit and toggle article topics.' } },
  { path: '/admin/tags', icon: Tag, tile: 'border-tone-green-border bg-tone-green-bg text-tone-green-fg', title: { vi: 'Thẻ', en: 'Tags' }, text: { vi: 'Tạo, sửa và bật tắt thẻ gắn cho bài viết.', en: 'Create, edit and toggle article tags.' } },
]

export function AdminDashboardPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = (message: string) => managementText(message, language)
  const vi = language === 'vi'
  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">{t('TechVerse administration')}</span>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Chào mừng trở lại!')}</h1>
        <p className="text-sm text-muted-foreground">{vi ? 'Chọn một khu vực để bắt đầu quản trị TechVerse.' : 'Pick an area to start managing TechVerse.'}</p>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm"><Link to="/settings/language"><Languages />{vi ? 'Tiếng Việt' : 'English'}</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/settings/theme"><Palette />{vi ? 'Giao diện' : 'Appearance'}</Link></Button>
      </div>
    </header>
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
}
