import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { BlogDetailPage } from './BlogDetailPage'
import { setAccessToken } from '../../services/api/client'
import { publicDetailFixture as article } from '../../test/articleFixtures'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const json = (data: unknown, status = 200, code?: string) => new Response(JSON.stringify({ status, code, message: 'English', data }), { status })
function mockApi(detail: (id: string) => Response = id => json(id === 'pub-2' ? { ...article, id: 'pub-2', title: 'JPA nâng cao', content: '## Phần JPA', relatedArticles: [] } : article)) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => detail(new URL(String(input)).pathname.split('/').pop()!))
  vi.stubGlobal('fetch', fetch)
  setAccessToken('reader')
  return fetch
}
function List() {
  const location = useLocation()
  return <p>list {location.pathname + location.search}</p>
}
const renderPage = (entry: string | { pathname: string; state: unknown } = '/blogs/pub-1') => render(<MemoryRouter initialEntries={[entry]}>
  <Routes><Route path="/blogs/:id" element={<BlogDetailPage language="vi" />} /><Route path="/blogs" element={<List />} /></Routes>
</MemoryRouter>)

it('shows breadcrumb, meta with the update date for v2+, summary, tags, Markdown and a TOC that matches the heading anchors', async () => {
  mockApi()
  const { container } = renderPage()
  expect(await screen.findByRole('heading', { level: 1, name: 'Spring Boot từ đầu' })).not.toBeNull()
  const crumbs = screen.getByRole('navigation', { name: 'Đường dẫn' })
  expect(within(crumbs).getByRole('link', { name: 'Java' }).getAttribute('href')).toBe('/blogs?topicId=java')
  expect(screen.getByText(/^Cập nhật/)).not.toBeNull()
  expect(screen.getByText('6 phút đọc')).not.toBeNull()
  expect(screen.getByRole('region', { name: 'Tóm tắt' }).textContent).toContain('Tóm tắt Spring')
  expect(screen.getByRole('button', { name: 'Lưu bài viết' }).getAttribute('aria-pressed')).toBe('false')
  const sidebar = screen.getByRole('complementary', { name: 'Thông tin bài viết' })
  const toc = await within(sidebar).findByRole('navigation', { name: 'Mục lục' })
  const hrefs = within(toc).getAllByRole('link').map(link => link.getAttribute('href'))
  expect(hrefs).toEqual(['#mo-dau', '#cai-dat', '#mo-dau-2'])
  expect(hrefs.map(href => container.querySelector(href!)?.tagName)).toEqual(['H2', 'H3', 'H2'])
  expect(within(sidebar).getByText('Java backend')).not.toBeNull()
  expect(within(sidebar).getByText('Kỹ sư Java.')).not.toBeNull()
  expect(within(sidebar).getByRole('link', { name: 'Xem tất cả Java' }).getAttribute('href')).toBe('/blogs?topicId=java')
})

it('hides the update label for v1 and the related card when there are no related articles', async () => {
  mockApi(() => json({ ...article, versionNumber: 1, relatedArticles: [] }))
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'Spring Boot từ đầu' })
  expect(screen.queryByText(/^Cập nhật/)).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Bài liên quan' })).toBeNull()
})

it('returns to the list URL from router state, keeps it across related articles and falls back to /blogs', async () => {
  mockApi()
  const user = userEvent.setup()
  renderPage({ pathname: '/blogs/pub-1', state: { from: '/blogs?topicId=java&page=1' } })
  await screen.findByRole('heading', { level: 1, name: 'Spring Boot từ đầu' })
  await user.click(within(screen.getByRole('complementary', { name: 'Thông tin bài viết' })).getByRole('link', { name: /JPA nâng cao/ }))
  expect(await screen.findByRole('heading', { level: 1, name: 'JPA nâng cao' })).not.toBeNull()
  expect(screen.queryByRole('heading', { name: 'Mở đầu' })).toBeNull()
  await user.click(screen.getByRole('link', { name: 'Về danh sách' }))
  expect(screen.getByText('list /blogs?topicId=java&page=1')).not.toBeNull()
  cleanup()
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'Spring Boot từ đầu' })
  expect(screen.getByRole('link', { name: 'Về danh sách' }).getAttribute('href')).toBe('/blogs')
})

it('ignores a malformed URL fragment instead of breaking the page', async () => {
  mockApi()
  renderPage('/blogs/pub-1#%')
  expect(await screen.findByRole('heading', { level: 1, name: 'Spring Boot từ đầu' })).not.toBeNull()
  expect(await screen.findAllByRole('navigation', { name: 'Mục lục' })).not.toHaveLength(0)
})

it('treats a hidden or missing article as 404 with a way back', async () => {
  mockApi(() => json(null, 404, 'ARTICLE_NOT_FOUND'))
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByText('Bài viết không tồn tại hoặc đã bị ẩn')).not.toBeNull()
  expect(screen.queryByRole('complementary')).toBeNull()
  await user.click(screen.getByRole('link', { name: 'Về danh sách' }))
  expect(screen.getByText('list /blogs')).not.toBeNull()
})

it('shows a translated error with retry for other failures', async () => {
  let fail = true
  mockApi(() => fail ? json(null, 500) : json(article))
  const user = userEvent.setup()
  renderPage()
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('Hệ thống tạm thời gián đoạn')
  fail = false
  await user.click(within(alert).getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Spring Boot từ đầu' })).not.toBeNull()
})

it('hides the save button for a management account (canSave=false)', async () => {
  mockApi()
  render(<MemoryRouter initialEntries={['/blogs/pub-1']}><Routes><Route path="/blogs/:id" element={<BlogDetailPage language="vi" canSave={false} />} /></Routes></MemoryRouter>)
  expect(await screen.findByRole('heading', { level: 1, name: 'Spring Boot từ đầu' })).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'Lưu bài viết' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Sao chép liên kết' })).not.toBeNull()
})
