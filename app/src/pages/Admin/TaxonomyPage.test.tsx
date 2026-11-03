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
  await waitFor(() => expect(calls.find(call => call.init?.method === 'POST')?.init?.body).toBe(JSON.stringify({ name: 'Kotlin', description: '' })))
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
