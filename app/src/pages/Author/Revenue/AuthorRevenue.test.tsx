import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthorRevenuePage } from './AuthorRevenuePage'
import { setAccessToken } from '../../../services/api/client'
import { json, page } from '../../Courses/fixtures'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

// Totals deliberately do not equal the sum of the rows shown: the page must print the server numbers, never add them up.
const totals = { itemCount: 12, grossAmount: 4200000, platformAmount: 840000, authorAmount: 3360000 }
const item = { courseId: 'c1', courseTitle: 'Spring Boot từ A đến Z', paidAt: '2026-11-15T03:42:00Z', unitPriceAmount: 350000, commissionRateBps: 2000, commissionAmount: 70000, authorNetAmount: 280000 }
const show = (initial = '/author/revenue') => render(<MemoryRouter initialEntries={[initial]}><AuthorRevenuePage language="vi" /></MemoryRouter>)

it('prints the four server totals and every item from its own snapshot, without buyers or payout wording', async () => {
  const fetchMock = vi.fn(async () => json({ totals, items: page([item], 3) }))
  vi.stubGlobal('fetch', fetchMock)
  show('/author/revenue?page=1')
  expect(screen.getByRole('status', { name: 'Đang tải doanh thu...' })).toBeTruthy()
  expect(await screen.findByText('Spring Boot từ A đến Z')).toBeTruthy()
  expect(screen.getByText('12')).toBeTruthy()
  expect(screen.getByText(/4\.200\.000/)).toBeTruthy(); expect(screen.getByText(/840\.000/, { selector: 'dd' })).toBeTruthy(); expect(screen.getByText(/3\.360\.000/)).toBeTruthy()
  expect(screen.getByText(/Giá 350\.000.*Nền tảng giữ 20% \(70\.000.*Bạn nhận 280\.000/)).toBeTruthy()
  expect(screen.getByText('Số liệu theo tỷ lệ tại thời điểm mỗi đơn được tạo.')).toBeTruthy()
  expect(document.body.textContent).not.toMatch(/chi trả|đã thanh toán cho bạn|người mua/i)
  expect(new URL(String((fetchMock.mock.calls[0] as unknown[])[0])).searchParams.get('page')).toBe('1')
  expect(screen.getByRole('navigation', { name: 'Phân trang' })).toBeTruthy()
})

it('shows the empty state when there is no revenue', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json({ totals: { itemCount: 0, grossAmount: 0, platformAmount: 0, authorAmount: 0 }, items: page([]) })))
  show()
  expect(await screen.findByText('Chưa có doanh thu')).toBeTruthy()
  expect(screen.getByText('Doanh thu hiện khi có người học thanh toán khóa của bạn.')).toBeTruthy()
})

it('shows a load error with retry, and the permission message on 403', async () => {
  let status = 500
  vi.stubGlobal('fetch', vi.fn(async () => status === 200 ? json({ totals, items: page([item]) }) : json(null, status, status === 403 ? 'ACCESS_DENIED' : 'INTERNAL')))
  const user = userEvent.setup()
  show()
  expect(await screen.findByRole('alert')).toBeTruthy()
  status = 403
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Bạn không có quyền thực hiện thao tác này.')).toBeTruthy()
  status = 200
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Spring Boot từ A đến Z')).toBeTruthy()
})
