import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ArticleEditorPage } from './ArticleEditorPage'
import { setAccessToken } from '../../services/api/client'
import type { AuthorArticle } from '../../types/articles'

const base = '/api/v1/author/articles'
const managed = (key: string) => `https://res.cloudinary.com/demo/image/upload/v1/articles/author-1/art-1/${key}.png`
const topic = { id: 'java', name: 'Java', active: true }
const draft = (over: Partial<AuthorArticle> = {}): AuthorArticle => ({
  id: 'art-1', authorId: 'author-1', title: 'OOP Java', summary: 'Learn OOP', content: 'Intro\n\n![sơ đồ](./img/a.png)\n\n![ok](' + managed('k0') + ')', coverImageUrl: null,
  topic, tags: [], workflowStatus: 'DRAFT', publicationStatus: 'UNPUBLISHED', hasUnpublishedChanges: true, publishedVersion: null,
  imageIssues: [{ type: 'LOCAL_FILE', alt: 'sơ đồ', source: './img/a.png', occurrence: 1, line: 3, column: 1, filename: 'a.png' }],
  moderationNote: null, reviewedBy: null, reviewedAt: null, publishedAt: null, createdAt: '2026-11-04T09:00:00Z', createdBy: 'author-1', updatedAt: '2026-11-04T10:42:00Z', updatedBy: 'author-1', ...over,
})
const fetchMock = vi.fn<typeof fetch>()
let article: AuthorArticle | null
let uploadStatus: number[]
let location = ''
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ status, message: 'x', code: status === 429 ? 'ARTICLE_RATE_LIMITED' : undefined, data }), { status })
const calls = () => fetchMock.mock.calls.map(([url, init]) => ({ path: new URL(String(url)).pathname, method: init?.method || 'GET', headers: new Headers(init?.headers), body: init?.body }))
const writes = () => calls().filter(c => c.method !== 'GET')
const png = (name: string, size = 10) => { const f = new File(['x'], name, { type: 'image/png' }); Object.defineProperty(f, 'size', { value: size }); return f }

async function backend(input: RequestInfo | URL, init?: RequestInit) {
  const path = new URL(String(input)).pathname
  const method = init?.method || 'GET'
  if (path.endsWith('/options')) return response({ topics: { content: [topic], hasNext: false }, tags: { content: [{ id: 'spring', name: 'Spring', active: true }], hasNext: false } })
  if (path.endsWith('/images')) {
    const status = uploadStatus.shift() ?? 200
    return status === 200 ? response({ url: managed(`up${calls().length}`), publicId: 'p', width: 1, height: 1, uploadKey: 'k' }) : response(null, status)
  }
  if (method === 'GET') return article ? response(article) : new Response(JSON.stringify({ status: 404, code: 'ARTICLE_NOT_FOUND', message: 'Article not found' }), { status: 404 })
  if (method === 'POST' && path === base) {
    const body = JSON.parse(String(init?.body))
    article = draft({ ...body, imageIssues: [], content: body.content ?? '', topic })
    return response(article, 201)
  }
  if (path.endsWith('/withdraw')) { article = { ...article!, workflowStatus: 'DRAFT' }; return response(article) }
  const body = JSON.parse(String(init?.body))
  article = { ...article!, ...body, workflowStatus: body.action === 'SUBMIT' ? 'PENDING' : article!.workflowStatus, imageIssues: [] }
  return response(article)
}

function Where() { location = useLocation().pathname; return null }
function renderAt(path: string, language: 'vi' | 'en' = 'vi') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/author/blogs/new" element={<ArticleEditorPage language={language} />} />
    <Route path="/author/blogs/:id/edit" element={<ArticleEditorPage language={language} />} />
    <Route path="/author/blogs" element={<p>Workspace</p>} />
  </Routes><Where /></MemoryRouter>)
}

beforeEach(() => {
  setAccessToken('t')
  article = draft()
  uploadStatus = []
  fetchMock.mockReset().mockImplementation(backend)
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

it('new article: image upload is locked until title/topic, then auto-saves once and uploads', async () => {
  article = null
  const user = userEvent.setup({ applyAccept: false })
  renderAt('/author/blogs/new')
  const insert = await screen.findByRole('button', { name: 'Chèn ảnh' })
  expect((insert as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('Nhập tiêu đề, chủ đề và lưu nháp trước')).toBeTruthy()
  await user.type(screen.getByLabelText('Tiêu đề'), 'OOP Java')
  await user.selectOptions(await screen.findByLabelText('Chủ đề'), 'java')
  expect((screen.getByRole('button', { name: 'Chèn ảnh' }) as HTMLButtonElement).disabled).toBe(false)
  await user.upload(screen.getByLabelText('Tệp ảnh chèn vào nội dung'), png('pic.png'))
  await waitFor(() => expect(writes().map(c => `${c.method} ${c.path}`)).toEqual(['POST /api/v1/author/articles', 'POST /api/v1/author/articles/art-1/images']))
  expect(writes()[0].headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/)
  expect(JSON.parse(String(writes()[0].body))).toMatchObject({ action: 'SAVE', title: 'OOP Java', topicId: 'java' })
  await waitFor(() => expect((screen.getByLabelText('Nội dung Markdown') as HTMLTextAreaElement).value).toContain('/articles/author-1/art-1/'))
  await waitFor(() => expect(location).toBe("/author/blogs/art-1/edit"))
  expect((screen.getByLabelText('Tiêu đề') as HTMLInputElement).value).toBe('OOP Java')
})

it('lists image issues, locks submit, replaces by source+occurrence and saves only changed fields', async () => {
  const user = userEvent.setup({ applyAccept: false })
  renderAt('/author/blogs/art-1/edit')
  const panel = await screen.findByRole('region', { name: '1 ảnh cần tải lên' })
  expect(panel.textContent).toContain('./img/a.png')
  expect(panel.textContent).toMatch(/dòng 3/)
  expect((screen.getByRole('button', { name: 'Gửi duyệt' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('Còn 1 ảnh cần tải lên')).toBeTruthy()
  await user.upload(within(panel).getByLabelText('Tệp thay thế cho ảnh 1'), png('a.png'))
  await waitFor(() => expect(screen.queryByRole('region', { name: /ảnh cần tải lên/ })).toBeNull())
  const content = (screen.getByLabelText('Nội dung Markdown') as HTMLTextAreaElement).value
  expect(content).not.toContain('./img/a.png')
  expect(content).toMatch(/!\[sơ đồ\]\(https:\/\/res\.cloudinary\.com\/.*\/art-1\/up\d+\.png\)/)
  await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
  await waitFor(() => expect(writes().filter(c => c.method === 'PATCH')).toHaveLength(1))
  expect(Object.keys(JSON.parse(String(writes().find(c => c.method === 'PATCH')!.body))).sort()).toEqual(['action', 'content'])
  expect((screen.getByRole('button', { name: 'Gửi duyệt' }) as HTMLButtonElement).disabled).toBe(false)
})

it('never rewrites a stale target and reports size/rate-limit errors on the issue row', async () => {
  const user = userEvent.setup({ applyAccept: false })
  renderAt('/author/blogs/art-1/edit')
  const panel = await screen.findByRole('region', { name: '1 ảnh cần tải lên' })
  await user.upload(within(panel).getByLabelText('Tệp thay thế cho ảnh 1'), png('a.png', 6 * 1024 * 1024))
  expect(within(panel).getByText(/5 MiB/)).toBeTruthy()
  expect(writes()).toHaveLength(0)
  uploadStatus = [429]
  await user.upload(within(panel).getByLabelText('Tệp thay thế cho ảnh 1'), png('a.png'))
  expect(await within(panel).findByText('Thao tác quá nhanh, hãy thử lại sau.')).toBeTruthy()
  await user.click(within(panel).getByRole('button', { name: 'Thử lại' }))
  await waitFor(() => expect(screen.queryByRole('region', { name: /ảnh cần tải lên/ })).toBeNull())
  expect(writes().filter(c => c.path.endsWith('/images'))).toHaveLength(2)
  expect(writes()[0].headers.get('Upload-Key')).toBe(writes()[1].headers.get('Upload-Key'))

  cleanup()
  article = draft()
  renderAt('/author/blogs/art-1/edit')
  const fresh = await screen.findByRole('region', { name: '1 ảnh cần tải lên' })
  const editor = screen.getByLabelText('Nội dung Markdown')
  fireEvent.change(editor, { target: { value: 'Moved\n\n\n\n![sơ đồ](./img/a.png)' } })
  const before = writes().length
  await user.upload(within(fresh).getByLabelText('Tệp thay thế cho ảnh 1'), png('a.png'))
  expect(within(fresh).getByText(/Lưu nháp để cập nhật danh sách ảnh/)).toBeTruthy()
  expect(writes()).toHaveLength(before)
  expect((editor as HTMLTextAreaElement).value).toContain('./img/a.png')
})

it('matches several picked files to issues by filename', async () => {
  article = draft({ content: '![a](./img/a.png)\n![b](https://x.example/b.jpg)', imageIssues: [
    { type: 'LOCAL_FILE', alt: 'a', source: './img/a.png', occurrence: 1, line: 1, column: 1, filename: 'a.png' },
    { type: 'EXTERNAL_URL', alt: 'b', source: 'https://x.example/b.jpg', occurrence: 1, line: 2, column: 1, filename: 'b.jpg' },
  ] })
  const user = userEvent.setup({ applyAccept: false })
  renderAt('/author/blogs/art-1/edit')
  const panel = await screen.findByRole('region', { name: '2 ảnh cần tải lên' })
  await user.upload(within(panel).getByLabelText('Tệp ảnh ghép theo tên'), [png('b.jpg'), png('zzz.png')])
  expect(await within(panel).findByText(/zzz\.png/)).toBeTruthy()
  await waitFor(() => expect(screen.getByRole('region', { name: '1 ảnh cần tải lên' })).toBeTruthy())
  expect((screen.getByLabelText('Nội dung Markdown') as HTMLTextAreaElement).value).not.toContain('x.example')
})

it('preview renders managed images only, a placeholder for the rest, and no reading time', async () => {
  renderAt('/author/blogs/art-1/edit')
  const preview = await screen.findByRole('region', { name: 'Xem trước' })
  expect(await within(preview).findByRole('heading', { name: 'OOP Java' })).toBeTruthy()
  const sources = [...preview.querySelectorAll('img')].map(img => img.getAttribute('src'))
  expect(sources).toEqual([managed('k0')])
  expect(within(preview).getByText('Ảnh cần tải lên')).toBeTruthy()
  expect(preview.textContent).not.toMatch(/phút đọc|min read/)
})

it('pending article is read-only with a withdraw action behind AlertDialog', async () => {
  article = draft({ workflowStatus: 'PENDING', imageIssues: [] })
  const user = userEvent.setup()
  renderAt('/author/blogs/art-1/edit')
  expect(await screen.findByText(/Đang chờ duyệt/)).toBeTruthy()
  // Existing articles open with the metadata card collapsed so the writing area stays above the fold.
  expect(screen.queryByLabelText('Tiêu đề')).toBeNull()
  await user.click(screen.getByRole('button', { name: /Thông tin bài/ }))
  expect((screen.getByLabelText('Tiêu đề') as HTMLInputElement).readOnly).toBe(true)
  expect(screen.queryByRole('button', { name: 'Lưu nháp' })).toBeNull()
  await user.click(screen.getAllByRole('button', { name: 'Rút lại' })[0])
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Rút lại' }))
  await waitFor(() => expect(writes().map(c => c.path)).toEqual([`${base}/art-1/withdraw`]))
  await waitFor(() => expect((screen.getByLabelText('Tiêu đề') as HTMLInputElement).readOnly).toBe(false))
})

it('guards unsaved changes on editor navigation and on tab close', async () => {
  const user = userEvent.setup()
  renderAt('/author/blogs/art-1/edit')
  await user.click(await screen.findByRole('button', { name: /Thông tin bài/ }))
  await user.type(screen.getByLabelText('Tiêu đề'), '!')
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  await user.click(screen.getByRole('link', { name: 'Bài viết của tôi' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Ở lại' }))
  await waitFor(() => expect(location).toBe("/author/blogs/art-1/edit"))
  await user.click(screen.getByRole('link', { name: 'Bài viết của tôi' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Rời trang' }))
  expect(await screen.findByText('Workspace')).toBeTruthy()
})

it('shows not-found for someone else’s article and English copy', async () => {
  article = null
  renderAt('/author/blogs/zzz/edit', 'en')
  expect(await screen.findByText('Article not found')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Back to my articles' }).getAttribute('href')).toBe('/author/blogs')
})

it('preview refuses a managed-looking URL the backend still lists as an image issue', async () => {
  const foreign = managed('foreign')
  article = draft({ content: `![x](${foreign})\n\n![ok](${managed('k0')})`, imageIssues: [{ type: 'UNMANAGED_ASSET', alt: 'x', source: foreign, occurrence: 1, line: 1, column: 1, filename: 'foreign.png' }] })
  renderAt('/author/blogs/art-1/edit')
  const preview = await screen.findByRole('region', { name: 'Xem trước' })
  await within(preview).findByRole('heading', { name: 'OOP Java' })
  expect([...preview.querySelectorAll('img')].map(img => img.getAttribute('src'))).toEqual([managed('k0')])
})

it('locks the form while a save is in flight so a late response cannot drop new typing', async () => {
  let finish!: () => void
  fetchMock.mockImplementation(async (input, init) => (init?.method === 'PATCH' ? new Promise<void>(resolve => { finish = resolve }).then(() => backend(input, init)) : backend(input, init)))
  const user = userEvent.setup()
  renderAt('/author/blogs/art-1/edit')
  fireEvent.change(await screen.findByLabelText('Nội dung Markdown'), { target: { value: 'Mới' } })
  await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
  expect((screen.getByLabelText('Nội dung Markdown') as HTMLTextAreaElement).readOnly).toBe(true)
  finish()
  await waitFor(() => expect((screen.getByLabelText('Nội dung Markdown') as HTMLTextAreaElement).readOnly).toBe(false))
})

it('hiding keeps unsaved edits in the form', async () => {
  article = draft({ workflowStatus: 'PUBLISHED', publicationStatus: 'PUBLISHED', imageIssues: [] })
  fetchMock.mockImplementation(async (input, init) => init?.method === 'PATCH' && String(input).endsWith('/publication')
    ? response({ ...article!, publicationStatus: 'AUTHOR_HIDDEN' }) : backend(input, init))
  const user = userEvent.setup()
  renderAt('/author/blogs/art-1/edit')
  fireEvent.change(await screen.findByLabelText('Nội dung Markdown'), { target: { value: 'Chưa lưu' } })
  await user.click(screen.getByRole('button', { name: 'Thao tác khác cho OOP Java' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Ẩn bài' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Ẩn bài' }))
  expect(await screen.findByText('Bạn đang ẩn bài.')).toBeTruthy()
  expect((screen.getByLabelText('Nội dung Markdown') as HTMLTextAreaElement).value).toBe('Chưa lưu')
})

it('shows a retryable error when topics/tags fail to load, and 413 copy for an oversized import', async () => {
  let failOptions = true
  fetchMock.mockImplementation(async (input, init) => failOptions && String(input).includes('/options') ? response(null, 503) : backend(input, init))
  article = null
  const user = userEvent.setup({ applyAccept: false })
  renderAt('/author/blogs/new')
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('Hệ thống tạm thời gián đoạn')
  failOptions = false
  await user.click(within(alert).getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('option', { name: 'Java' })).toBeTruthy()
  const big = new File(['x'], 'big.md', { type: 'text/markdown' })
  Object.defineProperty(big, 'size', { value: 2 * 1024 * 1024 })
  await user.upload(screen.getByLabelText('Tệp Markdown'), big)
  expect(await screen.findByText('Tệp hoặc nội dung vượt giới hạn dung lượng.')).toBeTruthy()
})

it('locks the image panel while a save is in flight so the save response cannot undo an image change', async () => {
  let finish!: () => void
  fetchMock.mockImplementation(async (input, init) => (init?.method === 'PATCH' ? new Promise<void>(resolve => { finish = resolve }).then(() => backend(input, init)) : backend(input, init)))
  const user = userEvent.setup({ applyAccept: false })
  renderAt('/author/blogs/art-1/edit')
  const panel = await screen.findByRole('region', { name: '1 ảnh cần tải lên' })
  fireEvent.change(screen.getByLabelText('Nội dung Markdown'), { target: { value: `${article!.content} ` } })
  await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
  for (const name of ['Tải ảnh thay thế', 'Bỏ ảnh', 'Chọn nhiều ảnh – tự ghép theo tên file']) expect((within(panel).getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
  // Even if a file input fires (e.g. picker opened before the save), no upload starts during the save.
  await user.upload(within(panel).getByLabelText('Tệp thay thế cho ảnh 1'), png('a.png'))
  expect(writes().filter(c => c.path.endsWith('/images'))).toHaveLength(0)
  finish()
  await waitFor(() => expect((screen.getByRole('button', { name: 'Lưu nháp' }) as HTMLButtonElement).disabled).toBe(false))
})
