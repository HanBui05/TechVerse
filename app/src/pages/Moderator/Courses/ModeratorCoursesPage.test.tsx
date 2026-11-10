import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ModeratorCoursesPage } from './ModeratorCoursesPage'
import { setAccessToken } from '../../../services/api/client'
import type { ModeratorCourseSummary } from '../../../types/courses'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const json = (data: unknown, status = 200, code?: string) => new Response(JSON.stringify({ status, code, message: 'English message', data }), { status })
const page = (content: unknown[], totalElements = content.length) => ({ content, page: 0, size: 12, totalElements, totalPages: 1, hasNext: false })
const options = { topics: page([{ id: 'java', name: 'Java' }]), tags: page([{ id: 'spring', name: 'Spring' }]) }
export const summary: ModeratorCourseSummary = {
  course: {
    id: 'c1', title: 'Java cơ bản', summary: 'Tóm tắt', coverImageUrl: null, level: 'BEGINNER', topic: { id: 'java', name: 'Java' }, workflowStatus: 'PENDING', publicationStatus: 'PUBLISHED',
    hasUnpublishedChanges: true, publishedAt: '2026-11-01T00:00:00Z', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-11-08T00:00:00Z',
  },
  author: { id: 'a1', fullName: 'Trần B', avatarUrl: null }, authorEligible: true,
}

function mockApi(list: (url: URL) => Response = () => json(page([summary]))) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/options')) return json(options)
    if (url.searchParams.get('size') === '1') return json(page([], 3))
    return list(url)
  })
  vi.stubGlobal('fetch', fetch)
  setAccessToken('moderator')
  return fetch
}
const listCalls = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.map(([input]) => new URL(String(input))).filter(url => url.pathname === '/api/v1/moderator/courses' && url.searchParams.get('size') === '12')
const renderPage = (language: 'vi' | 'en' = 'vi') => render(<MemoryRouter><ModeratorCoursesPage language={language} /></MemoryRouter>)

it('defaults to the pending queue, counts courses by status and links each row to the detail page', async () => {
  const fetch = mockApi()
  renderPage()
  expect(screen.getByRole('heading', { level: 1, name: 'Duyệt khóa học' })).not.toBeNull()
  const link = await screen.findByRole('link', { name: 'Java cơ bản' })
  expect(link.getAttribute('href')).toBe('/moderator/courses/c1')
  expect(Object.fromEntries(listCalls(fetch)[0].searchParams)).toMatchObject({ workflowStatus: 'PENDING', page: '0' })
  expect(within(screen.getByRole('group', { name: 'Soạn thảo' })).getByRole('button', { name: 'Chờ duyệt' }).getAttribute('aria-pressed')).toBe('true')
  const row = within(link.closest('li')!)
  expect(row.getByText('Trần B')).not.toBeNull()
  expect(row.getByText('Cơ bản')).not.toBeNull()
  expect(row.getByText('Bản cập nhật')).not.toBeNull()
  expect(within(screen.getByRole('region', { name: 'Khóa học cần xử lý' })).getAllByText('3').length).toBe(5)
  expect(fetch.mock.calls.some(([input]) => String(input).includes('/moderator/articles'))).toBe(false)
})

it('changes the status axes and the topic filter, back to page 0; warns about an ineligible author', async () => {
  const fetch = mockApi(() => json(page([{ ...summary, authorEligible: false }])))
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByText('Tác giả không còn đủ điều kiện')).not.toBeNull()
  await user.click(within(screen.getByRole('group', { name: 'Công khai' })).getByRole('button', { name: 'Bị ẩn' }))
  await user.selectOptions(await screen.findByLabelText('Chủ đề'), 'java')
  await vi.waitFor(() => expect(Object.fromEntries(listCalls(fetch).at(-1)!.searchParams)).toMatchObject({ publicationStatus: 'HIDDEN', topicId: 'java', workflowStatus: 'PENDING', page: '0' }))
})

it('shows the empty queue, then “no match” with a clear-filters action', async () => {
  const fetch = mockApi(() => json(page([])))
  const user = userEvent.setup()
  renderPage('en')
  expect(await screen.findByText('No courses awaiting review')).not.toBeNull()
  await user.click(within(screen.getByRole('group', { name: 'Editing' })).getByRole('button', { name: 'All' }))
  expect(await screen.findByText('No courses match the filters')).not.toBeNull()
  await user.click(screen.getByRole('button', { name: 'Clear filters' }))
  await vi.waitFor(() => expect(listCalls(fetch).at(-1)!.searchParams.get('workflowStatus')).toBe('PENDING'))
})

it('shows the API error by code and retries on demand only', async () => {
  let fail = true
  const fetch = mockApi(() => fail ? json(null, 503, 'SERVICE_UNAVAILABLE') : json(page([summary])))
  const user = userEvent.setup()
  renderPage()
  expect((await screen.findByRole('alert')).textContent).toContain('Hệ thống tạm thời gián đoạn')
  expect(listCalls(fetch)).toHaveLength(1)
  fail = false
  await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('link', { name: 'Java cơ bản' })).not.toBeNull()
})

it('never renders money: no price, revenue, bank or commission', async () => {
  mockApi(() => json(page([{ ...summary, course: { ...summary.course, priceAmount: 500000, currency: 'VND' } }])))
  const { container } = renderPage()
  await screen.findByRole('link', { name: 'Java cơ bản' })
  expect(container.textContent).not.toMatch(/500|VND|₫|giá|doanh thu|ngân hàng|hoa hồng/i)
})
