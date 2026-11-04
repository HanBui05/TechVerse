import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { BlogsPage } from './BlogsPage'
import { setAccessToken } from '../../services/api/client'
import { publicSummaryFixture as item } from '../../test/articleFixtures'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const json = (data: unknown, status = 200) => new Response(JSON.stringify({ status, message: 'English', data }), { status })
const page = (content: unknown[], totalElements = content.length, totalPages = 1) => ({ content, page: 0, size: 9, totalElements, totalPages, hasNext: false })
const options = { topics: page([{ id: 'java', name: 'Java' }, { id: 'react', name: 'React' }]), tags: page([{ id: 't1', name: 'Spring' }]) }

function mockApi(list: (url: URL) => Response | Promise<Response> = () => json(page([item], 42, 5))) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    return url.pathname.endsWith('/options') ? json(options) : list(url)
  })
  vi.stubGlobal('fetch', fetch)
  setAccessToken('reader')
  return fetch
}
const listParams = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.map(([input]) => new URL(String(input))).filter(url => url.pathname === '/api/v1/articles').map(url => Object.fromEntries(url.searchParams))

function Probe() {
  const location = useLocation()
  const navigate = useNavigate()
  return <><output aria-label="url">{location.pathname + location.search}</output><button type="button" onClick={() => navigate(-1)}>back</button><button type="button" onClick={() => navigate(1)}>forward</button></>
}
const renderPage = (url = '/blogs') => render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/blogs" element={<><BlogsPage language="vi" /><Probe /></>} /></Routes></MemoryRouter>)
const url = () => screen.getByRole('status', { name: 'url' }).textContent

it('reads filter and page from the URL, asks for 9 articles and shows header, total chip, cards and pagination', async () => {
  const fetch = mockApi()
  renderPage('/blogs?topicId=java&sort=OLDEST&page=2')
  expect(within(screen.getByRole('status', { name: 'Đang tải bài viết...' })).getAllByRole('listitem')).toHaveLength(9)
  expect(await screen.findByRole('heading', { name: 'Spring Boot từ đầu' })).not.toBeNull()
  expect(listParams(fetch)[0]).toEqual({ topicId: 'java', sort: 'OLDEST', page: '2', size: '9' })
  expect(screen.getByRole('heading', { level: 1, name: 'Bài viết' })).not.toBeNull()
  expect(screen.getByText('42 bài')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Java' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: 'Trang 3' }).getAttribute('aria-current')).toBe('page')
})

it('commits the keyword only on Enter, resets the page and pushes history that Back/Forward replay', async () => {
  const fetch = mockApi()
  const user = userEvent.setup()
  renderPage('/blogs?page=1')
  await screen.findByRole('heading', { name: 'Spring Boot từ đầu' })
  const search = screen.getByRole('searchbox', { name: 'Tìm bài viết' })
  fireEvent.change(search, { target: { value: '  spring  ' } })
  expect(listParams(fetch)).toHaveLength(1)
  await user.type(search, '{Enter}')
  await waitFor(() => expect(url()).toBe('/blogs?keyword=spring'))
  await waitFor(() => expect(listParams(fetch).at(-1)).toEqual({ keyword: 'spring', page: '0', size: '9', sort: 'NEWEST' }))
  await user.click(screen.getByRole('button', { name: 'Trang 2' }))
  await waitFor(() => expect(url()).toBe('/blogs?keyword=spring&page=1'))
  await user.click(screen.getByRole('button', { name: 'back' }))
  await waitFor(() => expect(url()).toBe('/blogs?keyword=spring'))
  await user.click(screen.getByRole('button', { name: 'back' }))
  await waitFor(() => expect(url()).toBe('/blogs?page=1'))
  expect((screen.getByRole('searchbox', { name: 'Tìm bài viết' }) as HTMLInputElement).value).toBe('')
  await user.click(screen.getByRole('button', { name: 'forward' }))
  await waitFor(() => expect((screen.getByRole('searchbox', { name: 'Tìm bài viết' }) as HTMLInputElement).value).toBe('spring'))
})

it('topic chip, tag and sort write the URL and reset the page; clearing the keyword commits at once', async () => {
  mockApi()
  const user = userEvent.setup()
  renderPage('/blogs?keyword=java&page=3')
  await screen.findByRole('heading', { name: 'Spring Boot từ đầu' })
  await user.click(screen.getByRole('button', { name: 'React' }))
  await waitFor(() => expect(url()).toBe('/blogs?keyword=java&topicId=react'))
  await user.selectOptions(screen.getByRole('combobox', { name: 'Thẻ' }), 't1')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Sắp xếp' }), 'OLDEST')
  await waitFor(() => expect(url()).toBe('/blogs?keyword=java&topicId=react&tagId=t1&sort=OLDEST'))
  await user.click(screen.getByRole('button', { name: 'Xóa từ khóa' }))
  await waitFor(() => expect(url()).toBe('/blogs?topicId=react&tagId=t1&sort=OLDEST'))
  await user.click(screen.getByRole('button', { name: 'Tất cả' }))
  await waitFor(() => expect(url()).toBe('/blogs?tagId=t1&sort=OLDEST'))
})

it('separates “no match” (clear filters) from “no articles yet”', async () => {
  mockApi(() => json(page([])))
  const user = userEvent.setup()
  renderPage('/blogs?tagId=t1')
  expect(await screen.findByText('Không tìm thấy bài viết phù hợp')).not.toBeNull()
  await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
  expect(await screen.findByText('Chưa có bài viết nào')).not.toBeNull()
  expect(url()).toBe('/blogs')
  expect(screen.queryByRole('button', { name: 'Xóa bộ lọc' })).toBeNull()
})

it('normalizes empty, default and unknown params instead of treating them as filters', async () => {
  const fetch = mockApi(() => json(page([])))
  renderPage('/blogs?keyword=&sort=NEWEST&page=0&foo=1')
  expect(await screen.findByText('Chưa có bài viết nào')).not.toBeNull()
  await waitFor(() => expect(url()).toBe('/blogs'))
  expect(screen.queryByRole('button', { name: 'Xóa bộ lọc' })).toBeNull()
  expect(listParams(fetch).every(params => !('foo' in params))).toBe(true)
})

it('shows a translated error with retry instead of the backend text', async () => {
  let fail = true
  mockApi(() => fail ? json(null, 503) : json(page([item])))
  const user = userEvent.setup()
  renderPage()
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('Hệ thống tạm thời gián đoạn')
  expect(alert.textContent).not.toContain('English')
  fail = false
  await user.click(within(alert).getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('heading', { name: 'Spring Boot từ đầu' })).not.toBeNull()
})

it('links “Saved articles” in the header and shows save buttons only when the account may save', async () => {
  const fetch = mockApi()
  renderPage()
  await screen.findByRole('heading', { name: 'Spring Boot từ đầu' })
  expect(screen.getByRole('link', { name: 'Bài đã lưu' }).getAttribute('href')).toBe('/me/saved-articles')
  expect(screen.getByRole('button', { name: 'Lưu bài viết' })).not.toBeNull()
  cleanup()
  render(<MemoryRouter initialEntries={['/blogs']}><Routes><Route path="/blogs" element={<BlogsPage language="vi" canSave={false} />} /></Routes></MemoryRouter>)
  await screen.findByRole('heading', { name: 'Spring Boot từ đầu' })
  expect(screen.queryByRole('link', { name: 'Bài đã lưu' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Lưu bài viết' })).toBeNull()
  expect(fetch.mock.calls.filter(([input]) => /saved/.test(String(input)))).toEqual([])
})
