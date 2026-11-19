import { vi } from 'vitest'
import type { PracticeAttempt, PracticeSet, QuizItem, CardItem } from '../../types/exercises'

export const json = (data: unknown, status = 200, code?: string) => new Response(JSON.stringify({ status, code, message: 'English message', data }), { status })
export const page = <T,>(content: T[], totalPages = 1) => ({ content, page: 0, size: 9, totalElements: content.length, totalPages, hasNext: false })

export const author = { id: 'au1', fullName: 'Nguyễn A', avatarUrl: null }
export const set = (over: Partial<PracticeSet> = {}): PracticeSet => ({
  id: 's1', title: 'SQL cơ bản', description: 'Ôn **SQL**.', topic: { id: 't1', name: 'SQL' }, type: 'MULTIPLE_CHOICE', difficulty: 'MEDIUM', questionCount: 3,
  author, publishedAt: '2026-11-01T00:00:00Z', lastAttempt: null, viewer: { canAttempt: true, reason: null }, ...over,
})

export const quizQuestions = { setId: 's1', type: 'MULTIPLE_CHOICE', questions: [
  { id: 'q1', position: 0, content: 'SELECT làm gì?', codeSnippet: null, codeLanguage: null, options: ['Đọc dữ liệu', 'Xóa dữ liệu'] },
  { id: 'q2', position: 1, content: 'WHERE làm gì?', codeSnippet: null, codeLanguage: null, options: ['Sắp xếp', 'Lọc dòng'] },
  { id: 'q3', position: 2, content: 'JOIN làm gì?', codeSnippet: null, codeLanguage: null, options: ['Ghép bảng', 'Xóa bảng'] },
] }
export const cardQuestions = { setId: 's2', type: 'FLASHCARD', questions: [
  { id: 'c1', position: 0, front: 'useState', back: 'Hook giữ state', explanation: 'Trả về cặp [state, setState].' },
  { id: 'c2', position: 1, front: 'useEffect', back: 'Hook chạy hiệu ứng phụ', explanation: '' },
] }

const quizItem = (over: Partial<QuizItem>): QuizItem => ({ questionId: 'q1', position: 0, content: 'SELECT làm gì?', codeSnippet: null, codeLanguage: null, options: ['Đọc dữ liệu', 'Xóa dữ liệu'], correctIndex: 0, selectedIndex: 0, correct: true, explanation: 'SELECT đọc dữ liệu.', ...over })
export const quizAttempt = (over: Partial<PracticeAttempt> = {}): PracticeAttempt => ({
  id: 'a1', exerciseSetId: 's1', title: 'SQL cơ bản', type: 'MULTIPLE_CHOICE', correctCount: 2, totalCount: 3, percent: 66, durationSeconds: 90, completedAt: '2026-11-16T09:30:00Z',
  items: [quizItem({}), quizItem({ questionId: 'q2', position: 1, content: 'WHERE làm gì?', options: ['Sắp xếp', 'Lọc dòng'], correctIndex: 1, selectedIndex: 1, explanation: 'WHERE lọc dòng.' }),
    quizItem({ questionId: 'q3', position: 2, content: 'JOIN làm gì?', options: ['Ghép bảng', 'Xóa bảng'], correctIndex: 0, selectedIndex: null, correct: false, explanation: 'JOIN ghép bảng.' })], ...over,
})
const cardItem = (over: Partial<CardItem>): CardItem => ({ questionId: 'c1', position: 0, front: 'useState', back: 'Hook giữ state', explanation: 'Trả về cặp.', remembered: true, ...over })
export const cardAttempt = (over: Partial<PracticeAttempt> = {}): PracticeAttempt => ({
  id: 'a2', exerciseSetId: 's2', title: 'Từ vựng React', type: 'FLASHCARD', correctCount: 1, totalCount: 2, percent: 50, durationSeconds: 30, completedAt: '2026-11-15T21:00:00Z',
  items: [cardItem({}), cardItem({ questionId: 'c2', position: 1, front: 'useEffect', back: 'Hook chạy hiệu ứng phụ', explanation: '', remembered: false })], ...over,
})

type Handler = (url: string, init?: RequestInit) => Response | undefined
/** Routes by URL; a handler returns undefined to pass. Unmatched calls fail the test loudly. */
export function mockApi(...handlers: Handler[]) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^https?:\/\/[^/]+/, '')
    for (const handler of handlers) { const response = handler(url, init); if (response) return response }
    throw new Error(`Unmocked ${init?.method ?? 'GET'} ${url}`)
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
export const keyOf = (init?: RequestInit) => new Headers(init?.headers).get('Idempotency-Key')
