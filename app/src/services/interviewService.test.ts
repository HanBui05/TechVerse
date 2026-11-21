import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError, setAccessToken } from './api/client'
import {
  authorInterviews,
  interviewActions,
  interviewAiDraftErrors,
  interviewFilter,
  interviewFormErrors,
  interviewSearch,
  moderatorInterviewActions,
  publicInterviews,
  validateFeedbackAnswer,
} from './interviewService'
import type { InterviewForm } from '../types/interview'

const validForm = (over: Partial<InterviewForm> = {}): InterviewForm => ({
  topicId: '11111111-1111-1111-1111-111111111111',
  level: 'MEDIUM',
  question: 'Giải thích cơ chế ACID trong cơ sở dữ liệu quan hệ?',
  sampleAnswer: 'ACID gồm Atomicity, Consistency, Isolation và Durability đảm bảo tính toàn vẹn của giao dịch.',
  hint: 'Hãy nêu đủ 4 tính chất và ví dụ ngắn.',
  ...over,
})

const long = (n: number) => 'a'.repeat(n)

it('validates question, sampleAnswer, hint, topicId and level bounds according to table 1a', () => {
  expect(interviewFormErrors(validForm())).toEqual({})
  expect(interviewFormErrors(validForm({ hint: '' }))).toEqual({})
  expect(interviewFormErrors(validForm({ topicId: '  ' })).topicId).toBe('topicRequired')
  expect(interviewFormErrors(validForm({ question: 'ngắn 9kt' })).question).toBe('questionLength')
  expect(interviewFormErrors(validForm({ question: long(1001) })).question).toBe('questionLength')
  expect(interviewFormErrors(validForm({ sampleAnswer: 'quá ngắn < 20 kt' })).sampleAnswer).toBe('sampleAnswerLength')
  expect(interviewFormErrors(validForm({ sampleAnswer: long(5001) })).sampleAnswer).toBe('sampleAnswerLength')
  expect(interviewFormErrors(validForm({ hint: long(501) })).hint).toBe('hintLength')
})

it('rejects Markdown images (inline and reference) and NUL characters in question, sampleAnswer and hint', () => {
  expect(interviewFormErrors(validForm({ question: 'Xem sơ đồ ![arch](https://a.b/c.png) này?' })).question).toBe('contentInvalid')
  expect(interviewFormErrors(validForm({ sampleAnswer: 'Sơ đồ tham chiếu ![arch][id1] ở dưới đây.' })).sampleAnswer).toBe('contentInvalid')
  expect(interviewFormErrors(validForm({ hint: 'Gợi ý có ký tự\0ẩn' })).hint).toBe('contentInvalid')
  expect(interviewFormErrors(validForm({ question: 'Liên kết thường [tài liệu](https://a.b) vẫn hợp lệ?' }))).toEqual({})
})

it('validates AI draft generation input bounds (count 1..5, instruction <= 500, sourceText <= 8000)', () => {
  expect(interviewAiDraftErrors({ topicId: 't1', level: 'EASY', count: 3 })).toEqual({})
  expect(interviewAiDraftErrors({ topicId: '', level: 'EASY', count: 3 }).topicId).toBe('topicRequired')
  expect(interviewAiDraftErrors({ topicId: 't1', level: 'EASY', count: 0 }).count).toBe('countRange')
  expect(interviewAiDraftErrors({ topicId: 't1', level: 'EASY', count: 6 }).count).toBe('countRange')
  expect(interviewAiDraftErrors({ topicId: 't1', level: 'EASY', count: 2, instruction: long(501) }).instruction).toBe('instructionLength')
  expect(interviewAiDraftErrors({ topicId: 't1', level: 'EASY', count: 2, sourceText: long(8001) }).sourceText).toBe('sourceLength')
})

it('validates learner feedback answer length (1..4000 trimmed)', () => {
  expect(validateFeedbackAnswer('   ')).toBe('answerLengthError')
  expect(validateFeedbackAnswer('Câu trả lời hợp lệ')).toBeNull()
  expect(validateFeedbackAnswer(long(4000))).toBeNull()
  expect(validateFeedbackAnswer(long(4001))).toBe('answerLengthError')
})

it('maps author and moderator actions by status and publishedAt', () => {
  expect(interviewActions({ status: 'DRAFT', publishedAt: null })).toEqual({ primary: 'edit', actions: ['copy', 'delete'], readOnly: false })
  expect(interviewActions({ status: 'CHANGES_REQUESTED', publishedAt: null }).actions).toEqual(['copy', 'delete'])
  expect(interviewActions({ status: 'CHANGES_REQUESTED', publishedAt: '2026-11-10T00:00:00Z' }).actions).toEqual(['copy'])
  expect(interviewActions({ status: 'PENDING', publishedAt: null })).toEqual({ primary: 'view', actions: ['withdraw', 'copy'], readOnly: true })
  expect(interviewActions({ status: 'PUBLISHED', publishedAt: '2026-11-10T00:00:00Z' }).actions).toEqual(['copy', 'hide'])
  expect(interviewActions({ status: 'AUTHOR_HIDDEN', publishedAt: '2026-11-10T00:00:00Z' }).actions).toEqual(['copy', 'unhide'])
  expect(interviewActions({ status: 'HIDDEN', publishedAt: '2026-11-10T00:00:00Z' }).actions).toEqual(['copy'])
  expect(interviewActions({ status: 'REMOVED', publishedAt: null }).actions).toEqual(['copy'])

  expect(moderatorInterviewActions('PENDING')).toEqual(['REQUEST_CHANGES', 'APPROVE'])
  expect(moderatorInterviewActions('PUBLISHED')).toEqual(['HIDE', 'REMOVE'])
  expect(moderatorInterviewActions('AUTHOR_HIDDEN')).toEqual(['HIDE', 'REMOVE'])
  expect(moderatorInterviewActions('HIDDEN')).toEqual(['RESTORE', 'REMOVE'])
  expect(moderatorInterviewActions('DRAFT')).toEqual([])
  expect(moderatorInterviewActions('CHANGES_REQUESTED')).toEqual([])
  expect(moderatorInterviewActions('REMOVED')).toEqual([])
})

it('parses and serializes /interview URL filters, stripping mark for guests', () => {
  const params = new URLSearchParams('topicId=sql&level=HARD&mark=SAVED&keyword= index &page=2')
  expect(interviewFilter(params, true)).toEqual({ topicId: 'sql', level: 'HARD', mark: 'SAVED', keyword: 'index', page: 2 })
  expect(interviewFilter(params, false)).toEqual({ topicId: 'sql', level: 'HARD', mark: '', keyword: 'index', page: 2 })
  expect(interviewFilter(new URLSearchParams('level=UNKNOWN&mark=INVALID&page=-3'), true)).toEqual({ topicId: '', level: '', mark: '', keyword: '', page: 0 })

  expect(interviewSearch({ topicId: '', level: '', mark: '', keyword: '', page: 0 }, true).toString()).toBe('')
  expect(interviewSearch({ topicId: 'sql', level: 'EASY', mark: 'REVIEWED', keyword: ' join ', page: 1 }, true).toString()).toBe('keyword=join&topicId=sql&level=EASY&mark=REVIEWED&page=1')
  expect(interviewSearch({ topicId: 'sql', level: 'EASY', mark: 'REVIEWED', keyword: ' join ', page: 1 }, false).toString()).toBe('keyword=join&topicId=sql&level=EASY&page=1')
})

const fetchMock = vi.fn<typeof fetch>()
beforeEach(() => { setAccessToken('tok'); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => { setAccessToken(null); vi.unstubAllGlobals() })

it('reads X-AI-Quota-Limit and X-AI-Quota-Remaining on AI draft creation and learner feedback, including on error', async () => {
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ status: 200, message: 'ok', data: { questions: [], requested: 2 } }),
      { status: 200, headers: { 'X-AI-Quota-Limit': '10', 'X-AI-Quota-Remaining': '6' } },
    ),
  )
  const drafts = await authorInterviews.generateAiDrafts({ topicId: 't1', level: 'MEDIUM', count: 2, instruction: '  join  ' })
  expect(drafts.quota).toEqual({ limit: 10, remaining: 6 })
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ topicId: 't1', level: 'MEDIUM', count: 2, instruction: 'join' })

  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ status: 429, code: 'AI_QUOTA_EXCEEDED', message: 'Daily AI allowance used up' }),
      { status: 429, headers: { 'X-AI-Quota-Limit': '15', 'X-AI-Quota-Remaining': '0' } },
    ),
  )
  const err = await publicInterviews.feedback('q1', 'Câu trả lời').catch(e => e)
  expect(err).toBeInstanceOf(ApiError)
  expect(err.code).toBe('AI_QUOTA_EXCEEDED')
  expect(err.quota).toEqual({ limit: 15, remaining: 0 })
})

it('renews an expired access token once and retries the AI call', async () => {
  fetchMock
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 401, code: 'AUTH_INVALID_ACCESS_TOKEN', message: 'expired' }), { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 200, message: 'ok', data: { accessToken: 'fresh' } }), { status: 200 }))
    .mockResolvedValueOnce(new Response(
      JSON.stringify({ status: 200, message: 'ok', data: { verdict: 'GOOD', strengths: [], missing: [], advice: 'Tốt' } }),
      { status: 200, headers: { 'X-AI-Quota-Limit': '20', 'X-AI-Quota-Remaining': '19' } },
    ))
  const result = await publicInterviews.feedback('q1', 'Câu trả lời')
  expect(result.feedback.verdict).toBe('GOOD')
  expect(result.quota).toEqual({ limit: 20, remaining: 19 })
  expect(String(fetchMock.mock.calls[1][0])).toContain('/api/v1/auth/refresh')
  expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get('Authorization')).toBe('Bearer fresh')
})
