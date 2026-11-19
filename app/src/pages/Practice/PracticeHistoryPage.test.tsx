import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { PracticeAttemptReviewPage, PracticeHistoryPage } from './PracticeHistoryPage'
import { setAccessToken } from '../../services/api/client'
import { cardAttempt, json, mockApi, page, quizAttempt, set } from './fixtures'

afterEach(() => { cleanup(); setAccessToken(null); localStorage.clear(); vi.unstubAllGlobals() })

function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}</output> }
const renderHistory = (path = '/me/practice') => render(<MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/me/practice" element={<PracticeHistoryPage language="vi" />} />
  <Route path="/me/practice/:attemptId" element={<PracticeAttemptReviewPage language="vi" />} />
  <Route path="/practice/:id/attempt" element={<Where />} /><Route path="/practice" element={<Where />} /></Routes></MemoryRouter>)
const history = (attempts = [quizAttempt({ items: null }), cardAttempt({ items: null })]) => (url: string) => url.startsWith('/api/v1/me/exercise-attempts?') ? json(page(attempts)) : undefined

it('lists my attempts newest first with score and time, each opening its review', async () => {
  mockApi(history(), (url) => url === '/api/v1/me/exercise-attempts/a1' ? json(quizAttempt()) : url === '/api/v1/exercise-sets/s1' ? json(set()) : undefined)
  const user = userEvent.setup()
  renderHistory()
  const row = await screen.findByRole('link', { name: /SQL cơ bản/ })
  expect(row.textContent).toContain('2/3 (66%)')
  expect(row.textContent).toContain('2 phút')
  expect(screen.getByRole('link', { name: /Từ vựng React/ }).textContent).toContain('Đã nhớ 1/2')
  await user.click(row)
  expect(await screen.findByRole('heading', { name: 'Bạn đúng 2/3 câu (66%)' })).toBeTruthy()
  expect(screen.getByRole('link', { name: /Lịch sử/ }).getAttribute('href')).toBe('/me/practice')
})

it('shows an empty state that leads to the practice area', async () => {
  mockApi(history([]))
  const user = userEvent.setup()
  renderHistory()
  expect(await screen.findByText('Chưa có lượt làm nào.')).toBeTruthy()
  await user.click(screen.getByRole('link', { name: 'Đến khu Luyện tập' }))
  expect(screen.getByTestId('where').textContent).toBe('/practice')
})

it('retries a failed history load', async () => {
  let fail = true
  mockApi((url) => url.startsWith('/api/v1/me/exercise-attempts?') ? (fail ? json(null, 503, 'EXERCISE_STORAGE_UNAVAILABLE') : json(page([quizAttempt({ items: null })]))) : undefined)
  const user = userEvent.setup()
  renderHistory()
  expect((await screen.findByRole('alert')).textContent).toContain('Dịch vụ đang gián đoạn. Hãy thử lại.')
  fail = false
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('link', { name: /SQL cơ bản/ })).toBeTruthy()
})

it('review: offers “Làm lại” while the set is still available', async () => {
  mockApi((url) => url === '/api/v1/me/exercise-attempts/a1' ? json(quizAttempt()) : url === '/api/v1/exercise-sets/s1' ? json(set()) : undefined)
  const user = userEvent.setup()
  renderHistory('/me/practice/a1')
  await user.click(await screen.findByRole('link', { name: 'Làm lại' }))
  expect(screen.getByTestId('where').textContent).toBe('/practice/s1/attempt')
})

it('review: a removed set has no “Làm lại”, only a muted note, and the stored answers still show', async () => {
  mockApi((url) => url === '/api/v1/me/exercise-attempts/a1' ? json(quizAttempt()) : url === '/api/v1/exercise-sets/s1' ? json(null, 404, 'EXERCISE_SET_NOT_FOUND') : undefined)
  renderHistory('/me/practice/a1')
  expect(await screen.findByText('Bộ bài tập không còn khả dụng.')).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Làm lại' })).toBeNull()
  expect(screen.getByText('SELECT đọc dữ liệu.')).toBeTruthy()
})

it('review: someone else’s or a missing attempt says so', async () => {
  mockApi((url) => url.startsWith('/api/v1/me/exercise-attempts/') ? json(null, 404, 'EXERCISE_ATTEMPT_NOT_FOUND') : undefined)
  renderHistory('/me/practice/zzz')
  expect(await screen.findByText('Không tìm thấy lượt làm.')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Về lịch sử' }).getAttribute('href')).toBe('/me/practice')
})
