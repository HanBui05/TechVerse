import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { MyCoursesPage } from './MyCoursesPage'
import { setAccessToken } from '../../services/api/client'
import { json, page, summary } from './fixtures'

afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const mine = (over = {}) => ({ course: summary, progress: { completed: 1, total: 3, percent: 33 }, continueLesson: { id: 'l2', title: 'Cài đặt', chapterId: 'ch1' }, grantedAt: '2026-11-01T00:00:00Z', lastAccessedAt: '2026-11-09T00:00:00Z', ...over })
const renderPage = () => render(<MemoryRouter><MyCoursesPage language="vi" /></MemoryRouter>)

it('lists started courses with progress, Continue learning to the continue lesson, and Review for a finished one', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json(page([mine(), mine({ course: { ...summary, id: 'c2', title: 'Spring' }, progress: { completed: 3, total: 3, percent: 100 }, lastAccessedAt: null })]))))
  renderPage()
  const link = await screen.findByRole('link', { name: 'Tiếp tục học: Java cơ bản' })
  expect(link.getAttribute('href')).toBe('/courses/c1/lessons/l2')
  expect(screen.getByRole('progressbar', { name: /Java cơ bản/ }).getAttribute('aria-valuenow')).toBe('33')
  expect(screen.getByText('1/3 bài · 33%')).toBeTruthy()
  expect(screen.getByText('Hoàn thành')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Xem lại khóa học' }).getAttribute('href')).toBe('/courses/c2')
})

it('shows loading, the empty state with Explore courses, and a retryable error', async () => {
  let mode: 'empty' | 'fail' | 'ok' = 'empty'
  vi.stubGlobal('fetch', vi.fn(async () => mode === 'empty' ? json(page([])) : mode === 'fail' ? json(null, 500, 'INTERNAL_ERROR') : json(page([mine()]))))
  const user = userEvent.setup()
  const view = renderPage()
  expect(screen.getByRole('status', { name: 'Đang tải khóa học...' })).toBeTruthy()
  expect(await screen.findByText('Bạn chưa bắt đầu khóa học nào')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Khám phá khóa học' }).getAttribute('href')).toBe('/courses')
  view.unmount()
  mode = 'fail'
  renderPage()
  const retry = await screen.findByRole('button', { name: 'Thử lại' })
  mode = 'ok'
  await user.click(retry)
  expect(await screen.findByText('Java cơ bản')).toBeTruthy()
})
