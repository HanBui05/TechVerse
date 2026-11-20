import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ModeratorExercisesPage } from './ModeratorExercisesPage'
import { setAccessToken } from '../../../services/api/client'
import type { ModeratorExerciseSummary } from '../../../types/exercises'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const json = (data: unknown, status = 200, code?: string) => new Response(JSON.stringify({ status, code, message: 'English message', data }), { status })
const page = (content: unknown[], totalElements = content.length) => ({ content, page: 0, size: 12, totalElements, totalPages: 1, hasNext: false })
export const row: ModeratorExerciseSummary = {
  set: { id: 's1', title: 'SQL cơ bản', description: '', topic: { id: 'sql', name: 'SQL' }, type: 'MULTIPLE_CHOICE', difficulty: 'MEDIUM', status: 'PENDING', aiAssisted: true, version: 3, moderationNote: null, questionCount: 12, publishedAt: null, createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-16T09:10:00Z' },
  author: { id: 'a1', fullName: 'Nguyễn A', avatarUrl: null }, authorEligible: true, reviewToken: 'a'.repeat(64),
}
function mockApi(list: (url: URL) => Response = () => json(page([row]))) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    return url.pathname.endsWith('/options') ? json([{ id: 'sql', name: 'SQL' }]) : list(url)
  })
  vi.stubGlobal('fetch', fetch)
  setAccessToken('moderator')
  return fetch
}
const listCalls = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.map(([input]) => new URL(String(input))).filter(url => url.pathname === '/api/v1/moderator/exercise-sets')
const renderPage = (language: 'vi' | 'en' = 'vi') => render(<MemoryRouter><ModeratorExercisesPage language={language} /></MemoryRouter>)

it('defaults to the pending queue (no stat tiles) and links each row to its detail with AI badge', async () => {
  const fetch = mockApi()
  renderPage()
  const link = await screen.findByRole('link', { name: 'SQL cơ bản' })
  expect(link.getAttribute('href')).toBe('/moderator/exercises/s1')
  expect(Object.fromEntries(listCalls(fetch)[0].searchParams)).toMatchObject({ status: 'PENDING', page: '0' })
  expect(within(screen.getByRole('group', { name: 'Trạng thái' })).getByRole('button', { name: 'Chờ duyệt' }).getAttribute('aria-pressed')).toBe('true')
  const item = within(link.closest('li')!)
  expect(item.getByText('Nguyễn A')).not.toBeNull()
  expect(item.getByText('Có dùng AI')).not.toBeNull()
  expect(item.getByText('12 câu')).not.toBeNull()
  expect(screen.queryByText('Tác giả không còn đủ điều kiện')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Bản nháp' })).toBeNull()
})

it('changes status/type/topic filters back to page 0 and warns about an ineligible author', async () => {
  const fetch = mockApi(() => json(page([{ ...row, authorEligible: false }])))
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByText('Tác giả không còn đủ điều kiện')).not.toBeNull()
  await user.click(within(screen.getByRole('group', { name: 'Trạng thái' })).getByRole('button', { name: 'Bị ẩn bởi kiểm duyệt' }))
  await user.selectOptions(screen.getByLabelText('Loại'), 'FLASHCARD')
  await user.selectOptions(await screen.findByLabelText('Chủ đề'), 'sql')
  await vi.waitFor(() => expect(Object.fromEntries(listCalls(fetch).at(-1)!.searchParams)).toMatchObject({ status: 'HIDDEN', type: 'FLASHCARD', topicId: 'sql', page: '0' }))
})

it('shows the empty state, and clears filters back to the pending queue', async () => {
  const fetch = mockApi(() => json(page([])))
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByText('Không có bộ bài tập nào.')).not.toBeNull()
  await user.click(within(screen.getByRole('group', { name: 'Trạng thái' })).getByRole('button', { name: 'Đã gỡ' }))
  await user.click(await screen.findByRole('button', { name: 'Xóa lọc' }))
  await vi.waitFor(() => expect(listCalls(fetch).at(-1)!.searchParams.get('status')).toBe('PENDING'))
})

it('shows a translated error with retry, then recovers', async () => {
  let fail = true
  mockApi(() => fail ? json(null, 503, 'EXERCISE_STORAGE_UNAVAILABLE') : json(page([row])))
  const user = userEvent.setup()
  renderPage()
  expect((await screen.findByRole('alert')).textContent).toContain('Dịch vụ đang gián đoạn. Hãy thử lại.')
  fail = false
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('link', { name: 'SQL cơ bản' })).not.toBeNull()
})

it('renders English copy', async () => {
  mockApi()
  renderPage('en')
  expect(await screen.findByText('AI-assisted')).not.toBeNull()
  expect(screen.getByRole('heading', { level: 1, name: 'Review exercises' })).not.toBeNull()
})
