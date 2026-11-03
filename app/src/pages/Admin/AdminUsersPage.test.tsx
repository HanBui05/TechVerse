import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminUsersPage } from './AdminUsersPage'
import { setAccessToken } from '../../services/api/client'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals(); vi.restoreAllMocks() })

// Translate enum labels without accidentally sending Vietnamese strings to the API.
it('displays Vietnamese roles/statuses but submits the original enum filter values', async () => {
  const urls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    urls.push(String(input))
    return new Response(JSON.stringify({ status: 200, data: { content: [], hasNext: false } }))
  }))
  setAccessToken('admin-test')
  const user = userEvent.setup()
  render(<AdminUsersPage />)
  expect(screen.queryByRole('option', { name: 'Chờ duyệt' })).not.toBeNull()
  expect((screen.getByRole('option', { name: 'Chờ duyệt' }) as HTMLOptionElement).value).toBe('PENDING')
  await user.selectOptions(screen.getByLabelText('Hồ sơ tác giả'), 'PENDING')
  await user.selectOptions(screen.getByLabelText('Vai trò'), 'AUTHOR')
  await waitFor(() => expect(urls.some(url => url.includes('authorStatus=PENDING') && url.includes('role=AUTHOR'))).toBe(true))
})

const minh = { id: 'u1', fullName: 'Trần Minh', email: 'minh@example.com', roles: ['LEARNER'], active: true, authorProfileStatus: null, createdAt: '2026-01-02T00:00:00Z' }
function stubUsers(calls: { url: string; init?: RequestInit }[], content = [minh]) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    const data = url.includes('/admin/users/u1') ? { ...minh, avatarUrl: null, phoneNumber: '0900', dateOfBirth: null, authorProfile: null }
      : url.includes('bulk-status') ? {} : { content, hasNext: false, totalElements: content.length }
    return new Response(JSON.stringify({ status: 200, data }))
  }))
  setAccessToken('admin-test')
}

// Bulk lock goes through an AlertDialog carrying the old confirm question; nothing is sent until confirmed.
it('confirms bulk lock in an AlertDialog before sending the same payload', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  stubUsers(calls)
  const confirm = vi.spyOn(window, 'confirm')
  const user = userEvent.setup()
  render(<AdminUsersPage />)
  await user.click(await screen.findByRole('checkbox', { name: 'Chọn Trần Minh' }))
  expect(screen.getByText('1 kết quả')).toBeTruthy()
  expect(screen.getByText('Đã chọn 1')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Khóa' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText('Khóa 1 tài khoản đã chọn?')).toBeTruthy()
  expect(calls.some(call => call.url.includes('bulk-status'))).toBe(false)
  await user.click(within(dialog).getByRole('button', { name: 'Khóa' }))
  await waitFor(() => expect(calls.find(call => call.url.includes('bulk-status'))?.init?.body).toBe(JSON.stringify({ userIds: ['u1'], active: false })))
  expect(confirm).not.toHaveBeenCalled()
})

it('opens account details in a side sheet', async () => {
  stubUsers([])
  const user = userEvent.setup()
  render(<AdminUsersPage />)
  await user.click(await screen.findByRole('button', { name: /Trần Minh/ }))
  const sheet = await screen.findByRole('dialog')
  expect(within(sheet).getByText('0900')).toBeTruthy()
  expect(within(sheet).getByRole('button', { name: 'Khóa tài khoản' })).toBeTruthy()
})

it('shows an empty state when no user matches', async () => {
  stubUsers([], [])
  render(<AdminUsersPage />)
  expect((await screen.findByRole('status')).textContent).toContain('Không tìm thấy người dùng.')
})

// Search runs while typing (debounced), without pressing Enter; list rows show the real avatar.
it('searches as the admin types and shows the real avatar', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    calls.push({ url: String(input) })
    return new Response(JSON.stringify({ status: 200, data: { content: [{ ...minh, avatarUrl: 'https://cdn.example.com/minh.png' }], hasNext: false, totalElements: 1 } }))
  }))
  setAccessToken('admin-test')
  render(<AdminUsersPage />)
  expect((await screen.findByRole('img', { name: /Trần Minh/ })).getAttribute('src')).toBe('https://cdn.example.com/minh.png')
  fireEvent.change(screen.getByLabelText('Tìm theo tên hoặc email'), { target: { value: 'min' } })
  await waitFor(() => expect(calls.some(call => call.url.includes('keyword=min'))).toBe(true))
})

// A slow response for an older keyword must not replace the newer results (admin could lock the wrong account).
it('keeps the newest search results when an older request answers last', async () => {
  const pending = new Map<string, (users: typeof minh[]) => void>()
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const keyword = new URL(String(input)).searchParams.get('keyword') || ''
    return new Promise<Response>(resolve => {
      const answer = (content: typeof minh[]) => resolve(new Response(JSON.stringify({ status: 200, data: { content, hasNext: false, totalElements: content.length } })))
      if (!keyword) answer([])
      else pending.set(keyword, answer)
    })
  }))
  setAccessToken('admin-test')
  render(<AdminUsersPage />)
  const search = screen.getByLabelText('Tìm theo tên hoặc email')
  fireEvent.change(search, { target: { value: 'a' } })
  await waitFor(() => expect(pending.has('a')).toBe(true))
  fireEvent.change(search, { target: { value: 'ab' } })
  await waitFor(() => expect(pending.has('ab')).toBe(true))
  pending.get('ab')!([{ ...minh, id: 'new', fullName: 'Kết quả mới' }])
  expect(await screen.findByText('Kết quả mới')).toBeTruthy()
  pending.get('a')!([{ ...minh, id: 'old', fullName: 'Kết quả cũ' }])
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(screen.queryByText('Kết quả cũ')).toBeNull()
  expect(screen.getByText('Kết quả mới')).toBeTruthy()
})
