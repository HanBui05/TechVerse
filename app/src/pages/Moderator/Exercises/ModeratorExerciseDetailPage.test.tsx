import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ModeratorExerciseDetailPage } from './ModeratorExerciseDetailPage'
import { setAccessToken } from '../../../services/api/client'
import { moderatorExerciseActions } from '../../../services/exerciseService'
import type { ModeratorExerciseDetail } from '../../../types/exercises'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const json = (data: unknown, status = 200, code?: string) => new Response(JSON.stringify({ status, code, message: 'English message', data }), { status })
const quiz = { id: 'q1', position: 0, content: 'SELECT khác gì?', codeSnippet: null, codeLanguage: null, options: ['Một', 'Hai', 'Ba'], correctIndex: 1, explanation: 'Vì hai đúng.', front: null, back: null }
const detail = (over: Partial<ModeratorExerciseDetail['set']> = {}, rest: Partial<ModeratorExerciseDetail> = {}): ModeratorExerciseDetail => ({
  set: { id: 's1', title: 'SQL cơ bản', description: '', topic: { id: 'sql', name: 'SQL' }, type: 'MULTIPLE_CHOICE', difficulty: 'MEDIUM', status: 'PENDING', aiAssisted: true, version: 3, moderationNote: null, questionCount: 1, publishedAt: null, createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-16T09:10:00Z', questions: [quiz], ...over },
  author: { id: 'a1', fullName: 'Nguyễn A', avatarUrl: null }, authorEligible: true, reviewToken: 'a'.repeat(64), ...rest,
})
function mockApi(handler: (method: string) => Response) {
  const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => handler(init?.method ?? 'GET'))
  vi.stubGlobal('fetch', fetch)
  setAccessToken('moderator')
  return fetch
}
const writes = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.filter(([, init]) => init?.method === 'PATCH')
const renderPage = () => render(<MemoryRouter initialEntries={['/moderator/exercises/s1']}><Routes><Route path="/moderator/exercises/:id" element={<ModeratorExerciseDetailPage language="vi" />} /></Routes></MemoryRouter>)

it('maps statuses to moderator actions (wireframe 5)', () => {
  expect(moderatorExerciseActions('PENDING')).toEqual(['REQUEST_CHANGES', 'APPROVE'])
  expect(moderatorExerciseActions('PUBLISHED')).toEqual(['HIDE', 'REMOVE'])
  expect(moderatorExerciseActions('AUTHOR_HIDDEN')).toEqual(['HIDE', 'REMOVE'])
  expect(moderatorExerciseActions('HIDDEN')).toEqual(['RESTORE', 'REMOVE'])
  for (const status of ['DRAFT', 'CHANGES_REQUESTED', 'REMOVED'] as const) expect(moderatorExerciseActions(status)).toEqual([])
})

it('shows every question with the correct answer marked in text, and the previous note', async () => {
  mockApi(() => json(detail({ moderationNote: 'Sửa câu 1' })))
  renderPage()
  expect(await screen.findByRole('heading', { level: 1, name: 'SQL cơ bản' })).not.toBeNull()
  expect(screen.getAllByText('Nguyễn A').length).toBeGreaterThan(0)
  expect(screen.getByText(/Sửa câu 1/)).not.toBeNull()
  expect(within(screen.getByText('Hai').closest('li')!).getByText('Đáp án đúng')).not.toBeNull()
  expect(within(screen.getByText('Một').closest('li')!).queryByText('Đáp án đúng')).toBeNull()
  expect(screen.getByText('Vì hai đúng.')).not.toBeNull()
})

it('shows both faces of a flashcard set', async () => {
  const card = { ...quiz, content: null, options: null, correctIndex: null, front: 'useState là gì?', back: 'Hook giữ state.', explanation: 'Ghi chú' }
  mockApi(() => json(detail({ type: 'FLASHCARD', questions: [card] })))
  renderPage()
  expect(await screen.findByText('useState là gì?')).not.toBeNull()
  expect(screen.getByText('Hook giữ state.')).not.toBeNull()
})

it('approves after a confirm dialog, sending the token and showing the returned state', async () => {
  const fetch = mockApi(method => method === 'PATCH' ? json(detail({ status: 'PUBLISHED' }, { reviewToken: 'b'.repeat(64) })) : json(detail()))
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Duyệt' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Duyệt' }))
  expect(await screen.findByText('Đã duyệt bộ bài tập.')).not.toBeNull()
  const [url, init] = writes(fetch)[0]
  expect(String(url)).toContain('/moderator/exercise-sets/s1/review')
  expect(JSON.parse(String(init!.body))).toEqual({ decision: 'APPROVE', reviewToken: 'a'.repeat(64) })
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Ẩn' })).not.toBeNull()
})

it('requires a reason to request changes and never calls the API without it', async () => {
  const fetch = mockApi(() => json(detail()))
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Yêu cầu sửa' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Yêu cầu sửa' }))
  expect(within(dialog).getByText('Hãy ghi lý do (tối đa 1.000 ký tự).')).not.toBeNull()
  expect(writes(fetch)).toHaveLength(0)
  await user.type(within(dialog).getByRole('textbox'), 'Thiếu giải thích')
  expect(within(dialog).getByText('16/1.000')).not.toBeNull()
})

it('hides with a reason, then offers restore and remove for a moderator-hidden set', async () => {
  const fetch = mockApi(method => method === 'PATCH' ? json(detail({ status: 'HIDDEN' })) : json(detail({ status: 'PUBLISHED' })))
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Ẩn' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.type(within(dialog).getByRole('textbox'), 'Vi phạm')
  await user.click(within(dialog).getByRole('button', { name: 'Ẩn' }))
  expect(await screen.findByText('Đã ẩn bộ bài tập.')).not.toBeNull()
  expect(JSON.parse(String(writes(fetch)[0][1]!.body))).toEqual({ action: 'HIDE', reviewToken: 'a'.repeat(64), reason: 'Vi phạm' })
  expect(screen.getByRole('button', { name: 'Khôi phục' })).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Gỡ' })).not.toBeNull()
})

it('says removal is final in its dialog', async () => {
  mockApi(() => json(detail({ status: 'PUBLISHED' })))
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Gỡ' }))
  expect(within(await screen.findByRole('alertdialog')).getByText('Gỡ không hoàn tác được.')).not.toBeNull()
})

it('disables Approve and explains why for an ineligible author, but still allows requesting changes', async () => {
  mockApi(() => json(detail({}, { authorEligible: false })))
  renderPage()
  expect(((await screen.findByRole('button', { name: 'Duyệt' })) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getAllByText('Tác giả không còn đủ điều kiện').length).toBeGreaterThan(0)
  expect(((screen.getByRole('button', { name: 'Yêu cầu sửa' })) as HTMLButtonElement).disabled).toBe(false)
})

it('locks writes on a stale token until reload, without retrying the review', async () => {
  let reads = 0
  const fetch = mockApi(method => method === 'PATCH' ? json(null, 409, 'EXERCISE_REVIEW_STALE') : (reads++, json(detail())))
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Duyệt' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Duyệt' }))
  const banner = await screen.findByRole('alert')
  expect(banner.textContent).toContain('Bộ bài tập đã thay đổi. Hãy tải lại trước khi duyệt.')
  expect((screen.getByRole('button', { name: 'Duyệt' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Yêu cầu sửa' }) as HTMLButtonElement).disabled).toBe(true)
  await user.click(within(banner).getByRole('button', { name: 'Tải lại' }))
  await vi.waitFor(() => expect(reads).toBe(2))
  expect((await screen.findByRole('button', { name: 'Duyệt' }) as HTMLButtonElement).disabled).toBe(false)
  expect(writes(fetch)).toHaveLength(1)
})

it('keeps the dialog open and translated for author/topic/not-ready refusals', async () => {
  mockApi(method => method === 'PATCH' ? json(null, 409, 'EXERCISE_TOPIC_INACTIVE') : json(detail()))
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Duyệt' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Duyệt' }))
  expect(await screen.findByText('Chủ đề đã ngừng hoạt động.')).not.toBeNull()
  expect(screen.getByRole('alertdialog')).not.toBeNull()
})

it('switches to not found when the set was withdrawn while reviewing (404 on write)', async () => {
  mockApi(method => method === 'PATCH' ? json(null, 404, 'EXERCISE_SET_NOT_FOUND') : json(detail()))
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Duyệt' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Duyệt' }))
  expect(await screen.findByText('Không tìm thấy bộ bài tập.')).not.toBeNull()
  expect(screen.getByRole('link', { name: 'Về danh sách' })).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull()
})

it('shows a code snippet verbatim even when it contains a closing fence line', async () => {
  mockApi(() => json(detail({ questions: [{ ...quiz, codeLanguage: 'md', codeSnippet: 'a\n```\n# not a heading' }] })))
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'SQL cơ bản' })
  expect(screen.queryByRole('heading', { name: 'not a heading' })).toBeNull()
  expect(document.querySelector('pre')?.textContent).toContain('# not a heading')
})

it('ignores a language label that could break the fence', async () => {
  mockApi(() => json(detail({ questions: [{ ...quiz, codeLanguage: 'js`\n# oops', codeSnippet: 'x = 1\n# kept' }] })))
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'SQL cơ bản' })
  expect(screen.queryByRole('heading', { name: 'oops' })).toBeNull()
  expect(document.querySelector('pre')?.textContent).toContain('# kept')
})

it('shows not found with a way back, and a permission message on 403', async () => {
  mockApi(() => json(null, 404, 'EXERCISE_SET_NOT_FOUND'))
  renderPage()
  expect(await screen.findByText('Không tìm thấy bộ bài tập.')).not.toBeNull()
  expect(screen.getByRole('link', { name: 'Về danh sách' }).getAttribute('href')).toBe('/moderator/exercises')
  cleanup()
  mockApi(() => json(null, 403, 'ACCESS_DENIED'))
  renderPage()
  expect(await screen.findByText('Bạn không có quyền.')).not.toBeNull()
})

it('is read-only for requested-changes and removed sets', async () => {
  mockApi(() => json(detail({ status: 'CHANGES_REQUESTED' })))
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'SQL cơ bản' })
  expect(screen.queryByRole('group', { name: 'Hành động' })).toBeNull()
})
