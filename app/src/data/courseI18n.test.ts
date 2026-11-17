import { describe, expect, it } from 'vitest'
import { ApiError } from '../services/api/client'
import { COURSE_ERROR_CODES, courseErrorText, courseText, isCourseStale, moderatorCourseErrorText, moderatorCourseText, readerCourseText, payAdminText } from './courseI18n'

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

describe('payment copy (Tasks 1a–1b table rows)', () => {
  const code = (name: string, status: number, language: 'vi' | 'en') => courseErrorText(new ApiError('English', status, name), language, 'F')
  it.each([
    ['COURSE_PRICE_INVALID', 400, 'Giá khóa học không hợp lệ.', 'The course price is invalid.'],
    ['COURSE_PRICE_TYPE_LOCKED', 409, 'Không thể đổi loại giá của khóa đã công khai.', 'A published course cannot switch between free and paid.'],
    ['COURSE_PURCHASE_REQUIRED', 403, 'Hãy mua khóa học để tiếp tục.', 'Buy this course to continue.'],
    ['ORDER_INVALID', 400, 'Thông tin đơn hàng không hợp lệ.', 'The order details are invalid.'],
    ['ORDER_COURSE_UNAVAILABLE', 409, 'Không thể mua khóa học này.', 'This course cannot be purchased.'],
    ['ORDER_ALREADY_ENROLLED', 409, 'Bạn đã có quyền học khóa này. Hãy tải lại trang.', 'You already have access to this course. Reload the page.'],
    ['PAYMENT_UNAVAILABLE', 503, 'Thanh toán tạm thời không khả dụng.', 'Payment is temporarily unavailable.'],
    ['ORDER_RATE_LIMITED', 429, 'Bạn thao tác quá nhanh, hãy thử lại sau.', 'You are going too fast; try again later.'],
    ['ORDER_NOT_FOUND', 404, 'Không tìm thấy đơn.', 'Order not found.'],
    ['ORDER_TRANSFER_REPORT_NOT_ALLOWED', 409, 'Đơn này không cần báo chuyển khoản.', 'This order does not need a transfer report.'],
    ['AUTH_ACCESS_TOKEN_REQUIRED', 401, 'Hãy đăng nhập để tiếp tục.', 'Sign in to continue.'],
    ['AUTH_INVALID_ACCESS_TOKEN', 401, 'Hãy đăng nhập để tiếp tục.', 'Sign in to continue.'],
  ])('%s → vi/en sentence', (name, status, vi, en) => {
    expect(code(name, status, 'vi')).toBe(vi)
    expect(code(name, status, 'en')).toBe(en)
  })

  it('has the price and buy copy of the Task 2a table in vi/en', () => {
    const [rvi, ren, avi, aen] = [readerCourseText('vi'), readerCourseText('en'), courseText('vi'), courseText('en')]
    expect([rvi('free'), rvi('buy'), rvi('purchaseRequired'), rvi('noRefund')]).toEqual(['Miễn phí', 'Mua khóa học', 'Hãy mua khóa học để tiếp tục.', 'Khóa học đã mua không được hoàn tiền.'])
    expect([ren('free'), ren('buy'), ren('purchaseRequired'), ren('noRefund')]).toEqual(['Free', 'Buy course', 'Buy this course to continue.', 'Purchased courses are non-refundable.'])
    expect(avi('share', { rate: 20, amount: '280.000 ₫' })).toBe('Nền tảng giữ 20%, bạn nhận 280.000 ₫')
    expect(aen('share', { rate: 20, amount: '₫280,000' })).toBe('Platform keeps 20%; you receive ₫280,000')
  })
})

describe('admin payment copy (Task 2c)', () => {
  it('uses the 1c-1d sentences for the new codes', () => {
    const vi = (code: string, status = 409) => courseErrorText(new ApiError('English', status, code), 'vi', 'F')
    expect(vi('PAYMENT_INVALID', 400)).toBe('Thông tin đối chiếu không hợp lệ.')
    expect(vi('PAYMENT_AMOUNT_MISMATCH')).toBe('Số tiền không khớp đơn; hãy đối chiếu sao kê.')
    expect(vi('PAYMENT_STATE_INVALID')).toBe('Không thể xác nhận đơn ở trạng thái này.')
    expect(vi('PAYMENT_REFERENCE_CONFLICT')).toBe('Mã giao dịch đã được dùng hoặc không khớp.')
    expect(vi('PAYMENT_RECONCILIATION_NOT_REQUIRED')).toBe('Không có khoản cần đối chiếu.')
    expect(vi('PAYMENT_RECONCILIATION_STALE')).toBe('Có khoản thanh toán mới; hãy xem lại danh sách.')
    expect(vi('COMMISSION_RATE_INVALID', 400)).toBe('Tỷ lệ không hợp lệ.')
    expect(courseErrorText(new ApiError('English', 409, 'PAYMENT_AMOUNT_MISMATCH'), 'en', 'F')).toMatch(/does not match/)
  })

  it('has the spec copy in both languages and fills placeholders', () => {
    expect(payAdminText('vi')('received')).toBe('Đã nhận tiền')
    expect(payAdminText('vi')('duplicate')).toBe('Có khoản thanh toán trùng cần đối chiếu')
    expect(payAdminText('en')('duplicate')).toBe('Duplicate payment requires reconciliation')
    expect(payAdminText('vi')('policy', { date: '14/11/2026' })).toBe('Tỷ lệ hoa hồng · Hiệu lực từ 14/11/2026')
    expect(payAdminText('en')('policy', { date: '11/14/2026' })).toBe('Commission rate · Effective from 11/14/2026')
    expect(payAdminText('vi')('revenueTitle')).toBe('Doanh thu tác giả')
    expect(payAdminText('en')('yourShare')).toBe('Your share')
  })
})
