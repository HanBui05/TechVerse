import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ModeratorArticleDetailPage } from './ModeratorArticleDetailPage'
import { setAccessToken } from '../../services/api/client'
import { moderatorDetailFixture as detail } from '../../test/articleFixtures'
import type { ModeratorArticleDetail } from '../../types/articles'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const json = (data: unknown, status = 200, code?: string) => new Response(JSON.stringify({ status, code, message: 'English message', data }), { status })
const approved: ModeratorArticleDetail = { ...detail, article: { ...detail.article, workflowStatus: 'PUBLISHED', hasUnpublishedChanges: false }, reviewToken: 'b'.repeat(64) }

function mockApi(first: ModeratorArticleDetail | Response = detail, patch: () => Response = () => json(approved)) {
  const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => init?.method === 'PATCH' ? patch() : first instanceof Response ? first.clone() : json(first))
  vi.stubGlobal('fetch', fetch)
  setAccessToken('moderator')
  return fetch
}
const patches = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.filter(([, init]) => init?.method === 'PATCH').map(([input, init]) => ({ path: new URL(String(input)).pathname, body: JSON.parse(String(init!.body)) }))
const renderPage = () => render(<MemoryRouter initialEntries={['/moderator/articles/art-1']}><Routes><Route path="/moderator/articles/:id" element={<ModeratorArticleDetailPage language="vi" />} /></Routes></MemoryRouter>)

it('compares the proposal with the live version side by side and marks changed fields', async () => {
  mockApi()
  renderPage()
  expect(await screen.findByRole('heading', { level: 1, name: 'Live (sửa)' })).not.toBeNull()
  const changes = screen.getByRole('list', { name: 'Thay đổi so với v3:' })
  expect(within(changes).getAllByRole('listitem').map(li => li.textContent)).toEqual(['Tiêu đề', 'Tóm tắt', 'Thẻ', 'Nội dung'])
  const proposed = screen.getByRole('region', { name: 'Bản đề xuất' })
  const live = screen.getByRole('region', { name: 'Bản công khai v3' })
  expect(within(proposed).getAllByText('Đã đổi')).toHaveLength(4)
  expect(within(live).queryByText('Đã đổi')).toBeNull()
  expect(within(live).getAllByText('Live').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Đủ điều kiện').length).toBeGreaterThan(0)
})

it('approves with the token after showing the last return note, then offers the live-article actions', async () => {
  const fetch = mockApi()
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Duyệt' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText('Bản đề xuất sẽ thành v4 trên cùng URL.')).not.toBeNull()
  expect(within(dialog).getByText(/Bổ sung ví dụ/)).not.toBeNull()
  await user.click(within(dialog).getByRole('button', { name: 'Duyệt' }))
  expect(await screen.findByText('Đã duyệt và xuất bản.')).not.toBeNull()
  expect(patches(fetch)).toEqual([{ path: '/api/v1/moderator/articles/art-1/review', body: { decision: 'APPROVE', reviewToken: 'a'.repeat(64), moderationNote: null } }])
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Ẩn bài' })).not.toBeNull()
})

it('requires a note before requesting changes and a reason before hiding', async () => {
  const fetch = mockApi()
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Yêu cầu sửa' }))
  let dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Yêu cầu sửa' }))
  expect(within(dialog).getByText('Nhập ghi chú trước khi yêu cầu sửa.')).not.toBeNull()
  await user.click(within(dialog).getByRole('button', { name: 'Hủy' }))
  await user.click(screen.getByRole('button', { name: 'Ẩn bài' }))
  dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Ẩn bài' }))
  expect(within(dialog).getByText('Nhập lý do trước khi tiếp tục.')).not.toBeNull()
  expect(patches(fetch)).toEqual([])
  await user.type(within(dialog).getByRole('textbox'), 'Sai phạm')
  await user.click(within(dialog).getByRole('button', { name: 'Ẩn bài' }))
  await waitFor(() => expect(patches(fetch)).toEqual([{ path: '/api/v1/moderator/articles/art-1/publication', body: { action: 'HIDE', reviewToken: 'a'.repeat(64), moderationNote: 'Sai phạm' } }]))
})

it('turns a stale token into a reload inside the dialog', async () => {
  const fetch = mockApi(detail, () => json(null, 409, 'ARTICLE_REVIEW_STALE'))
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Duyệt' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Duyệt' }))
  expect((await within(dialog).findByRole('alert')).textContent).toContain('Bài đã thay đổi, hãy tải lại.')
  const reads = fetch.mock.calls.length
  await user.click(within(dialog).getByRole('button', { name: 'Tải lại' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  expect(fetch.mock.calls.length).toBe(reads + 1)
})

it('does not keep the stale article on screen when the reload fails', async () => {
  let reads = 0
  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => init?.method === 'PATCH' ? json(null, 409, 'ARTICLE_REVIEW_STALE') : reads++ === 0 ? json(detail) : json(null, 500)))
  setAccessToken('moderator')
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Duyệt' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Duyệt' }))
  await user.click(await within(dialog).findByRole('button', { name: 'Tải lại' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Hệ thống tạm thời gián đoạn')
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull()
})

it('locks approval for an ineligible author and shows banners instead of actions for terminal states', async () => {
  mockApi({ ...detail, authorEligible: false })
  renderPage()
  const approve = await screen.findByRole('button', { name: 'Duyệt' })
  expect(approve.hasAttribute('disabled')).toBe(true)
  expect(screen.getByText('Tác giả không còn quyền đăng bài nên chưa thể duyệt.')).not.toBeNull()
  cleanup()
  mockApi({ ...detail, article: { ...detail.article, publicationStatus: 'AUTHOR_DELETED' } })
  renderPage()
  expect(await screen.findByText('Tác giả đã xóa bài, chỉ còn để đối soát.')).not.toBeNull()
  expect(screen.queryByRole('group', { name: 'Thao tác kiểm duyệt' })).toBeNull()
})

it('shows not found with a way back to the list', async () => {
  mockApi(json(null, 404, 'ARTICLE_NOT_FOUND'))
  renderPage()
  expect(await screen.findByText('Không tìm thấy bài viết')).not.toBeNull()
  expect(screen.getByRole('link', { name: 'Về danh sách' }).getAttribute('href')).toBe('/moderator/articles')
})
