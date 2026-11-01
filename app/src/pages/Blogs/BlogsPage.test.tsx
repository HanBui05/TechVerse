import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BlogDetailPage } from './BlogsPage'
import { setAccessToken } from '../../services/api/client'

const markdown = '# Học Java\n\nĐoạn **quan trọng** và `inlineCode`.\n\n- Bước một\n- Bước hai\n\n> Ghi nhớ\n\n| Khóa | Ý nghĩa |\n| --- | --- |\n| sid | Phiên |\n\n```java\nint count = 1;\n```\n\n![Sơ đồ](https://res.cloudinary.com/demo/diagram.png)\n\n<script>alert(1)</script>\n\n[Không an toàn](javascript:alert%281%29)'
const article = {
  id: 'one', title: 'Kiến thức Java', summary: 'Tóm tắt bài học', content: markdown,
  coverImageUrl: 'https://res.cloudinary.com/demo/cover.png',
  author: { id: 'author', fullName: 'Tác giả Java', avatarUrl: null },
  topic: { id: 'java', name: 'Java Core' }, tags: [{ id: 'oop', name: 'OOP' }],
  publishedAt: '2026-10-30T00:00:00Z', updatedAt: '2026-10-30T00:00:00Z',
  relatedArticles: [
    { id: 'two', title: 'Spring tiếp theo', coverImageUrl: 'https://res.cloudinary.com/demo/spring.png', publishedAt: '2026-10-29T00:00:00Z' },
    { id: 'three', title: 'Bài không có ảnh', coverImageUrl: null, publishedAt: null },
  ],
}

beforeEach(() => {
  setAccessToken('test-reader')
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify({
    status: 200, message: 'OK', data: String(input).endsWith('/two')
      ? { ...article, id: 'two', title: 'Spring tiếp theo', content: '## Nội dung Spring', relatedArticles: [] } : article,
  }), { status: 200 })))
})
afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

// Bắt lỗi render Markdown như văn bản, mất bảng/code hoặc vô tình bật raw HTML.
it('renders rich article content safely, including tables, lists, inline code and highlighted blocks', async () => {
  const { container } = render(<MemoryRouter initialEntries={['/blogs/one']}><Routes><Route path="/blogs/:id" element={<BlogDetailPage />} /></Routes></MemoryRouter>)
  await screen.findByRole('heading', { name: 'Kiến thức Java' })
  expect(screen.getByRole('table').textContent).toContain('Phiên')
  expect(screen.getByText('quan trọng').tagName).toBe('STRONG')
  expect(screen.getByText('inlineCode').tagName).toBe('CODE')
  expect(screen.getByText('Bước một').tagName).toBe('LI')
  expect(screen.getByText('Ghi nhớ').closest('blockquote')).toBeTruthy()
  expect(container.querySelector('pre code.language-java .hljs-number')?.textContent).toBe('1')
  expect(screen.getByRole('img', { name: 'Sơ đồ' }).getAttribute('src')).toBe('https://res.cloudinary.com/demo/diagram.png')
  expect(container.querySelector('script')).toBeNull()
  expect(screen.getByText('Không an toàn').closest('a')?.getAttribute('href') || '').not.toMatch(/^javascript:/)
})

// Bắt lỗi mất thumbnail, điều hướng bài liên quan hoặc dữ liệu bài cũ còn lưu khi đổi route.
it('places related articles with thumbnails in a complementary sidebar and follows their links', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={['/blogs/one']}><Routes><Route path="/blogs/:id" element={<BlogDetailPage />} /></Routes></MemoryRouter>)
  await screen.findByRole('heading', { name: 'Kiến thức Java' })
  const sidebar = screen.getByRole('complementary', { name: 'Thông tin bài viết' })
  const link = within(sidebar).getByRole('link', { name: /Spring tiếp theo/ })
  expect(link.querySelector('img')?.getAttribute('src')).toBe('https://res.cloudinary.com/demo/spring.png')
  expect(within(sidebar).getByRole('link', { name: /Bài không có ảnh/ })).toBeTruthy()
  await user.click(link)
  await screen.findByRole('heading', { name: 'Nội dung Spring' })
  expect(screen.queryByRole('heading', { name: 'Học Java' })).toBeNull()
})
