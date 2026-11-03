import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaxonomyPage } from './TaxonomyPage'
import { setAccessToken } from '../../services/api/client'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const java = { id: 't1', name: 'Java', description: 'Ngôn ngữ JVM', active: true }
type Call = { url: string; init?: RequestInit }
function stub(calls: Call[], content = [java]) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    const body = init?.body ? JSON.parse(String(init.body)) : null
    const data = init?.method === 'POST' ? { id: 't2', active: true, ...body }
      : url.endsWith('/status') ? { ...java, active: false }
        : url.includes('/topics/t1') ? java : { content, hasNext: false, totalElements: content.length }
    return new Response(JSON.stringify({ status: 200, data }))
  }))
  setAccessToken('admin-test')
}

it('creates a topic from the dialog and reports it', async () => {
  const calls: Call[] = []
  stub(calls)
  const user = userEvent.setup()
  render(<TaxonomyPage kind="topics" />)
  await screen.findByRole('button', { name: /Java/ })
  expect(screen.getByText('1 kết quả')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Tạo mới' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Tên'), { target: { value: 'Kotlin' } })
  await user.click(within(dialog).getByRole('button', { name: 'Tạo mới' }))
  await waitFor(() => expect(calls.find(call => call.init?.method === 'POST')?.init?.body).toBe(JSON.stringify({ name: 'Kotlin', description: '', icon: null })))
  expect((await screen.findByText('Đã tạo chủ đề: Kotlin')).closest('[role=status]')).not.toBeNull()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

it('toggles status through an AlertDialog carrying the old question', async () => {
  const calls: Call[] = []
  stub(calls)
  const confirm = vi.spyOn(window, 'confirm')
  const user = userEvent.setup()
  render(<TaxonomyPage kind="topics" />)
  await user.click(await screen.findByRole('button', { name: /Java/ }))
  const dialog = await screen.findByRole('dialog')
  expect((within(dialog).getByLabelText('Tên') as HTMLInputElement).value).toBe('Java')
  await user.click(within(dialog).getByRole('button', { name: 'Ngừng hoạt động' }))
  const alert = await screen.findByRole('alertdialog')
  expect(within(alert).getByText('Thay đổi trạng thái Java?')).toBeTruthy()
  await user.click(within(alert).getByRole('button', { name: 'Ngừng hoạt động' }))
  await waitFor(() => expect(calls.find(call => call.url.endsWith('/topics/t1/status'))?.init?.body).toBe(JSON.stringify({ active: false })))
  expect(confirm).not.toHaveBeenCalled()
})

it('shows an empty state with a create action', async () => {
  stub([], [])
  render(<TaxonomyPage kind="tags" />)
  const empty = await screen.findByRole('status')
  expect(empty.textContent).toContain('Chưa có dữ liệu.')
  expect(within(empty).getByRole('button', { name: 'Tạo mới' })).toBeTruthy()
})

it('searches as the admin types', async () => {
  const calls: Call[] = []
  stub(calls)
  render(<TaxonomyPage kind="topics" />)
  await screen.findByRole('button', { name: /Java/ })
  fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'ja' } })
  await waitFor(() => expect(calls.some(call => call.url.includes('keyword=ja'))).toBe(true))
})

const json = (data: unknown, status = 200) => new Response(JSON.stringify(status < 400 ? { status, data } : { status, ...(data as object) }), { status })

// The backend answers a duplicate with an English message; the Vietnamese admin must read Vietnamese, inside the open form.
it('explains a duplicate name in Vietnamese and keeps the form open', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => init?.method === 'POST'
    ? json({ code: 'TOPIC_EXISTED', message: 'Topic name already exists' }, 409)
    : json({ content: [java], hasNext: false, totalElements: 1 })))
  setAccessToken('admin-test')
  const user = userEvent.setup()
  render(<TaxonomyPage kind="topics" />)
  await screen.findByRole('button', { name: /Java/ })
  await user.click(screen.getByRole('button', { name: 'Tạo mới' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Tên'), { target: { value: 'java' } })
  await user.click(within(dialog).getByRole('button', { name: 'Tạo mới' }))
  expect((await within(dialog).findByRole('alert')).textContent).toBe('Tên chủ đề đã tồn tại. Hãy chọn tên khác.')
  expect(screen.queryByText(/already exists/)).toBeNull()
})

it('reports a created tag in English when the app is in English', async () => {
  stub([])
  const user = userEvent.setup()
  render(<TaxonomyPage kind="tags" language="en" />)
  await screen.findByRole('button', { name: /Java/ })
  await user.click(screen.getByRole('button', { name: 'Create new' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Kotlin' } })
  await user.click(within(dialog).getByRole('button', { name: 'Create new' }))
  expect(await screen.findByText('Created tag: Kotlin')).toBeTruthy()
})

// 12 per page (3-column grid), statistics from count-only queries, numbered pages.
it('pages 12 items at a time and shows active/hidden statistics', async () => {
  const urls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    urls.push(String(input))
    const params = new URL(String(input)).searchParams
    const count = params.get('size') !== '1' ? 30 : params.get('active') === 'true' ? 26 : params.get('active') === 'false' ? 4 : 30
    return json({ content: [java], hasNext: true, totalElements: count })
  }))
  setAccessToken('admin-test')
  const user = userEvent.setup()
  render(<TaxonomyPage kind="topics" />)
  const stat = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement!.querySelector('dd')!.textContent
  await waitFor(() => expect(stat('Tổng chủ đề')).toBe('30'))
  expect(stat('Đang hoạt động')).toBe('26')
  expect(stat('Đang ẩn')).toBe('4')
  expect(urls.some(url => url.includes('size=12') && url.includes('page=0'))).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Trang 3' }))
  await waitFor(() => expect(urls.some(url => url.includes('size=12') && url.includes('page=2'))).toBe(true))
})

// Topics carry a brand icon: the picker suggests icons from the typed name and the slug is sent with the form.
it('picks a suggested brand icon for a new topic', async () => {
  const calls: Call[] = []
  stub(calls)
  const user = userEvent.setup()
  render(<TaxonomyPage kind="topics" />)
  await screen.findByRole('button', { name: /Java/ })
  await user.click(screen.getByRole('button', { name: 'Tạo mới' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Tên'), { target: { value: 'Docker' } })
  await user.click(await within(dialog).findByRole('button', { name: 'Docker' }, { timeout: 10000 }))
  expect(within(dialog).getByRole('button', { name: 'Docker' }).getAttribute('aria-pressed')).toBe('true')
  await user.click(within(dialog).getByRole('button', { name: 'Tạo mới' }))
  await waitFor(() => expect(calls.find(call => call.init?.method === 'POST')?.init?.body).toBe(JSON.stringify({ name: 'Docker', description: '', icon: 'docker' })))
}, 20000)

// Tags keep the plain form: no icon field is shown or sent.
it('does not offer icons for tags', async () => {
  const calls: Call[] = []
  stub(calls)
  const user = userEvent.setup()
  render(<TaxonomyPage kind="tags" />)
  await screen.findByRole('button', { name: /Java/ })
  await user.click(screen.getByRole('button', { name: 'Tạo mới' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).queryByLabelText('Tìm icon')).toBeNull()
  fireEvent.change(within(dialog).getByLabelText('Tên'), { target: { value: 'jwt' } })
  await user.click(within(dialog).getByRole('button', { name: 'Tạo mới' }))
  await waitFor(() => expect(calls.find(call => call.init?.method === 'POST')?.init?.body).toBe(JSON.stringify({ name: 'jwt', description: '' })))
})

// Switching topics → tags quickly: a late topic count must not overwrite the tag statistics.
it('keeps the statistics of the current kind when an older count answers last', async () => {
  const late: (() => void)[] = []
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    const isCount = new URL(url).searchParams.get('size') === '1'
    const answer = () => json({ content: [], hasNext: false, totalElements: url.includes('/topics') ? 99 : 7 })
    if (isCount && url.includes('/topics')) return new Promise<Response>(resolve => late.push(() => resolve(answer())))
    return Promise.resolve(answer())
  }))
  setAccessToken('admin-test')
  const { rerender } = render(<TaxonomyPage kind="topics" />)
  await waitFor(() => expect(late.length).toBe(3))
  rerender(<TaxonomyPage kind="tags" />)
  const stat = () => screen.getByText('Tổng thẻ', { selector: 'dt' }).parentElement!.querySelector('dd')!.textContent
  await waitFor(() => expect(stat()).toBe('7'))
  late.forEach(resolve => resolve())
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(stat()).toBe('7')
})
