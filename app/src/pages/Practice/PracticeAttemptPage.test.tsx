import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { PracticeAttemptPage } from './PracticeAttemptPage'
import { setAccessToken } from '../../services/api/client'
import { cardAttempt, cardQuestions, json, keyOf, mockApi, quizAttempt, quizQuestions } from './fixtures'

afterEach(() => { cleanup(); setAccessToken(null); localStorage.clear(); vi.unstubAllGlobals() })

function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}{l.state ? JSON.stringify(l.state) : ''}</output> }
const renderAttempt = (id = 's1', language: 'vi' | 'en' = 'vi') => render(<MemoryRouter initialEntries={[`/practice/${id}/attempt`]}><Routes>
  <Route path="/practice/:id/attempt" element={<PracticeAttemptPage language={language} />} />
  <Route path="/practice" element={<Where />} /><Route path="/login" element={<Where />} /></Routes></MemoryRouter>)

const questions = (data: unknown = quizQuestions) => (url: string) => url.endsWith('/questions') ? json(data) : undefined
const submits = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.filter(([, init]) => init?.method === 'POST')

it('walks a quiz to the result without showing any answer beforehand, then submits every question once', async () => {
  const fetch = mockApi(questions(), (url, init) => init?.method === 'POST' ? json(quizAttempt()) : undefined)
  const user = userEvent.setup()
  renderAttempt()
  expect(await screen.findByText('Câu 1/3')).toBeTruthy()
  expect(screen.queryByText(/Giải thích|Đáp án đúng/)).toBeNull()
  await user.click(screen.getByRole('radio', { name: /A\. Đọc dữ liệu/ }))
  await user.click(screen.getByRole('button', { name: 'Câu sau' }))
  expect(screen.getByText('Câu 2/3')).toBeTruthy()
  await user.click(screen.getByRole('radio', { name: /B\. Lọc dòng/ }))
  await user.click(screen.getByRole('button', { name: 'Câu sau' }))
  await user.click(screen.getByRole('radio', { name: /A\. Ghép bảng/ }))
  await user.click(screen.getByRole('button', { name: 'Nộp bài' }))
  expect(await screen.findByRole('heading', { name: 'Bạn đúng 2/3 câu (66%)' })).toBeTruthy()
  const [[url, init]] = submits(fetch)
  expect(url).toContain('/api/v1/exercise-sets/s1/attempts')
  expect(JSON.parse(String(init?.body)).answers).toEqual([{ questionId: 'q1', selectedIndex: 0 }, { questionId: 'q2', selectedIndex: 1 }, { questionId: 'q3', selectedIndex: 0 }])
  expect(keyOf(init)).toMatch(/^[0-9a-f-]{36}$/)
  expect(screen.getByRole('button', { name: 'Làm lại' })).toBeTruthy()
})

it('asks before submitting with blank questions and keeps going on “Làm tiếp”', async () => {
  const fetch = mockApi(questions(), (url, init) => init?.method === 'POST' ? json(quizAttempt()) : undefined)
  const user = userEvent.setup()
  renderAttempt()
  await screen.findByText('Câu 1/3')
  await user.click(screen.getByRole('radio', { name: /A\. Đọc dữ liệu/ }))
  await user.click(screen.getByRole('button', { name: 'Nộp bài' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText('Còn 2 câu chưa trả lời. Vẫn nộp?')).toBeTruthy()
  await user.click(within(dialog).getByRole('button', { name: 'Làm tiếp' }))
  expect(submits(fetch)).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: 'Nộp bài' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Nộp' }))
  expect(await screen.findByRole('heading', { name: /Bạn đúng/ })).toBeTruthy()
  expect(JSON.parse(String(submits(fetch)[0][1]?.body)).answers[1]).toEqual({ questionId: 'q2', selectedIndex: null })
})

it('clears a pick when the chosen option is clicked again, and the question list jumps to a question', async () => {
  mockApi(questions())
  const user = userEvent.setup()
  renderAttempt()
  await screen.findByText('Câu 1/3')
  const option = screen.getByRole('radio', { name: /A\. Đọc dữ liệu/ })
  await user.click(option)
  expect((option as HTMLInputElement).checked).toBe(true)
  await user.click(option)
  expect((option as HTMLInputElement).checked).toBe(false)
  await user.click(screen.getAllByRole('button', { name: /Câu 3, chưa trả lời/ })[0])
  expect(screen.getByText('Câu 3/3')).toBeTruthy()
})

it('picks an option with the number keys and moves with the arrows', async () => {
  mockApi(questions())
  const user = userEvent.setup()
  renderAttempt()
  await screen.findByText('Câu 1/3')
  await user.keyboard('2')
  expect((screen.getByRole('radio', { name: /B\. Xóa dữ liệu/ }) as HTMLInputElement).checked).toBe(true)
  await user.keyboard('{ArrowRight}')
  expect(screen.getByText('Câu 2/3')).toBeTruthy()
})

it('keeps the answers and reuses the same Idempotency-Key when a submit fails on the network', async () => {
  let calls = 0
  const fetch = mockApi(questions(), (_url, init) => { if (init?.method !== 'POST') return undefined; if (++calls === 1) throw new TypeError('Failed to fetch'); return json(quizAttempt()) })
  const user = userEvent.setup()
  renderAttempt()
  await screen.findByText('Câu 1/3')
  await user.click(screen.getByRole('radio', { name: /A\. Đọc dữ liệu/ }))
  await user.click(screen.getByRole('button', { name: 'Nộp bài' }))
  await user.click(await screen.findByRole('button', { name: 'Nộp' }))
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('Dịch vụ đang gián đoạn. Hãy thử lại.')
  expect((screen.getByRole('radio', { name: /A\. Đọc dữ liệu/ }) as HTMLInputElement).checked).toBe(true)
  await user.click(within(alert).getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('heading', { name: /Bạn đúng/ })).toBeTruthy()
  const keys = submits(fetch).map(([, init]) => keyOf(init))
  expect(keys).toHaveLength(2)
  expect(keys[0]).toBe(keys[1])
})

it('replaces the attempt with a notice when the set is hidden while answering', async () => {
  mockApi(questions(), (_url, init) => init?.method === 'POST' ? json(null, 404, 'EXERCISE_SET_NOT_FOUND') : undefined)
  const user = userEvent.setup()
  renderAttempt()
  await screen.findByText('Câu 1/3')
  await user.click(screen.getByRole('radio', { name: /A\. Đọc dữ liệu/ }))
  await user.click(screen.getByRole('button', { name: 'Nộp bài' }))
  await user.click(await screen.findByRole('button', { name: 'Nộp' }))
  expect(await screen.findByText('Bộ bài tập không còn khả dụng.')).toBeTruthy()
  expect(screen.queryByRole('radio')).toBeNull()
  await user.click(screen.getByRole('link', { name: 'Về danh sách' }))
  expect(screen.getByTestId('where').textContent).toBe('/practice')
})

it('sends a signed-out visitor to /login with the page to return to', async () => {
  mockApi(url => url.endsWith('/questions') ? json(null, 401, 'AUTH_ACCESS_TOKEN_REQUIRED') : undefined)
  renderAttempt()
  expect((await screen.findByTestId('where')).textContent).toBe('/login{"returnTo":"/practice/s1/attempt"}')
})

it('offers “Làm lại” on an invalid attempt and drops the answers', async () => {
  mockApi(questions(), (_url, init) => init?.method === 'POST' ? json(null, 400, 'EXERCISE_ATTEMPT_INVALID') : undefined)
  const user = userEvent.setup()
  renderAttempt()
  await screen.findByText('Câu 1/3')
  await user.click(screen.getByRole('radio', { name: /A\. Đọc dữ liệu/ }))
  await user.click(screen.getByRole('button', { name: 'Nộp bài' }))
  await user.click(await screen.findByRole('button', { name: 'Nộp' }))
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('Bài làm không hợp lệ. Hãy tải lại và làm lại.')
  await user.click(within(alert).getByRole('button', { name: 'Làm lại' }))
  expect(await screen.findByText('Câu 1/3')).toBeTruthy()
  expect((screen.getByRole('radio', { name: /A\. Đọc dữ liệu/ }) as HTMLInputElement).checked).toBe(false)
})

it('narrows the result to wrong or blank questions without calling the API', async () => {
  const fetch = mockApi(questions(), (_url, init) => init?.method === 'POST' ? json(quizAttempt()) : undefined)
  const user = userEvent.setup()
  renderAttempt()
  await screen.findByText('Câu 1/3')
  await user.click(screen.getByRole('button', { name: 'Nộp bài' }))
  await user.click(await screen.findByRole('button', { name: 'Nộp' }))
  await screen.findByRole('heading', { name: /Bạn đúng/ })
  expect(screen.getByText('SELECT đọc dữ liệu.')).toBeTruthy()
  const calls = fetch.mock.calls.length
  await user.click(screen.getByRole('button', { name: 'Chỉ câu sai/bỏ trống' }))
  expect(screen.queryByText('SELECT đọc dữ liệu.')).toBeNull()
  expect(screen.getByText('JOIN ghép bảng.')).toBeTruthy()
  expect(screen.getAllByText('Bỏ trống').length).toBeGreaterThan(0)
  expect(fetch.mock.calls.length).toBe(calls)
})

it('flips a card before it can be marked, auto-submits on the last card and lists the cards not remembered', async () => {
  const fetch = mockApi(questions(cardQuestions), (_url, init) => init?.method === 'POST' ? json(cardAttempt()) : undefined)
  const user = userEvent.setup()
  renderAttempt('s2')
  expect(await screen.findByText('Thẻ 1/2')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Đã nhớ' })).toBeNull()
  expect(screen.queryByText('Hook giữ state')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Lật thẻ' }))
  expect(screen.getByText('Hook giữ state')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Đã nhớ' }))
  expect(screen.getByText('Thẻ 2/2')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Lật thẻ' }))
  await user.click(screen.getByRole('button', { name: 'Chưa nhớ' }))
  expect(await screen.findByRole('heading', { name: 'Đã nhớ 1/2 thẻ' })).toBeTruthy()
  expect(JSON.parse(String(submits(fetch)[0][1]?.body)).results).toEqual([{ questionId: 'c1', remembered: true }, { questionId: 'c2', remembered: false }])
  const missed = screen.getByRole('region', { name: 'Thẻ chưa nhớ' })
  expect(within(missed).getByText('useEffect')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Ôn lại' })).toBeTruthy()
})

it('records a pick made with the arrow keys on a focused radio (change event, no click)', async () => {
  mockApi(questions())
  const user = userEvent.setup()
  renderAttempt()
  await screen.findByText('Câu 1/3')
  await user.click(screen.getByRole('radio', { name: /A\. Đọc dữ liệu/ }))
  await user.keyboard('{ArrowDown}')
  expect((screen.getByRole('radio', { name: /B\. Xóa dữ liệu/ }) as HTMLInputElement).checked).toBe(true)
  expect((screen.getByRole('radio', { name: /A\. Đọc dữ liệu/ }) as HTMLInputElement).checked).toBe(false)
})

it('locks the answers after a failed submit so the retry reuses the key for the same answers', async () => {
  mockApi(questions(), (_url, init) => { if (init?.method === 'POST') throw new TypeError('Failed to fetch'); return undefined })
  const user = userEvent.setup()
  renderAttempt()
  await screen.findByText('Câu 1/3')
  await user.click(screen.getByRole('radio', { name: /A\. Đọc dữ liệu/ }))
  await user.click(screen.getByRole('button', { name: 'Nộp bài' }))
  await user.click(await screen.findByRole('button', { name: 'Nộp' }))
  await screen.findByRole('alert')
  expect((screen.getByRole('radio', { name: /B\. Xóa dữ liệu/ }) as HTMLInputElement).disabled).toBe(true)
})

it('numbers result questions and cards by their order, whatever base the server uses for position', async () => {
  const shift = (a: ReturnType<typeof quizAttempt>) => ({ ...a, items: a.items!.map(item => ({ ...item, position: item.position + 1 })) })
  mockApi(questions(), (_url, init) => init?.method === 'POST' ? json(shift(quizAttempt())) : undefined)
  const user = userEvent.setup()
  renderAttempt()
  await screen.findByText('Câu 1/3')
  await user.click(screen.getByRole('button', { name: 'Nộp bài' }))
  await user.click(await screen.findByRole('button', { name: 'Nộp' }))
  await screen.findByRole('heading', { name: /Bạn đúng/ })
  expect(screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(['Câu 1', 'Câu 2', 'Câu 3'])
})
