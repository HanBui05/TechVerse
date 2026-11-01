import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModeratorArticlesPage } from './ModeratorArticlesPage'
import { setAccessToken } from '../../services/api/client'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

// Keep long Markdown in a keyboard-accessible reading region, separate from review controls.
it('opens long content in a dedicated reading region while keeping review actions outside it', async () => {
  const article = { id: 'long', title: 'Bài viết dài', summary: 'Tóm tắt', status: 'PENDING', content: '# Bài viết\n\n' + 'Nội dung dài.\n\n'.repeat(60), moderationNote: null, topic: { name: 'Java' }, tags: [], createdAt: '2026-10-30T01:00:00Z', updatedAt: '2026-10-30T01:00:00Z' }
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify({ status: 200, data: new URL(String(input)).pathname.endsWith('/long') ? { article, author: { fullName: 'Tác giả' }, reviewToken: 'review-test' } : { content: [{ ...article, author: { fullName: 'Tác giả' } }], hasNext: false, totalElements: 1 } }))))
  setAccessToken('moderator-test')
  const user = userEvent.setup()
  render(<ModeratorArticlesPage />)
  await user.click(await screen.findByRole('button', { name: /Bài viết dài/ }))
  expect(screen.queryByRole('region', { name: 'Nội dung bài viết' })).not.toBeNull()
  const region = screen.getByRole('region', { name: 'Nội dung bài viết' })
  expect(region.tabIndex).toBe(0)
  expect(region.contains(screen.getByRole('button', { name: 'Phê duyệt' }))).toBe(false)
})
