import { Pagination } from '../../components/Pagination'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Clock3, FileText } from 'lucide-react'
import { request } from '../../services/api/client'
import { MarkdownContent } from '../../components/MarkdownContent'

type Taxonomy = { id: string; name: string }
type Article = { id: string; title: string; summary: string; content?: string; coverImageUrl: string | null; author: { id: string; fullName: string; avatarUrl: string | null }; topic: Taxonomy; tags: Taxonomy[]; publishedAt: string | null; relatedArticles?: { id: string; title: string; coverImageUrl: string | null; publishedAt: string | null }[] }
type Page<T> = { content: T[]; hasNext: boolean }
type Options = { topics: Page<Taxonomy>; tags: Page<Taxonomy> }
const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString('vi-VN') : ''

export function BlogsPage() {
  const [items, setItems] = useState<Article[]>([]); const [options, setOptions] = useState<Options | null>(null); const [keyword, setKeyword] = useState(''); const [query, setQuery] = useState(''); const [topicId, setTopicId] = useState(''); const [tagId, setTagId] = useState(''); const [page, setPage] = useState(0); const [hasNext, setHasNext] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [optionsError, setOptionsError] = useState('')
  useEffect(() => { let active = true; request<Options>('/api/v1/articles/options?topicSize=100&tagSize=100').then(data => { if (active) setOptions(data) }).catch(e => { if (active) setOptionsError(e instanceof Error ? e.message : 'Không tải được bộ lọc') }); return () => { active = false } }, [])
  useEffect(() => { let active = true; setLoading(true); setError(''); const params = new URLSearchParams({ page: String(page), size: '12' }); if (query) params.set('keyword', query); if (topicId) params.set('topicId', topicId); if (tagId) params.set('tagId', tagId); request<Page<Article>>(`/api/v1/articles?${params}`).then(data => { if (active) { setItems(data.content); setHasNext(data.hasNext) } }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Không tải được bài viết') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [page, query, topicId, tagId])
  return <main className="page-content blogs-page"><div className="blogs-content"><span className="section-kicker">TechVerse Journal</span><h1>Bài viết</h1><p className="blogs-lede">Khám phá kiến thức và kinh nghiệm từ cộng đồng TechVerse.</p><form className="blogs-filters" onSubmit={e => { e.preventDefault(); setPage(0); setQuery(keyword.trim()) }}><label>Tìm theo tiêu đề<input maxLength={255} value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Tìm bài viết..." /></label><button className="button button-primary">Tìm kiếm</button><label>Chủ đề<select value={topicId} onChange={e => { setPage(0); setTopicId(e.target.value) }}><option value="">Tất cả</option>{options?.topics.content.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label>Thẻ<select value={tagId} onChange={e => { setPage(0); setTagId(e.target.value) }}><option value="">Tất cả</option>{options?.tags.content.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label></form>{optionsError && <p role="alert" className="article-error">Không tải được bộ lọc: {optionsError}</p>}{loading && <p role="status">Đang tải bài viết...</p>}{error && <p className="article-error" role="alert">{error}</p>}{!loading && !error && !items.length && <div className="blogs-empty"><BookOpen size={32} /><h2>Chưa có bài viết phù hợp</h2><p>Hãy thử thay đổi bộ lọc hoặc quay lại sau.</p></div>}<div className="blogs-grid">{!error && items.map(article => <Link className="blogs-card" to={`/blogs/${article.id}`} key={article.id}>{article.coverImageUrl ? <img src={article.coverImageUrl} alt="" /> : <div className="blogs-card-art"><FileText size={34} /></div>}<div className="blogs-card-body"><span className="section-kicker">{article.topic.name}</span><h2>{article.title}</h2><p>{article.summary}</p><div className="blogs-card-meta"><span>{article.author.fullName}{article.publishedAt ? ` · ${formatDate(article.publishedAt)}` : ''}</span><ArrowRight size={17} /></div></div></Link>)}</div><Pagination page={page} hasNext={hasNext} loading={loading} onPageChange={setPage} /></div></main>
}


// Hiển thị bài đọc có định dạng cùng sidebar; loại phản hồi cũ khi chuyển bài liên quan.
export function BlogDetailPage() {
  const { id } = useParams()
  const [article, setArticle] = useState<Article | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setArticle(null)
    request<Article>(`/api/v1/articles/${encodeURIComponent(id || '')}`)
      .then(data => { if (active) setArticle(data) })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Không tải được bài viết') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  const readingMinutes = Math.max(1, Math.ceil((article?.content || '').split(/\s+/).filter(Boolean).length / 220))

  return <main className="page-content blogs-page blogs-detail-page"><div className="blogs-detail-shell">
    <Link className="blogs-back" to="/blogs"><ArrowLeft size={17} /> Quay lại bài viết</Link>
    {loading && <p role="status">Đang tải bài viết...</p>}
    {error && <p role="alert" className="article-error">{error}</p>}
    {article && <div className="blogs-reading-layout">
      <article className="blogs-reader">
        <header className="blogs-article-heading">
          <span className="blogs-topic-label"><BookOpen size={15} />{article.topic.name}</span>
          <h1>{article.title}</h1>
          <div className="blogs-reader-byline">
            <span className="blogs-byline-author">{article.author.avatarUrl ? <img src={article.author.avatarUrl} alt="" /> : <span className="blogs-author-initial" aria-hidden="true">{article.author.fullName.slice(0, 1).toUpperCase()}</span>}{article.author.fullName}</span>
            {article.publishedAt && <time dateTime={article.publishedAt}><CalendarDays size={14} />{formatDate(article.publishedAt)}</time>}
            <span><Clock3 size={14} />{readingMinutes} phút đọc</span>
          </div>
        </header>
        {article.summary && <section className="blogs-summary" aria-label="Tóm tắt bài viết"><strong>Tóm tắt</strong><p>{article.summary}</p></section>}
        {!!article.tags.length && <div className="blogs-tags">{article.tags.map(tag => <span key={tag.id}>#{tag.name}</span>)}</div>}
        {article.coverImageUrl && <img className="blogs-cover" src={article.coverImageUrl} alt={`Ảnh bìa: ${article.title}`} />}
        <MarkdownContent content={article.content || ''} />
      </article>
      <aside className="blogs-reading-sidebar" aria-label="Thông tin bài viết">
        <section className="blogs-sidebar-panel">
          <h2>Về tác giả</h2>
          <div className="blogs-author-card">
            {article.author.avatarUrl ? <img src={article.author.avatarUrl} alt="" /> : <span className="blogs-author-initial" aria-hidden="true">{article.author.fullName.slice(0, 1).toUpperCase()}</span>}
            <div><strong>{article.author.fullName}</strong><small>Tác giả trên TechVerse</small></div>
          </div>
        </section>
        <section className="blogs-sidebar-panel blogs-related">
          <div className="blogs-sidebar-heading"><h2>Bài viết liên quan</h2><BookOpen size={16} /></div>
          {article.relatedArticles?.length ? <div className="blogs-related-list">{article.relatedArticles.map(related =>
            <Link className="blogs-related-card" key={related.id} to={`/blogs/${related.id}`}>
              <span className="blogs-related-image">{related.coverImageUrl ? <img src={related.coverImageUrl} alt="" loading="lazy" /> : <FileText size={23} />}</span>
              <span className="blogs-related-copy"><strong>{related.title}</strong>{related.publishedAt && <time dateTime={related.publishedAt}>{formatDate(related.publishedAt)}</time>}</span>
            </Link>)}</div> : <p className="blogs-sidebar-empty">Chưa có bài viết liên quan.</p>}
          <Link className="blogs-view-all" to="/blogs">Khám phá tất cả bài viết <ArrowRight size={15} /></Link>
        </section>
        <div className="blogs-reading-note"><span>TECHVERSE JOURNAL</span><p>Một chút kiến thức mới,<br />mỗi ngày.</p></div>
      </aside>
    </div>}
  </div></main>
}
