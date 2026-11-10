import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ModeratorCourseDetailPage } from './ModeratorCourseDetailPage'
import { setAccessToken } from '../../../services/api/client'
import type { AuthorCourse, Lesson, ModeratorCourseDetail } from '../../../types/courses'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const item = (id: string, title: string, position: number) => ({ id, title, summary: null, position, preview: false, hasVideo: false, hasContent: true, aiAssisted: false })
const course: AuthorCourse = {
  id: 'c1', authorId: 'a1', title: 'Java cơ bản', summary: 'Tóm tắt khóa', description: '# Mô tả', level: 'BEGINNER', coverImageUrl: null, topic: { id: 'java', name: 'Java' }, tags: [],
  workflowStatus: 'PENDING', publicationStatus: 'PUBLISHED', fingerprint: 'f', hasUnpublishedChanges: true, imageIssues: [], moderationNote: null, reviewedAt: null,
  publishedAt: '2026-11-01T00:00:00Z', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-11-08T00:00:00Z',
  chapters: [{ id: 'ch1', title: 'Nhập môn', position: 0, lessons: [item('l1', 'Bài một', 0), item('l2', 'Bài hai', 1), item('l3', 'Bài ba', 2)] }],
  publishedVersion: { id: 'v2', versionNumber: 2, approvedAt: '2026-11-01T00:00:00Z', fingerprint: 'g', chapters: [{ id: 'ch1', title: 'Nhập môn', position: 0, lessons: [item('l1', 'Bài một', 0), item('l3', 'Bài ba', 1), item('l9', 'Bài cũ', 2)] }] },
}
const detail: ModeratorCourseDetail = {
  course, author: { id: 'a1', fullName: 'Trần B', avatarUrl: null }, reviewToken: 'a'.repeat(64), authorEligible: true,
  history: [{ id: 'h1', action: 'APPROVE', note: null, actor: { id: 'm1', fullName: 'Mod', avatarUrl: null }, fromWorkflowStatus: 'PENDING', toWorkflowStatus: 'PUBLISHED', fromPublicationStatus: 'UNPUBLISHED', toPublicationStatus: 'PUBLISHED', versionNumber: 2, createdAt: '2026-11-01T00:00:00Z' }],
  changes: [{ id: 'ch1', title: 'Nhập môn', changeStatus: 'CHANGED', lessons: [
    { id: 'l1', title: 'Bài một', changeStatus: 'UNCHANGED' }, { id: 'l2', title: 'Bài hai', changeStatus: 'NEW' }, { id: 'l3', title: 'Bài ba', changeStatus: 'CHANGED' }, { id: 'l9', title: 'Bài cũ', changeStatus: 'ARCHIVED' },
  ] }],
}
const lesson = (id: string, title: string, extra: Partial<Lesson> = {}): Lesson => ({ id, chapterId: 'ch1', versionId: null, title, summary: null, content: `Nội dung ${title}`, video: null, preview: false, position: 0, aiAssisted: false, fingerprint: '', imageIssues: [], ...extra })
const json = (data: unknown, status = 200, code?: string) => new Response(JSON.stringify({ status, code, message: 'English message', data }), { status })

function mockApi(first: ModeratorCourseDetail = detail, patch: () => Response = () => json({ ...detail, course: { ...course, workflowStatus: 'PUBLISHED' } })) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (init?.method === 'PATCH') return patch()
    if (url.pathname.endsWith('/lessons/l3')) return json(url.searchParams.get('versionId') === 'v2'
      ? lesson('l3', 'Bài ba', { versionId: 'v2', video: { provider: 'YOUTUBE', videoId: 'AAAAAAAAAAA' } })
      : lesson('l3', 'Bài ba (mới)', { video: { provider: 'YOUTUBE', videoId: 'dQw4w9WgXcQ' }, preview: true }))
    if (url.pathname.endsWith('/lessons/l2')) return json(lesson('l2', 'Bài hai'))
    if (url.pathname.endsWith('/lessons/l9')) return json(lesson('l9', 'Bài cũ', { versionId: 'v2' }))
    return json(first)
  })
  vi.stubGlobal('fetch', fetch)
  setAccessToken('moderator')
  return fetch
}
const calls = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.map(([input, init]) => ({ url: new URL(String(input)), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null }))
const renderPage = (language: 'vi' | 'en' = 'vi') => render(<MemoryRouter initialEntries={['/moderator/courses/c1']}><Routes><Route path="/moderator/courses/:id" element={<ModeratorCourseDetailPage language={language} />} /></Routes></MemoryRouter>)
const tree = () => screen.getByRole('navigation', { name: /Thay đổi|Changes/ })

it('shows metadata, author and history, and by default only the changed chapters/lessons with their labels', async () => {
  mockApi()
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByRole('heading', { level: 1, name: 'Java cơ bản' })).not.toBeNull()
  expect(screen.getByText('v2')).not.toBeNull()
  expect(screen.getAllByText('Trần B').length).toBeGreaterThan(0)
  expect(screen.getByText(/Duyệt · v2 · Mod/)).not.toBeNull()
  const nodes = () => within(tree()).getAllByRole('button').map(b => b.textContent)
  expect(nodes()).toEqual(['Thông tin khóa học', 'Chương 1Nhập mônĐã sửa', 'Bài haiMới', 'Bài baĐã sửa', 'Bài cũĐã gỡ'])
  await user.click(screen.getByRole('button', { name: 'Xem tất cả', pressed: false }))
  expect(nodes()).toEqual(['Thông tin khóa học', 'Chương 1Nhập mônĐã sửa', 'Bài một', 'Bài haiMới', 'Bài baĐã sửa', 'Bài cũĐã gỡ'])
  // Course information shows the working copy (the version DTO has no metadata).
  expect(within(screen.getByRole('region', { name: 'Bản đề xuất' })).getByText('Tóm tắt khóa')).not.toBeNull()
})

it('labels changes in English too', async () => {
  mockApi()
  renderPage('en')
  await screen.findByRole('heading', { level: 1, name: 'Java cơ bản' })
  expect(within(tree()).getAllByRole('button').map(b => b.textContent)).toEqual(['Course information', 'Chapter 1Nhập mônChanged', 'Bài haiNew', 'Bài baChanged', 'Bài cũArchived'])
  expect(screen.getByRole('button', { name: 'Changes only', pressed: true })).not.toBeNull()
})

it('compares a changed lesson with its live snapshot, a new one alone and an archived one from the version', async () => {
  const fetch = mockApi()
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: /^Bài ba/ }))
  const proposed = await screen.findByRole('region', { name: 'Bản đề xuất' })
  const live = screen.getByRole('region', { name: 'Bản công khai v2' })
  expect(await within(proposed).findByText('Bài ba (mới)')).not.toBeNull()
  expect(await within(live).findByText('Nội dung Bài ba')).not.toBeNull()
  expect(within(proposed).getAllByText('Đã đổi')).toHaveLength(4)
  expect(within(live).queryByText('Đã đổi')).toBeNull()
  expect(within(proposed).getByTitle(/Video bài học/).getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  expect(within(live).getByTitle(/Video bài học/).getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/AAAAAAAAAAA')
  expect(calls(fetch).filter(c => c.url.pathname.endsWith('/lessons/l3')).map(c => c.url.search).sort()).toEqual(['', '?versionId=v2'])

  await user.click(screen.getByRole('button', { name: /^Bài hai/ }))
  expect(await within(await screen.findByRole('region', { name: 'Bản đề xuất' })).findByText('Nội dung Bài hai')).not.toBeNull()
  expect(screen.queryByRole('region', { name: 'Bản công khai v2' })).toBeNull()

  await user.click(screen.getByRole('button', { name: /^Bài cũ/ }))
  expect(await within(await screen.findByRole('region', { name: 'Bản công khai v2' })).findByText('Nội dung Bài cũ')).not.toBeNull()
  expect(screen.queryByRole('region', { name: 'Bản đề xuất' })).toBeNull()
  expect(calls(fetch).some(c => c.url.pathname.endsWith('/lessons/l9') && c.url.search === '?versionId=v2')).toBe(true)
  expect(calls(fetch).some(c => c.url.pathname.endsWith('/lessons/l9') && c.url.search === '')).toBe(false)
})

it('approves with the review token, locks the actions while sending and then offers the live actions', async () => {
  let release!: (r: Response) => void
  const fetch = mockApi(detail, () => new Promise<Response>(resolve => { release = resolve }) as unknown as Response)
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Duyệt khóa' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(/bản công khai v3/)).not.toBeNull()
  await user.click(within(dialog).getByRole('button', { name: 'Duyệt khóa' }))
  expect((within(dialog).getByRole('button', { name: 'Duyệt khóa' }) as HTMLButtonElement).disabled).toBe(true)
  expect((within(dialog).getByRole('button', { name: 'Hủy' }) as HTMLButtonElement).disabled).toBe(true)
  release(json({ ...detail, course: { ...course, workflowStatus: 'PUBLISHED', hasUnpublishedChanges: false } }))
  expect(await screen.findByText('Đã duyệt và xuất bản khóa học.')).not.toBeNull()
  expect(calls(fetch).filter(c => c.method === 'PATCH').map(c => [c.url.pathname, c.body])).toEqual([['/api/v1/moderator/courses/c1/review', { decision: 'APPROVE', reviewToken: 'a'.repeat(64), moderationNote: null }]])
  expect(screen.queryByRole('button', { name: 'Duyệt khóa' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Ẩn khóa' })).not.toBeNull()
})

it('on a stale token shows the Task 1c sentence, sends once and only reloads on demand', async () => {
  const fetch = mockApi(detail, () => json(null, 409, 'COURSE_REVIEW_STALE'))
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Duyệt khóa' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Duyệt khóa' }))
  expect((await within(dialog).findByRole('alert')).textContent).toContain('Khóa học đã thay đổi. Hãy tải lại trước khi duyệt.')
  expect((within(dialog).getByRole('button', { name: 'Duyệt khóa' }) as HTMLButtonElement).disabled).toBe(true)
  expect(calls(fetch).filter(c => c.method === 'PATCH')).toHaveLength(1)
  const details = () => calls(fetch).filter(c => c.url.pathname === '/api/v1/moderator/courses/c1').length
  expect(details()).toBe(1)
  await user.click(within(dialog).getByRole('button', { name: 'Tải lại' }))
  await vi.waitFor(() => expect(details()).toBe(2))
  expect(calls(fetch).filter(c => c.method === 'PATCH')).toHaveLength(1)
})

it('requires feedback before requesting changes and maps API validation errors in English', async () => {
  const fetch = mockApi(detail, () => json(null, 400, 'COURSE_REVIEW_NOTE_REQUIRED'))
  const user = userEvent.setup()
  renderPage('en')
  await user.click(await screen.findByRole('button', { name: 'Request changes' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Request changes' }))
  expect(within(dialog).getByText('Feedback is required.')).not.toBeNull()
  expect(calls(fetch).filter(c => c.method === 'PATCH')).toHaveLength(0)
  await user.type(within(dialog).getByLabelText('Feedback for the author (required)'), 'fix')
  await user.click(within(dialog).getByRole('button', { name: 'Request changes' }))
  expect((await within(dialog).findByRole('alert')).textContent).toBe('Feedback is required.')
  expect(calls(fetch).filter(c => c.method === 'PATCH')[0].body).toEqual({ decision: 'REQUEST_CHANGES', reviewToken: 'a'.repeat(64), moderationNote: 'fix' })
})

it('locks approval when the author is no longer eligible; a never-published course shows every item as New in one column', async () => {
  const fresh = { ...detail, authorEligible: false, course: { ...course, publicationStatus: 'UNPUBLISHED' as const, publishedVersion: null },
    changes: [{ id: 'ch1', title: 'Nhập môn', changeStatus: 'NEW' as const, lessons: [{ id: 'l2', title: 'Bài hai', changeStatus: 'NEW' as const }] }] }
  mockApi(fresh)
  const user = userEvent.setup()
  renderPage()
  expect(((await screen.findByRole('button', { name: 'Duyệt khóa' })) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('Tác giả không còn đủ điều kiện nên chưa thể duyệt khóa.')).not.toBeNull()
  await user.click(screen.getByRole('button', { name: /^Chương 1/ }))
  expect(within(await screen.findByRole('region', { name: 'Bản đề xuất' })).getByText('Bài hai')).not.toBeNull()
  expect(screen.queryByRole('region', { name: /Bản công khai/ })).toBeNull()
})
