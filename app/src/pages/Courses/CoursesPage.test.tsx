import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { CoursesPage } from './CoursesPage'
import { setAccessToken } from '../../services/api/client'
import { json, options, page, summary } from './fixtures'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname + l.search}</output> }
function mockApi(list: (url: URL) => Response = () => json(page([summary]))) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    return url.pathname.endsWith('/options') ? json(options) : list(url)
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const listCalls = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.map(([input]) => new URL(String(input))).filter(url => url.pathname === '/api/v1/courses')
const renderPage = (path = '/courses', authenticated = false) => render(<MemoryRouter initialEntries={[path]}><CoursesPage language="vi" authenticated={authenticated} /><Where /></MemoryRouter>)

it('lists cards for Guests without “My courses”, linking to the overview, and shows no lesson counts or money', async () => {
  const fetch = mockApi()
  renderPage()
  const link = await screen.findByRole('link', { name: 'Java cơ bản' })
  expect(link.getAttribute('href')).toBe('/courses/c1')
  expect(screen.getAllByText('Cơ bản').length).toBeGreaterThan(1)
  expect(screen.queryByRole('link', { name: 'Khóa học của tôi' })).toBeNull()
  expect(screen.queryByText(/VND|₫|\d+ bài/)).toBeNull()
  expect(listCalls(fetch)[0].searchParams.get('size')).toBe('9')
  // Guests get the course taxonomy from the public endpoint, not the article one.
  expect(await screen.findByRole('group', { name: 'Chủ đề' })).toBeTruthy()
  const paths = fetch.mock.calls.map(([input]) => new URL(String(input)).pathname)
  expect(paths).toContain('/api/v1/courses/options')
  expect(paths).not.toContain('/api/v1/articles/options')
})

it('shows “My courses” when signed in and writes filters to the URL, back to page 0', async () => {
  const fetch = mockApi()
  const user = userEvent.setup()
  renderPage('/courses?page=2', true)
  expect(await screen.findByRole('link', { name: 'Khóa học của tôi' })).toBeTruthy()
  await user.selectOptions(screen.getByLabelText('Trình độ'), 'ADVANCED')
  await user.click(await screen.findByRole('button', { name: 'Java' }))
  await vi.waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/courses?topicId=java&level=ADVANCED'))
  const last = listCalls(fetch).at(-1)!
  expect(last.searchParams.get('level')).toBe('ADVANCED')
  expect(last.searchParams.get('topicId')).toBe('java')
  expect(last.searchParams.get('page')).toBe('0')
})

it('shows the empty state, then “no match” with a clear-filters action', async () => {
  mockApi(() => json(page([])))
  const user = userEvent.setup()
  const view = renderPage()
  expect(await screen.findByText('Chưa có khóa học nào')).toBeTruthy()
  view.unmount()
  renderPage('/courses?keyword=zzz')
  expect(await screen.findByText('Không tìm thấy khóa học phù hợp')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
  await vi.waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/courses'))
})

it('shows the API error and retries on demand', async () => {
  let fail = true
  const fetch = mockApi(() => fail ? json(null, 503, 'SERVICE_UNAVAILABLE') : json(page([summary])))
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByRole('alert')).toBeTruthy()
  const before = listCalls(fetch).length
  fail = false
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('link', { name: 'Java cơ bản' })).toBeTruthy()
  expect(listCalls(fetch).length).toBe(before + 1)
})
