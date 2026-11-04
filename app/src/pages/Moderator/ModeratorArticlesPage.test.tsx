import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ModeratorArticlesPage } from './ModeratorArticlesPage'
import { setAccessToken } from '../../services/api/client'
import { moderatorSummaryFixture as item } from '../../test/articleFixtures'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const json = (data: unknown, status = 200, code?: string) => new Response(JSON.stringify({ status, code, message: 'English message', data }), { status })
const page = (content: unknown[], totalElements = content.length) => ({ content, page: 0, size: 12, totalElements, totalPages: 1, hasNext: false })
const options = { topics: page([{ id: 'java', name: 'Java' }]), tags: page([{ id: 'spring', name: 'Spring' }]) }

// Routes: reader options, count-only stats (size=1) and the list; `list` decides the list answer per request.
function mockApi(list: (url: URL) => Response = () => json(page([item]))) {
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
const listCalls = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.map(([input]) => new URL(String(input))).filter(url => url.pathname === '/api/v1/moderator/articles' && url.searchParams.get('size') === '12')
const renderPage = () => render(<MemoryRouter><ModeratorArticlesPage language="vi" /></MemoryRouter>)

it('defaults to the pending queue and links each row to the detail page', async () => {
  const fetch = mockApi()
  renderPage()
  const link = await screen.findByRole('link', { name: 'Live (sửa)' })
  expect(link.getAttribute('href')).toBe('/moderator/articles/art-1')
  expect(Object.fromEntries(listCalls(fetch)[0].searchParams)).toMatchObject({ workflowStatus: 'PENDING', size: '12', page: '0' })
  expect(screen.getByText('Bản cập nhật')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Chờ duyệt' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('filters by author from the row and removes the filter from its chip; warns when the author is ineligible', async () => {
  const fetch = mockApi(() => json(page([{ ...item, authorEligible: false }])))
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByText('Tác giả không còn đủ điều kiện')).not.toBeNull()
  await user.click(screen.getByRole('button', { name: 'Lọc theo tác giả Trần B' }))
  await waitFor(() => expect(listCalls(fetch).at(-1)!.searchParams.get('authorId')).toBe('author-1'))
  await user.click(screen.getByRole('button', { name: 'Bỏ lọc tác giả Trần B' }))
  await waitFor(() => expect(listCalls(fetch).at(-1)!.searchParams.has('authorId')).toBe(false))
})

it('tells an empty queue apart from an empty filter result, and clears back to the queue', async () => {
  const fetch = mockApi(() => json(page([])))
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByText('Không còn bài chờ duyệt')).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'Xóa bộ lọc' })).toBeNull()
  await user.click(within(screen.getByRole('group', { name: 'Công khai' })).getByRole('button', { name: 'Bị ẩn' }))
  expect(await screen.findByText('Không có bài khớp bộ lọc')).not.toBeNull()
  await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
  await waitFor(() => expect(Object.fromEntries(listCalls(fetch).at(-1)!.searchParams)).toEqual({ page: '0', size: '12', workflowStatus: 'PENDING', sortBy: 'CREATED_AT', direction: 'DESC' }))
})

it('rejects a reversed date range without requesting it', async () => {
  const fetch = mockApi()
  renderPage()
  await screen.findByRole('link', { name: 'Live (sửa)' })
  fireEvent.change(screen.getByLabelText('Gửi từ ngày'), { target: { value: '2026-11-04' } })
  fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-11-01' } })
  expect(await screen.findByText('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.')).not.toBeNull()
  expect(listCalls(fetch).some(url => url.searchParams.has('createdTo'))).toBe(false)
})

it('moves back to the last page when the queue shrank under the current page', async () => {
  const fetch = mockApi(url => url.searchParams.get('page') === '0' ? json(page([item], 13)) : json({ ...page([], 13), page: 1, totalPages: 1 }))
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('link', { name: 'Live (sửa)' })
  await user.click(screen.getByRole('button', { name: 'Trang 2' }))
  await waitFor(() => expect(listCalls(fetch).map(url => url.searchParams.get('page'))).toEqual(['0', '1', '0']))
  expect(await screen.findByRole('link', { name: 'Live (sửa)' })).not.toBeNull()
})

it('reports a failed topic/tag options load and retries it', async () => {
  let fail = true
  const fetch = mockApi()
  fetch.mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/options')) return fail ? json(null, 500) : json(options)
    return json(page([item], url.searchParams.get('size') === '1' ? 3 : 1))
  })
  const user = userEvent.setup()
  renderPage()
  const alert = await screen.findByText('Không thể tải danh sách chủ đề và thẻ.')
  fail = false
  await user.click(within(alert.parentElement!).getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('option', { name: 'Java' })).not.toBeNull()
})

it('shows a load error with retry', async () => {
  let fail = true
  const fetch = mockApi(() => fail ? json(null, 500) : json(page([item])))
  const user = userEvent.setup()
  renderPage()
  expect((await screen.findByRole('alert')).textContent).toContain('Hệ thống tạm thời gián đoạn')
  fail = false
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('link', { name: 'Live (sửa)' })).not.toBeNull()
  expect(listCalls(fetch).length).toBe(2)
})
