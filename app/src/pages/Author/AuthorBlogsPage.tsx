import { statusLabel } from '../../data/managementI18n'
import type { Language } from '../../types/preferences'
import { Pagination } from '../../components/Pagination'
import { useEffect, useRef, useState } from 'react'
import { request } from '../../services/api/client'
import { TagPicker } from '../../components/TagPicker'

type Option = { id: string; name: string }
type Article = { id: string; title: string; summary: string; content: string; status: string; topic: Option; tags: Option[]; moderationNote: string | null; coverImageUrl: string | null }
type Page<T> = { content: T[]; hasNext: boolean }
type Options = { topics: Page<Option>; tags: Page<Option> }
type PendingCover = { file: File; uploadKey: string; preview: string }
const base = '/api/v1/author/articles'

// Quản lý bài viết của tác giả và upload ảnh bìa qua API Cloudinary hiện có.
export function AuthorBlogsPage({ language = 'vi' }: { language?: Language } = {}) {
  const [articles, setArticles] = useState<Article[]>([])
  const [topics, setTopics] = useState<Option[]>([])
  const [tags, setTags] = useState<Option[]>([])
  const [article, setArticle] = useState<Article | null>(null)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [topicId, setTopicId] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [cover, setCover] = useState('')
  const [pendingCover, setPendingCover] = useState<PendingCover | null>(null)
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [optionsError, setOptionsError] = useState('')
  const [optionsLoading, setOptionsLoading] = useState(true)
  const createKey = useRef(crypto.randomUUID())
  const operationInProgress = useRef(false)
  const canEdit = !article || ['DRAFT', 'CHANGES_REQUESTED'].includes(article.status)

  // Giải phóng URL xem trước khi đổi ảnh, bỏ ảnh hoặc rời trang.
  useEffect(() => {
    if (pendingCover) return () => URL.revokeObjectURL(pendingCover.preview)
  }, [pendingCover])

  // Tải danh sách bài viết của chính tác giả theo trang.
  const load = async () => {
    try {
      const data = await request<Page<Article>>(`${base}?page=${page}&size=20`)
      setArticles(data.content)
      setHasNext(data.hasNext)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải bài viết')
    }
  }
  useEffect(() => { void load() }, [page])

  // Tải các chủ đề và thẻ đang được phép chọn.
  const loadOptions = async () => {
    setOptionsLoading(true)
    setOptionsError('')
    try {
      const data = await request<Options>(`${base}/options?topicSize=100&tagSize=100`)
      setTopics(data.topics.content)
      setTags(data.tags.content)
    } catch (e) {
      setOptionsError(e instanceof Error ? e.message : 'Không thể tải chủ đề và thẻ.')
    } finally {
      setOptionsLoading(false)
    }
  }
  useEffect(() => { void loadOptions() }, [])

  // Mở form mới với khóa tạo bài riêng, không kế thừa ảnh của bài trước.
  const fresh = () => {
    if (operationInProgress.current) return
    setArticle(null)
    setTitle('')
    setTopicId('')
    setTagIds([])
    setSummary('')
    setContent('')
    setCover('')
    setPendingCover(null)
    setError('')
    setMessage('')
    createKey.current = crypto.randomUUID()
    setEditing(true)
  }

  // Mở chi tiết bài viết và ảnh bìa đã lưu, khóa chuyển bài khi đang xử lý.
  const open = async (id: string) => {
    if (operationInProgress.current) return
    operationInProgress.current = true
    setBusy(true)
    setError('')
    try {
      const data = await request<Article>(`${base}/${id}`)
      setArticle(data)
      setTitle(data.title)
      setTopicId(data.topic.id)
      setTagIds(data.tags.map(tag => tag.id))
      setSummary(data.summary || '')
      setContent(data.content || '')
      setCover(data.coverImageUrl || '')
      setPendingCover(null)
      setEditing(true)
      setMessage('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải bài viết')
    } finally {
      operationInProgress.current = false
      setBusy(false)
    }
  }

  // Chỉ giữ ảnh hợp lệ để xem trước; chưa upload khi người dùng vừa chọn file.
  const selectCover = (file: File) => {
    if (!canEdit || operationInProgress.current) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
      setError('Chọn ảnh JPEG, PNG hoặc WebP không rỗng, tối đa 5 MB.')
      return
    }
    setPendingCover({ file, uploadKey: crypto.randomUUID(), preview: URL.createObjectURL(file) })
    setError('')
    setMessage('')
  }

  // Bỏ ảnh khỏi bài khi lưu tiếp theo; không xóa trực tiếp tài nguyên Cloudinary.
  const removeCover = () => {
    if (!canEdit || operationInProgress.current) return
    setPendingCover(null)
    setCover('')
    setError('')
    setMessage('')
  }

  // Tạo nháp trước nếu cần, upload ảnh rồi mới lưu hoặc gửi duyệt; giữ trạng thái để retry an toàn.
  const save = async (action: 'SAVE' | 'SUBMIT') => {
    if (!canEdit || operationInProgress.current) return
    setError('')
    setMessage('')
    if (!title.trim() || !topicId) {
      setError('Vui lòng nhập tiêu đề và chọn chủ đề.')
      return
    }
    if (action === 'SUBMIT' && (!summary.trim() || !content.trim())) {
      setError('Để gửi kiểm duyệt, vui lòng nhập cả phần tóm tắt và nội dung bài viết.')
      return
    }
    operationInProgress.current = true
    setBusy(true)
    try {
      let target = article
      let coverImageUrl = cover || null
      const metadata = { title: title.trim(), topicId, tagIds, summary, content }
      if (pendingCover) {
        if (!target) {
          target = await request<Article>(base, {
            method: 'POST', headers: { 'Idempotency-Key': createKey.current },
            body: JSON.stringify({ ...metadata, action: 'SAVE', coverImageUrl: null }),
          })
          setArticle(target)
        }
        const body = new FormData()
        body.append('file', pendingCover.file)
        const uploaded = await request<{ url: string }>(`${base}/${target.id}/images`, {
          method: 'POST', headers: { 'Upload-Key': pendingCover.uploadKey }, body,
        })
        coverImageUrl = uploaded.url
        setCover(uploaded.url)
        setPendingCover(null)
      }
      const data = await request<Article>(target ? `${base}/${target.id}` : base, {
        method: target ? 'PATCH' : 'POST',
        headers: target ? {} : { 'Idempotency-Key': createKey.current },
        body: JSON.stringify({ ...metadata, action, coverImageUrl }),
      })
      setArticle(data)
      setCover(data.coverImageUrl || '')
      setMessage(action === 'SUBMIT' ? 'Đã gửi bài viết để kiểm duyệt.' : 'Đã lưu bài viết.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể lưu bài viết')
    } finally {
      operationInProgress.current = false
      setBusy(false)
    }
  }

  // Nhập Markdown hoặc upload ảnh chèn vào nội dung, tách biệt hoàn toàn với ảnh bìa.
  const upload = async (file: File, image: boolean) => {
    if (!canEdit || operationInProgress.current) return
    if (image && !article) {
      setError('Hãy lưu bản nháp trước khi tải ảnh.')
      return
    }
    if (!image && (!/\.(md|txt)$/i.test(file.name) || file.size > 1024 * 1024)) {
      setError('Chọn tệp .md hoặc .txt mã hóa UTF-8, tối đa 1 MB.')
      return
    }
    operationInProgress.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const body = new FormData()
      body.append('file', file)
      if (image) {
        const data = await request<{ url: string }>(`${base}/${article!.id}/images`, {
          method: 'POST', headers: { 'Upload-Key': crypto.randomUUID() }, body,
        })
        setContent(value => `${value}\n![Ảnh](${data.url})\n`)
      } else {
        const data = await request<{ content: string; warnings: string[] }>(`${base}/import`, { method: 'POST', body })
        setContent(data.content)
        setMessage(data.warnings.join(' ') || 'Đã nhập nội dung. Hãy lưu bài viết để giữ thay đổi.')
      }
    } catch (e) {
      setError(e instanceof Error ? `Không thể nhập tệp: ${e.message}` : 'Không thể tải tệp')
    } finally {
      operationInProgress.current = false
      setBusy(false)
    }
  }

  return <main className="page-content article-page"><div className="article-content">
    <span className="section-kicker">TechVerse Author</span>
    <header className="article-header"><div><h1>Blog của tôi</h1><p>Viết và quản lý bài viết của bạn.</p></div>
      <button className="button button-primary" disabled={busy} onClick={fresh}>+ Tạo bài viết</button>
    </header>
    {optionsLoading && <p role="status">Đang tải chủ đề và thẻ...</p>}
    {optionsError && <p className="article-error" role="alert">Không tải được chủ đề và thẻ: {optionsError} <button type="button" onClick={() => void loadOptions()}>Thử lại</button></p>}
    {!optionsLoading && !optionsError && !topics.length && <p role="status">Chưa có chủ đề hoạt động. Hãy liên hệ admin để tạo chủ đề trước khi lưu bài viết.</p>}
    {!optionsLoading && !optionsError && !tags.length && <p role="status">Chưa có thẻ hoạt động; thẻ là tùy chọn.</p>}
    {error && <p className="article-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <div className="article-grid">
      <section className="article-panel"><h2>Bài viết</h2>
        {!articles.length && <p>Chưa có bài viết để hiển thị.</p>}
        {articles.map(item => <button key={item.id} className="application-row" disabled={busy} onClick={() => void open(item.id)}>
          <span><strong>{item.title}</strong><small>{item.summary}</small></span><span>{statusLabel(item.status, 'article', language)}</span>
        </button>)}
        <Pagination language={language} page={page} hasNext={hasNext} loading={busy} onPageChange={setPage} />
      </section>
      <section className="article-panel">{editing ? <>
        <h2>{article ? 'Chi tiết bài viết' : 'Bài viết mới'}</h2>
        {article && <p>Trạng thái: <strong>{statusLabel(article.status, 'article', language)}</strong></p>}
        {article?.moderationNote && <p>Nhận xét: {article.moderationNote}</p>}
        <fieldset disabled={!canEdit || busy} className="article-form">
          <label>Tiêu đề *<input value={title} maxLength={255} onChange={e => setTitle(e.target.value)} /></label>
          <label>Chủ đề *<select value={topicId} onChange={e => setTopicId(e.target.value)}>
            <option value="">Chọn chủ đề</option>
            {article?.topic && !topics.some(t => t.id === article.topic.id) && <option value={article.topic.id}>{article.topic.name}</option>}
            {topics.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}
          </select></label>
          <TagPicker options={[...tags, ...(article?.tags.filter(tag => !tags.some(option => option.id === tag.id)) || [])]} selected={tagIds} onChange={setTagIds} disabled={!canEdit || busy} />
          <label>Tóm tắt<textarea maxLength={500} rows={3} value={summary} onChange={e => setSummary(e.target.value)} /></label>
          <label>Nội dung Markdown<textarea rows={12} value={content} onChange={e => setContent(e.target.value)} /></label>
          <div className="article-cover">
            <label htmlFor="article-cover-file">Ảnh bìa</label>
            <input id="article-cover-file" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="article-cover-help" onChange={e => {
              const file = e.target.files?.[0]
              if (file) selectCover(file)
              e.target.value = ''
            }} />
            <small id="article-cover-help">Chọn ảnh từ máy (JPEG, PNG, WebP), tối đa 5 MB. Ảnh được tải lên khi lưu hoặc gửi duyệt.</small>
            {(pendingCover || cover) && <div className="article-cover-preview">
              <img src={pendingCover?.preview || cover} alt="Xem trước ảnh bìa" />
              <button type="button" className="button button-outline" onClick={removeCover}>Bỏ ảnh bìa</button>
            </div>}
          </div>
          <label>Nhập tệp Markdown (.md, .txt)<input type="file" accept=".md,.txt,text/plain,text/markdown" onChange={e => {
            const file = e.target.files?.[0]
            if (file) void upload(file, false)
            e.target.value = ''
          }} /></label>
          <label>Tải ảnh vào nội dung (lưu nháp trước)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!article} onChange={e => {
            const file = e.target.files?.[0]
            if (file) void upload(file, true)
            e.target.value = ''
          }} /></label>
          <div className="applications-actions">
            <button type="button" className="button button-outline" onClick={() => void save('SAVE')}>Lưu nháp</button>
            <button type="button" className="button button-primary" onClick={() => void save('SUBMIT')}>Gửi kiểm duyệt</button>
          </div>
          {busy && <small role="status">Đang xử lý, vui lòng đợi...</small>}
        </fieldset>
      </> : <p>Chọn bài viết hoặc tạo bài mới.</p>}</section>
    </div>
  </div></main>
}
