import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminCommissionPage } from './AdminCommissionPage'
import { setAccessToken } from '../../../services/api/client'
import { json } from '../../Courses/fixtures'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const policy = { id: 'p1', rateBps: 2000, effectiveFrom: '2026-11-14T02:00:00Z' }
type Handler = (init?: RequestInit) => Response
const stub = (handler: Handler) => { const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => handler(init)); vi.stubGlobal('fetch', fetchMock); return fetchMock }
const puts = (fetchMock: ReturnType<typeof stub>) => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT').map(([, init]) => JSON.parse(String(init?.body)))
const rate = () => screen.getByLabelText(/Tỷ lệ mới/) as HTMLInputElement

it('shows the current rate and effective date from the server, and an example that only illustrates', async () => {
  stub(() => json(policy))
  render(<AdminCommissionPage language="vi" />)
  expect(screen.getByRole('status', { name: 'Đang tải tỷ lệ...' })).toBeTruthy()
  expect(await screen.findByText('20%')).toBeTruthy()
  expect(screen.getByText(/2000 bps/)).toBeTruthy()
  expect(screen.getByText(/Tỷ lệ hoa hồng · Hiệu lực từ/)).toBeTruthy()
  expect(screen.getByText('Đổi tỷ lệ có hiệu lực ngay cho đơn mới; đơn đã tạo giữ tỷ lệ cũ.')).toBeTruthy()
  fireEvent.change(rate(), { target: { value: '15' } })
  expect(screen.getByText(/nền tảng giữ 52\.500/)).toBeTruthy(); expect(screen.getByText(/tác giả nhận 297\.500/)).toBeTruthy()
})

it('saves only after the confirm dialog: body is whole bps, then the policy is reloaded from the server', async () => {
  let current = policy
  const fetchMock = stub(init => init?.method === 'PUT' ? (current = { ...policy, id: 'p2', rateBps: 1500 }, json(current)) : json(current))
  const user = userEvent.setup()
  render(<AdminCommissionPage language="vi" />)
  await screen.findByText('20%')
  fireEvent.change(rate(), { target: { value: '15' } })
  await user.click(screen.getByRole('button', { name: 'Lưu tỷ lệ' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog.textContent).toContain('15%')
  expect(puts(fetchMock)).toHaveLength(0)
  await user.click(within(dialog).getByRole('button', { name: 'Đổi tỷ lệ' }))
  expect(await screen.findByText('Đã cập nhật tỷ lệ.')).toBeTruthy()
  expect(puts(fetchMock)).toEqual([{ rateBps: 1500 }])
  expect(await screen.findByText('15%')).toBeTruthy()
})

it('reports an unchanged rate when the server returns the same policy', async () => {
  stub(() => json(policy))
  const user = userEvent.setup()
  render(<AdminCommissionPage language="vi" />)
  await screen.findByText('20%')
  fireEvent.change(rate(), { target: { value: '20' } })
  await user.click(screen.getByRole('button', { name: 'Lưu tỷ lệ' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Đổi tỷ lệ' }))
  expect(await screen.findByText('Tỷ lệ hiện tại không đổi.')).toBeTruthy()
})

it.each(['', 'abc', '-1', '100.5', '101', '1.234', '1e2'])('blocks the invalid rate %j on the client and sends nothing', async bad => {
  const fetchMock = stub(() => json(policy))
  render(<AdminCommissionPage language="vi" />)
  await screen.findByText('20%')
  fireEvent.change(rate(), { target: { value: bad } })
  expect((screen.getByRole('button', { name: 'Lưu tỷ lệ' }) as HTMLButtonElement).disabled).toBe(true)
  if (bad) expect(screen.getByText('Tỷ lệ không hợp lệ.')).toBeTruthy()
  expect(puts(fetchMock)).toHaveLength(0)
})

it('shows the server error under the field and keeps the typed value', async () => {
  const fetchMock = stub(init => init?.method === 'PUT' ? json(null, 400, 'COMMISSION_RATE_INVALID') : json(policy))
  const user = userEvent.setup()
  render(<AdminCommissionPage language="vi" />)
  await screen.findByText('20%')
  fireEvent.change(rate(), { target: { value: '15' } })
  await user.click(screen.getByRole('button', { name: 'Lưu tỷ lệ' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Đổi tỷ lệ' }))
  expect(await screen.findByText('Tỷ lệ không hợp lệ.')).toBeTruthy()
  expect(rate().value).toBe('15')
  expect(puts(fetchMock)).toHaveLength(1)
})

it('warns that payment is unavailable while no policy exists and lets the admin create the first one', async () => {
  let created = false
  stub(init => init?.method === 'PUT' ? (created = true, json(policy)) : json(created ? policy : null))
  const user = userEvent.setup()
  render(<AdminCommissionPage language="vi" />)
  expect(await screen.findByText('Chưa có tỷ lệ; thanh toán tạm thời không khả dụng.')).toBeTruthy()
  fireEvent.change(rate(), { target: { value: '20' } })
  await user.click(screen.getByRole('button', { name: 'Lưu tỷ lệ' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Đổi tỷ lệ' }))
  expect(await screen.findByText('Đã cập nhật tỷ lệ.')).toBeTruthy()
  await waitFor(() => expect(screen.queryByText('Chưa có tỷ lệ; thanh toán tạm thời không khả dụng.')).toBeNull())
})

it('shows a load error with retry', async () => {
  let fail = true
  stub(() => fail ? json(null, 500, 'INTERNAL') : json(policy))
  const user = userEvent.setup()
  render(<AdminCommissionPage language="vi" />)
  expect(await screen.findByRole('alert')).toBeTruthy()
  fail = false
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('20%')).toBeTruthy()
})
