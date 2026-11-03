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
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[.05em] text-accent-text">{t('TechVerse administration')}</span>
        <h1 className="text-2xl font-bold">{t('Chào mừng trở lại!')}</h1>
        <p className="text-sm text-muted-foreground">{vi ? 'Chọn một khu vực để bắt đầu quản trị TechVerse.' : 'Pick an area to start managing TechVerse.'}</p>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm"><Link to="/settings/language"><Languages />{vi ? 'Tiếng Việt' : 'English'}</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/settings/theme"><Palette />{vi ? 'Giao diện' : 'Appearance'}</Link></Button>
      </div>
    </header>
    <section aria-labelledby="admin-shortcuts" className="flex flex-col gap-4">
      <h2 id="admin-shortcuts" className="text-xl font-bold">{vi ? 'Khu vực quản trị' : 'Admin areas'}</h2>
      <ul data-slot="admin-shortcuts" className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map(({ path, icon: Icon, tile, title, text }) => <li key={path} className="flex">
          <Link to={path} className="group flex w-full flex-col gap-4 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-ring hover:shadow-lg focus-visible:ring-[3px] focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0">
            <span className={`flex size-12 items-center justify-center rounded-xl border ${tile}`}><Icon aria-hidden className="size-6" /></span>
            <span className="flex flex-col gap-1">
              <span className="text-base font-bold">{title[language]}</span>
              <span className="text-sm text-muted-foreground">{text[language]}</span>
            </span>
            <span aria-hidden className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-accent-text">{vi ? 'Mở' : 'Open'}<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
          </Link>
        </li>)}
      </ul>
    </section>
  </main>
}
