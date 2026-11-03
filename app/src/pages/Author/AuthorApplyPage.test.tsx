import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthorApplyPage } from './AuthorApplyPage'
import { setAccessToken } from '../../services/api/client'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const bio = 'Tôi có 6 năm kinh nghiệm phát triển backend Java và từng hướng dẫn nhiều bạn mới vào nghề.'
const profile = (status: string, extra: Record<string, unknown> = {}) => ({ id: 'p1', bio, expertise: 'Phát triển Backend', portfolioUrl: 'https://example.com/me', status, version: 4, reviewNote: null, reviewedAt: null, suspensionReason: null, suspendedAt: null, restorationNote: null, restoredAt: null, createdAt: '2026-10-01T03:00:00Z', updatedAt: '2026-10-02T03:00:00Z', ...extra })
const history = [
  { decision: 'REJECTED', reviewNote: 'Cần bổ sung ví dụ bài viết', applicationVersion: 2, bioSnapshot: bio, expertiseSnapshot: 'Phát triển Backend', portfolioUrlSnapshot: null, reviewedAt: '2026-10-05T03:00:00Z' },
  { decision: 'REJECTED', reviewNote: 'Giới thiệu quá ngắn', applicationVersion: 1, bioSnapshot: bio, expertiseSnapshot: 'Cơ sở dữ liệu', portfolioUrlSnapshot: null, reviewedAt: '2026-10-01T03:00:00Z' },
]

type Call = { url: string; init?: RequestInit }
type Reply = { status?: number; data: unknown }
// Serve the real envelope at the network boundary; GET replies are consumed in order (last one repeats).
function stub(gets: Reply[], write?: Reply) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    const reply = (init?.method ?? 'GET') === 'GET' ? (gets.length > 1 ? gets.shift()! : gets[0]) : write ?? { data: null }
    const status = reply.status ?? 200
    return new Response(JSON.stringify({ status, message: status === 200 ? 'OK' : 'Raw backend message', data: reply.data }), { status })
  }))
  setAccessToken('learner-test')
  return calls
}
const writes = (calls: Call[]) => calls.filter(call => call.init?.method === 'POST' || call.init?.method === 'PATCH')
const body = (call: Call) => JSON.parse(String(call.init?.body))

it('submits a new application with the Vietnamese expertise value even when the UI is English', async () => {
  const calls = stub([{ data: { applicationStatus: 'NOT_APPLIED', profile: null, reviewHistory: [] } }, { data: { applicationStatus: 'PENDING', profile: profile('PENDING'), reviewHistory: [] } }])
  const user = userEvent.setup()
  render(<AuthorApplyPage language="en" />)
  // Expertise is a grouped set of radio chips; the English label still submits the Vietnamese value.
  const picker = await screen.findByRole('group', { name: /Expertise/ })
  expect(within(picker).getAllByRole('radio')).toHaveLength(22)
  expect(within(picker).getByRole('group', { name: 'Data & AI' })).toBeTruthy()
  const backend = within(picker).getByRole('radio', { name: 'Backend development' })
  expect(backend).toHaveProperty('value', 'Phát triển Backend')
  // Validation failure never reaches the API and is reported in English.
  fireEvent.change(screen.getByLabelText(/About you/), { target: { value: 'Too short' } })
  await user.click(backend)
  expect(backend).toHaveProperty('checked', true)
  await user.click(screen.getByRole('button', { name: /Submit application/ }))
  expect((await screen.findByRole('alert')).textContent).toMatch(/50/)
  expect(writes(calls)).toHaveLength(0)
  fireEvent.change(screen.getByLabelText(/About you/), { target: { value: bio } })
  await user.click(screen.getByRole('button', { name: /Submit application/ }))
  expect((await screen.findByRole('status')).textContent).toMatch(/submitted/i)
  expect(writes(calls)).toHaveLength(1)
  expect(writes(calls)[0].init?.method).toBe('POST')
  expect(body(writes(calls)[0])).toEqual({ bio, expertise: 'Phát triển Backend' })
  expect(screen.queryByRole('button', { name: /Submit application/ })).toBeNull()
})

it.each([
  ['PENDING', { }, 'Chờ duyệt'],
  ['APPROVED', { reviewedAt: '2026-10-06T03:00:00Z' }, 'Đã duyệt'],
  ['SUSPENDED', { suspensionReason: 'Vi phạm quy định nội dung', suspendedAt: '2026-10-07T03:00:00Z' }, 'Vi phạm quy định nội dung'],
])('shows %s without a submittable form', async (status, extra, text) => {
  const calls = stub([{ data: { applicationStatus: status, profile: profile(status, extra), reviewHistory: [] } }])
  render(<AuthorApplyPage language="vi" />)
  expect((await screen.findAllByText(text)).length).toBeGreaterThan(0)
  expect(screen.getByText(bio)).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Giới thiệu bản thân và kinh nghiệm' }).tabIndex).toBe(0)
  expect(screen.queryByRole('button', { name: /Gửi/ })).toBeNull()
  expect(screen.queryByRole('textbox')).toBeNull()
  // An empty history renders no timeline block.
  expect(screen.queryByRole('list', { name: 'Lịch sử xét duyệt' })).toBeNull()
  expect(writes(calls)).toHaveLength(0)
})

it('highlights the rejection, lists history newest first and resubmits with expectedVersion and a saved free-text expertise', async () => {
  const legacy = 'Lập trình nhúng cho xe điện'
  const calls = stub([{ data: { applicationStatus: 'REJECTED', profile: profile('REJECTED', { expertise: legacy, reviewNote: 'Cần bổ sung ví dụ bài viết', reviewedAt: '2026-10-05T03:00:00Z' }), reviewHistory: history } }])
  const user = userEvent.setup()
  render(<AuthorApplyPage language="en" />)
  const timeline = await screen.findByRole('list', { name: 'Review history' })
  expect(screen.getByRole('region', { name: 'Review history' }).tabIndex).toBe(0)
  expect(screen.getByRole('region', { name: 'Expertise / field' }).tabIndex).toBe(0)
  // The current choice stays visible above the scrolling chip list.
  expect(screen.getByText('Lập trình nhúng cho xe điện', { selector: '[data-slot=expertise-current] *' })).toBeTruthy()
  const items = within(timeline).getAllByRole('listitem')
  expect(items).toHaveLength(2)
  expect(items[0].textContent).toMatch(/Cần bổ sung ví dụ bài viết/)
  expect(items[0].textContent).toMatch(/v2/)
  expect(items[1].textContent).toMatch(/Giới thiệu quá ngắn/)
  expect(timeline.textContent).not.toMatch(/admin|reviewer/i)
  // A saved free-text value is shown verbatim as its own checked chip.
  expect(screen.getByRole('radio', { name: `${legacy} (saved)` })).toHaveProperty('checked', true)
  expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1)
  expect((screen.getByLabelText(/About you/) as HTMLTextAreaElement).value).toBe(bio)
  await user.click(screen.getByRole('button', { name: /Resubmit application/ }))
  await waitFor(() => expect(writes(calls)).toHaveLength(1))
  expect(writes(calls)[0].init?.method).toBe('PATCH')
  expect(body(writes(calls)[0])).toEqual({ bio, expertise: legacy, portfolioUrl: 'https://example.com/me', expectedVersion: 4 })
})

it('reloads the server state after a 409 conflict', async () => {
  const calls = stub([
    { data: { applicationStatus: 'REJECTED', profile: profile('REJECTED', { reviewNote: 'Thiếu portfolio' }), reviewHistory: [] } },
    { data: { applicationStatus: 'PENDING', profile: profile('PENDING', { version: 5 }), reviewHistory: [] } },
  ], { status: 409, data: null })
  const user = userEvent.setup()
  render(<AuthorApplyPage language="vi" />)
  await user.click(await screen.findByRole('button', { name: /Gửi lại hồ sơ/ }))
  expect((await screen.findByRole('alert')).textContent).toBe('Hồ sơ đã thay đổi')
  await waitFor(() => expect(screen.queryByRole('button', { name: /Gửi lại hồ sơ/ })).toBeNull())
  expect(calls.filter(call => (call.init?.method ?? 'GET') === 'GET')).toHaveLength(2)
  expect(screen.getAllByText('Chờ duyệt').length).toBeGreaterThan(0)
})

it('keeps the conflict message and offers a retry when the reload after 409 fails', async () => {
  stub([
    { data: { applicationStatus: 'NOT_APPLIED', profile: null, reviewHistory: [] } },
    { status: 500, data: null },
  ], { status: 409, data: null })
  const user = userEvent.setup()
  render(<AuthorApplyPage language="en" />)
  fireEvent.change(await screen.findByLabelText(/About you/), { target: { value: bio } })
  await user.click(screen.getByRole('radio', { name: 'Databases' }))
  await user.click(screen.getByRole('button', { name: /Submit application/ }))
  expect((await screen.findByRole('alert')).textContent).toBe('The application has changed')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Submit application/ })).toBeNull()
})

it('keeps the typed data and shows a generic warning on 403', async () => {
  stub([{ data: { applicationStatus: 'NOT_APPLIED', profile: null, reviewHistory: [] } }], { status: 403, data: null })
  const user = userEvent.setup()
  render(<AuthorApplyPage language="vi" />)
  fireEvent.change(await screen.findByLabelText(/Giới thiệu/), { target: { value: bio } })
  await user.click(screen.getByRole('radio', { name: 'Cơ sở dữ liệu' }))
  await user.click(screen.getByRole('button', { name: /Gửi hồ sơ/ }))
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toMatch(/Không gửi được hồ sơ/)
  expect(alert.textContent).not.toMatch(/Raw backend message/)
  expect((screen.getByLabelText(/Giới thiệu/) as HTMLTextAreaElement).value).toBe(bio)
  expect(screen.getByRole('radio', { name: 'Cơ sở dữ liệu' })).toHaveProperty('checked', true)
})

it('offers a retry when loading fails', async () => {
  const calls = stub([{ status: 500, data: null }, { data: { applicationStatus: 'NOT_APPLIED', profile: null, reviewHistory: [] } }])
  const user = userEvent.setup()
  render(<AuthorApplyPage language="en" />)
  expect((await screen.findByRole('alert')).textContent).not.toMatch(/Raw backend message/)
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByLabelText(/About you/)).toBeTruthy()
  expect(calls).toHaveLength(2)
})
