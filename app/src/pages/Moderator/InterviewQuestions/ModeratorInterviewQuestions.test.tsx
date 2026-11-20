import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ModeratorInterviewQuestionsPage } from './ModeratorInterviewQuestionsPage'
import { ModeratorInterviewQuestionDetailPage } from './ModeratorInterviewQuestionDetailPage'
import { setAccessToken } from '../../../services/api/client'
import type { ModeratorInterviewQuestion } from '../../../types/interview'

afterEach(() => {
  cleanup()
  setAccessToken(null)
  vi.unstubAllGlobals()
})

const json = (data: unknown, status = 200, code?: string) =>
  new Response(JSON.stringify({ status, code, message: 'English message', data }), { status })
const page = (content: unknown[], totalElements = content.length) => ({
  content,
  page: 0,
  size: 12,
  totalElements,
  totalPages: 1,
  hasNext: false,
})

const makeModerated = (
  over: Partial<ModeratorInterviewQuestion['question']> = {},
  rest: Partial<ModeratorInterviewQuestion> = {},
): ModeratorInterviewQuestion => ({
  question: {
    id: 'q1',
    topic: { id: 'sql', name: 'SQL' },
    level: 'MEDIUM',
    question: 'Giải thích cơ chế ACID trong cơ sở dữ liệu?',
    sampleAnswer: 'ACID gồm Atomicity, Consistency, Isolation và Durability.',
    hint: 'Nêu đủ 4 tính chất.',
    status: 'PENDING',
    aiAssisted: true,
    version: 2,
    moderationNote: null,
    publishedAt: null,
    createdAt: '2026-11-10T00:00:00Z',
    updatedAt: '2026-11-18T09:00:00Z',
    ...over,
  },
  author: { id: 'a1', fullName: 'Nguyễn A', avatarUrl: null },
  authorEligible: true,
  reviewToken: 'a'.repeat(64),
  ...rest,
})

function mockListApi(list: (url: URL) => Response = () => json(page([makeModerated()]))) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    return url.pathname.endsWith('/options') ? json([{ id: 'sql', name: 'SQL' }]) : list(url)
  })
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('moderator')
  return fetchMock
}

function mockDetailApi(handler: (method: string) => Response) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => handler(init?.method ?? 'GET'))
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('moderator')
  return fetchMock
}

const listCalls = (fetchMock: ReturnType<typeof mockListApi>) =>
  fetchMock.mock.calls.map(([input]) => new URL(String(input))).filter(url => url.pathname === '/api/v1/moderator/interview-questions')
const writes = (fetchMock: ReturnType<typeof mockDetailApi>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={['/moderator/interview-questions/q1']}>
      <Routes>
        <Route path="/moderator/interview-questions/:id" element={<ModeratorInterviewQuestionDetailPage language="vi" />} />
      </Routes>
    </MemoryRouter>,
  )

it('defaults the queue to PENDING, shows AI badge and ineligible author warning, and updates filters', async () => {
  const fetchMock = mockListApi(() => json(page([makeModerated({}, { authorEligible: false })])))
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <ModeratorInterviewQuestionsPage language="vi" />
    </MemoryRouter>,
  )

  const link = await screen.findByRole('link', { name: 'Giải thích cơ chế ACID trong cơ sở dữ liệu?' })
  expect(link.getAttribute('href')).toBe('/moderator/interview-questions/q1')
  expect(Object.fromEntries(listCalls(fetchMock)[0].searchParams)).toMatchObject({ status: 'PENDING', page: '0' })
  expect(screen.getByText('Có dùng AI')).toBeTruthy()
  expect(screen.getByText('Tác giả không còn đủ điều kiện xuất bản.')).toBeTruthy()

  await user.click(within(screen.getByRole('group', { name: 'Trạng thái' })).getByRole('button', { name: 'Bị ẩn bởi kiểm duyệt' }))
  await user.selectOptions(screen.getByLabelText('Mức độ'), 'HARD')
  await user.selectOptions(await screen.findByLabelText('Chủ đề'), 'sql')
  await vi.waitFor(() =>
    expect(Object.fromEntries(listCalls(fetchMock).at(-1)!.searchParams)).toMatchObject({
      status: 'HIDDEN',
      level: 'HARD',
      topicId: 'sql',
      page: '0',
    }),
  )
})

it('shows question, hint, sample answer and approves with reviewToken', async () => {
  const fetchMock = mockDetailApi(method =>
    method === 'PATCH'
      ? json(makeModerated({ status: 'PUBLISHED' }, { reviewToken: 'b'.repeat(64) }))
      : json(makeModerated({ moderationNote: 'Ghi chú cũ' })),
  )
  const user = userEvent.setup()
  renderDetail()

  expect(await screen.findByRole('heading', { level: 1, name: 'Giải thích cơ chế ACID trong cơ sở dữ liệu?' })).toBeTruthy()
  expect(screen.getByText('Nêu đủ 4 tính chất.')).toBeTruthy()
  expect(screen.getByText('ACID gồm Atomicity, Consistency, Isolation và Durability.')).toBeTruthy()
  expect(screen.getByText(/Ghi chú cũ/)).toBeTruthy()

  await user.click(screen.getByRole('button', { name: 'Duyệt' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Duyệt' }))
  expect(await screen.findByText('Đã duyệt câu hỏi phỏng vấn.')).toBeTruthy()
  const [url, init] = writes(fetchMock)[0]
  expect(String(url)).toContain('/moderator/interview-questions/q1/review')
  expect(JSON.parse(String(init!.body))).toEqual({ decision: 'APPROVE', reviewToken: 'a'.repeat(64) })
  expect(screen.getByRole('button', { name: 'Ẩn' })).toBeTruthy()
})

it('requires a reason for REQUEST_CHANGES, HIDE and REMOVE and never calls the API without it', async () => {
  const fetchMock = mockDetailApi(method =>
    method === 'PATCH' ? json(makeModerated({ status: 'HIDDEN' })) : json(makeModerated()),
  )
  const user = userEvent.setup()
  renderDetail()

  await user.click(await screen.findByRole('button', { name: 'Yêu cầu sửa' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Yêu cầu sửa' }))
  expect(within(dialog).getByText('Hãy ghi lý do (tối đa 1.000 ký tự).')).toBeTruthy()
  expect(writes(fetchMock)).toHaveLength(0)

  await user.type(within(dialog).getByRole('textbox'), 'Thiếu ví dụ cụ thể')
  await user.click(within(dialog).getByRole('button', { name: 'Yêu cầu sửa' }))
  expect(await screen.findByText('Đã gửi yêu cầu chỉnh sửa.')).toBeTruthy()
  expect(JSON.parse(String(writes(fetchMock)[0][1]!.body))).toEqual({
    decision: 'REQUEST_CHANGES',
    reviewToken: 'a'.repeat(64),
    note: 'Thiếu ví dụ cụ thể',
  })
})

it('disables Approve for an ineligible author and locks actions on INTERVIEW_REVIEW_STALE until reloaded', async () => {
  mockDetailApi(() => json(makeModerated({}, { authorEligible: false })))
  renderDetail()
  expect(((await screen.findByRole('button', { name: 'Duyệt' })) as HTMLButtonElement).disabled).toBe(true)
  expect(((screen.getByRole('button', { name: 'Yêu cầu sửa' })) as HTMLButtonElement).disabled).toBe(false)
  cleanup()

  let reads = 0
  mockDetailApi(method =>
    method === 'PATCH' ? json(null, 409, 'INTERVIEW_REVIEW_STALE') : (reads++, json(makeModerated())),
  )
  const user = userEvent.setup()
  renderDetail()
  await user.click(await screen.findByRole('button', { name: 'Duyệt' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Duyệt' }))
  const banner = await screen.findByRole('alert')
  expect(banner.textContent).toContain('Câu hỏi đã thay đổi. Hãy tải lại trước khi duyệt.')
  expect((screen.getByRole('button', { name: 'Duyệt' }) as HTMLButtonElement).disabled).toBe(true)
  await user.click(within(banner).getByRole('button', { name: 'Tải lại' }))
  await vi.waitFor(() => expect(reads).toBe(2))
  expect((await screen.findByRole('button', { name: 'Duyệt' }) as HTMLButtonElement).disabled).toBe(false)
})
