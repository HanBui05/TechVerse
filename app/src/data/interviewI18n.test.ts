import { expect, it } from 'vitest'
import { ApiError } from '../services/api/client'
import {
  INTERVIEW_ERRORS,
  interviewErrorText,
  interviewLevelLabel,
  interviewStatusLabel,
  interviewText,
  interviewVerdictLabel,
  isInterviewConflict,
  isInterviewStale,
  learnerInterviewErrorKind,
  learnerInterviewErrorText,
  learnerInterviewText,
  moderatorInterviewText,
} from './interviewI18n'

const AUTHOR_MOD_CODES = [
  'VALIDATION_ERROR',
  'INTERVIEW_TOPIC_INACTIVE',
  'INTERVIEW_CONTENT_INVALID',
  'AUTH_ACCESS_TOKEN_REQUIRED',
  'AUTH_INVALID_ACCESS_TOKEN',
  'ACCESS_DENIED',
  'INTERVIEW_QUESTION_NOT_FOUND',
  'INTERVIEW_NOT_EDITABLE',
  'INTERVIEW_STATE_INVALID',
  'INTERVIEW_NOT_DELETABLE',
  'INTERVIEW_VERSION_CONFLICT',
  'INTERVIEW_REVIEW_STALE',
  'INTERVIEW_AUTHOR_INELIGIBLE',
  'INTERVIEW_RATE_LIMITED',
  'INTERVIEW_STORAGE_UNAVAILABLE',
]

const AI_CODES = [
  'AI_RATE_LIMITED',
  'AI_QUOTA_EXCEEDED',
  'AI_OUTPUT_INVALID',
  'AI_OUTPUT_TRUNCATED',
  'AI_GENERATION_IN_PROGRESS',
  'AI_PROVIDER_UNAVAILABLE',
  'AI_PROVIDER_REQUEST_REJECTED',
  'AI_PROVIDER_AUTH_FAILED',
  'AI_PROVIDER_RATE_LIMITED',
  'AI_TIMEOUT',
  'AI_STORAGE_UNAVAILABLE',
  'AI_CONFIGURATION_INVALID',
]

it('translates every 1a and 1c error code for Author and Moderator in both languages', () => {
  for (const code of [...AUTHOR_MOD_CODES, ...AI_CODES]) {
    expect(INTERVIEW_ERRORS[code]?.vi, code).toBeTruthy()
    expect(INTERVIEW_ERRORS[code]?.en, code).toBeTruthy()
    const vi = interviewErrorText(new ApiError('Backend English', 400, code), 'vi', 'fallback')
    const en = interviewErrorText(new ApiError('Backend English', 400, code), 'en', 'fallback')
    expect(vi, `${code}/vi`).not.toBe('fallback')
    expect(en, `${code}/en`).not.toBe('fallback')
    expect(vi).not.toContain('Backend English')
    expect(en).not.toContain('Backend English')
  }
  expect(interviewErrorText(new ApiError('x', 409, 'INTERVIEW_VERSION_CONFLICT'), 'vi', '')).toBe('Câu hỏi đã được sửa ở nơi khác. Hãy tải lại trước khi lưu.')
  expect(interviewErrorText(new ApiError('x', 409, 'INTERVIEW_REVIEW_STALE'), 'vi', '')).toBe('Câu hỏi đã thay đổi. Hãy tải lại trước khi duyệt.')
  expect(interviewErrorText(new ApiError('x', 409, 'INTERVIEW_AUTHOR_INELIGIBLE'), 'vi', '')).toBe('Tác giả không còn đủ điều kiện xuất bản.')
  expect(interviewErrorText(new ApiError('x', 400, 'INTERVIEW_CONTENT_INVALID'), 'vi', '')).toBe('Nội dung chứa định dạng không được hỗ trợ.')
  expect(interviewErrorText(new ApiError('x', 429, 'AI_QUOTA_EXCEEDED'), 'vi', '')).toBe('Bạn đã dùng hết lượt AI hôm nay.')
  expect(interviewErrorText(new ApiError('x', 409, 'AI_GENERATION_IN_PROGRESS'), 'vi', '')).toBe('AI đang xử lý yêu cầu trước.')
})

it('identifies version conflicts and stale review errors', () => {
  expect(isInterviewConflict(new ApiError('x', 409, 'INTERVIEW_VERSION_CONFLICT'))).toBe(true)
  expect(isInterviewConflict(new ApiError('x', 409, 'INTERVIEW_STATE_INVALID'))).toBe(false)
  expect(isInterviewStale(new ApiError('x', 409, 'INTERVIEW_REVIEW_STALE'))).toBe(true)
  expect(isInterviewStale(new ApiError('x', 409, 'INTERVIEW_STATE_INVALID'))).toBe(true)
  expect(isInterviewStale(new ApiError('x', 409, 'INTERVIEW_TOPIC_INACTIVE'))).toBe(false)
})

it('translates every learner-side code of table 1b and 1c in vi and en', () => {
  expect(learnerInterviewErrorText(new ApiError('x', 404, 'INTERVIEW_QUESTION_NOT_FOUND'), 'vi', 'f')).toBe('Câu hỏi không còn khả dụng.')
  expect(learnerInterviewErrorText(new ApiError('x', 404, 'INTERVIEW_QUESTION_NOT_FOUND'), 'en', 'f')).toBe('This question is no longer available.')
  expect(learnerInterviewErrorText(new ApiError('x', 401, 'AUTH_ACCESS_TOKEN_REQUIRED'), 'vi', 'f')).toBe('Đăng nhập để tiếp tục.')
  expect(learnerInterviewErrorText(new ApiError('x', 403, 'ACCESS_DENIED'), 'vi', 'f')).toBe('Bạn không có quyền.')
  expect(learnerInterviewErrorText(new ApiError('x', 400, 'VALIDATION_ERROR'), 'vi', 'f')).toBe('Dữ liệu chưa hợp lệ.')
  expect(learnerInterviewErrorText(new ApiError('x', 429, 'AI_QUOTA_EXCEEDED'), 'vi', 'f')).toBe('Bạn đã dùng hết lượt AI hôm nay.')
  expect(learnerInterviewErrorText(new Error('network'), 'vi', 'Dịch vụ đang gián đoạn. Hãy thử lại.')).toBe('Dịch vụ đang gián đoạn. Hãy thử lại.')
})

it('classifies learner errors by screen recovery action', () => {
  expect(learnerInterviewErrorKind(new ApiError('x', 404, 'INTERVIEW_QUESTION_NOT_FOUND'))).toBe('gone')
  expect(learnerInterviewErrorKind(new ApiError('x', 401, 'AUTH_ACCESS_TOKEN_REQUIRED'))).toBe('login')
  expect(learnerInterviewErrorKind(new ApiError('x', 403, 'ACCESS_DENIED'))).toBe('forbidden')
  expect(learnerInterviewErrorKind(new ApiError('x', 429, 'AI_QUOTA_EXCEEDED'))).toBe('quota')
  expect(learnerInterviewErrorKind(new ApiError('x', 409, 'AI_GENERATION_IN_PROGRESS'))).toBe('busy')
  expect(learnerInterviewErrorKind(new ApiError('x', 502, 'AI_PROVIDER_UNAVAILABLE'))).toBe('retry')
  expect(learnerInterviewErrorKind(new ApiError('x', 504, 'AI_TIMEOUT'))).toBe('retry')
  expect(learnerInterviewErrorKind(new TypeError('Failed to fetch'))).toBe('retry')
})

it('formats placeholders and maps level, status and verdict labels in vi and en', () => {
  expect(interviewText('vi')('aiDraftResult', { n: 2, count: 3 })).toBe('AI tạo được 2/3 câu, đã lưu thành bản nháp. Hãy kiểm tra trước khi gửi duyệt.')
  expect(interviewText('en')('aiDraftResult', { n: 2, count: 3 })).toBe('AI created 2/3 draft questions. Review them before submitting.')
  expect(moderatorInterviewText('vi')('heading')).toBe('Kiểm duyệt câu hỏi phỏng vấn')
  expect(learnerInterviewText('vi')('quotaLeft', { remaining: 4, limit: 15 })).toBe('Còn 4/15 lượt hôm nay')
  expect(interviewLevelLabel.MEDIUM.vi).toBe('Vừa')
  expect(interviewStatusLabel.CHANGES_REQUESTED.vi).toBe('Cần chỉnh sửa')
  expect(interviewVerdictLabel.GOOD.vi).toBe('Đạt ý chính')
  expect(interviewVerdictLabel.PARTIAL.vi).toBe('Đạt một phần')
  expect(interviewVerdictLabel.OFF_TRACK.vi).toBe('Chưa đúng trọng tâm')
})
