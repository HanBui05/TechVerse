import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AdminPayoutsPage } from './AdminPayoutsPage'
import { setAccessToken } from '../../../services/api/client'
import { json, page } from '../../Courses/fixtures'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const account = { bankId: '970436', bankName: 'Vietcombank', accountNo: '0123456789', accountName: 'NGUYEN VAN A', updatedAt: '2026-11-10T00:00:00Z' }
const vietQr = { bankId: '970436', accountNo: '0123456789', accountName: 'NGUYEN VAN A', amount: 1360000, content: 'TVPAY1A2B3C4D', imageUrl: 'https://img.vietqr.io/image/qr.png' }
const author = { authorId: 'a1', fullName: 'Nguyễn Văn A', email: 'a@mail.com', earnedAmount: 3360000, paidOutAmount: 2000000, balanceAmount: 1360000, account, vietQr }
const noAccount = { ...author, authorId: 'a2', fullName: 'Lê Thị C', email: 'c@mail.com', account: null, vietQr: null }
const settled = { ...author, authorId: 'a3', fullName: 'Phạm D', email: 'd@mail.com', paidOutAmount: 3360000, balanceAmount: 0, vietQr: null }
const recorded = { id: 'p1', authorId: 'a1', authorName: 'Nguyễn Văn A', amount: 1000000, bankReference: 'FT26319', bankId: '970436', bankName: 'Vietcombank', accountNo: '0123456789', accountName: 'NGUYEN VAN A', recordedById: 'ad', recordedByName: 'Admin Trần', createdAt: '2026-11-15T03:42:00Z', accountChanged: null }

type Handlers = { authors: (url: URL) => Response; history: (url: URL) => Response; record: (body: Record<string, unknown>) => Response }
const defaults: Handlers = { authors: () => json(page([author, noAccount])), history: () => json(page([recorded])), record: () => json({ ...recorded, amount: 1360000, accountChanged: false }) }
function serve(over: Partial<Handlers> = {}) {
  const h = { ...defaults, ...over }
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/payouts/authors')) return h.authors(url)
    if (init?.method === 'POST') return h.record(JSON.parse(String(init.body)))
    return h.history(url)
  })
  vi.stubGlobal('fetch', mock)
  return mock
}
const gets = (mock: ReturnType<typeof serve>, suffix: string) => mock.mock.calls.filter(c => !(c[1] as RequestInit | undefined)?.method).map(c => new URL(String(c[0]))).filter(u => u.pathname.endsWith(suffix))
const posts = (mock: ReturnType<typeof serve>) => mock.mock.calls.filter(c => (c[1] as RequestInit | undefined)?.method === 'POST').map(c => JSON.parse(String((c[1] as RequestInit).body)))
const show = (initial = '/admin/payouts') => render(<MemoryRouter initialEntries={[initial]}><AdminPayoutsPage language="vi" /></MemoryRouter>)
const openSheet = async (user: ReturnType<typeof userEvent.setup>, name = 'Nguyễn Văn A') => {
  await user.click((await screen.findAllByRole('button', { name: new RegExp(`Chi trả.*${name}`) }))[0])
  return await screen.findByRole('dialog')
}
/** Fill the reference and walk through the confirmation dialog. */
const submit = async (user: ReturnType<typeof userEvent.setup>, sheet: HTMLElement, reference = 'FT26320') => {
  fireEvent.change(within(sheet).getByLabelText(/Mã sao kê/), { target: { value: reference } })
  await user.click(within(sheet).getByRole('button', { name: 'Ghi nhận đã chuyển' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Xác nhận' }))
}

it('lists owed authors with their numbers, asks for owedOnly by default and widens with the checkbox', async () => {
  const mock = serve()
  const user = userEvent.setup()
  show()
  expect(screen.getByRole('status', { name: 'Đang tải công nợ...' })).toBeTruthy()
  expect(await screen.findByText('Nguyễn Văn A')).toBeTruthy()
  expect(screen.getByText('a@mail.com')).toBeTruthy()
  expect(screen.getAllByText('Đã kiếm', { selector: 'dt' })[0].nextElementSibling?.textContent).toMatch(/3\.360\.000/)
  expect(screen.getAllByText('Đã chi', { selector: 'dt' })[0].nextElementSibling?.textContent).toMatch(/2\.000\.000/)
  expect(screen.getAllByText('Còn nợ', { selector: 'dt' })[0].nextElementSibling?.textContent).toMatch(/1\.360\.000/)
  expect(gets(mock, '/payouts/authors')[0].searchParams.get('owedOnly')).toBe('true')
  await user.click(screen.getByRole('checkbox', { name: 'Hiện cả tác giả đã chi đủ' }))
  await waitFor(() => expect(gets(mock, '/payouts/authors').at(-1)!.searchParams.get('owedOnly')).toBe('false'))
  expect(gets(mock, '/payouts/authors').at(-1)!.searchParams.get('page')).toBe('0')
})

it('shows the empty, error and retry states of the debt list', async () => {
  serve({ authors: () => json(page([])) })
  show()
  expect(await screen.findByText('Không còn khoản nào phải chi.')).toBeTruthy()
  cleanup()
  let fail = true
  serve({ authors: () => fail ? json(null, 500, 'INTERNAL') : json(page([author])) })
  const user = userEvent.setup()
  show()
  expect(await screen.findByRole('alert')).toBeTruthy()
  fail = false
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Nguyễn Văn A')).toBeTruthy()
})

it('opens the sheet with the QR, the account, a fixed amount and the author history', async () => {
  const mock = serve()
  const user = userEvent.setup()
  show()
  const sheet = await openSheet(user)
  const qr = within(sheet).getByRole('img', { name: /VietQR/ }) as HTMLImageElement
  expect(qr.src).toBe(vietQr.imageUrl)
  expect(within(sheet).getByText('Số tài khoản').nextElementSibling?.textContent).toContain('0123456789')
  expect(within(sheet).getByText('NGUYEN VAN A')).toBeTruthy()
  expect(within(sheet).getByText('Số tiền cần chuyển').nextElementSibling?.textContent).toMatch(/1\.360\.000/)
  expect(within(sheet).getByText(/Đối chiếu tên chủ tài khoản app ngân hàng hiện ra với tên bên dưới trước khi chuyển/)).toBeTruthy()
  expect(within(sheet).queryByRole('spinbutton')).toBeNull()
  expect(within(sheet).getByRole('button', { name: /Sao chép số tài khoản/i })).toBeTruthy()
  expect(await within(sheet).findByText(/FT26319/)).toBeTruthy()
  expect(gets(mock, '/payouts').some(u => u.searchParams.get('authorId') === 'a1')).toBe(true)
})

it('keeps the record button off until a reference is typed, confirms, then records exactly the shown account and amount', async () => {
  let call = 0
  const mock = serve({ authors: () => json(page(call++ === 0 ? [author, noAccount] : [noAccount])) })
  const user = userEvent.setup()
  show()
  const sheet = await openSheet(user)
  const record = within(sheet).getByRole('button', { name: 'Ghi nhận đã chuyển' }) as HTMLButtonElement
  expect(record.disabled).toBe(true)
  fireEvent.change(within(sheet).getByLabelText(/Mã sao kê/), { target: { value: '  FT26320  ' } })
  expect(record.disabled).toBe(false)
  await user.click(record)
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(/Ghi nhận đã chuyển.*1\.360\.000.*cho Nguyễn Văn A\? Không sửa được sau khi ghi\./)).toBeTruthy()
  expect(posts(mock)).toHaveLength(0)
  await user.click(within(dialog).getByRole('button', { name: 'Xác nhận' }))
  expect(await screen.findByText('Đã ghi nhận khoản chi.')).toBeTruthy()
  expect(posts(mock)).toEqual([{ authorId: 'a1', amount: 1360000, bankReference: 'FT26320', bankId: '970436', accountNo: '0123456789', accountName: 'NGUYEN VAN A' }])
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(screen.queryByText('Nguyễn Văn A')).toBeNull())
  expect(screen.queryByText(/Tác giả đã đổi tài khoản/)).toBeNull()
})

it('warns after a successful record when the author changed the account', async () => {
  serve({ record: () => json({ ...recorded, accountChanged: true }) })
  const user = userEvent.setup()
  show()
  await submit(user, await openSheet(user))
  expect(await screen.findByText('Đã ghi nhận khoản chi.')).toBeTruthy()
  expect(screen.getByText('Tác giả đã đổi tài khoản sau khi bạn mở; khoản chi ghi theo tài khoản bạn đã chuyển.')).toBeTruthy()
})

it.each([
  ['PAYOUT_REFERENCE_CONFLICT', 409, 'Mã sao kê này đã được dùng.'],
  ['PAYOUT_INVALID', 400, 'Thông tin khoản chi không hợp lệ.'],
  ['USER_NOT_FOUND', 404, 'Không tìm thấy tác giả.'],
])('shows %s inside the sheet and keeps it open', async (code, status, copy) => {
  serve({ record: () => json(null, status, code) })
  const user = userEvent.setup()
  show()
  const sheet = await openSheet(user)
  await submit(user, sheet)
  expect(await within(sheet).findByText(copy)).toBeTruthy()
  expect(screen.getByRole('dialog')).toBeTruthy()
})

it('on PAYOUT_EXCEEDS_BALANCE shows the alert and reloads the author numbers into the open sheet', async () => {
  let reloaded = false
  const mock = serve({
    authors: () => json(page([reloaded ? { ...author, paidOutAmount: 2500000, balanceAmount: 860000, vietQr: { ...vietQr, amount: 860000 } } : author])),
    record: () => { reloaded = true; return json(null, 409, 'PAYOUT_EXCEEDS_BALANCE') },
  })
  const user = userEvent.setup()
  show()
  const sheet = await openSheet(user)
  await submit(user, sheet)
  expect(await within(sheet).findByText('Số tiền vượt quá số còn phải chi.')).toBeTruthy()
  await waitFor(() => expect(within(sheet).getByText(/Số còn nợ hiện tại: .*860\.000/)).toBeTruthy())
  // The sheet keeps what it was opened with and cannot record again from it.
  expect(within(sheet).getByText('Số tiền cần chuyển').nextElementSibling?.textContent).toMatch(/1\.360\.000/)
  expect((within(sheet).getByRole('button', { name: 'Ghi nhận đã chuyển' }) as HTMLButtonElement).disabled).toBe(true)
  expect(gets(mock, '/payouts/authors').length).toBeGreaterThan(1)
})

it('goes back to the first page when the current page empties after a record', async () => {
  const mock = serve({ authors: url => json(page(url.searchParams.get('page') === '1' ? [] : [author])) })
  show('/admin/payouts?page=1')
  expect(await screen.findByText('Nguyễn Văn A')).toBeTruthy()
  expect(gets(mock, '/payouts/authors').map(u => u.searchParams.get('page'))).toEqual(['1', '0'])
})

it('after PAYOUT_EXCEEDS_BALANCE never prints an amount it could not reload for that author', async () => {
  let conflict = false
  serve({ authors: () => conflict ? json(page([noAccount])) : json(page([author])), record: () => { conflict = true; return json(null, 409, 'PAYOUT_EXCEEDS_BALANCE') } })
  const user = userEvent.setup()
  show()
  const sheet = await openSheet(user)
  await submit(user, sheet)
  expect(await within(sheet).findByText(/Số còn nợ đã thay đổi/)).toBeTruthy()
  expect(within(sheet).queryByText(/Số còn nợ hiện tại/)).toBeNull()
})

it('gives an author without an account an alert and no form or QR; a settled author has no pay button', async () => {
  serve({ authors: () => json(page([noAccount, settled])) })
  const user = userEvent.setup()
  show('/admin/payouts?all=true')
  expect(await screen.findByText('Lê Thị C')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Chi trả.*Phạm D/ })).toBeNull()
  const sheet = await openSheet(user, 'Lê Thị C')
  expect(within(sheet).getByText('Tác giả chưa khai tài khoản nhận tiền.')).toBeTruthy()
  expect(within(sheet).queryByRole('img')).toBeNull()
  expect(within(sheet).queryByRole('button', { name: 'Ghi nhận đã chuyển' })).toBeNull()
})

it('still shows the transfer details when the QR image fails to load', async () => {
  serve()
  const user = userEvent.setup()
  show()
  const sheet = await openSheet(user)
  fireEvent.error(within(sheet).getByRole('img', { name: /VietQR/ }))
  expect(await within(sheet).findByText('Không tải được mã QR')).toBeTruthy()
  expect(within(sheet).getByText('Số tài khoản').nextElementSibling?.textContent).toContain('0123456789')
})

it('lists every recorded payout on the history tab with account and recorder, paged, with empty and error states', async () => {
  const mock = serve()
  show('/admin/payouts?tab=history&page=1')
  expect(await screen.findByText('FT26319')).toBeTruthy()
  expect(screen.getByText(/Nguyễn Văn A/)).toBeTruthy()
  expect(screen.getByText(/Vietcombank 0123456789 · NGUYEN VAN A/)).toBeTruthy()
  expect(screen.getByText('Ghi bởi: Admin Trần')).toBeTruthy()
  expect(screen.getByText(/1\.000\.000/)).toBeTruthy()
  const call = gets(mock, '/payouts')[0]
  expect(call.pathname).toBe('/api/v1/admin/payouts'); expect(call.searchParams.get('page')).toBe('1'); expect(call.searchParams.has('authorId')).toBe(false)
  cleanup()
  serve({ history: () => json(page([])) })
  show('/admin/payouts?tab=history')
  expect(await screen.findByText('Chưa có khoản chi nào.')).toBeTruthy()
  cleanup()
  serve({ history: () => json(null, 500, 'INTERNAL') })
  show('/admin/payouts?tab=history')
  expect(await screen.findByRole('alert')).toBeTruthy()
})

it('switches tabs through the URL', async () => {
  const mock = serve()
  const user = userEvent.setup()
  show()
  await screen.findByText('Nguyễn Văn A')
  await user.click(screen.getByRole('tab', { name: 'Lịch sử chi' }))
  expect(await screen.findByText('FT26319')).toBeTruthy()
  expect(gets(mock, '/payouts').length).toBeGreaterThan(0)
})
