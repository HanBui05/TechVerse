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
  await user.click(await screen.findByRole('button', { name: 'Xem chi tiết Trần Minh' }))
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

const json = (data: unknown, status = 200) => new Response(JSON.stringify(status < 400 ? { status, data } : { status, ...(data as object) }), { status })

// 12 users per page; the numbered pagination asks the API for the chosen zero-based page.
it('requests 12 users per page and jumps to a numbered page', async () => {
  const urls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    urls.push(String(input))
    return json({ content: [minh], hasNext: true, totalElements: 30 })
  }))
  setAccessToken('admin-test')
  const user = userEvent.setup()
  render(<AdminUsersPage />)
  expect(await screen.findByText('Hiển thị 1–12 trong 30')).toBeTruthy()
  expect(urls.some(url => url.includes('size=12') && url.includes('page=0'))).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Trang 2' }))
  await waitFor(() => expect(urls.some(url => url.includes('size=12') && url.includes('page=1'))).toBe(true))
})

// Statistic cards come from count-only queries (size=1) with the matching filter.
it('shows account statistics from count queries', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const params = new URL(String(input)).searchParams
    const count = params.get('size') !== '1' ? 1 : params.get('active') === 'true' ? 25 : params.get('active') === 'false' ? 5 : params.get('role') === 'AUTHOR' ? 7 : 30
    return json({ content: [minh], hasNext: false, totalElements: count })
  }))
  setAccessToken('admin-test')
  render(<AdminUsersPage />)
  const stat = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement!.querySelector('dd')!.textContent
  await waitFor(() => expect(stat('Tổng người dùng')).toBe('30'))
  expect(stat('Đang hoạt động')).toBe('25')
  expect(stat('Đã khóa')).toBe('5')
  expect(stat('Tác giả')).toBe('7')
})

// The backend message is English; in Vietnamese the admin must see a Vietnamese reason.
it('locks one user from its row and explains a refusal in Vietnamese', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).includes('bulk-status')
    ? json({ code: 'ADMIN_SELF_LOCK_NOT_ALLOWED', message: 'An administrator cannot lock their own account' }, 409)
    : json({ content: [minh], hasNext: false, totalElements: 1 })))
  setAccessToken('admin-test')
  const user = userEvent.setup()
  render(<AdminUsersPage />)
  await user.click(await screen.findByRole('button', { name: 'Khóa Trần Minh' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText('Khóa 1 tài khoản đã chọn?')).toBeTruthy()
  await user.click(within(dialog).getByRole('button', { name: 'Khóa tài khoản' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Bạn không thể tự khóa tài khoản của mình.')
  expect(screen.queryByText(/cannot lock/)).toBeNull()
})

// After locking the last user of the last filtered page, the page index must fall back to the last page that still exists.
it('moves back to the last existing page when the current page empties', async () => {
  const urls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    urls.push(String(input))
    const page = new URL(String(input)).searchParams.get('page')
    return json(page === '1' ? { content: [], hasNext: false, totalElements: 12 } : { content: [minh], hasNext: true, totalElements: 13 })
  }))
  setAccessToken('admin-test')
  const user = userEvent.setup()
  render(<AdminUsersPage />)
  await user.click(await screen.findByRole('button', { name: 'Trang 2' }))
  await waitFor(() => expect(urls.filter(url => url.includes('size=12') && url.includes('page=0')).length).toBe(2))
  expect(screen.queryByText(/13–12/)).toBeNull()
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
