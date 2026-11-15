import { describe, expect, it } from 'vitest'
import { ApiError } from '../services/api/client'
import { COURSE_ERROR_CODES, courseErrorText, courseText, isCourseStale, moderatorCourseErrorText, moderatorCourseText, readerCourseText } from './courseI18n'

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

describe('moderator course copy', () => {
  it('uses the Task 1c sentences for moderator codes in vi/en and keeps the course table for the rest', () => {
    const vi = (code: string, status = 409) => moderatorCourseErrorText(new ApiError('English', status, code), 'vi', 'F')
    expect(vi('COURSE_REVIEW_STALE')).toBe('Khóa học đã thay đổi. Hãy tải lại trước khi duyệt.')
    expect(vi('COURSE_SELF_REVIEW_NOT_ALLOWED', 403)).toBe('Bạn không thể duyệt khóa của mình.')
    expect(vi('COURSE_AUTHOR_INELIGIBLE')).toBe('Tác giả không còn đủ điều kiện.')
    expect(vi('COURSE_NOT_READY')).toBe('Khóa học không còn đủ điều kiện xuất bản.')
    expect(vi('COURSE_REVIEW_NOTE_REQUIRED', 400)).toBe('Cần nhập phản hồi.')
    expect(vi('COURSE_PUBLICATION_NOTE_REQUIRED', 400)).toBe('Cần nhập lý do.')
    expect(vi('VALIDATION_ERROR', 400)).toBe('Kiểm tra lại các trường được đánh dấu.')
    expect(moderatorCourseErrorText(new ApiError('English', 409, 'COURSE_REVIEW_STALE'), 'en', 'F')).toBe('The course has changed. Reload it before reviewing.')
    expect(moderatorCourseErrorText(new ApiError('English', 409, 'COURSE_NOT_READY'), 'en', 'F')).toBe('The course is no longer eligible to be published.')
  })

  it('treats a stale token or a moved state as stale', () => {
    for (const code of ['COURSE_REVIEW_STALE', 'COURSE_PUBLICATION_TRANSITION_INVALID', 'COURSE_NOT_PENDING']) expect(isCourseStale(new ApiError('x', 409, code))).toBe(true)
    expect(isCourseStale(new ApiError('x', 409, 'COURSE_NOT_READY'))).toBe(false)
  })

  it('has the spec labels in vi/en', () => {
    const [vi, en] = [moderatorCourseText('vi'), moderatorCourseText('en')]
    expect([vi('title'), vi('APPROVE'), vi('REQUEST_CHANGES'), vi('NEW'), vi('CHANGED'), vi('ARCHIVED'), vi('changesOnly'), vi('viewAll')])
      .toEqual(['Duyệt khóa học', 'Duyệt khóa', 'Yêu cầu sửa', 'Mới', 'Đã sửa', 'Đã gỡ', 'Chỉ phần thay đổi', 'Xem tất cả'])
    expect([en('title'), en('APPROVE'), en('REQUEST_CHANGES'), en('NEW'), en('CHANGED'), en('ARCHIVED'), en('changesOnly'), en('viewAll')])
      .toEqual(['Course moderation', 'Approve course', 'Request changes', 'New', 'Changed', 'Archived', 'Changes only', 'View all'])
  })
})

describe('reader course copy', () => {
  it('has the same keys in vi and en and keeps the spec sentences', () => {
    const vi = readerCourseText('vi'); const en = readerCourseText('en')
    expect(vi('loginTitle')).toBe('Đăng nhập để bắt đầu khóa học.'); expect(en('loginTitle')).toBe('Sign in to start this course.')
    expect(vi('complete')).toBe('Hoàn thành bài học'); expect(en('uncomplete')).toBe('Mark as incomplete')
    expect(vi('continueLearning')).toBe('Tiếp tục học'); expect(en('startLearning')).toBe('Start learning')
    expect(vi('chapterProgress', { x: 1, y: 3 })).toBe('Đã học 1/3 bài')
    expect(vi('notFound')).toBe('Không tìm thấy khóa học hoặc bài học.'); expect(en('notFound')).toBe('Course or lesson not found.')
  })
})
