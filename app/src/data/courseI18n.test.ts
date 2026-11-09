import { describe, expect, it } from 'vitest'
import { ApiError } from '../services/api/client'
import { COURSE_ERROR_CODES, courseErrorText, courseText } from './courseI18n'

describe('courseI18n', () => {
  it.each(COURSE_ERROR_CODES)('maps %s in both languages without the backend message', code => {
    for (const language of ['vi', 'en'] as const) {
      const text = courseErrorText(new ApiError('English backend text', 400, code), language, 'FALLBACK')
      expect(text).not.toBe('FALLBACK')
      expect(text).not.toBe('English backend text')
    }
  })

  it('delegates AI_* codes to the AI table', () => {
    expect(courseErrorText(new ApiError('x', 429, 'AI_QUOTA_EXCEEDED'), 'vi', 'F')).toBe('Bạn đã dùng hết lượt AI hôm nay.')
    expect(courseErrorText(new ApiError('x', 409, 'AI_GENERATION_INVALID'), 'en', 'F')).toMatch(/AI generation/)
  })

  it('uses the fallback for unknown codes, 403/5xx get the generic copy, non-API errors the fallback', () => {
    expect(courseErrorText(new ApiError('x', 400, 'SOMETHING_NEW'), 'vi', 'F')).toBe('F')
    expect(courseErrorText(new ApiError('x', 403), 'en', 'F')).toBe('You do not have permission to do this.')
    expect(courseErrorText(new ApiError('x', 502), 'en', 'F')).toMatch(/temporarily unavailable/)
    expect(courseErrorText(new TypeError('network'), 'vi', 'F')).toBe('F')
  })

  it('keeps the spec copy and fills placeholders', () => {
    expect(courseText('vi')('newCourse')).toBe('Tạo khóa học')
    expect(courseText('en')('submit')).toBe('Submit for review')
    expect(courseText('vi')('previewCourse')).toBe('Học thử')
    expect(courseText('en')('unpublishedChanges')).toBe('Unpublished changes')
    expect(courseText('vi')('counts', { c: 2, l: 5 })).toBe('2 chương · 5 bài')
  })
})
