import { managementText, statusLabel } from '../../data/managementI18n'
import type { Language } from '../../types/preferences'
import { Pagination } from '../../components/Pagination'
import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardList, FileText, MessageSquare, Search } from 'lucide-react'
import { ApiError, request } from '../../services/api/client'
import { MarkdownContent } from '../../components/MarkdownContent'

type Article = { id: string; title: string; summary: string; content: string; status: string; moderationNote: string | null; topic: { name: string } | null; tags: { id: string; name: string }[]; createdAt: string; updatedAt: string }
type Detail = { article: Article; author: { fullName: string }; reviewToken: string }
type Summary = { id: string; title: string; summary: string; status: string; author: { fullName: string }; topic: { name: string } | null; createdAt: string }
type Page = { content: Summary[]; hasNext: boolean; totalElements: number }
const base = '/api/v1/moderator/articles'
const statuses = ['PENDING', 'PUBLISHED', 'CHANGES_REQUESTED', 'HIDDEN', 'REMOVED']
const formatDate = (value?: string, language: Language = 'vi') => value ? new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'

export function ModeratorArticlesPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = (message: string) => managementText(message, language)

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
    } catch (e) { setError(e instanceof Error ? e.message : t("Không thể tải bài viết")) }
    finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [status, page, query])
  const open = async (id: string) => {
    setError(''); setMessage(''); setDetailLoading(true); setSelected(null)
    try { setSelected(await request<Detail>(`${base}/${id}`)); setNote('') }
    catch (e) { setError(e instanceof Error ? e.message : t("Không thể tải chi tiết")) }
    finally { setDetailLoading(false) }
  }
  const review = async (decision: 'APPROVE' | 'REQUEST_CHANGES') => {
    if (!selected || (decision === 'REQUEST_CHANGES' && !note.trim())) return
    if (!window.confirm(decision === 'APPROVE' ? t("Phê duyệt và xuất bản bài viết này?") : t("Gửi yêu cầu chỉnh sửa cho tác giả?"))) return
    setBusy(true); setError(''); setMessage('')
    try {
      const updated = await request<Detail>(`${base}/${selected.article.id}/review`, { method: 'PATCH', body: JSON.stringify({ decision, reviewToken: selected.reviewToken, moderationNote: note.trim() || null }) })
      setSelected(updated); setNote(''); await load()
      setMessage(decision === 'APPROVE' ? t("Bài viết đã được phê duyệt và xuất bản.") : t("Đã gửi yêu cầu chỉnh sửa tới tác giả."))
    } catch (e) { setError(e instanceof ApiError && e.status === 409 ? t("Bài viết đã thay đổi. Hãy mở lại bài để kiểm tra trước khi duyệt.") : e instanceof Error ? e.message : t("Không thể duyệt bài viết")) }
    finally { setBusy(false) }
  }
  return <main className="page-content moderation-page"><div className="moderation-content">
    <header className="moderation-header"><div><span className="section-kicker">{t("TechVerse Moderator")}</span><h1>{t("Kiểm duyệt bài viết")}</h1><p>{t("Xem nội dung từ Author và quản lý hàng đợi kiểm duyệt.")}</p></div><div className="moderation-header-icon"><ClipboardList size={26} /></div></header>
    <section className="moderation-toolbar" aria-label="Bộ lọc bài viết"><form onSubmit={e => { e.preventDefault(); setPage(0); setSelected(null); setQuery(keyword.trim()) }}><label className="moderation-search"><Search size={18} /><span className="sr-only">{t("Tìm kiếm bài viết")}</span><input value={keyword} maxLength={255} onChange={e => setKeyword(e.target.value)} placeholder={t("Tìm theo tiêu đề...")} /></label><button className="button button-primary">{t("Tìm kiếm")}</button></form><label>{t("Trạng thái")}<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); setSelected(null) }}><option value="">{t("Tất cả trạng thái")}</option>{statuses.map(key => <option key={key} value={key}>{statusLabel(key, 'article', language)}</option>)}</select></label></section>
    {error && <p className="moderation-alert error" role="alert">{error}</p>}{message && <p className="moderation-alert success" role="status">{message}</p>}
    <div className="moderation-layout"><section className="moderation-list"><div className="moderation-panel-title"><div><h2>{t("Danh sách bài viết")}</h2><p>{total} {language === 'vi' ? 'bài viết phù hợp' : 'matching articles'}</p></div><FileText size={20} /></div>
      {busy && <p className="moderation-empty" role="status">{t("Đang tải bài viết...")}</p>}{!busy && !items.length && <p className="moderation-empty">{t("Không có bài viết phù hợp.")}</p>}
      <div className="moderation-items">{items.map(item => <button type="button" key={item.id} onClick={() => void open(item.id)} className={`moderation-item ${selected?.article.id === item.id ? 'selected' : ''}`}><span className={`moderation-badge ${item.status.toLowerCase()}`}>{statusLabel(item.status, 'article', language)}</span><strong>{item.title}</strong><span className="moderation-item-summary">{item.summary || t("Chưa có tóm tắt")}</span><small>{item.author.fullName} · {item.topic?.name || t("Chưa phân loại")}</small><small>{formatDate(item.createdAt, language)}</small></button>)}</div>
      <Pagination language={language} page={page} hasNext={hasNext} loading={busy} onPageChange={setPage} /></section>
      <section className="moderation-detail">{detailLoading ? <p className="moderation-empty" role="status">{t("Đang tải nội dung...")}</p> : selected ? <><div className="moderation-detail-head"><span className={`moderation-badge ${selected.article.status.toLowerCase()}`}>{statusLabel(selected.article.status, 'article', language)}</span><h2>{selected.article.title}</h2><p>{selected.author.fullName} · {selected.article.topic?.name || t("Chưa phân loại")} · {formatDate(selected.article.createdAt, language)}</p></div><div className="moderation-detail-body"><h3>{t("Tóm tắt")}</h3><p>{selected.article.summary || t("Chưa có tóm tắt.")}</p>{selected.article.tags?.length > 0 && <div className="moderation-tags">{selected.article.tags.map(tag => <span key={tag.id}>{tag.name}</span>)}</div>}<h3>{t("Nội dung bài viết")}</h3><div key={selected.article.id} className="moderation-article-scroll" role="region" aria-label={t("Nội dung bài viết")} tabIndex={0}><MarkdownContent content={selected.article.content} /></div>{selected.article.moderationNote && <div className="moderation-previous-note"><strong>{t("Nhận xét trước đó")}</strong><p>{selected.article.moderationNote}</p></div>}{selected.article.status === 'PENDING' && <div className="moderation-review"><h3><MessageSquare size={18} /> {t("Nhận xét kiểm duyệt")}</h3><label htmlFor="moderation-note">{t("Nhận xét là bắt buộc khi yêu cầu chỉnh sửa.")}</label><textarea id="moderation-note" maxLength={2000} rows={4} placeholder={t("Nhập nhận xét cho tác giả...")} value={note} onChange={e => setNote(e.target.value)} /><small>{note.length}/2000</small><div className="moderation-review-actions"><button className="button button-outline" disabled={busy || !note.trim()} onClick={() => void review('REQUEST_CHANGES')}>{t("Yêu cầu chỉnh sửa")}</button><button className="button button-primary" disabled={busy} onClick={() => void review('APPROVE')}><CheckCircle2 size={17} />{t("Phê duyệt")}</button></div></div>}</div></> : <div className="moderation-detail-empty"><FileText size={32} /><h2>{t("Chọn bài viết để xem")}</h2><p>{t("Chọn một bài trong danh sách để đọc và kiểm duyệt.")}</p></div>}</section></div>
  </div></main>
}
