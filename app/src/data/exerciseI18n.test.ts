import { expect, it } from 'vitest'
import { EXERCISE_ERRORS, exerciseErrorText, exerciseText, isExerciseConflict } from './exerciseI18n'
import { ApiError } from '../services/api/client'

// Codes of the 1a table (1c AI_* codes are translated by aiAssistI18n; EXERCISE_QUESTIONS_INVALID is shared).
const CODES = ['VALIDATION_ERROR', 'EXERCISE_TOPIC_INACTIVE', 'EXERCISE_QUESTIONS_INVALID', 'EXERCISE_CONTENT_INVALID', 'AUTH_ACCESS_TOKEN_REQUIRED', 'AUTH_INVALID_ACCESS_TOKEN', 'ACCESS_DENIED',
  'EXERCISE_SET_NOT_FOUND', 'EXERCISE_NOT_EDITABLE', 'EXERCISE_NOT_READY', 'EXERCISE_STATE_INVALID', 'EXERCISE_NOT_DELETABLE', 'EXERCISE_VERSION_CONFLICT', 'EXERCISE_RATE_LIMITED', 'EXERCISE_STORAGE_UNAVAILABLE']
const AI_CODES = ['AI_RATE_LIMITED', 'AI_QUOTA_EXCEEDED', 'AI_OUTPUT_INVALID', 'AI_OUTPUT_TRUNCATED', 'AI_GENERATION_IN_PROGRESS', 'AI_PROVIDER_UNAVAILABLE', 'AI_PROVIDER_REQUEST_REJECTED', 'AI_PROVIDER_AUTH_FAILED', 'AI_PROVIDER_RATE_LIMITED', 'AI_TIMEOUT', 'AI_STORAGE_UNAVAILABLE', 'AI_CONFIGURATION_INVALID']

it('translates every 1a code to Vietnamese and English with the spec copy', () => {
  for (const code of CODES) {
    expect(EXERCISE_ERRORS[code]?.vi, code).toBeTruthy()
    expect(exerciseErrorText(new ApiError('English', 400, code), 'en', 'fallback')).not.toBe('fallback')
  }
  expect(exerciseErrorText(new ApiError('x', 409, 'EXERCISE_VERSION_CONFLICT'), 'vi', '')).toBe('Bộ bài tập đã được sửa ở nơi khác. Hãy tải lại trước khi lưu.')
  expect(exerciseErrorText(new ApiError('x', 404, 'EXERCISE_SET_NOT_FOUND'), 'vi', '')).toBe('Không tìm thấy bộ bài tập.')
  expect(exerciseErrorText(new ApiError('x', 409, 'EXERCISE_QUESTIONS_INVALID'), 'vi', '')).toBe('Mỗi bộ tối đa 50 câu.')
  expect(exerciseErrorText(new ApiError('x', 400, 'EXERCISE_CONTENT_INVALID'), 'vi', '')).toBe('Nội dung chứa định dạng không được hỗ trợ.')
})

it('translates every 1c AI code in both languages and never leaks the English backend message', () => {
  for (const code of AI_CODES) for (const language of ['vi', 'en'] as const) {
    const text = exerciseErrorText(new ApiError('Backend English message', 502, code), language, 'fallback')
    expect(text, `${code}/${language}`).not.toBe('fallback')
    expect(text).not.toContain('Backend English')
  }
  expect(exerciseErrorText(new ApiError('x', 429, 'AI_QUOTA_EXCEEDED'), 'vi', '')).toBe('Bạn đã dùng hết lượt AI hôm nay.')
})

it('falls back by status for unknown codes and by the fallback for non-API errors', () => {
  expect(exerciseErrorText(new ApiError('x', 403), 'vi', 'f')).toBe('Bạn không có quyền.')
  expect(exerciseErrorText(new ApiError('x', 500), 'vi', 'f')).toBe('Dịch vụ đang gián đoạn. Hãy thử lại.')
  expect(exerciseErrorText(new ApiError('x', 418, 'WHO_KNOWS'), 'vi', 'f')).toBe('f')
  expect(exerciseErrorText(new Error('boom'), 'vi', 'f')).toBe('f')
  expect(isExerciseConflict(new ApiError('x', 409, 'EXERCISE_VERSION_CONFLICT'))).toBe(true)
  expect(isExerciseConflict(new ApiError('x', 409, 'EXERCISE_STATE_INVALID'))).toBe(false)
})

it('substitutes placeholders and keeps both languages in step', () => {
  expect(exerciseText('vi')('questionInvalid', { n: 3 })).toBe('Câu 3: thông tin chưa hợp lệ.')
  expect(exerciseText('en')('aiResult', { n: 4, count: 5 })).toBe('AI produced 4/5 questions. Review before using.')
  expect(exerciseText('vi')('aiResult', { n: 4, count: 5 })).toBe('AI tạo được 4/5 câu. Hãy kiểm tra trước khi dùng.')
  expect(exerciseText('vi')('notReady')).toBe('Cần ít nhất 3 câu trắc nghiệm (hoặc 5 thẻ) để gửi duyệt.')
})

import { practiceErrorKind, practiceErrorText, practiceText } from './exerciseI18n'

it('translates every learner-side code of table 1b in vi and en', () => {
  const rows: [string, number, string, string][] = [
    ['EXERCISE_SET_NOT_FOUND', 404, 'Bộ bài tập không còn khả dụng.', 'This exercise set is no longer available.'],
    ['AUTH_ACCESS_TOKEN_REQUIRED', 401, 'Đăng nhập để làm bài.', 'Sign in to practice.'],
    ['ACCESS_DENIED', 403, 'Bạn không có quyền làm bộ bài tập này.', 'You do not have permission to take this exercise set.'],
    ['EXERCISE_ATTEMPT_INVALID', 400, 'Bài làm không hợp lệ. Hãy tải lại và làm lại.', 'This attempt is not valid. Reload and start again.'],
    ['EXERCISE_ATTEMPT_KEY_CONFLICT', 409, 'Yêu cầu trùng. Hãy làm lại.', 'Duplicate request. Please start again.'],
    ['EXERCISE_RATE_LIMITED', 429, 'Bạn thao tác quá nhanh, hãy thử lại sau.', 'You are going too fast; try again shortly.'],
    ['EXERCISE_STORAGE_UNAVAILABLE', 503, 'Dịch vụ đang gián đoạn. Hãy thử lại.', 'The service is temporarily unavailable. Try again.'],
    ['EXERCISE_ATTEMPT_NOT_FOUND', 404, 'Không tìm thấy lượt làm.', 'Attempt not found.'],
  ]
  for (const [code, status, vi, en] of rows) {
    expect(practiceErrorText(new ApiError('English', status, code), 'vi', 'x'), code).toBe(vi)
    expect(practiceErrorText(new ApiError('English', status, code), 'en', 'x'), code).toBe(en)
  }
  expect(practiceErrorText(new Error('network'), 'vi', 'Dịch vụ đang gián đoạn. Hãy thử lại.')).toBe('Dịch vụ đang gián đoạn. Hãy thử lại.')
})

it('classifies errors by what the screen must do next', () => {
  const kind = (status: number, code: string) => practiceErrorKind(new ApiError('x', status, code))
  expect(kind(404, 'EXERCISE_SET_NOT_FOUND')).toBe('gone')
  expect(kind(401, 'AUTH_ACCESS_TOKEN_REQUIRED')).toBe('login')
  expect(kind(400, 'EXERCISE_ATTEMPT_INVALID')).toBe('restart')
  expect(kind(409, 'EXERCISE_ATTEMPT_KEY_CONFLICT')).toBe('restart')
  expect(kind(429, 'EXERCISE_RATE_LIMITED')).toBe('retry')
  expect(kind(503, 'EXERCISE_STORAGE_UNAVAILABLE')).toBe('retry')
  expect(kind(403, 'ACCESS_DENIED')).toBe('forbidden')
  expect(practiceErrorKind(new TypeError('Failed to fetch'))).toBe('retry')
})

it('fills placeholders in learner copy', () => {
  expect(practiceText('vi')('progress', { n: 3, total: 12 })).toBe('Câu 3/12')
  expect(practiceText('en')('result', { correct: 9, total: 12, percent: 75 })).toBe('You got 9/12 correct (75%)')
})
