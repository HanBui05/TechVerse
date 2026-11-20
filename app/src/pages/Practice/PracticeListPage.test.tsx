import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { PracticeListPage } from './PracticeListPage'
import { PracticeIntroPage } from './PracticeIntroPage'
import { setAccessToken } from '../../services/api/client'
import { cardAttempt, json, mockApi, page, quizAttempt, set } from './fixtures'

afterEach(() => { cleanup(); setAccessToken(null); localStorage.clear(); vi.unstubAllGlobals() })

function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}{l.search}{l.state ? JSON.stringify(l.state) : ''}</output> }
const topics = [{ id: 't1', name: 'SQL' }]
const listApi = (sets = [set()]) => (url: string) => url.startsWith('/api/v1/exercise-sets/options') ? json(topics) : url.startsWith('/api/v1/exercise-sets?') ? json(page(sets)) : undefined
const renderList = (path = '/practice', authenticated = false) => render(<MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/practice" element={<PracticeListPage language="vi" authenticated={authenticated} />} />
  <Route path="/practice/:id" element={<Where />} /><Route path="/me/practice" element={<Where />} /></Routes></MemoryRouter>)
const renderIntro = (authenticated: boolean) => render(<MemoryRouter initialEntries={['/practice/s1']}><Routes>
  <Route path="/practice/:id" element={<PracticeIntroPage language="vi" authenticated={authenticated} />} />
  <Route path="/practice/:id/attempt" element={<Where />} /><Route path="/me/practice/:attemptId" element={<Where />} />
  <Route path="/login" element={<Where />} /><Route path="/practice" element={<Where />} /></Routes></MemoryRouter>)
const detail = (over: Parameters<typeof set>[0] = {}) => (url: string) => url === '/api/v1/exercise-sets/s1' ? json(set(over)) : undefined

it('lists published sets as links with type, difficulty, size, author and my last attempt', async () => {
  mockApi(listApi([set({ lastAttempt: quizAttempt({ correctCount: 9, totalCount: 12, percent: 75 }) }), set({ id: 's2', title: 'Từ vựng React', type: 'FLASHCARD', difficulty: 'EASY', questionCount: 8, lastAttempt: cardAttempt({ correctCount: 6, totalCount: 8 }) }), set({ id: 's3', title: 'Git nâng cao' })]))
  renderList('/practice', true)
  const sql = await screen.findByRole('link', { name: /SQL cơ bản/ })
  expect(sql.getAttribute('href')).toBe('/practice/s1')
  expect(sql.textContent).toContain('Trắc nghiệm')
  expect(sql.textContent).toContain('Vừa')
  expect(sql.textContent).toContain('3 câu')
  expect(sql.textContent).toContain('Tác giả: Nguyễn A')
  expect(sql.textContent).toContain('9/12 (75%)')
  expect(screen.getByRole('link', { name: /Từ vựng React/ }).textContent).toContain('đã nhớ 6/8')
  expect(screen.getByRole('link', { name: /Git nâng cao/ }).textContent).not.toContain('Lần gần nhất')
  expect(screen.getByRole('link', { name: 'Lịch sử luyện tập' }).getAttribute('href')).toBe('/me/practice')
})

it('hides the history link from guests', async () => {
  mockApi(listApi())
  renderList()
  await screen.findByRole('link', { name: /SQL cơ bản/ })
  expect(screen.queryByRole('link', { name: 'Lịch sử luyện tập' })).toBeNull()
})

it('keeps filters in the URL and refetches with them (page back to 0)', async () => {
  const fetch = mockApi(listApi())
  const user = userEvent.setup()
  renderList('/practice?page=2')
  await screen.findByRole('link', { name: /SQL cơ bản/ })
  await user.selectOptions(screen.getByLabelText('Độ khó'), 'HARD')
  await vi.waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes('difficulty=HARD') && !/page=[1-9]/.test(String(url)))).toBe(true))
  await user.selectOptions(screen.getByLabelText('Loại'), 'FLASHCARD')
  await user.type(screen.getByRole('searchbox'), 'sql{Enter}')
  await vi.waitFor(() => expect(fetch.mock.calls.some(([url]) => /difficulty=HARD/.test(String(url)) && /type=FLASHCARD/.test(String(url)) && /keyword=sql/.test(String(url)))).toBe(true))
})

it('tells an empty catalogue from an empty filter result, and clears the filter', async () => {
  mockApi(listApi([]))
  const user = userEvent.setup()
  const view = renderList()
  expect(await screen.findByText('Chưa có bộ bài tập nào.')).toBeTruthy()
  view.unmount()
  renderList('/practice?difficulty=HARD')
  expect(await screen.findByText('Không có bộ nào khớp bộ lọc.')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Xóa lọc' }))
  expect(await screen.findByText('Chưa có bộ bài tập nào.')).toBeTruthy()
})

it('shows a retry on a list error', async () => {
  let fail = true
  mockApi((url) => url.startsWith('/api/v1/exercise-sets/options') ? json(topics) : url.startsWith('/api/v1/exercise-sets?') ? (fail ? json(null, 503, 'EXERCISE_STORAGE_UNAVAILABLE') : json(page([set()]))) : undefined)
  const user = userEvent.setup()
  renderList()
  expect((await screen.findByRole('alert')).textContent).toContain('Dịch vụ đang gián đoạn. Hãy thử lại.')
  fail = false
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('link', { name: /SQL cơ bản/ })).toBeTruthy()
})

it('intro: a signed-in reader can start and review the last attempt', async () => {
  mockApi(detail({ lastAttempt: quizAttempt({ correctCount: 9, totalCount: 12, percent: 75 }) }))
  renderIntro(true)
  expect(await screen.findByRole('heading', { level: 1, name: 'SQL cơ bản' })).toBeTruthy()
  expect(screen.getByText('SQL', { selector: 'strong' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Bắt đầu' }).getAttribute('href')).toBe('/practice/s1/attempt')
  expect(screen.getByRole('link', { name: 'Xem lại' }).getAttribute('href')).toBe('/me/practice/a1')
})

it('intro: a guest is sent to /login and comes back to the same page', async () => {
  mockApi(detail({ viewer: { canAttempt: false, reason: 'LOGIN_REQUIRED' } }))
  const user = userEvent.setup()
  renderIntro(false)
  await user.click(await screen.findByRole('button', { name: 'Đăng nhập để làm bài' }))
  expect(screen.getByTestId('where').textContent).toBe('/login{"returnTo":"/practice/s1"}')
})

it('intro: the owner cannot take their own set', async () => {
  mockApi(detail({ viewer: { canAttempt: false, reason: 'OWNER' } }))
  renderIntro(true)
  expect(await screen.findByText('Bạn không thể làm bộ bài tập của chính mình.')).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Bắt đầu' })).toBeNull()
  expect((screen.getByRole('button', { name: 'Bắt đầu' }) as HTMLButtonElement).disabled).toBe(true)
})

it('intro: a hidden or missing set shows the unavailable page', async () => {
  mockApi(() => json(null, 404, 'EXERCISE_SET_NOT_FOUND'))
  const user = userEvent.setup()
  renderIntro(true)
  expect(await screen.findByText('Bộ bài tập không còn khả dụng.')).toBeTruthy()
  await user.click(screen.getByRole('link', { name: 'Về danh sách' }))
  expect(screen.getByTestId('where').textContent).toBe('/practice')
})
