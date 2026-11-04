import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SavedArticlesPage } from './SavedArticlesPage'
import { setAccessToken } from '../../services/api/client'
import { savedSummaryFixture as item } from '../../test/articleFixtures'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const json = (data: unknown, status = 200, code?: string) => new Response(JSON.stringify({ status, code, message: 'English', data }), { status })
const page = (content: unknown[], totalElements = content.length, totalPages = 1) => ({ content, page: 0, size: 9, totalElements, totalPages, hasNext: false })
const second = { ...item, id: 'pub-2', title: 'JPA nâng cao' }

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>
function mockApi(list: Handler = () => json(page([item, second], 8)), saved: Handler = (url, init) => json({ saved: init?.method === 'PUT' })) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    return url.pathname === '/api/v1/me/saved-articles' ? list(url, init) : saved(url, init)
  })
  vi.stubGlobal('fetch', fetch)
  setAccessToken('reader')
  return fetch
}
const calls = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.map(([input, init]) => ({ url: new URL(String(input)), method: init?.method ?? 'GET' }))
const renderPage = (language: 'vi' | 'en' = 'vi') => render(<MemoryRouter initialEntries={['/me/saved-articles']}><Routes>
  <Route path="/me/saved-articles" element={<SavedArticlesPage language={language} />} /><Route path="/blogs" element={<p>reader list</p>} />
</Routes></MemoryRouter>)
const card = (title: string) => screen.getByRole('heading', { name: title }).closest('article') as HTMLElement

it('shows 6 skeleton cards, then header, total chip and shared cards that are already saved', async () => {
  const fetch = mockApi()
  renderPage()
  expect(within(screen.getByRole('status', { name: 'Đang tải bài đã lưu...' })).getAllByRole('listitem')).toHaveLength(6)
  expect(await screen.findByRole('heading', { name: 'Spring Boot từ đầu' })).not.toBeNull()
  expect(screen.getByRole('heading', { level: 1, name: 'Bài đã lưu' })).not.toBeNull()
  expect(screen.getByText('8 bài')).not.toBeNull()
  expect(screen.getByRole('link', { name: 'Tất cả bài viết' }).getAttribute('href')).toBe('/blogs')
  expect(within(card('JPA nâng cao')).getByRole('button', { name: 'Lưu bài viết' }).getAttribute('aria-pressed')).toBe('true')
  expect(Object.fromEntries(calls(fetch)[0].url.searchParams)).toEqual({ page: '0', size: '9' })
})

it('unsaving turns the card into an in-place “Removed · Undo” row; Undo saves again on the same item', async () => {
  let finishDelete!: (response: Response) => void
  const fetch = mockApi(undefined, (_, init) => init?.method === 'DELETE' ? new Promise(resolve => { finishDelete = resolve }) : json({ saved: true }))
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('heading', { name: 'Spring Boot từ đầu' })
  await user.click(within(card('Spring Boot từ đầu')).getByRole('button', { name: 'Lưu bài viết' }))
  // Optimistic: the row shows before DELETE answers, in the same list slot.
  const items = Array.from(screen.getByRole('list', { name: 'Danh sách bài đã lưu' }).children) as HTMLElement[]
  expect(items).toHaveLength(2)
  expect(within(items[0]).getByText('Đã bỏ lưu')).not.toBeNull()
  expect(screen.queryByRole('heading', { name: 'Spring Boot từ đầu' })).toBeNull()
  finishDelete(json({ saved: false }))
  await user.click(within(items[0]).getByRole('button', { name: 'Hoàn tác bỏ lưu Spring Boot từ đầu' }))
  expect(await screen.findByRole('heading', { name: 'Spring Boot từ đầu' })).not.toBeNull()
  await waitFor(() => expect(calls(fetch).filter(call => call.method !== 'GET').map(call => `${call.method} ${call.url.pathname}`))
    .toEqual(['DELETE /api/v1/articles/pub-1/saved', 'PUT /api/v1/articles/pub-1/saved']))
  expect(screen.queryByRole('status', { name: /toast/i })).toBeNull()
})

it('rolls back to the confirmed state on errors: failed unsave brings the card back, failed undo keeps the row', async () => {
  let failPut = false
  mockApi(undefined, (_, init) => init?.method === 'DELETE' && !failPut ? json(null, 500) : init?.method === 'PUT' ? json(null, 500) : json({ saved: false }))
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('heading', { name: 'Spring Boot từ đầu' })
  await user.click(within(card('Spring Boot từ đầu')).getByRole('button', { name: 'Lưu bài viết' }))
  await screen.findByRole('heading', { name: 'Spring Boot từ đầu' })
  expect(within(card('Spring Boot từ đầu')).getByRole('alert')).not.toBeNull()
  expect(within(card('Spring Boot từ đầu')).getByRole('button', { name: 'Lưu bài viết' }).getAttribute('aria-pressed')).toBe('true')
  failPut = true
  await user.click(within(card('Spring Boot từ đầu')).getByRole('button', { name: 'Lưu bài viết' }))
  const undo = await screen.findByRole('button', { name: 'Hoàn tác bỏ lưu Spring Boot từ đầu' })
  await user.click(undo)
  // Undo optimistically shows the card again; the failed PUT brings back a fresh row with the error.
  const alert = await screen.findByRole('alert')
  const row = alert.closest('li') as HTMLElement
  expect(alert.textContent).toContain('Hệ thống tạm thời gián đoạn')
  expect(within(row).getByRole('button', { name: 'Hoàn tác bỏ lưu Spring Boot từ đầu' })).not.toBeNull()
  expect(within(row).getByText('Đã bỏ lưu')).not.toBeNull()
})

it('empty list: heart, “Chưa có bài đã lưu” and a CTA to explore; empty search offers to clear it', async () => {
  const fetch = mockApi(() => json(page([])))
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByText('Chưa có bài đã lưu')).not.toBeNull()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm trong bài đã lưu' }), { target: { value: ' jpa ' } })
  await user.type(screen.getByRole('searchbox', { name: 'Tìm trong bài đã lưu' }), '{Enter}')
  expect(await screen.findByText('Không có bài đã lưu khớp')).not.toBeNull()
  expect(Object.fromEntries(calls(fetch).at(-1)!.url.searchParams)).toEqual({ keyword: 'jpa', page: '0', size: '9' })
  await user.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }))
  expect(await screen.findByText('Chưa có bài đã lưu')).not.toBeNull()
  await user.click(screen.getByRole('link', { name: 'Khám phá bài viết' }))
  expect(screen.getByText('reader list')).not.toBeNull()
})

it('shows a translated error with retry, and English copy on demand', async () => {
  let fail = true
  mockApi(() => fail ? json(null, 503) : json(page([item])))
  const user = userEvent.setup()
  renderPage('en')
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).not.toContain('English')
  fail = false
  await user.click(within(alert).getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('heading', { name: 'Spring Boot từ đầu' })).not.toBeNull()
  expect(screen.getByRole('heading', { level: 1, name: 'Saved articles' })).not.toBeNull()
})
