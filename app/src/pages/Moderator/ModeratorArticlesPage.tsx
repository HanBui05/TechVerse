import { managementText, statusLabel } from '../../data/managementI18n'
import type { Language } from '../../types/preferences'
import { useEffect, useRef, useState } from 'react'
import { CalendarDays, CheckCircle2, Eye, FileText, MessageSquare, PencilLine, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { request } from '../../services/api/client'
import { MarkdownContent } from '../../components/MarkdownContent'
import { EmptyState } from '../../components/EmptyState'
import { adminErrorText } from '../Admin/adminErrors'
import { AdminPagination } from '../Admin/AdminPagination'
import { ArticleStats, useArticleStats } from './ArticleStats'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { statusTone, toneFor } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

type Article = { id: string; title: string; summary: string; content: string; status: string; moderationNote: string | null; topic: { name: string } | null; tags: { id: string; name: string }[]; createdAt: string; updatedAt: string }
type Detail = { article: Article; author: { fullName: string }; reviewToken: string }
type Summary = { id: string; title: string; summary: string; status: string; author: { fullName: string }; topic: { name: string } | null; createdAt: string }
type Page = { content: Summary[]; hasNext: boolean; totalElements: number }
type Decision = 'APPROVE' | 'REQUEST_CHANGES'
const base = '/api/v1/moderator/articles'
const SIZE = 12
const statuses = ['PENDING', 'PUBLISHED', 'CHANGES_REQUESTED', 'HIDDEN', 'REMOVED']
// Same list frame as the Admin pages: a 6-column table from xl up, stacked cards below.
const columns = 'xl:grid xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_8rem_7rem_6rem] xl:items-center xl:gap-4'
const fieldLabel = 'text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground'
const formatDate = (value: string, language: Language, time = false) => new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(value))

export function ModeratorArticlesPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = (message: string) => managementText(message, language)
  const vi = language === 'vi'
  const [items, setItems] = useState<Summary[]>([])
  const [selected, setSelected] = useState<Detail | null>(null)
  const [status, setStatus] = useState('PENDING')
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const [pending, setPending] = useState<Decision | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [stats, loadStats] = useArticleStats()
  // Only the newest list request may update the page; an older search answering late must not overwrite it.
  const latest = useRef(0)
  const load = async () => {
    const id = ++latest.current
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ page: String(page), size: String(SIZE) })
      if (status) params.set('status', status)
      if (query) params.set('keyword', query)
      const result = await request<Page>(`${base}?${params}`)
      if (id !== latest.current) return
      const last = Math.max(0, Math.ceil((result.totalElements ?? 0) / SIZE) - 1)
      if (page > last) { setPage(last); return }
      setItems(result.content); setTotal(result.totalElements ?? null)
    } catch (e) { if (id === latest.current) setError(adminErrorText(e, language, t("Không thể tải bài viết"))) }
    finally { if (id === latest.current) setLoading(false) }
  }
  useEffect(() => { void load() }, [status, page, query])
  // Live search like the Admin pages: typing applies after a short pause; Enter applies at once.
  const typed = useDebouncedValue(keyword.trim())
  useEffect(() => { setPage(0); setQuery(typed) }, [typed])
  const open = async (id: string) => {
    setError(''); setMessage('')
    try { setSelected(await request<Detail>(`${base}/${id}`)); setNote(''); setNoteError(false) }
    catch (e) { setError(adminErrorText(e, language, t("Không thể tải chi tiết"))) }
  }
  // Request changes needs feedback (backend rule): explain on the field instead of a silently disabled button.
  const ask = (decision: Decision) => { if (decision === 'REQUEST_CHANGES' && !note.trim()) { setNoteError(true); noteRef.current?.focus(); return } setPending(decision) }
  // Runs only after the AlertDialog is confirmed; the payload is unchanged from the old window.confirm flow.
  const review = async (decision: Decision) => {
    if (!selected) return
    setLoading(true); setError(''); setMessage('')
    try {
      const updated = await request<Detail>(`${base}/${selected.article.id}/review`, { method: 'PATCH', body: JSON.stringify({ decision, reviewToken: selected.reviewToken, moderationNote: note.trim() || null }) })
      setSelected(updated); setNote('')
      setMessage(decision === 'APPROVE' ? t("Bài viết đã được phê duyệt và xuất bản.") : t("Đã gửi yêu cầu chỉnh sửa tới tác giả."))
      await load(); void loadStats()
    } catch (e) { setError(adminErrorText(e, language, t("Không thể duyệt bài viết"))) }
    finally { setLoading(false) }
  }
  const chips: [string, string][] = [['', t("Tất cả")], ...statuses.map(key => [key, statusLabel(key, 'article', language)] as [string, string])]
  const notices = <>
    {error && <p role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">{error}</p>}
    {message && <p role="status" className="rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">{message}</p>}
  </>
  const needsNote = noteError && !note.trim()
  const article = selected?.article

  return <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:px-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("Kiểm duyệt bài viết")}</h1>
        <p className="text-sm text-muted-foreground">{t("Xem nội dung từ Author và quản lý hàng đợi kiểm duyệt.")}</p>
      </div>
      <Button variant="outline" onClick={() => { void load(); void loadStats() }} disabled={loading}><RefreshCw className={loading ? 'animate-spin motion-reduce:animate-none' : ''} />{vi ? 'Làm mới' : 'Refresh'}</Button>
    </header>

    <ArticleStats stats={stats} language={language} />

    <Card className="gap-0 rounded-2xl py-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
        <span className="inline-flex items-center gap-2 font-semibold"><span aria-hidden className="flex size-8 items-center justify-center rounded-lg border border-tone-sky-border bg-tone-sky-bg text-tone-sky-fg"><SlidersHorizontal className="size-4" /></span>{vi ? 'Bộ lọc' : 'Filters'}</span>
        <div role="group" aria-label={t("Trạng thái")} className="flex flex-wrap gap-2">
          {chips.map(([value, label]) => <Button key={value || 'all'} size="sm" variant={status === value ? 'default' : 'outline'} className="rounded-full" aria-pressed={status === value} onClick={() => { setStatus(value); setPage(0) }}>{label}</Button>)}
        </div>
      </div>
      <form className="flex flex-col gap-2 p-6" onSubmit={e => { e.preventDefault(); setPage(0); setQuery(keyword.trim()) }}>
        <Label htmlFor="moderator-search" className={fieldLabel}>{t("Tìm kiếm bài viết")}</Label>
        <div className="relative max-w-xl">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="moderator-search" type="search" className="pl-9 pointer-coarse:min-h-11" maxLength={255} placeholder={t("Tìm theo tiêu đề...")} value={keyword} onChange={e => setKeyword(e.target.value)} />
        </div>
      </form>
    </Card>

    {!selected && notices}

    <Card className="gap-0 overflow-hidden rounded-2xl py-0">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-bold">{t("Danh sách bài viết")}</h2>
          <p className="text-xs text-muted-foreground">{vi ? 'Mở một bài để đọc nội dung và kiểm duyệt.' : 'Open an article to read and review it.'}</p>
        </div>
        {total !== null && <Badge tone="blue" aria-live="polite">{vi ? `${total} bài viết` : `${total} ${total === 1 ? 'article' : 'articles'}`}</Badge>}
      </div>
      <div aria-hidden className={`hidden border-b border-border bg-muted/40 px-6 py-3 ${columns} ${fieldLabel}`}>
        <span>{vi ? 'Bài viết' : 'Article'}</span><span>{vi ? 'Tác giả' : 'Author'}</span><span>{vi ? 'Chủ đề' : 'Topic'}</span><span>{t("Trạng thái")}</span><span>{vi ? 'Ngày gửi' : 'Submitted'}</span><span className="text-right">{vi ? 'Thao tác' : 'Actions'}</span>
      </div>
      {loading && !items.length
        ? <div className="flex flex-col divide-y divide-border" aria-busy="true" aria-label={t("Đang tải bài viết...")}>{[0, 1, 2, 3].map(i => <div key={i} className="flex flex-col gap-2 px-6 py-4"><Skeleton className="h-4 w-64 max-w-full" /><Skeleton className="h-3 w-96 max-w-full" /></div>)}</div>
        : !items.length
          ? <EmptyState className="m-6" icon={FileText} title={t("Không có bài viết phù hợp.")} description={vi ? 'Chọn trạng thái khác hoặc đổi từ khóa tìm kiếm.' : 'Pick another status or change the keyword.'} />
          : <ul data-slot="moderator-article-list" className={`flex flex-col divide-y divide-border transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {items.map(item => <li key={item.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-6 py-3 transition-colors hover:bg-muted/50 ${columns}`}>
              <span className="flex min-w-0 flex-col gap-0.5"><span className="font-semibold [overflow-wrap:anywhere]">{item.title}</span><span className="line-clamp-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{item.summary || t("Chưa có tóm tắt")}</span></span>
              <span className="flex justify-end xl:hidden"><Badge tone={statusTone(item.status)}>{statusLabel(item.status, 'article', language)}</Badge></span>
              <span className="col-span-2 truncate text-sm xl:col-span-1">{item.author.fullName}</span>
              <span className="col-span-2 xl:col-span-1">{item.topic ? <Badge tone={toneFor(item.topic.name)} className="max-w-full truncate">{item.topic.name}</Badge> : <span className="text-sm text-muted-foreground">{t("Chưa phân loại")}</span>}</span>
              <span className="hidden xl:flex"><Badge tone={statusTone(item.status)}>{statusLabel(item.status, 'article', language)}</Badge></span>
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><CalendarDays aria-hidden className="size-3.5 xl:hidden" />{formatDate(item.createdAt, language)}</span>
              <span className="flex justify-end"><Button size="sm" variant="outline" aria-label={`${vi ? 'Xem bài' : 'View article'} ${item.title}`} onClick={() => void open(item.id)}><Eye />{vi ? 'Xem' : 'View'}</Button></span>
            </li>)}
          </ul>}
      {!!total && <div className="border-t border-border px-6 py-4"><AdminPagination language={language} page={page} size={SIZE} total={total ?? 0} loading={loading} onPageChange={setPage} /></div>}
    </Card>

    <Sheet open={selected !== null} onOpenChange={next => { if (!next) { setSelected(null); setMessage('') } }}>
      <SheetContent closeLabel={vi ? 'Đóng' : 'Close'} className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
        {selected && article && <>
          <SheetHeader className="gap-2 border-b border-border p-6 pr-14">
            <Badge tone={statusTone(article.status)} className="self-start">{statusLabel(article.status, 'article', language)}</Badge>
            <SheetTitle className="text-xl font-bold [overflow-wrap:anywhere]">{article.title}</SheetTitle>
            <SheetDescription className="[overflow-wrap:anywhere]">{[selected.author.fullName, article.topic?.name || t("Chưa phân loại"), formatDate(article.createdAt, language, true)].join(' · ')}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-6 p-6">
            {notices}
            <section className="flex flex-col gap-2">
              <h3 className={fieldLabel}>{t("Tóm tắt")}</h3>
              <p className="text-sm leading-relaxed [overflow-wrap:anywhere]">{article.summary || t("Chưa có tóm tắt.")}</p>
              {article.tags?.length > 0 && <ul aria-label={vi ? 'Thẻ' : 'Tags'} className="flex flex-wrap gap-1">{article.tags.map(tag => <li key={tag.id} className="max-w-full"><Badge tone={toneFor(tag.name)} className="max-w-full whitespace-normal [overflow-wrap:anywhere]">{tag.name}</Badge></li>)}</ul>}
            </section>
            <section className="flex flex-col gap-2">
              <h3 className={fieldLabel}>{t("Nội dung bài viết")}</h3>
              <div key={article.id} role="region" aria-label={t("Nội dung bài viết")} tabIndex={0} className="max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-background p-5 outline-none [&_.markdown-content>:first-child]:mt-0 focus-visible:ring-[3px] focus-visible:ring-ring">
                <MarkdownContent content={article.content} />
              </div>
            </section>
            {article.moderationNote && <section className="flex flex-col gap-2 rounded-lg border border-tone-amber-border bg-tone-amber-bg p-4 text-tone-amber-fg">
              <h3 className="text-[11px] font-semibold uppercase tracking-[.05em]">{t("Nhận xét trước đó")}</h3>
              <p className="text-sm whitespace-pre-line [overflow-wrap:anywhere]">{article.moderationNote}</p>
            </section>}
            {article.status === 'PENDING' && <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <Label htmlFor="moderation-note" className={`${fieldLabel} inline-flex items-center gap-2`}><MessageSquare aria-hidden className="size-3.5" />{t("Nhận xét kiểm duyệt")}</Label>
              <Textarea ref={noteRef} id="moderation-note" rows={4} className="max-h-48 overflow-y-auto" maxLength={2000} placeholder={t("Nhập nhận xét cho tác giả...")} value={note} aria-invalid={needsNote} aria-describedby="moderation-note-hint" onChange={e => { setNote(e.target.value); setNoteError(false) }} />
              <div className="flex flex-wrap justify-between gap-2 text-xs">
                <p id="moderation-note-hint" className={needsNote ? 'text-danger' : 'text-muted-foreground'}>{needsNote ? (vi ? 'Nhập nhận xét trước khi yêu cầu chỉnh sửa.' : 'Enter feedback before requesting changes.') : t("Nhận xét là bắt buộc khi yêu cầu chỉnh sửa.")}</p>
                <span className="text-muted-foreground tabular-nums">{note.length}/2000</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={loading} onClick={() => ask('APPROVE')}><CheckCircle2 />{t("Phê duyệt")}</Button>
                <Button variant="outline" disabled={loading} onClick={() => ask('REQUEST_CHANGES')}><PencilLine />{t("Yêu cầu chỉnh sửa")}</Button>
              </div>
            </section>}
          </div>
        </>}
      </SheetContent>
    </Sheet>

    <AlertDialog open={pending !== null} onOpenChange={next => { if (!next) setPending(null) }}>
      {pending && <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending === 'APPROVE' ? t("Phê duyệt") : t("Yêu cầu chỉnh sửa")}</AlertDialogTitle>
          <AlertDialogDescription>{pending === 'APPROVE' ? t("Phê duyệt và xuất bản bài viết này?") : t("Gửi yêu cầu chỉnh sửa cho tác giả?")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{vi ? 'Hủy' : 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction onClick={() => void review(pending)}>{pending === 'APPROVE' ? t("Phê duyệt") : t("Yêu cầu chỉnh sửa")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
  </main>
}
