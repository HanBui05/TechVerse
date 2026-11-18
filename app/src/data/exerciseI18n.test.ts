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
