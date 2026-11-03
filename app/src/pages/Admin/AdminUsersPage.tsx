import { managementText, statusLabel } from '../../data/managementI18n'
import type { Language } from '../../types/preferences'
import { EmptyState } from '../../components/EmptyState'
import { UserAvatar } from '../../components/UserAvatar'
import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { request } from '../../services/api/client'
import { adminErrorText } from './adminErrors'
import { AdminPagination } from './AdminPagination'
import { CalendarDays, CheckCircle2, Eye, Lock, LockOpen, PenLine, Phone, RefreshCw, Search, SlidersHorizontal, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { statusTone, toneFor } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

type User = { id: string; fullName: string; email: string; roles: string[]; active: boolean; createdAt?: string; authorProfileStatus?: string | null; avatarUrl?: string | null; phoneNumber?: string | null; dateOfBirth?: string | null; authorProfile?: { bio: string; status: string } | null }
type Page = { content: User[]; hasNext: boolean; totalElements?: number }
type Pending = { userIds: string[]; nextActive: boolean; title: string }
type Stats = { total: number; active: number; locked: number; authors: number }
const SIZE = 12
const fieldLabel = 'text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground'
// One template for the header row and every user row (xl and up, where the sidebar still leaves room for 7 columns); below xl each row stacks as a card.
const columns = 'xl:grid xl:grid-cols-[2.5rem_minmax(0,1.7fr)_minmax(0,1.6fr)_7rem_minmax(0,1.3fr)_6.5rem_7.5rem] xl:items-center xl:gap-4'
// Count-only queries (size=1, read totalElements) for the statistic cards; filters match the list API.
const STAT_QUERIES: [keyof Stats, Record<string, string>][] = [['total', {}], ['active', { active: 'true' }], ['locked', { active: 'false' }], ['authors', { role: 'AUTHOR' }]]

export function AdminUsersPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = (message: string) => managementText(message, language)
  const vi = language === 'vi'
  const [users, setUsers] = useState<User[]>([]); const [selected, setSelected] = useState<User | null>(null); const [ids, setIds] = useState<string[]>([]); const [keyword, setKeyword] = useState(''); const [query, setQuery] = useState(''); const [active, setActive] = useState(''); const [role, setRole] = useState(''); const [authorStatus, setAuthorStatus] = useState(''); const [sortBy, setSortBy] = useState('CREATED_AT'); const [direction, setDirection] = useState('DESC'); const [page, setPage] = useState(0); const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  const [pending, setPending] = useState<Pending | null>(null); const [total, setTotal] = useState<number | null>(null); const [stats, setStats] = useState<Stats | null>(null)
  // Only the newest list request may update the page; an older search answering late must not overwrite it.
  const latest = useRef(0)
  const load = async () => { const id = ++latest.current; setLoading(true); setError(''); try { const params = new URLSearchParams({ page: String(page), size: String(SIZE), keyword: query, sortBy, direction }); if (active) params.set('active', active); if (role) params.set('role', role); if (authorStatus) params.set('authorStatus', authorStatus); const result = await request<Page>(`/api/v1/admin/users?${params}`); if (id !== latest.current) return; const last = Math.max(0, Math.ceil((result.totalElements ?? 0) / SIZE) - 1); if (page > last) { setPage(last); return } setUsers(result.content); setTotal(result.totalElements ?? null) } catch (e) { if (id === latest.current) setError(adminErrorText(e, language, t("Không tải được người dùng"))) } finally { if (id === latest.current) setLoading(false) } }
  // Statistics are decoration: a failed count leaves the card at "—" instead of blocking the list.
  // Only the newest stats request may write: an older one answering late would show counts from before an action.
  const latestStats = useRef(0)
  const loadStats = async () => { const id = ++latestStats.current; try { const counts = await Promise.all(STAT_QUERIES.map(([, filter]) => request<Page>(`/api/v1/admin/users?${new URLSearchParams({ page: '0', size: '1', ...filter })}`))); if (id !== latestStats.current) return; setStats(Object.fromEntries(STAT_QUERIES.map(([key], i) => [key, counts[i].totalElements ?? 0])) as Stats) } catch { if (id === latestStats.current) setStats(null) } }
  useEffect(() => { setIds([]); void load() }, [page, query, active, role, authorStatus, sortBy, direction])
  useEffect(() => { void loadStats() }, [])
  // Live search: typing updates the query after a short pause; Enter applies it at once.
  const typed = useDebouncedValue(keyword.trim())
  useEffect(() => { setPage(0); setQuery(typed) }, [typed])
  const open = async (id: string) => { try { setSelected(await request<User>(`/api/v1/admin/users/${id}`)); setError('') } catch (e) { setError(adminErrorText(e, language, t("Không tải được chi tiết"))) } }
  // Runs only after the AlertDialog is confirmed; payload and reload order are unchanged from the old window.confirm flow.
  const update = async (userIds: string[], nextActive: boolean) => { if (!userIds.length) return; setLoading(true); setError(''); try { await request('/api/v1/admin/users/bulk-status', { method: 'PATCH', body: JSON.stringify({ userIds, active: nextActive }) }); setIds([]); if (selected && userIds.includes(selected.id)) await open(selected.id); await load(); void loadStats() } catch (e) { setError(adminErrorText(e, language, t("Không thể cập nhật"))) } finally { setLoading(false) } }
  const refresh = () => { void load(); void loadStats() }
  const question = (count: number, nextActive: boolean) => vi ? `${nextActive ? 'Mở khóa' : 'Khóa'} ${count} tài khoản đã chọn?` : `${nextActive ? 'Unlock' : 'Lock'} ${count} selected accounts?`
  const date = (value?: string | null) => value ? new Date(value).toLocaleDateString(vi ? 'vi-VN' : 'en-US') : '—'
  const statusBadge = (user: User) => <Badge tone={statusTone(user.active ? 'ACTIVE' : 'LOCKED')}>{user.active ? t("Hoạt động") : t("Đã khóa")}</Badge>
  const roleBadges = (roles: string[]) => roles.map(value => <Badge key={value} tone={toneFor(value)}>{statusLabel(value, 'role', language)}</Badge>)
  const lockOne = (user: User) => setPending({ userIds: [user.id], nextActive: !user.active, title: user.active ? t("Khóa tài khoản") : t("Mở khóa tài khoản") })
  const filter = (id: string, label: string, value: string, onChange: (value: string) => void, options: [string, string][]) => <div className="flex flex-col gap-2">
    <Label htmlFor={id} className={fieldLabel}>{label}</Label>
    <NativeSelect id={id} className="pointer-coarse:min-h-11" value={value} onChange={e => { onChange(e.target.value); setPage(0) }}>{options.map(([v, text]) => <NativeSelectOption key={v} value={v}>{text}</NativeSelectOption>)}</NativeSelect>
  </div>
  const all: [string, string] = ['', t("Tất cả")]
  const errorText = error && <p role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">{error}</p>
  const statCards: [keyof Stats, string, ComponentType<{ className?: string }>, string, string][] = [
    ['total', t("Tổng người dùng"), Users, 'text-foreground', 'border-tone-blue-border bg-tone-blue-bg text-tone-blue-fg'],
    ['active', vi ? 'Đang hoạt động' : 'Active', CheckCircle2, 'text-tone-green-fg', 'border-tone-green-border bg-tone-green-bg text-tone-green-fg'],
    ['locked', t("Đã khóa"), Lock, 'text-tone-rose-fg', 'border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg'],
    ['authors', vi ? 'Tác giả' : 'Authors', PenLine, 'text-tone-amber-fg', 'border-tone-amber-border bg-tone-amber-bg text-tone-amber-fg'],
  ]
  const statusChips: [string, string][] = [['', t("Tất cả")], ['true', t("Hoạt động")], ['false', t("Đã khóa")]]

  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 pb-28 lg:px-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("Quản lý người dùng")}</h1>
        <p className="text-sm text-muted-foreground">{vi ? 'Tìm kiếm, lọc và khóa hoặc mở khóa tài khoản trong hệ thống.' : 'Search, filter and lock or unlock accounts across the platform.'}</p>
      </div>
      <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={loading ? 'animate-spin motion-reduce:animate-none' : ''} />{vi ? 'Làm mới' : 'Refresh'}</Button>
    </header>

    <dl className="m-0 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {statCards.map(([key, label, Icon, number, tile]) => <div key={key} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
        <div className="flex min-w-0 flex-col gap-2">
          <dt className={fieldLabel}>{label}</dt>
          <dd className={`m-0 text-2xl font-bold tabular-nums sm:text-3xl ${number}`}>{stats ? stats[key].toLocaleString(vi ? 'vi-VN' : 'en-US') : '—'}</dd>
        </div>
        <span aria-hidden className={`hidden size-11 shrink-0 items-center justify-center rounded-xl border sm:flex ${tile}`}><Icon className="size-5" /></span>
      </div>)}
    </dl>

    <Card className="gap-0 rounded-2xl py-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
        <span className="inline-flex items-center gap-2 font-semibold"><span aria-hidden className="flex size-8 items-center justify-center rounded-lg border border-tone-sky-border bg-tone-sky-bg text-tone-sky-fg"><SlidersHorizontal className="size-4" /></span>{vi ? 'Bộ lọc' : 'Filters'}</span>
        <div role="group" aria-label={t("Tài khoản")} className="flex flex-wrap gap-2">
          {statusChips.map(([value, text]) => <Button key={value} size="sm" variant={active === value ? 'default' : 'outline'} className="rounded-full" aria-pressed={active === value} onClick={() => { setActive(value); setPage(0) }}>{text}</Button>)}
        </div>
      </div>
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-6 [&_[data-slot=native-select-wrapper]]:w-full">
        <form className="flex flex-col gap-2 sm:col-span-2" onSubmit={e => { e.preventDefault(); setPage(0); setQuery(keyword.trim()) }}>
          <Label htmlFor="admin-user-search" className={fieldLabel}>{t("Tìm theo tên hoặc email")}</Label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="admin-user-search" type="search" className="pl-9 pointer-coarse:min-h-11" maxLength={100} placeholder={vi ? 'Nhập tên hoặc email…' : 'Name or email…'} value={keyword} onChange={e => setKeyword(e.target.value)} />
          </div>
        </form>
        {filter('admin-user-role', t("Role"), role, setRole, [all, ...['LEARNER', 'AUTHOR', 'MODERATOR', 'ADMIN'].map(v => [v, statusLabel(v, 'role', language)] as [string, string])])}
        {filter('admin-user-author', t("Hồ sơ Author"), authorStatus, setAuthorStatus, [all, ...['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].map(v => [v, statusLabel(v, 'author', language)] as [string, string])])}
        {filter('admin-user-sort', t("Sắp xếp"), sortBy, setSortBy, [['CREATED_AT', t("Ngày tạo")], ['FULL_NAME', t("Họ tên")], ['EMAIL', t("Email")]])}
        {filter('admin-user-direction', t("Thứ tự"), direction, setDirection, [['DESC', t("Giảm dần")], ['ASC', t("Tăng dần")]])}
      </div>
    </Card>

    {!selected && errorText}

    <Card className="gap-0 overflow-hidden rounded-2xl py-0">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-bold">{t("Danh sách người dùng")}</h2>
          <p className="text-xs text-muted-foreground">{vi ? 'Chọn một người dùng để xem chi tiết, hoặc chọn nhiều để khóa hàng loạt.' : 'Open a user for details, or select several to lock them at once.'}</p>
        </div>
        <div className="flex items-center gap-3">
          {total !== null && <Badge tone="blue" aria-live="polite">{vi ? `${total} kết quả` : `${total} ${total === 1 ? 'result' : 'results'}`}</Badge>}
          <label className="flex items-center gap-2 text-sm text-muted-foreground pointer-coarse:min-h-11">
            <Checkbox checked={users.length > 0 && ids.length === users.length} disabled={!users.length} onCheckedChange={checked => setIds(checked === true ? users.map(u => u.id) : [])} />
            {t("Chọn trang này")}
          </label>
        </div>
      </div>
      <div aria-hidden className={`hidden border-b border-border bg-muted/40 px-6 py-3 ${columns} ${fieldLabel}`}>
        <span /><span>{vi ? 'Người dùng' : 'User'}</span><span>Email</span><span>{t("Trạng thái")}</span><span>{t("Role")}</span><span>{t("Ngày tạo")}</span><span className="text-right">{vi ? 'Thao tác' : 'Actions'}</span>
      </div>
      {loading && !users.length
        ? <div className="flex flex-col divide-y divide-border" aria-busy="true" aria-label={t("Đang tải...")}>{[0, 1, 2, 3, 4].map(i => <div key={i} className="flex items-center gap-4 px-6 py-4"><Skeleton className="size-5 rounded" /><Skeleton className="size-10 rounded-full" /><div className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-64 max-w-full" /></div><Skeleton className="h-5 w-20 rounded-full" /></div>)}</div>
        : !users.length
          ? <EmptyState className="m-6" icon={Users} title={t("Không tìm thấy người dùng.")} description={vi ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Try another keyword or filter.'} />
          : <ul data-slot="admin-user-list" className={`flex flex-col divide-y divide-border transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {users.map(user => <li key={user.id} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-6 py-3 transition-colors hover:bg-muted/50 ${columns} ${ids.includes(user.id) ? 'bg-accent/40' : ''}`}>
              <label className="-m-3.5 flex p-3.5"><Checkbox aria-label={`${vi ? 'Chọn' : 'Select'} ${user.fullName}`} checked={ids.includes(user.id)} onCheckedChange={checked => setIds(checked === true ? [...ids, user.id] : ids.filter(id => id !== user.id))} /></label>
              <span className="flex min-w-0 items-center gap-3"><UserAvatar name={user.fullName} url={user.avatarUrl} /><span className="truncate font-semibold">{user.fullName}</span></span>
              <span className="justify-self-end xl:hidden">{statusBadge(user)}</span>
              <span className="col-span-3 col-start-1 truncate text-sm text-muted-foreground xl:col-span-1 xl:col-start-auto">{user.email}</span>
              <span className="hidden xl:block">{statusBadge(user)}</span>
              <span className="col-span-3 flex flex-wrap gap-1 xl:col-span-1">{roleBadges(user.roles)}{user.authorProfileStatus && <Badge tone={statusTone(user.authorProfileStatus)}>{statusLabel(user.authorProfileStatus, 'author', language)}</Badge>}</span>
              <span className="col-span-2 inline-flex items-center gap-1 text-sm text-muted-foreground xl:col-span-1"><CalendarDays aria-hidden className="size-3.5 xl:hidden" />{date(user.createdAt)}</span>
              <span className="flex justify-end gap-1">
                <Button size="sm" variant="outline" aria-label={`${vi ? 'Xem chi tiết' : 'View details of'} ${user.fullName}`} onClick={() => void open(user.id)}><Eye />{vi ? 'Xem' : 'View'}</Button>
                <Button size="icon" variant="ghost" className={user.active ? 'text-danger hover:text-danger' : 'text-tone-green-fg'} aria-label={`${user.active ? (vi ? 'Khóa' : 'Lock') : (vi ? 'Mở khóa' : 'Unlock')} ${user.fullName}`} disabled={loading} onClick={() => lockOne(user)}>{user.active ? <Lock /> : <LockOpen />}</Button>
              </span>
            </li>)}
          </ul>}
      {!!total && <div className="border-t border-border px-6 py-4"><AdminPagination language={language} page={page} size={SIZE} total={total ?? 0} loading={loading} onPageChange={setPage} /></div>}
    </Card>

    {ids.length > 0 && <div role="region" aria-label={vi ? 'Thao tác hàng loạt' : 'Bulk actions'} className="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-fit max-w-[calc(100%-2rem)] animate-in items-center gap-3 rounded-full border border-border bg-popover py-2 pr-2 pl-5 text-popover-foreground shadow-xl fade-in slide-in-from-bottom-4">
      <span className="text-sm font-semibold whitespace-nowrap">{vi ? `Đã chọn ${ids.length}` : `${ids.length} selected`}</span>
      <Button size="sm" variant="destructive" className="rounded-full" disabled={loading} onClick={() => setPending({ userIds: ids, nextActive: false, title: vi ? 'Khóa' : 'Lock' })}><Lock />{vi ? 'Khóa' : 'Lock'}</Button>
      <Button size="sm" variant="outline" className="rounded-full" disabled={loading} onClick={() => setPending({ userIds: ids, nextActive: true, title: vi ? 'Mở khóa' : 'Unlock' })}><LockOpen />{vi ? 'Mở khóa' : 'Unlock'}</Button>
    </div>}

    <Sheet open={selected !== null} onOpenChange={next => { if (!next) setSelected(null) }}>
      <SheetContent closeLabel={vi ? 'Đóng' : 'Close'} className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {selected && <>
          <SheetHeader className="items-center gap-3 border-b border-border p-6 text-center">
            <span className="sr-only">{t("Thông tin tài khoản")}</span>
            <UserAvatar className="size-17 text-xl" name={selected.fullName} url={selected.avatarUrl} />
            <SheetTitle className="text-xl font-bold">{selected.fullName}</SheetTitle>
            <SheetDescription>{selected.email}</SheetDescription>
            <div className="flex flex-wrap justify-center gap-1">{roleBadges(selected.roles)}{statusBadge(selected)}</div>
          </SheetHeader>
          <div className="flex flex-col gap-6 p-6">
            {errorText}
            <dl className="m-0 grid gap-4 text-sm">
              <div className="flex items-center gap-3"><Phone aria-hidden className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">{t("Điện thoại:")}</dt><dd className="m-0">{selected.phoneNumber || '—'}</dd></div>
              <div className="flex items-center gap-3"><CalendarDays aria-hidden className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">{t("Ngày sinh:")}</dt><dd className="m-0">{selected.dateOfBirth || '—'}</dd></div>
            </dl>
            {selected.authorProfile && <section className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between gap-2"><h3 className={fieldLabel}>{t("Hồ sơ Author:")}</h3><Badge tone={statusTone(selected.authorProfile.status)}>{statusLabel(selected.authorProfile.status, 'author', language)}</Badge></div>
              <p className="max-h-48 overflow-y-auto text-sm whitespace-pre-line">{selected.authorProfile.bio}</p>
            </section>}
            <Button variant={selected.active ? 'destructive' : 'default'} disabled={loading} onClick={() => lockOne(selected)}>
              {selected.active ? <Lock /> : <LockOpen />}{selected.active ? t("Khóa tài khoản") : t("Mở khóa tài khoản")}
            </Button>
          </div>
        </>}
      </SheetContent>
    </Sheet>

    <AlertDialog open={pending !== null} onOpenChange={next => { if (!next) setPending(null) }}>
      {pending && <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending.title}</AlertDialogTitle>
          <AlertDialogDescription>{question(pending.userIds.length, pending.nextActive)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{vi ? 'Hủy' : 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction variant={pending.nextActive ? 'default' : 'destructive'} onClick={() => void update(pending.userIds, pending.nextActive)}>{pending.title}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
  </main>
}
