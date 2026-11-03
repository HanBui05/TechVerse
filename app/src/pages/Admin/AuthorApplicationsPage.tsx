import { managementText, statusLabel } from '../../data/managementI18n'
import type { Language } from '../../types/preferences'
import { Pagination } from '../../components/Pagination'
import { EmptyState } from '../../components/EmptyState'
import { UserAvatar } from '../../components/UserAvatar'
import { useEffect, useRef, useState } from 'react'
import { request } from '../../services/api/client'
import { Briefcase, CalendarDays, Check, ExternalLink, History, Mail, PauseCircle, Quote, RotateCcw, Search, UserCheck, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { statusTone, toneFor } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

type Review = { decision: string; reviewNote?: string | null; reviewedAt?: string | null; reviewerNameSnapshot?: string | null }
type Application = { id: string; fullName: string; email: string; avatarUrl?: string | null; expertise: string; status: string; version: number; active?: boolean; createdAt?: string; bio?: string; portfolioUrl?: string | null; reviewNote?: string | null; suspensionReason?: string | null; reviewHistory?: Review[] }
type Page = { content: Application[]; hasNext: boolean; totalElements?: number }
type Kind = 'APPROVED' | 'REJECTED' | 'suspend' | 'restore'
const base = '/api/v1/admin/author-applications'
const fieldLabel = 'text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground'
// Expertise is free text the applicant types (e.g. "Java, Spring Boot"); split it into one chip per skill.
const skills = (expertise: string) => [...new Set(expertise.split(/[,;\n]/).map(skill => skill.trim()).filter(Boolean))]
// Selected chip takes the status tone; static class strings so Tailwind can see them.
const chipOn: Record<string, string> = { '': 'border-ring bg-accent text-accent-text', PENDING: 'border-tone-amber-border bg-tone-amber-bg text-tone-amber-fg', APPROVED: 'border-tone-green-border bg-tone-green-bg text-tone-green-fg', REJECTED: 'border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg', SUSPENDED: 'border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg' }

export function AuthorApplicationsPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = (message: string) => managementText(message, language)
  const vi = language === 'vi'
  const [items, setItems] = useState<Application[]>([]); const [selected, setSelected] = useState<Application | null>(null); const [status, setStatus] = useState('PENDING'); const [keyword, setKeyword] = useState(''); const [query, setQuery] = useState(''); const [active, setActive] = useState(''); const [sortBy, setSortBy] = useState('CREATED_AT'); const [direction, setDirection] = useState('DESC'); const [page, setPage] = useState(0); const [hasNext, setHasNext] = useState(false); const [note, setNote] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState<{ kind: Kind; title: string } | null>(null); const [total, setTotal] = useState<number | null>(null)
  // Only the newest list request may update the page; an older search answering late must not overwrite it.
  const latest = useRef(0)
  const load = async () => { const id = ++latest.current; setLoading(true); setError(''); try { const params = new URLSearchParams({ page: String(page), size: '20', sortBy, direction }); if (status) params.set('status', status); if (active) params.set('active', active); if (query) params.set('keyword', query); const result = await request<Page>(`${base}?${params}`); if (id !== latest.current) return; setItems(result.content); setHasNext(result.hasNext); setTotal(result.totalElements ?? null) } catch (e) { if (id === latest.current) setError(e instanceof Error ? e.message : t("Không tải được hồ sơ")) } finally { if (id === latest.current) setLoading(false) } }
  useEffect(() => { void load() }, [page, status, active, query, sortBy, direction])
  // Live search: typing updates the query after a short pause; Enter applies it at once.
  const typed = useDebouncedValue(keyword.trim())
  useEffect(() => { setPage(0); setQuery(typed) }, [typed])
  const open = async (id: string) => { setError(''); try { setSelected(await request<Application>(`${base}/${id}`)); setNote('') } catch (e) { setError(e instanceof Error ? e.message : t("Không tải được chi tiết")) } }
  // Runs only after the AlertDialog is confirmed; payloads are unchanged from the old window.confirm flow.
  const action = async (kind: Kind) => { if (!selected || (kind !== 'APPROVED' && !note.trim())) return; setLoading(true); setError(''); try { const review = kind === 'APPROVED' || kind === 'REJECTED'; const payload = review ? { decision: kind, reviewNote: note.trim(), expectedVersion: selected.version } : kind === 'suspend' ? { reason: note.trim(), expectedVersion: selected.version } : { note: note.trim(), expectedVersion: selected.version }; const updated = await request<Application>(`${base}/${selected.id}/${review ? 'review' : kind}`, { method: 'PATCH', body: JSON.stringify(payload) }); setSelected(updated); setNote(''); await load() } catch (e) { setError(e instanceof Error ? e.message : t("Không thể cập nhật hồ sơ")) } finally { setLoading(false) } }
  const date = (value?: string | null) => value ? new Date(value).toLocaleDateString(vi ? 'vi-VN' : 'en-US') : '—'
  const filter = (id: string, label: string, value: string, onChange: (value: string) => void, options: [string, string][]) => <div className="flex flex-col gap-2">
    <Label htmlFor={id} className={fieldLabel}>{label}</Label>
    <NativeSelect id={id} className="pointer-coarse:min-h-11" value={value} onChange={e => { onChange(e.target.value); setPage(0) }}>{options.map(([v, text]) => <NativeSelectOption key={v} value={v}>{text}</NativeSelectOption>)}</NativeSelect>
  </div>
  const chips: [string, string][] = [['', t("Tất cả")], ['PENDING', t("Chờ duyệt")], ['APPROVED', t("Đã duyệt")], ['REJECTED', t("Từ chối")], ['SUSPENDED', t("Tạm ngưng")]]
  const errorText = error && <p role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">{error}</p>
  const ask = (kind: Kind, title: string) => setPending({ kind, title })
  const needsNote = !note.trim()

  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:px-8">
    <header className="flex items-center gap-4">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-tone-purple-border bg-tone-purple-bg text-tone-purple-fg"><UserCheck aria-hidden className="size-6" /></span>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[.05em] text-accent-text">{t("TechVerse administration")}</span>
        <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">{t("Hồ sơ đăng ký Author")}</h1>{total !== null && <Badge tone="slate" aria-live="polite">{vi ? `${total} kết quả` : `${total} ${total === 1 ? 'result' : 'results'}`}</Badge>}</div>
        <p className="text-sm text-muted-foreground">{vi ? 'Xem hồ sơ, duyệt hoặc từ chối, đình chỉ và khôi phục quyền tác giả.' : 'Review applications, approve or reject, suspend and restore author access.'}</p>
      </div>
    </header>

    <div role="group" aria-label={t("Hồ sơ")} className="flex flex-wrap gap-2">
      {chips.map(([value, label]) => <button key={value || 'all'} type="button" data-slot="status-chip" aria-pressed={status === value} onClick={() => { setStatus(value); setPage(0) }}
        className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring pointer-coarse:min-h-11 ${status === value ? chipOn[value] : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
        {value && <span aria-hidden className="size-2 rounded-full bg-current" />}{label}
      </button>)}
    </div>

    <Card className="rounded-2xl">
      <CardContent className="grid gap-4 md:grid-cols-12 [&_[data-slot=native-select-wrapper]]:w-full">
        <form className="flex flex-col gap-2 md:col-span-6" onSubmit={e => { e.preventDefault(); setPage(0); setQuery(keyword.trim()) }}>
          <Label htmlFor="author-app-search" className={fieldLabel}>{t("Tìm kiếm")}</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="author-app-search" type="search" className="pl-9 pointer-coarse:min-h-11" maxLength={100} value={keyword} onChange={e => setKeyword(e.target.value)} />
            </div>
          </div>
        </form>
        <div className="grid gap-4 sm:grid-cols-3 md:col-span-6">
          {filter('author-app-active', t("Tài khoản"), active, setActive, [['', t("Tất cả")], ['true', t("Hoạt động")], ['false', t("Đã khóa")]])}
          {filter('author-app-sort', t("Sắp xếp"), sortBy, setSortBy, [['CREATED_AT', t("Ngày tạo")], ['UPDATED_AT', t("Ngày cập nhật")], ['FULL_NAME', t("Họ tên")], ['EMAIL', t("Email")]])}
          {filter('author-app-direction', t("Thứ tự"), direction, setDirection, [['DESC', t("Giảm dần")], ['ASC', t("Tăng dần")]])}
        </div>
      </CardContent>
    </Card>

    {!selected && errorText}

    <Card className="gap-0 overflow-hidden rounded-2xl py-0">
      <h2 className="border-b border-border px-6 py-4 text-base font-bold">{t("Danh sách hồ sơ")}</h2>
      {loading && !items.length
        ? <div className="flex flex-col divide-y divide-border" aria-busy="true" aria-label={t("Đang tải...")}>{[0, 1, 2, 3].map(i => <div key={i} className="flex items-center gap-4 px-6 py-4"><Skeleton className="size-10 rounded-full" /><div className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-72 max-w-full" /></div><Skeleton className="h-5 w-20 rounded-full" /></div>)}</div>
        : !items.length
          ? <EmptyState className="m-6" icon={UserCheck} title={t("Không có hồ sơ phù hợp.")} description={vi ? 'Chọn trạng thái khác hoặc đổi từ khóa tìm kiếm.' : 'Pick another status or change the keyword.'} />
          : <ul data-slot="author-app-list" className={`flex flex-col divide-y divide-border transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {items.map(item => <li key={item.id}>
              <button type="button" data-slot="author-app-row" className="flex w-full items-center gap-4 px-6 py-4 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset" onClick={() => void open(item.id)}>
                <UserAvatar name={item.fullName} url={item.avatarUrl} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-semibold">{item.fullName}</span>
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex min-w-0 items-center gap-1"><Mail aria-hidden className="size-3.5 shrink-0" /><span className="truncate">{item.email}</span></span>
                    {item.createdAt && <span className="inline-flex items-center gap-1"><CalendarDays aria-hidden className="size-3.5" />{date(item.createdAt)}</span>}
                  </span>
                  <span className="flex flex-wrap gap-1">{skills(item.expertise).slice(0, 3).map(skill => <Badge key={skill} tone={toneFor(skill)}>{skill}</Badge>)}{skills(item.expertise).length > 3 && <Badge tone="slate">+{skills(item.expertise).length - 3}</Badge>}</span>
                </span>
                {item.active === false && <Badge tone="slate" className="hidden sm:inline-flex">{t("Đã khóa")}</Badge>}
                <Badge tone={statusTone(item.status)}>{statusLabel(item.status, 'author', language)}</Badge>
              </button>
            </li>)}
          </ul>}
      <div className="px-6 pb-4"><Pagination language={language} page={page} hasNext={hasNext} loading={loading} onPageChange={setPage} /></div>
    </Card>

    <Sheet open={selected !== null} onOpenChange={next => { if (!next) setSelected(null) }}>
      <SheetContent closeLabel={vi ? 'Đóng' : 'Close'} className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {selected && <>
          <SheetHeader className="flex-row items-center gap-4 border-b border-border p-6 pr-14">
            <UserAvatar className="avatar-large" name={selected.fullName} url={selected.avatarUrl} />
            <div className="flex min-w-0 flex-col gap-1">
              <SheetTitle className="text-xl font-bold">{selected.fullName}</SheetTitle>
              <SheetDescription className="truncate">{selected.email}</SheetDescription>
              <div className="flex flex-wrap gap-1"><Badge tone={statusTone(selected.status)}>{statusLabel(selected.status, 'author', language)}</Badge>{selected.active === false && <Badge tone="slate">{t("Đã khóa")}</Badge>}</div>
            </div>
          </SheetHeader>
          <div className="flex flex-col gap-6 p-6">
            <span className="sr-only">{t("Chi tiết hồ sơ")}</span>
            {errorText}
            <section className="flex flex-col gap-3 rounded-xl border border-tone-purple-border bg-tone-purple-bg/40 p-4">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
                <span className="flex size-7 items-center justify-center rounded-lg border border-tone-purple-border bg-tone-purple-bg text-tone-purple-fg"><Briefcase aria-hidden className="size-4" /></span>
                {vi ? 'Chuyên môn' : 'Expertise'}
                <span className="text-xs font-normal text-muted-foreground">· {skills(selected.expertise).length} {vi ? 'kỹ năng' : skills(selected.expertise).length === 1 ? 'skill' : 'skills'}</span>
              </h3>
              <ul data-slot="expertise-list" aria-label={vi ? 'Chuyên môn' : 'Expertise'} className="flex flex-wrap gap-2">
                {skills(selected.expertise).map(skill => <li key={skill}><Badge tone={toneFor(skill)} className="gap-1.5 px-3 py-1 text-[13px] font-semibold"><span aria-hidden className="size-1.5 rounded-full bg-current" />{skill}</Badge></li>)}
              </ul>
            </section>
            <section className="flex flex-col gap-3">
              <h3 className={`${fieldLabel} inline-flex items-center gap-2`}><Quote aria-hidden className="size-3.5" />{t("Giới thiệu:")}</h3>
              <div className="flex flex-col gap-2 border-l-4 border-l-tone-purple-border pl-4 text-sm leading-relaxed">
                {(selected.bio || '—').split(/\n+/).filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}
              </div>
            </section>
            {selected.portfolioUrl && <Button asChild variant="outline" className="self-start"><a href={selected.portfolioUrl} target="_blank" rel="noreferrer"><ExternalLink />{vi ? 'Xem portfolio' : 'View portfolio'}</a></Button>}
            {(selected.reviewNote || selected.suspensionReason) && <section className="flex flex-col gap-2 rounded-lg border border-tone-amber-border bg-tone-amber-bg p-4 text-tone-amber-fg">
              <h3 className="text-[11px] font-semibold uppercase tracking-[.05em]">{t("Ghi chú:")}</h3>
              <p className="text-sm whitespace-pre-line">{selected.suspensionReason || selected.reviewNote}</p>
            </section>}
            {!!selected.reviewHistory?.length && <section className="flex flex-col gap-3">
              <h3 className={`${fieldLabel} inline-flex items-center gap-2`}><History aria-hidden className="size-3.5" />{vi ? 'Lịch sử duyệt' : 'Review history'}</h3>
              <ol data-slot="review-history" className="flex flex-col gap-4 border-l border-border pl-5">
                {selected.reviewHistory.map((review, index) => <li key={index} className="relative flex flex-col gap-1">
                  <span aria-hidden className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-current text-tone-slate-fg" />
                  <div className="flex flex-wrap items-center gap-2"><Badge tone={statusTone(review.decision)}>{statusLabel(review.decision, 'author', language)}</Badge><span className="text-xs text-muted-foreground">{[review.reviewerNameSnapshot, date(review.reviewedAt)].filter(Boolean).join(' · ')}</span></div>
                  {review.reviewNote && <p className="text-sm text-muted-foreground whitespace-pre-line">{review.reviewNote}</p>}
                </li>)}
              </ol>
            </section>}
            {['PENDING', 'APPROVED', 'SUSPENDED'].includes(selected.status) && <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <Label htmlFor="author-app-note" className={fieldLabel}>{t("Ghi chú / lý do")}</Label>
              <Textarea id="author-app-note" rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {selected.status === 'PENDING' && <>
                  <Button disabled={loading} onClick={() => ask('APPROVED', t("Phê duyệt"))}><Check />{t("Phê duyệt")}</Button>
                  <Button variant="destructive" disabled={loading || needsNote} onClick={() => ask('REJECTED', t("Từ chối"))}><X />{t("Từ chối")}</Button>
                </>}
                {selected.status === 'APPROVED' && <Button variant="destructive" disabled={loading || needsNote} onClick={() => ask('suspend', t("Tạm ngưng"))}><PauseCircle />{t("Tạm ngưng")}</Button>}
                {selected.status === 'SUSPENDED' && <Button disabled={loading || needsNote} onClick={() => ask('restore', t("Khôi phục"))}><RotateCcw />{t("Khôi phục")}</Button>}
              </div>
            </section>}
          </div>
        </>}
      </SheetContent>
    </Sheet>

    <AlertDialog open={pending !== null} onOpenChange={next => { if (!next) setPending(null) }}>
      {pending && selected && <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending.title}</AlertDialogTitle>
          <AlertDialogDescription>{vi ? `Xác nhận thao tác với hồ sơ ${selected.fullName}?` : `Confirm action for ${selected.fullName}'s application?`}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{vi ? 'Hủy' : 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction variant={pending.kind === 'REJECTED' || pending.kind === 'suspend' ? 'destructive' : 'default'} onClick={() => void action(pending.kind)}>{pending.title}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
  </main>
}
