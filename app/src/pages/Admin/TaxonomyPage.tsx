import { managementText } from '../../data/managementI18n'
import type { Language } from '../../types/preferences'
import { Pagination } from '../../components/Pagination'
import { EmptyState } from '../../components/EmptyState'
import { useEffect, useRef, useState } from 'react'
import { request } from '../../services/api/client'
import { BookOpen, CheckCircle2, EyeOff, Hash, Plus, Power, Search, Tag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

type Item = { id: string; name: string; description: string | null; active: boolean }
type Page = { content: Item[]; hasNext: boolean; totalElements?: number }
const fieldLabel = 'text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground'
// Card accent follows toneFor(name), so a topic/tag has the same colour here as its Badge on article pages.
const toneTile: Record<BadgeTone, string> = {
  blue: 'border-tone-blue-border bg-tone-blue-bg text-tone-blue-fg', green: 'border-tone-green-border bg-tone-green-bg text-tone-green-fg', purple: 'border-tone-purple-border bg-tone-purple-bg text-tone-purple-fg', amber: 'border-tone-amber-border bg-tone-amber-bg text-tone-amber-fg',
  rose: 'border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg', sky: 'border-tone-sky-border bg-tone-sky-bg text-tone-sky-fg', cyan: 'border-tone-cyan-border bg-tone-cyan-bg text-tone-cyan-fg', slate: 'border-tone-slate-border bg-tone-slate-bg text-tone-slate-fg',
}

export function TaxonomyPage({ kind, language = 'vi' }: { kind: 'topics' | 'tags'; language?: Language }) {
  const t = (message: string) => managementText(message, language)
  const vi = language === 'vi'
  const [items, setItems] = useState<Item[]>([]); const [selected, setSelected] = useState<Item | null>(null); const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [keyword, setKeyword] = useState(''); const [query, setQuery] = useState(''); const [active, setActive] = useState(''); const [sortBy, setSortBy] = useState('CREATED_AT'); const [direction, setDirection] = useState('DESC'); const [page, setPage] = useState(0); const [hasNext, setHasNext] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false); const [confirming, setConfirming] = useState(false); const [total, setTotal] = useState<number | null>(null)
  const base = `/api/v1/admin/${kind}`; const label = vi ? (kind === 'topics' ? 'chủ đề' : 'thẻ') : (kind === 'topics' ? 'topics' : 'tags')
  const Icon = kind === 'topics' ? BookOpen : Tag
  // Only the newest list request may update the page; an older search answering late must not overwrite it.
  const latest = useRef(0)
  const load = async () => { const id = ++latest.current; setLoading(true); setError(''); try { const params = new URLSearchParams({ page: String(page), size: '20', keyword: query, sortBy, direction }); if (active) params.set('active', active); const result = await request<Page>(`${base}?${params}`); if (id !== latest.current) return; setItems(result.content); setHasNext(result.hasNext); setTotal(result.totalElements ?? null) } catch (e) { if (id === latest.current) setError(e instanceof Error ? e.message : t("Không tải được dữ liệu")) } finally { if (id === latest.current) setLoading(false) } }
  useEffect(() => { setSelected(null); setName(''); setDescription(''); setPage(0); setQuery(''); setKeyword(''); setFormOpen(false) }, [kind])
  useEffect(() => { void load() }, [kind, page, query, active, sortBy, direction])
  // Live search: typing updates the query after a short pause; Enter applies it at once.
  const typed = useDebouncedValue(keyword.trim())
  useEffect(() => { setPage(0); setQuery(typed) }, [typed])
  const open = async (id: string) => { try { const item = await request<Item>(`${base}/${id}`); setSelected(item); setName(item.name); setDescription(item.description || ''); setError(''); setMessage(''); setFormOpen(true) } catch (e) { setError(e instanceof Error ? e.message : t("Không tải được chi tiết")) } }
  const create = () => { setSelected(null); setName(''); setDescription(''); setError(''); setMessage(''); setFormOpen(true) }
  const save = async () => { setLoading(true); setError(''); setMessage(''); const editing = selected !== null; try { const item = await request<Item>(selected ? `${base}/${selected.id}` : base, { method: selected ? 'PATCH' : 'POST', body: JSON.stringify({ name, description }) }); if (editing) setSelected(item); else { setSelected(null); setName(''); setDescription('') } setFormOpen(false); await load(); setMessage(`${editing ? 'Đã cập nhật' : 'Đã tạo'} ${label}: ${item.name}`) } catch (e) { setError(e instanceof Error ? e.message : t("Không thể lưu")) } finally { setLoading(false) } }
  // Runs only after the AlertDialog is confirmed; same endpoint and payload as the old window.confirm flow.
  const toggle = async () => { if (!selected) return; setLoading(true); try { setSelected(await request<Item>(`${base}/${selected.id}/status`, { method: 'PATCH', body: JSON.stringify({ active: !selected.active }) })); await load() } catch (e) { setError(e instanceof Error ? e.message : t("Không thể cập nhật")) } finally { setLoading(false) } }
  const filter = (id: string, text: string, value: string, onChange: (value: string) => void, options: [string, string][]) => <div className="flex flex-col gap-2">
    <Label htmlFor={id} className={fieldLabel}>{text}</Label>
    <NativeSelect id={id} className="pointer-coarse:min-h-11" value={value} onChange={e => { onChange(e.target.value); setPage(0) }}>{options.map(([v, option]) => <NativeSelectOption key={v} value={v}>{option}</NativeSelectOption>)}</NativeSelect>
  </div>
  const errorText = error && <p role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">{error}</p>
  const toggleLabel = selected?.active ? t("Ngừng hoạt động") : t("Kích hoạt")
  const createButton = <Button onClick={create}><Plus />{t("Tạo mới")}</Button>
  const headerTile = kind === 'topics' ? toneTile.amber : toneTile.green

  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:px-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl border ${headerTile}`}><Icon aria-hidden className="size-6" /></span>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[.05em] text-accent-text">{t("TechVerse administration")}</span>
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">{t("Quản lý")} {label}</h1>{total !== null && <Badge tone="slate" aria-live="polite">{vi ? `${total} kết quả` : `${total} ${total === 1 ? 'result' : 'results'}`}</Badge>}</div>
          <p className="text-sm text-muted-foreground">{vi ? `Tạo, chỉnh sửa và bật tắt ${label} dùng để phân loại bài viết.` : `Create, edit and toggle the ${label} used to organise articles.`}</p>
        </div>
      </div>
      {createButton}
    </header>

    <Card className="rounded-2xl">
      <CardContent className="grid gap-4 md:grid-cols-12 [&_[data-slot=native-select-wrapper]]:w-full">
        <form className="flex flex-col gap-2 md:col-span-6" onSubmit={e => { e.preventDefault(); setPage(0); setQuery(keyword.trim()) }}>
          <Label htmlFor={`${kind}-search`} className={fieldLabel}>{t("Tìm kiếm")}</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id={`${kind}-search`} type="search" className="pl-9 pointer-coarse:min-h-11" maxLength={100} value={keyword} onChange={e => setKeyword(e.target.value)} />
            </div>
          </div>
        </form>
        <div className="grid gap-4 sm:grid-cols-3 md:col-span-6">
          {filter(`${kind}-active`, t("Trạng thái"), active, setActive, [['', t("Tất cả")], ['true', t("Hoạt động")], ['false', t("Ngừng hoạt động")]])}
          {filter(`${kind}-sort`, t("Sắp xếp"), sortBy, setSortBy, [['CREATED_AT', t("Ngày tạo")], ['UPDATED_AT', t("Ngày cập nhật")], ['NAME', t("Tên")]])}
          {filter(`${kind}-direction`, t("Thứ tự"), direction, setDirection, [['DESC', t("Giảm dần")], ['ASC', t("Tăng dần")]])}
        </div>
      </CardContent>
    </Card>

    {!formOpen && errorText}
    {message && <p role="status" className="inline-flex items-center gap-2 self-start rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm font-semibold text-tone-green-fg animate-in fade-in"><CheckCircle2 aria-hidden className="size-4" />{message}</p>}

    <section aria-labelledby={`${kind}-list`} className="flex flex-col gap-4">
      <h2 id={`${kind}-list`} className="text-xl font-bold">{t("Danh sách")} {label}</h2>
      {loading && !items.length
        ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label={t("Đang tải...")}>{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="flex flex-col gap-3 rounded-lg border border-border p-5"><div className="flex items-center gap-3"><Skeleton className="size-10 rounded-lg" /><Skeleton className="h-4 w-28" /></div><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></div>)}</div>
        : !items.length
          ? <EmptyState icon={Icon} title={t("Chưa có dữ liệu.")} description={vi ? `Tạo ${label} đầu tiên để tác giả gắn vào bài viết.` : 'Create the first one for authors to use.'} action={createButton} />
          : <ul data-slot="taxonomy-grid" className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {items.map(item => <li key={item.id} className="flex">
              <button type="button" data-slot="taxonomy-card" onClick={() => void open(item.id)}
                className={`group flex w-full flex-col gap-3 rounded-lg border border-border bg-card p-5 text-left text-card-foreground shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-ring hover:shadow-lg focus-visible:ring-[3px] focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${item.active ? '' : 'opacity-70'}`}>
                <span className="flex items-center gap-3">
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg border ${toneTile[toneFor(item.name)]}`}><Hash aria-hidden className="size-5" /></span>
                  <span className="min-w-0 flex-1 truncate text-base font-bold">{item.name}</span>
                  <Badge tone={statusTone(item.active ? 'ACTIVE' : 'HIDDEN')}>{item.active ? t("Hoạt động") : t("Ẩn")}</Badge>
                </span>
                <span className="line-clamp-2 text-sm text-muted-foreground">{item.description || (vi ? 'Chưa có mô tả.' : 'No description yet.')}</span>
              </button>
            </li>)}
          </ul>}
      <Pagination language={language} page={page} hasNext={hasNext} loading={loading} onPageChange={setPage} />
    </section>

    <Dialog open={formOpen} onOpenChange={setFormOpen}>
      <DialogContent closeLabel={vi ? 'Đóng' : 'Close'} className="sm:max-w-lg">
        <form className="flex flex-col gap-5" onSubmit={e => { e.preventDefault(); void save() }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{selected ? <><span>{vi ? 'Chỉnh sửa' : 'Edit'}:</span><Badge tone={toneFor(selected.name)}>{selected.name}</Badge></> : vi ? `Tạo ${label} mới` : `Create ${label}`}</DialogTitle>
            <DialogDescription>{selected ? (selected.active ? t("Hoạt động") : t("Ẩn")) : (vi ? `Tên ${label} hiển thị cho tác giả và người đọc.` : `The name authors and readers will see.`)}</DialogDescription>
          </DialogHeader>
          {errorText}
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${kind}-name`} className={fieldLabel}>{t("Tên")}</Label>
            <Input id={`${kind}-name`} className="pointer-coarse:min-h-11" required maxLength={100} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${kind}-description`} className={fieldLabel}>{t("Mô tả")}</Label>
            <Textarea id={`${kind}-description`} rows={4} maxLength={500} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {selected ? <Button type="button" variant={selected.active ? 'destructive' : 'outline'} disabled={loading} onClick={() => setConfirming(true)}>{selected.active ? <EyeOff /> : <Power />}{toggleLabel}</Button> : <span />}
            <Button type="submit" disabled={loading}>{selected ? t("Lưu thay đổi") : t("Tạo mới")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      {selected && <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{toggleLabel}</AlertDialogTitle>
          <AlertDialogDescription>{vi ? `Thay đổi trạng thái ${selected.name}?` : `Change the status of ${selected.name}?`}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{vi ? 'Hủy' : 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction variant={selected.active ? 'destructive' : 'default'} onClick={() => void toggle()}>{toggleLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
  </main>
}
