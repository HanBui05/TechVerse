import { managementText } from '../../data/managementI18n'
import type { Language } from '../../types/preferences'
import { EmptyState } from '../../components/EmptyState'
import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { request } from '../../services/api/client'
import { adminErrorText } from './adminErrors'
import { AdminPagination } from './AdminPagination'
import { BookOpen, CheckCircle2, ChevronRight, EyeOff, Hash, Layers, Plus, Power, Search, SlidersHorizontal, Tag, X } from 'lucide-react'
import { suggestIcons, TopicIcon, useBrandIcons } from './topicIcons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { statusTone, toneFor } from '@/lib/utils'
import type { BadgeTone } from '@/components/ui/badge'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

type Item = { id: string; name: string; description: string | null; icon?: string | null; active: boolean }
type Page = { content: Item[]; hasNext: boolean; totalElements?: number }
type Stats = { total: number; active: number; hidden: number }
const SIZE = 12
const fieldLabel = 'text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground'
// Card accent follows toneFor(name), so a topic/tag has the same colour here as its Badge on article pages.
const toneTile: Record<BadgeTone, string> = {
  blue: 'border-tone-blue-border bg-tone-blue-bg text-tone-blue-fg', green: 'border-tone-green-border bg-tone-green-bg text-tone-green-fg', purple: 'border-tone-purple-border bg-tone-purple-bg text-tone-purple-fg', amber: 'border-tone-amber-border bg-tone-amber-bg text-tone-amber-fg',
  rose: 'border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg', sky: 'border-tone-sky-border bg-tone-sky-bg text-tone-sky-fg', cyan: 'border-tone-cyan-border bg-tone-cyan-bg text-tone-cyan-fg', slate: 'border-tone-slate-border bg-tone-slate-bg text-tone-slate-fg',
}
// Count-only queries (size=1, read totalElements) for the statistic cards.
const STAT_QUERIES: [keyof Stats, Record<string, string>][] = [['total', {}], ['active', { active: 'true' }], ['hidden', { active: 'false' }]]

export function TaxonomyPage({ kind, language = 'vi' }: { kind: 'topics' | 'tags'; language?: Language }) {
  const t = (message: string) => managementText(message, language)
  const vi = language === 'vi'
  const [items, setItems] = useState<Item[]>([]); const [selected, setSelected] = useState<Item | null>(null); const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [keyword, setKeyword] = useState(''); const [query, setQuery] = useState(''); const [active, setActive] = useState(''); const [sortBy, setSortBy] = useState('CREATED_AT'); const [direction, setDirection] = useState('DESC'); const [page, setPage] = useState(0); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(false)
  const [icon, setIcon] = useState(''); const [iconQuery, setIconQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false); const [confirming, setConfirming] = useState(false); const [total, setTotal] = useState<number | null>(null); const [stats, setStats] = useState<Stats | null>(null)
  const base = `/api/v1/admin/${kind}`
  const one = vi ? (kind === 'topics' ? 'chủ đề' : 'thẻ') : (kind === 'topics' ? 'topic' : 'tag')
  const title = vi ? `Quản lý ${one}` : (kind === 'topics' ? 'Manage topics' : 'Manage tags')
  const Icon = kind === 'topics' ? BookOpen : Tag
  const topics = kind === 'topics'
  const icons = useBrandIcons(topics)
  // Only the newest list request may update the page; an older search answering late must not overwrite it.
  const latest = useRef(0)
  const load = async () => { const id = ++latest.current; setLoading(true); setError(''); try { const params = new URLSearchParams({ page: String(page), size: String(SIZE), keyword: query, sortBy, direction }); if (active) params.set('active', active); const result = await request<Page>(`${base}?${params}`); if (id !== latest.current) return; const last = Math.max(0, Math.ceil((result.totalElements ?? 0) / SIZE) - 1); if (page > last) { setPage(last); return } setItems(result.content); setTotal(result.totalElements ?? null) } catch (e) { if (id === latest.current) setError(adminErrorText(e, language, t("Không tải được dữ liệu"))) } finally { if (id === latest.current) setLoading(false) } }
  // Statistics are decoration: a failed count leaves the card at "—" instead of blocking the list.
  // Like `load`, only the newest count may land: switching topics ↔ tags must not show the other kind's numbers.
  const latestStats = useRef(0)
  const loadStats = async () => { const id = ++latestStats.current; try { const counts = await Promise.all(STAT_QUERIES.map(([, filter]) => request<Page>(`${base}?${new URLSearchParams({ page: '0', size: '1', ...filter })}`))); if (id !== latestStats.current) return; setStats(Object.fromEntries(STAT_QUERIES.map(([key], i) => [key, counts[i].totalElements ?? 0])) as Stats) } catch { if (id === latestStats.current) setStats(null) } }
  useEffect(() => { setSelected(null); setName(''); setDescription(''); setPage(0); setQuery(''); setKeyword(''); setActive(''); setFormOpen(false); setMessage(''); setStats(null); void loadStats() }, [kind])
  useEffect(() => { void load() }, [kind, page, query, active, sortBy, direction])
  // Live search: typing updates the query after a short pause; Enter applies it at once.
  const typed = useDebouncedValue(keyword.trim())
  useEffect(() => { setPage(0); setQuery(typed) }, [typed])
  const open = async (id: string) => { setMessage(''); try { const item = await request<Item>(`${base}/${id}`); setSelected(item); setName(item.name); setDescription(item.description || ''); setIcon(item.icon || ''); setIconQuery(''); setError(''); setFormOpen(true) } catch (e) { setError(adminErrorText(e, language, t("Không tải được chi tiết"))) } }
  const create = () => { setSelected(null); setName(''); setDescription(''); setIcon(''); setIconQuery(''); setError(''); setMessage(''); setFormOpen(true) }
  const save = async () => { setLoading(true); setError(''); setMessage(''); const editing = selected !== null; try { const item = await request<Item>(selected ? `${base}/${selected.id}` : base, { method: selected ? 'PATCH' : 'POST', body: JSON.stringify(topics ? { name, description, icon: icon || null } : { name, description }) }); if (editing) setSelected(item); else { setSelected(null); setName(''); setDescription('') } setFormOpen(false); await load(); void loadStats(); setMessage(vi ? `${editing ? 'Đã cập nhật' : 'Đã tạo'} ${one}: ${item.name}` : `${editing ? 'Updated' : 'Created'} ${one}: ${item.name}`) } catch (e) { setError(adminErrorText(e, language, t("Không thể lưu"))) } finally { setLoading(false) } }
  // Runs only after the AlertDialog is confirmed; same endpoint and payload as the old window.confirm flow.
  const toggle = async () => { if (!selected) return; setLoading(true); setError(''); setMessage(''); try { const item = await request<Item>(`${base}/${selected.id}/status`, { method: 'PATCH', body: JSON.stringify({ active: !selected.active }) }); setSelected(item); await load(); void loadStats(); setMessage(vi ? `${item.active ? 'Đã kích hoạt' : 'Đã ẩn'} ${one}: ${item.name}` : `${item.active ? 'Activated' : 'Hid'} ${one}: ${item.name}`) } catch (e) { setError(adminErrorText(e, language, t("Không thể cập nhật"))) } finally { setLoading(false) } }
  const toggleWord = (item: Item | null) => item?.active ? (vi ? 'Ngừng hoạt động' : 'Deactivate') : (vi ? 'Kích hoạt' : 'Activate')
  const filter = (id: string, text: string, value: string, onChange: (value: string) => void, options: [string, string][]) => <div className="flex flex-col gap-2">
    <Label htmlFor={id} className={fieldLabel}>{text}</Label>
    <NativeSelect id={id} className="pointer-coarse:min-h-11" value={value} onChange={e => { onChange(e.target.value); setPage(0) }}>{options.map(([v, option]) => <NativeSelectOption key={v} value={v}>{option}</NativeSelectOption>)}</NativeSelect>
  </div>
  const errorText = error && <p role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">{error}</p>
  const createButton = <Button onClick={create}><Plus />{t("Tạo mới")}</Button>
  const statCards: [keyof Stats, string, ComponentType<{ className?: string }>, string, string][] = [
    ['total', vi ? `Tổng ${one}` : (kind === 'topics' ? 'Total topics' : 'Total tags'), Layers, 'text-foreground', 'border-tone-blue-border bg-tone-blue-bg text-tone-blue-fg'],
    ['active', vi ? 'Đang hoạt động' : 'Active', CheckCircle2, 'text-tone-green-fg', 'border-tone-green-border bg-tone-green-bg text-tone-green-fg'],
    ['hidden', vi ? 'Đang ẩn' : 'Hidden', EyeOff, 'text-tone-amber-fg', 'border-tone-amber-border bg-tone-amber-bg text-tone-amber-fg'],
  ]
  const statusChips: [string, string][] = [['', t("Tất cả")], ['true', t("Hoạt động")], ['false', t("Ẩn")]]

  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:px-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground">{vi ? `Tạo, chỉnh sửa và bật tắt ${one} dùng để phân loại bài viết.` : `Create, edit and switch on or off the ${one}s used to organise articles.`}</p>
      </div>
      {createButton}
    </header>

    <dl className="m-0 grid grid-cols-3 gap-3 sm:gap-4">
      {statCards.map(([key, label, StatIcon, number, tile]) => <div key={key} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
        <div className="flex min-w-0 flex-col gap-2">
          <dt className={fieldLabel}>{label}</dt>
          <dd className={`m-0 text-2xl font-bold tabular-nums sm:text-3xl ${number}`}>{stats ? stats[key].toLocaleString(vi ? 'vi-VN' : 'en-US') : '—'}</dd>
        </div>
        <span aria-hidden className={`hidden size-11 shrink-0 items-center justify-center rounded-xl border sm:flex ${tile}`}><StatIcon className="size-5" /></span>
      </div>)}
    </dl>

    <Card className="gap-0 rounded-2xl py-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
        <span className="inline-flex items-center gap-2 font-semibold"><span aria-hidden className="flex size-8 items-center justify-center rounded-lg border border-tone-sky-border bg-tone-sky-bg text-tone-sky-fg"><SlidersHorizontal className="size-4" /></span>{vi ? 'Bộ lọc' : 'Filters'}</span>
        <div role="group" aria-label={t("Trạng thái")} className="flex flex-wrap gap-2">
          {statusChips.map(([value, text]) => <Button key={value} size="sm" variant={active === value ? 'default' : 'outline'} className="rounded-full" aria-pressed={active === value} onClick={() => { setActive(value); setPage(0) }}>{text}</Button>)}
        </div>
      </div>
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4 [&_[data-slot=native-select-wrapper]]:w-full">
        <form className="flex flex-col gap-2 sm:col-span-2" onSubmit={e => { e.preventDefault(); setPage(0); setQuery(keyword.trim()) }}>
          <Label htmlFor={`${kind}-search`} className={fieldLabel}>{t("Tìm kiếm")}</Label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id={`${kind}-search`} type="search" className="pl-9 pointer-coarse:min-h-11" maxLength={100} placeholder={vi ? `Nhập tên ${one}…` : `Search ${one}s…`} value={keyword} onChange={e => setKeyword(e.target.value)} />
          </div>
        </form>
        {filter(`${kind}-sort`, t("Sắp xếp"), sortBy, setSortBy, [['CREATED_AT', t("Ngày tạo")], ['UPDATED_AT', t("Ngày cập nhật")], ['NAME', t("Tên")]])}
        {filter(`${kind}-direction`, t("Thứ tự"), direction, setDirection, [['DESC', t("Giảm dần")], ['ASC', t("Tăng dần")]])}
      </div>
    </Card>

    {!formOpen && errorText}
    {message && <p role="status" className="inline-flex items-center gap-2 self-start rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm font-semibold text-tone-green-fg animate-in fade-in"><CheckCircle2 aria-hidden className="size-4" />{message}</p>}

    <section aria-labelledby={`${kind}-list`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${kind}-list`} className="text-xl font-bold">{vi ? `Danh sách ${one}` : (kind === 'topics' ? 'Topic list' : 'Tag list')}</h2>
        {total !== null && <Badge tone="blue" aria-live="polite">{vi ? `${total} kết quả` : `${total} ${total === 1 ? 'result' : 'results'}`}</Badge>}
      </div>
      {loading && !items.length
        ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label={t("Đang tải...")}>{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border p-5"><div className="flex items-center gap-3"><Skeleton className="size-11 rounded-xl" /><Skeleton className="h-4 w-28" /></div><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></div>)}</div>
        : !items.length
          ? <EmptyState icon={Icon} title={t("Chưa có dữ liệu.")} description={vi ? `Tạo ${one} đầu tiên để tác giả gắn vào bài viết.` : 'Create the first one for authors to use.'} action={createButton} />
          : <ul data-slot="taxonomy-grid" className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {items.map(item => <li key={item.id} className="flex">
              <button type="button" data-slot="taxonomy-card" onClick={() => void open(item.id)}
                className={`group flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left text-card-foreground shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-ring hover:shadow-lg focus-visible:ring-[3px] focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${item.active ? '' : 'opacity-70'}`}>
                <span className="flex w-full items-start gap-3">
                  {topics ? <TopicIcon icon={item.icon} name={item.name} icons={icons} /> : <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${toneTile[toneFor(item.name)]}`}><Hash className="size-5" /></span>}
                  <span className="min-w-0 flex-1 self-center text-base font-bold [overflow-wrap:anywhere]">{item.name}</span>
                  <Badge tone={statusTone(item.active ? 'ACTIVE' : 'HIDDEN')}>{item.active ? t("Hoạt động") : t("Ẩn")}</Badge>
                </span>
                <span className="line-clamp-2 text-sm text-muted-foreground">{item.description || (vi ? 'Chưa có mô tả.' : 'No description yet.')}</span>
                <span aria-hidden className="mt-auto inline-flex items-center gap-1 self-end text-xs font-semibold text-accent-text opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{vi ? 'Chỉnh sửa' : 'Edit'}<ChevronRight className="size-3.5" /></span>
              </button>
            </li>)}
          </ul>}
      <AdminPagination language={language} page={page} size={SIZE} total={total ?? 0} loading={loading} onPageChange={setPage} />
    </section>

    <Dialog open={formOpen} onOpenChange={setFormOpen}>
      <DialogContent closeLabel={vi ? 'Đóng' : 'Close'} className="sm:max-w-lg">
        <form className="flex flex-col gap-5" onSubmit={e => { e.preventDefault(); void save() }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{selected ? <><span>{vi ? 'Chỉnh sửa' : 'Edit'}:</span><Badge tone={toneFor(selected.name)}>{selected.name}</Badge></> : vi ? `Tạo ${one} mới` : `Create ${one}`}</DialogTitle>
            <DialogDescription>{selected ? (selected.active ? t("Hoạt động") : t("Ẩn")) : (vi ? `Tên ${one} hiển thị cho tác giả và người đọc.` : `The name authors and readers will see.`)}</DialogDescription>
          </DialogHeader>
          {errorText}
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${kind}-name`} className={fieldLabel}>{t("Tên")}</Label>
            <Input id={`${kind}-name`} className="pointer-coarse:min-h-11" required maxLength={100} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${kind}-description`} className={fieldLabel}>{t("Mô tả")}</Label>
            <Textarea id={`${kind}-description`} rows={4} className="max-h-48 overflow-y-auto" maxLength={500} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          {topics && <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
            <legend className={`mb-2 ${fieldLabel}`}>Icon</legend>
            <div className="flex items-center gap-3">
              <TopicIcon icon={icon} name={name || '?'} icons={icons} />
              <span className="min-w-0 flex-1 truncate text-sm">{icon ? (icons?.get(icon)?.title ?? icon) : (vi ? 'Chưa chọn — hiện chữ cái đầu' : 'None — initials are shown')}</span>
              {icon && <Button type="button" size="sm" variant="ghost" onClick={() => setIcon('')}><X />{vi ? 'Bỏ icon' : 'Remove'}</Button>}
            </div>
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label={vi ? 'Tìm icon' : 'Search icons'} type="search" className="pl-9 pointer-coarse:min-h-11" placeholder={vi ? 'Tìm logo: docker, react, postgresql…' : 'Search logos: docker, react…'} value={iconQuery} onChange={e => setIconQuery(e.target.value)} />
            </div>
            {/* Without a query: logos matching the topic name, then popular tech logos. */}
            {!icons ? <p className="text-xs text-muted-foreground">{t("Đang tải...")}</p> : (() => {
              const found = suggestIcons(icons, iconQuery, name)
              return found.length
                ? <><p aria-live="polite" className="text-xs text-muted-foreground">{vi ? `${found.length} logo · gõ để tìm trong ${icons.size.toLocaleString('vi-VN')} logo` : `${found.length} logos · type to search ${icons.size.toLocaleString('en-US')} logos`}</p><div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto p-0.5 sm:grid-cols-6">{found.map(option => <Button key={option.slug} type="button" variant={icon === option.slug ? 'default' : 'outline'} title={option.title} aria-label={option.title} aria-pressed={icon === option.slug} className="h-12 pointer-coarse:min-h-12" onClick={() => setIcon(option.slug)}>
                    <TopicIcon icon={option.slug} name={option.title} icons={icons} className="size-8 border-0 bg-transparent" />
                  </Button>)}</div></>
                : <p className="text-xs text-muted-foreground">{vi ? 'Không có logo khớp. Thử từ khóa khác.' : 'No matching logo. Try another keyword.'}</p>
            })()}
          </fieldset>}
          <DialogFooter className="gap-2 sm:justify-between">
            {selected ? <Button type="button" variant={selected.active ? 'destructive' : 'outline'} disabled={loading} onClick={() => setConfirming(true)}>{selected.active ? <EyeOff /> : <Power />}{toggleWord(selected)}</Button> : <span />}
            <Button type="submit" disabled={loading}>{selected ? t("Lưu thay đổi") : t("Tạo mới")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      {selected && <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{toggleWord(selected)}</AlertDialogTitle>
          <AlertDialogDescription>{vi ? `Thay đổi trạng thái ${selected.name}?` : `Change the status of ${selected.name}?`}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{vi ? 'Hủy' : 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction variant={selected.active ? 'destructive' : 'default'} onClick={() => void toggle()}>{toggleWord(selected)}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
  </main>
}
