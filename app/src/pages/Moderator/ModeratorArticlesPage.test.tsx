import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModeratorArticlesPage } from './ModeratorArticlesPage'
import { setAccessToken } from '../../services/api/client'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const article = { id: 'long', title: 'Bài viết dài', summary: 'Tóm tắt', status: 'PENDING', content: '# Bài viết\n\n' + 'Nội dung dài.\n\n'.repeat(60), moderationNote: null, topic: { name: 'Java' }, tags: [], createdAt: '2026-10-30T01:00:00Z', updatedAt: '2026-10-30T01:00:00Z' }
const json = (data: unknown, status = 200, code?: string) => new Response(JSON.stringify({ status, code, message: 'English message', data }), { status })

// Routes: count-only stats (size=1), the list, the detail and the review PATCH.
function mockApi(review?: () => Response) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (init?.method === 'PATCH') return review ? review() : json({ article: { ...article, status: 'PUBLISHED' }, author: { fullName: 'Tác giả' }, reviewToken: 'r2' })
    if (url.pathname.endsWith('/long')) return json({ article, author: { fullName: 'Tác giả' }, reviewToken: 'review-test' })
    if (url.searchParams.get('size') === '1') return json({ content: [], hasNext: false, totalElements: url.searchParams.get('status') === 'PENDING' ? 30 : 2 })
    return json({ content: [{ ...article, author: { fullName: 'Tác giả' } }], hasNext: true, totalElements: 30 })
  })
  vi.stubGlobal('fetch', fetch)
  setAccessToken('moderator-test')
  return fetch
}

// Keep long Markdown in a keyboard-accessible reading region, separate from review controls.
it('opens long content in a dedicated reading region while keeping review actions outside it', async () => {
  mockApi()
  const user = userEvent.setup()
  render(<ModeratorArticlesPage />)
  await user.click(await screen.findByRole('button', { name: /Bài viết dài/ }))
  const region = await screen.findByRole('region', { name: 'Nội dung bài viết' })
  expect(region.tabIndex).toBe(0)
  expect(region.contains(screen.getByRole('button', { name: 'Phê duyệt' }))).toBe(false)
})

it('shows status counts, 12 articles per page and numbered pagination', async () => {
  const fetch = mockApi()
  const user = userEvent.setup()
  render(<ModeratorArticlesPage />)
  const pending = await screen.findByText('30', { selector: 'dd' })
  expect(pending).not.toBeNull()
  const list = fetch.mock.calls.map(([input]) => new URL(String(input))).find(url => url.searchParams.get('size') !== '1')!
  expect(list.searchParams.get('size')).toBe('12')
  expect(list.searchParams.get('status')).toBe('PENDING')
  await user.click(screen.getByRole('button', { name: 'Trang 3' }))
  expect(fetch.mock.calls.some(([input]) => new URL(String(input)).searchParams.get('page') === '2')).toBe(true)
})

it('confirms approval in an in-app dialog instead of window.confirm', async () => {
  const fetch = mockApi()
  const confirm = vi.spyOn(window, 'confirm')
  const user = userEvent.setup()
  render(<ModeratorArticlesPage />)
  await user.click(await screen.findByRole('button', { name: /Bài viết dài/ }))
  await user.click(await screen.findByRole('button', { name: 'Phê duyệt' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Phê duyệt' }))
  expect(await screen.findByText('Bài viết đã được phê duyệt và xuất bản.')).not.toBeNull()
  const patch = fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')!
  expect(JSON.parse(String(patch[1]!.body))).toEqual({ decision: 'APPROVE', reviewToken: 'review-test', moderationNote: null })
  expect(confirm).not.toHaveBeenCalled()
})

it('asks for feedback before requesting changes', async () => {
  const fetch = mockApi()
  const user = userEvent.setup()
  render(<ModeratorArticlesPage />)
  await user.click(await screen.findByRole('button', { name: /Bài viết dài/ }))
  await user.click(await screen.findByRole('button', { name: 'Yêu cầu chỉnh sửa' }))
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(screen.getByText('Nhập nhận xét trước khi yêu cầu chỉnh sửa.')).not.toBeNull()
  expect(fetch.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
})

it('keeps the newest status counts when an older count request answers late', async () => {
  const late: (() => void)[] = []
  let round = 0
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.searchParams.get('size') !== '1') return json({ content: [], hasNext: false, totalElements: 0 })
    if (url.searchParams.get('status') !== 'PENDING') return json({ content: [], hasNext: false, totalElements: 0 })
    // First round (on mount) answers only after the refresh round has finished.
    if (round++ === 0) return new Promise<Response>(resolve => late.push(() => resolve(json({ content: [], hasNext: false, totalElements: 99 }))))
    return json({ content: [], hasNext: false, totalElements: 5 })
  }))
  setAccessToken('moderator-test')
  const user = userEvent.setup()
  render(<ModeratorArticlesPage />)
  await user.click(await screen.findByRole('button', { name: 'Làm mới' }))
  expect(await screen.findByText('5', { selector: 'dd' })).not.toBeNull()
  late.forEach(resolve => resolve())
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(screen.queryByText('99', { selector: 'dd' })).toBeNull()
})

it('explains a stale review in Vietnamese', async () => {
  mockApi(() => json(null, 409, 'ARTICLE_REVIEW_STALE'))
  const user = userEvent.setup()
  render(<ModeratorArticlesPage />)
  await user.click(await screen.findByRole('button', { name: /Bài viết dài/ }))
  await user.click(await screen.findByRole('button', { name: 'Phê duyệt' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Phê duyệt' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Bài viết đã thay đổi. Hãy mở lại bài để kiểm tra trước khi duyệt.')
})
