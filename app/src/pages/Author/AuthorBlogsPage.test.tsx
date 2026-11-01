import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthorBlogsPage } from './AuthorBlogsPage'
import { setAccessToken } from '../../services/api/client'

const base = '/api/v1/author/articles'
const coverUrl = 'https://res.cloudinary.com/demo/image/upload/v1/articles/cover.png'
const oldCover = 'https://res.cloudinary.com/demo/image/upload/v1/articles/old.png'
const draft = { id: 'draft-1', title: 'OOP Java', summary: 'Learn OOP', content: '# OOP', status: 'DRAFT', topic: { id: 'java', name: 'Java' }, tags: [], moderationNote: null, coverImageUrl: null as string | null }
const fetchMock = vi.fn<typeof fetch>()
let writes: { method: string; path: string; body: unknown; uploadKey: string | null }[]
let existing: typeof draft | null
let uploadFailures: number
let patchFailures: number
let tagOptions: { id: string; name: string }[]

// Return a backend envelope without replacing any frontend upload or save behavior.
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ status, message: status === 200 ? 'OK' : 'Temporary failure', data }), { status })
}

// Model editable drafts and enforce upload-before-save ordering at the HTTP boundary.
async function backend(input: RequestInfo | URL, options?: RequestInit) {
  const path = new URL(String(input)).pathname
  const method = options?.method || 'GET'
  if (method === 'GET') {
    if (path.endsWith('/options')) return response({ topics: { content: [draft.topic], hasNext: false }, tags: { content: tagOptions, hasNext: false } })
    if (path === `${base}/${draft.id}`) return response(existing || draft)
    return response({ content: existing ? [existing] : [], hasNext: false })
  }
  const body = options?.body instanceof FormData ? options.body : JSON.parse(String(options?.body))
  writes.push({ method, path, body, uploadKey: new Headers(options?.headers).get('Upload-Key') })
  if (path.endsWith('/images')) {
    if (uploadFailures-- > 0) return response(null, 503)
    return response({ url: coverUrl, uploadKey: new Headers(options?.headers).get('Upload-Key'), publicId: 'cover', width: 800, height: 450 })
  }
  if (method === 'PATCH' && patchFailures-- > 0) return response(null, 503)
  return response({ ...draft, ...body, status: body.action === 'SUBMIT' ? 'PENDING' : draft.status })
}

// Open an unsaved article and fill the required metadata using the real form.
async function newArticle() {
  const user = userEvent.setup({ applyAccept: false })
  render(<AuthorBlogsPage />)
  await screen.findByText('Chưa có bài viết để hiển thị.')
  await user.click(screen.getByRole('button', { name: '+ Tạo bài viết' }))
  await user.type(screen.getByLabelText('Tiêu đề *'), 'OOP Java')
  await user.selectOptions(screen.getByLabelText('Chủ đề *'), 'java')
  await user.type(screen.getByLabelText('Tóm tắt'), 'Learn OOP')
  await user.type(screen.getByLabelText('Nội dung Markdown'), '# OOP')
  return user
}

// Open an existing draft to test replacing/removing its persisted cover.
async function openDraft() {
  const user = userEvent.setup({ applyAccept: false })
  render(<AuthorBlogsPage />)
  await user.click(await screen.findByRole('button', { name: /OOP Java/ }))
  await screen.findByText('Chi tiết bài viết')
  return user
}

beforeEach(() => {
  setAccessToken('test-author-access')
  writes = []
  existing = null
  uploadFailures = 0
  patchFailures = 0
  tagOptions = []
  fetchMock.mockReset().mockImplementation(backend)
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('URL', URL)
  URL.createObjectURL = vi.fn(() => 'blob:cover-preview')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

it('selects a local cover with preview, then creates draft, uploads and submits in order', async () => {
  const user = await newArticle()
  expect(screen.queryByLabelText('URL ảnh bìa')).toBeNull()
  const file = new File(['image'], 'cover.png', { type: 'image/png' })
  await user.upload(screen.getByLabelText('Ảnh bìa'), file)
  expect(screen.getByRole('img', { name: 'Xem trước ảnh bìa' }).getAttribute('src')).toBe('blob:cover-preview')
  expect(writes).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: 'Gửi kiểm duyệt' }))
  await screen.findByText('Đã gửi bài viết để kiểm duyệt.')
  expect(writes.map(write => [write.method, write.path])).toEqual([
    ['POST', base], ['POST', `${base}/${draft.id}/images`], ['PATCH', `${base}/${draft.id}`],
  ])
  expect(writes[0].body).toMatchObject({ action: 'SAVE', coverImageUrl: null })
  expect((writes[1].body as FormData).get('file')).toBe(file)
  expect(writes[1].uploadKey).toMatch(/^[a-f0-9-]{36}$/)
  expect(writes[2].body).toMatchObject({ action: 'SUBMIT', content: '# OOP', coverImageUrl: coverUrl })
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cover-preview')
})

it.each([
  ['text.txt', 'text/plain', 5],
  ['large.png', 'image/png', 5 * 1024 * 1024 + 1],
  ['empty.png', 'image/png', 0],
])('rejects invalid local cover %s before making upload requests', async (name, type, size) => {
  const user = await newArticle()
  await user.upload(screen.getByLabelText('Ảnh bìa'), new File([new Uint8Array(size)], name, { type }))
  expect((await screen.findByRole('alert')).textContent).toMatch(/JPEG|PNG|WebP|5 MB/)
  expect(writes).toHaveLength(0)
  expect(screen.queryByRole('img', { name: 'Xem trước ảnh bìa' })).toBeNull()
})

it('keeps the draft and reuses the upload key when retrying a failed cover upload', async () => {
  uploadFailures = 1
  const user = await newArticle()
  await user.upload(screen.getByLabelText('Ảnh bìa'), new File(['image'], 'cover.webp', { type: 'image/webp' }))
  await user.click(screen.getByRole('button', { name: 'Gửi kiểm duyệt' }))
  await screen.findByRole('alert')
  expect(writes.filter(write => write.method === 'PATCH')).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: 'Gửi kiểm duyệt' }))
  await screen.findByText('Đã gửi bài viết để kiểm duyệt.')
  expect(writes.filter(write => write.path === base)).toHaveLength(1)
  const uploads = writes.filter(write => write.path.endsWith('/images'))
  expect(uploads).toHaveLength(2)
  expect(uploads[0].uploadKey).toBe(uploads[1].uploadKey)
})

it('does not upload the cover again when retrying a failed final save', async () => {
  patchFailures = 1
  const user = await newArticle()
  await user.upload(screen.getByLabelText('Ảnh bìa'), new File(['image'], 'cover.png', { type: 'image/png' }))
  await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
  await screen.findByRole('alert')
  await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
  await screen.findByText('Đã lưu bài viết.')
  expect(writes.filter(write => write.path.endsWith('/images'))).toHaveLength(1)
  expect(writes.filter(write => write.method === 'PATCH')).toHaveLength(2)
  expect(writes.at(-1)?.body).toMatchObject({ coverImageUrl: coverUrl })
})

it('replaces an existing cover without creating another draft', async () => {
  existing = { ...draft, coverImageUrl: oldCover } as typeof draft
  const user = await openDraft()
  expect(screen.getByRole('img', { name: 'Xem trước ảnh bìa' }).getAttribute('src')).toBe(oldCover)
  await user.upload(screen.getByLabelText('Ảnh bìa'), new File(['image'], 'cover.jpeg', { type: 'image/jpeg' }))
  await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
  await screen.findByText('Đã lưu bài viết.')
  expect(writes.map(write => write.path)).toEqual([`${base}/${draft.id}/images`, `${base}/${draft.id}`])
  expect(writes.at(-1)?.body).toMatchObject({ coverImageUrl: coverUrl })
})

it('removes a persisted cover by saving null without uploading another image', async () => {
  existing = { ...draft, coverImageUrl: oldCover } as typeof draft
  const user = await openDraft()
  await user.click(screen.getByRole('button', { name: 'Bỏ ảnh bìa' }))
  await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
  await screen.findByText('Đã lưu bài viết.')
  expect(writes).toHaveLength(1)
  expect(writes[0].body).toMatchObject({ coverImageUrl: null })
})

it('continues creating articles without an optional cover in one request', async () => {
  const user = await newArticle()
  await user.click(screen.getByRole('button', { name: 'Gửi kiểm duyệt' }))
  await screen.findByText('Đã gửi bài viết để kiểm duyệt.')
  expect(writes).toHaveLength(1)
  expect(writes[0].body).toMatchObject({ action: 'SUBMIT', coverImageUrl: null })
})

// Bắt lỗi tìm kiếm làm mất lựa chọn hoặc chip không gỡ được thẻ khỏi payload.
it('searches tags, preserves selected chips and removes a tag before saving', async () => {
  tagOptions = [{ id: 'java', name: 'Java' }, { id: 'spring', name: 'Spring Boot' }]
  const user = await newArticle()
  await user.type(screen.getByRole('searchbox', { name: 'Tìm thẻ' }), 'spring')
  await user.click(screen.getByRole('checkbox', { name: 'Spring Boot' }))
  await user.clear(screen.getByRole('searchbox', { name: 'Tìm thẻ' }))
  await user.click(screen.getByRole('checkbox', { name: 'Java' }))
  await user.click(screen.getByRole('button', { name: 'Bỏ thẻ Spring Boot' }))
  await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
  await screen.findByText('Đã lưu bài viết.')
  expect(writes[0].body).toMatchObject({ tagIds: ['java'] })
})

// Bắt lỗi chọn vượt 10 thẻ thay vì chỉ cắt bớt payload một cách âm thầm.
it('limits selection to ten tags and allows another after removing one', async () => {
  tagOptions = Array.from({ length: 11 }, (_, i) => ({ id: `tag-${i}`, name: `Tag ${i + 1}` }))
  const user = await newArticle()
  for (let i = 1; i <= 10; i++) await user.click(screen.getByRole('checkbox', { name: `Tag ${i}` }))
  expect((screen.getByRole('checkbox', { name: 'Tag 11' }) as HTMLButtonElement).disabled).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Bỏ thẻ Tag 1' }))
  await user.click(screen.getByRole('checkbox', { name: 'Tag 11' }))
  await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
  await screen.findByText('Đã lưu bài viết.')
  expect((writes[0].body as { tagIds: string[] }).tagIds).toHaveLength(10)
  expect((writes[0].body as { tagIds: string[] }).tagIds).toContain('tag-10')
  expect((writes[0].body as { tagIds: string[] }).tagIds).not.toContain('tag-0')
})
