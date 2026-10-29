import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, FileText, MessageSquare, Search } from 'lucide-react'
import { ApiError, request } from '../../services/api/client'

type Article = { id: string; title: string; summary: string; content: string; status: string; moderationNote: string | null; topic: { name: string } | null; tags: { id: string; name: string }[]; createdAt: string; updatedAt: string }
type Detail = { article: Article; author: { fullName: string }; reviewToken: string }
type Summary = { id: string; title: string; summary: string; status: string; author: { fullName: string }; topic: { name: string } | null; createdAt: string }
type Page = { content: Summary[]; hasNext: boolean; totalElements: number }
const base = '/api/v1/moderator/articles'
const statuses: Record<string, string> = { PENDING: 'Chờ duyệt', PUBLISHED: 'Đã xuất bản', CHANGES_REQUESTED: 'Yêu cầu chỉnh sửa', HIDDEN: 'Đã ẩn', REMOVED: 'Đã gỡ' }
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'

export function ModeratorArticlesPage() {
  const [items, setItems] = useState<Summary[]>([])
  const [selected, setSelected] = useState<Detail | null>(null)
  const [status, setStatus] = useState('PENDING')
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [total, setTotal] = useState(0)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const load = async () => {
    setBusy(true); setError('')
    try {
      const params = new URLSearchParams({ page: String(page), size: '20' })
      if (status) params.set('status', status)
      if (query) params.set('keyword', query)
      const result = await request<Page>(`${base}?${params}`)
      setItems(result.content); setHasNext(result.hasNext); setTotal(result.totalElements)
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể tải bài viết') }
    finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [status, page, query])
  const open = async (id: string) => {
    setError(''); setMessage(''); setDetailLoading(true); setSelected(null)
    try { setSelected(await request<Detail>(`${base}/${id}`)); setNote('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Không thể tải chi tiết') }
    finally { setDetailLoading(false) }
  }
  const review = async (decision: 'APPROVE' | 'REQUEST_CHANGES') => {
    if (!selected || (decision === 'REQUEST_CHANGES' && !note.trim())) return
    if (!window.confirm(decision === 'APPROVE' ? 'Phê duyệt và xuất bản bài viết này?' : 'Gửi yêu cầu chỉnh sửa cho tác giả?')) return
    setBusy(true); setError(''); setMessage('')
    try {
      const updated = await request<Detail>(`${base}/${selected.article.id}/review`, { method: 'PATCH', body: JSON.stringify({ decision, reviewToken: selected.reviewToken, moderationNote: note.trim() || null }) })
      setSelected(updated); setNote(''); await load()
      setMessage(decision === 'APPROVE' ? 'Bài viết đã được phê duyệt và xuất bản.' : 'Đã gửi yêu cầu chỉnh sửa tới tác giả.')
    } catch (e) { setError(e instanceof ApiError && e.status === 409 ? 'Bài viết đã thay đổi. Hãy mở lại bài để kiểm tra trước khi duyệt.' : e instanceof Error ? e.message : 'Không thể duyệt bài viết') }
    finally { setBusy(false) }
  }
  return <main className="page-content moderation-page"><div className="moderation-content">
    <header className="moderation-header"><div><span className="section-kicker">TechVerse Moderator</span><h1>Kiểm duyệt bài viết</h1><p>Xem nội dung từ Author và quản lý hàng đợi kiểm duyệt.</p></div><div className="moderation-header-icon"><ClipboardList size={26} /></div></header>
    <section className="moderation-toolbar" aria-label="Bộ lọc bài viết"><form onSubmit={e => { e.preventDefault(); setPage(0); setSelected(null); setQuery(keyword.trim()) }}><label className="moderation-search"><Search size={18} /><span className="sr-only">Tìm kiếm bài viết</span><input value={keyword} maxLength={255} onChange={e => setKeyword(e.target.value)} placeholder="Tìm theo tiêu đề..." /></label><button className="button button-primary">Tìm kiếm</button></form><label>Trạng thái<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); setSelected(null) }}><option value="">Tất cả trạng thái</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></section>
    {error && <p className="moderation-alert error" role="alert">{error}</p>}{message && <p className="moderation-alert success" role="status">{message}</p>}
    <div className="moderation-layout"><section className="moderation-list"><div className="moderation-panel-title"><div><h2>Danh sách bài viết</h2><p>{total} bài viết phù hợp</p></div><FileText size={20} /></div>
      {busy && <p className="moderation-empty" role="status">Đang tải bài viết...</p>}{!busy && !items.length && <p className="moderation-empty">Không có bài viết phù hợp.</p>}
      <div className="moderation-items">{items.map(item => <button type="button" key={item.id} onClick={() => void open(item.id)} className={`moderation-item ${selected?.article.id === item.id ? 'selected' : ''}`}><span className={`moderation-badge ${item.status.toLowerCase()}`}>{statuses[item.status] || item.status}</span><strong>{item.title}</strong><span className="moderation-item-summary">{item.summary || 'Chưa có tóm tắt'}</span><small>{item.author.fullName} · {item.topic?.name || 'Chưa phân loại'}</small><small>{formatDate(item.createdAt)}</small></button>)}</div>
      <div className="moderation-pagination"><button type="button" aria-label="Trang trước" disabled={!page || busy} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button><span>Trang {page + 1}</span><button type="button" aria-label="Trang sau" disabled={!hasNext || busy} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button></div></section>
      <section className="moderation-detail">{detailLoading ? <p className="moderation-empty" role="status">Đang tải nội dung...</p> : selected ? <><div className="moderation-detail-head"><span className={`moderation-badge ${selected.article.status.toLowerCase()}`}>{statuses[selected.article.status] || selected.article.status}</span><h2>{selected.article.title}</h2><p>{selected.author.fullName} · {selected.article.topic?.name || 'Chưa phân loại'} · {formatDate(selected.article.createdAt)}</p></div><div className="moderation-detail-body"><h3>Tóm tắt</h3><p>{selected.article.summary || 'Chưa có tóm tắt.'}</p>{selected.article.tags?.length > 0 && <div className="moderation-tags">{selected.article.tags.map(tag => <span key={tag.id}>{tag.name}</span>)}</div>}<h3>Nội dung bài viết <small>Markdown</small></h3><pre className="moderation-markdown">{selected.article.content}</pre>{selected.article.moderationNote && <div className="moderation-previous-note"><strong>Nhận xét trước đó</strong><p>{selected.article.moderationNote}</p></div>}{selected.article.status === 'PENDING' && <div className="moderation-review"><h3><MessageSquare size={18} /> Nhận xét kiểm duyệt</h3><label htmlFor="moderation-note">Nhận xét là bắt buộc khi yêu cầu chỉnh sửa.</label><textarea id="moderation-note" maxLength={2000} rows={4} placeholder="Nhập nhận xét cho tác giả..." value={note} onChange={e => setNote(e.target.value)} /><small>{note.length}/2000</small><div className="moderation-review-actions"><button className="button button-outline" disabled={busy || !note.trim()} onClick={() => void review('REQUEST_CHANGES')}>Yêu cầu chỉnh sửa</button><button className="button button-primary" disabled={busy} onClick={() => void review('APPROVE')}><CheckCircle2 size={17} />Phê duyệt</button></div></div>}</div></> : <div className="moderation-detail-empty"><FileText size={32} /><h2>Chọn bài viết để xem</h2><p>Chọn một bài trong danh sách để đọc và kiểm duyệt.</p></div>}</section></div>
  </div></main>
}
