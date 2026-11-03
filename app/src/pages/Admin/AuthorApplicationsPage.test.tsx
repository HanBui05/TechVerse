import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthorApplicationsPage } from './AuthorApplicationsPage'
import { setAccessToken } from '../../services/api/client'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const app = { id: 'a1', fullName: 'Lê Hoa', email: 'hoa@example.com', avatarUrl: 'https://cdn.example.com/hoa.png', active: true, expertise: 'Java, Spring Boot', status: 'PENDING', version: 3, createdAt: '2026-02-01T00:00:00Z' }
type Call = { url: string; init?: RequestInit }
function stub(calls: Call[], content = [app]) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    const data = url.includes('/author-applications/a1') ? { ...app, bio: 'Viết về JVM', portfolioUrl: null, reviewNote: null, reviewHistory: [] } : { content, hasNext: false, totalElements: content.length }
    return new Response(JSON.stringify({ status: 200, data }))
  }))
  setAccessToken('admin-test')
}

// Quick status chips drive the same `status` filter the old select sent; Pending stays the default.
it('filters by status through the quick chips', async () => {
  const calls: Call[] = []
  stub(calls)
  const user = userEvent.setup()
  render(<AuthorApplicationsPage />)
  await waitFor(() => expect(calls.some(call => call.url.includes('status=PENDING'))).toBe(true))
  expect(screen.getByRole('button', { name: 'Chờ duyệt' }).getAttribute('aria-pressed')).toBe('true')
  await user.click(screen.getByRole('button', { name: 'Đã duyệt' }))
  await waitFor(() => expect(calls.some(call => call.url.includes('status=APPROVED'))).toBe(true))
  await user.click(screen.getByRole('button', { name: 'Tất cả' }))
  await waitFor(() => expect(calls.at(-1)?.url.includes('status=')).toBe(false))
})

it('approves through an AlertDialog with the old question and the same payload', async () => {
  const calls: Call[] = []
  stub(calls)
  const confirm = vi.spyOn(window, 'confirm')
  const user = userEvent.setup()
  render(<AuthorApplicationsPage />)
  await user.click(await screen.findByRole('button', { name: /Lê Hoa/ }))
  const sheet = await screen.findByRole('dialog')
  expect(within(sheet).getByText('Viết về JVM')).toBeTruthy()
  expect((within(sheet).getByRole('button', { name: 'Từ chối' }) as HTMLButtonElement).disabled).toBe(true)
  await user.click(within(sheet).getByRole('button', { name: 'Phê duyệt' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText('Xác nhận thao tác với hồ sơ Lê Hoa?')).toBeTruthy()
  expect(calls.some(call => call.init?.method === 'PATCH')).toBe(false)
  await user.click(within(dialog).getByRole('button', { name: 'Phê duyệt' }))
  await waitFor(() => {
    const patch = calls.find(call => call.init?.method === 'PATCH')
    expect(patch?.url).toContain('/author-applications/a1/review')
    expect(patch?.init?.body).toBe(JSON.stringify({ decision: 'APPROVED', reviewNote: '', expectedVersion: 3 }))
  })
  expect(confirm).not.toHaveBeenCalled()
})

it('requires a note before rejecting', async () => {
  const calls: Call[] = []
  stub(calls)
  const user = userEvent.setup()
  render(<AuthorApplicationsPage />)
  await user.click(await screen.findByRole('button', { name: /Lê Hoa/ }))
  const sheet = await screen.findByRole('dialog')
  fireEvent.change(within(sheet).getByLabelText('Ghi chú / lý do'), { target: { value: 'Thiếu bài mẫu' } })
  await user.click(within(sheet).getByRole('button', { name: 'Từ chối' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Từ chối' }))
  await waitFor(() => expect(calls.find(call => call.init?.method === 'PATCH')?.init?.body).toBe(JSON.stringify({ decision: 'REJECTED', reviewNote: 'Thiếu bài mẫu', expectedVersion: 3 })))
})

it('shows an empty state when no application matches', async () => {
  stub([], [])
  render(<AuthorApplicationsPage />)
  expect((await screen.findByRole('status')).textContent).toContain('Không có hồ sơ phù hợp.')
  expect(screen.getByText('0 kết quả')).toBeTruthy()
})

it('searches as the admin types', async () => {
  const calls: Call[] = []
  stub(calls)
  render(<AuthorApplicationsPage />)
  await screen.findByRole('button', { name: /Lê Hoa/ })
  fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'hoa' } })
  await waitFor(() => expect(calls.some(call => call.url.includes('keyword=hoa'))).toBe(true))
})

// Expertise is a comma-separated string; it is shown as one chip per skill, with the applicant's real avatar.
it('shows expertise as separate chips and the real avatar in the detail sheet', async () => {
  const calls: Call[] = []
  stub(calls)
  const user = userEvent.setup()
  render(<AuthorApplicationsPage />)
  await user.click(await screen.findByRole('button', { name: /Lê Hoa/ }))
  const sheet = await screen.findByRole('dialog')
  const skills = within(sheet).getByRole('list', { name: 'Chuyên môn' })
  expect(within(skills).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Java', 'Spring Boot'])
  expect(within(sheet).getByRole('img', { name: /Lê Hoa/ }).getAttribute('src')).toBe('https://cdn.example.com/hoa.png')
})
