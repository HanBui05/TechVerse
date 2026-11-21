import { expect, it } from 'vitest'
import { ApiError } from '../services/api/client'
import {
  FORUM_ERRORS,
  forumErrorText,
  forumReactionMeta,
  forumText,
  isReportAlreadyHandled,
  moderatorReportText,
  reportReasonLabel,
  reportStatusLabel,
} from './forumI18n'

const ALL_CODES = [
  'VALIDATION_ERROR',
  'MALFORMED_REQUEST',
  'AUTH_ACCESS_TOKEN_REQUIRED',
  'AUTH_INVALID_ACCESS_TOKEN',
  'ACCESS_DENIED',
  'FORUM_TOPIC_INACTIVE',
  'FORUM_CONTENT_INVALID',
  'FORUM_POST_NOT_FOUND',
  'FORUM_QUESTION_CLOSED',
  'FORUM_ANSWER_INVALID',
  'FORUM_ANSWER_LIMIT',
  'FORUM_DUPLICATE_POST',
  'FORUM_RATE_LIMITED',
  'FORUM_STORAGE_UNAVAILABLE',
  'FORUM_STATE_INVALID',
  'REPORT_TARGET_NOT_FOUND',
  'REPORT_OWN_CONTENT',
  'REPORT_ALREADY_SUBMITTED',
  'REPORT_NOT_FOUND',
  'REPORT_ALREADY_HANDLED',
]

it('translates every 1a, 1b and 1c error code in Vietnamese and English with exact spec copy', () => {
  for (const code of ALL_CODES) {
    expect(FORUM_ERRORS[code]?.vi, code).toBeTruthy()
    expect(FORUM_ERRORS[code]?.en, code).toBeTruthy()
    const vi = forumErrorText(new ApiError('Backend English', 400, code), 'vi')
    const en = forumErrorText(new ApiError('Backend English', 400, code), 'en')
    expect(vi).not.toContain('Backend English')
    expect(en).not.toContain('Backend English')
  }

  expect(forumErrorText(new ApiError('x', 409, 'FORUM_TOPIC_INACTIVE'), 'vi')).toBe('Chủ đề đã ngừng hoạt động.')
  expect(forumErrorText(new ApiError('x', 400, 'FORUM_CONTENT_INVALID'), 'vi')).toBe('Nội dung chứa định dạng không được hỗ trợ.')
  expect(forumErrorText(new ApiError('x', 404, 'FORUM_POST_NOT_FOUND'), 'vi')).toBe('Không tìm thấy bài viết.')
  expect(forumErrorText(new ApiError('x', 409, 'FORUM_QUESTION_CLOSED'), 'vi', 'general')).toBe('Bài hỏi đã bị xóa, không thể trả lời.')
  expect(forumErrorText(new ApiError('x', 409, 'FORUM_QUESTION_CLOSED'), 'vi', 'react')).toBe('Bài hỏi đã bị xóa.')
  expect(forumErrorText(new ApiError('x', 409, 'FORUM_QUESTION_CLOSED'), 'en', 'react')).toBe('This question was deleted.')
  expect(forumErrorText(new ApiError('x', 401, 'AUTH_ACCESS_TOKEN_REQUIRED'), 'vi', 'general')).toBe('Đăng nhập để tiếp tục.')
  expect(forumErrorText(new ApiError('x', 401, 'AUTH_ACCESS_TOKEN_REQUIRED'), 'vi', 'report')).toBe('Đăng nhập để báo cáo.')
  expect(forumErrorText(new ApiError('x', 401, 'AUTH_ACCESS_TOKEN_REQUIRED'), 'vi', 'react')).toBe('Đăng nhập để bày tỏ cảm xúc.')
  expect(forumErrorText(new ApiError('x', 409, 'FORUM_ANSWER_INVALID'), 'vi')).toBe('Câu trả lời không còn khả dụng.')
  expect(forumErrorText(new ApiError('x', 409, 'FORUM_ANSWER_LIMIT'), 'vi')).toBe('Bài hỏi đã đạt giới hạn câu trả lời.')
  expect(forumErrorText(new ApiError('x', 409, 'FORUM_DUPLICATE_POST'), 'vi')).toBe('Bạn vừa gửi nội dung này.')
  expect(forumErrorText(new ApiError('x', 429, 'FORUM_RATE_LIMITED'), 'vi')).toBe('Bạn thao tác quá nhanh, hãy thử lại sau.')
  expect(forumErrorText(new ApiError('x', 503, 'FORUM_STORAGE_UNAVAILABLE'), 'vi')).toBe('Dịch vụ đang gián đoạn. Hãy thử lại.')
  expect(forumErrorText(new ApiError('x', 404, 'REPORT_TARGET_NOT_FOUND'), 'vi')).toBe('Nội dung không còn khả dụng.')
  expect(forumErrorText(new ApiError('x', 409, 'REPORT_OWN_CONTENT'), 'vi')).toBe('Bạn không thể báo cáo bài của chính mình.')
  expect(forumErrorText(new ApiError('x', 409, 'REPORT_ALREADY_SUBMITTED'), 'vi')).toBe('Bạn đã báo cáo nội dung này.')
  expect(forumErrorText(new ApiError('x', 404, 'REPORT_NOT_FOUND'), 'vi')).toBe('Không tìm thấy báo cáo.')
  expect(forumErrorText(new ApiError('x', 409, 'REPORT_ALREADY_HANDLED'), 'vi')).toBe('Báo cáo đã được xử lý. Hãy tải lại.')
  expect(forumErrorText(new ApiError('x', 409, 'FORUM_STATE_INVALID'), 'vi')).toBe('Không thực hiện được ở trạng thái hiện tại.')
})

it('uses the spec fallback copy for validation/malformed codes and unknown errors', () => {
  expect(forumErrorText(new ApiError('x', 400, 'VALIDATION_ERROR'), 'vi')).toBe('Yêu cầu không hợp lệ. Hãy tải lại trang.')
  expect(forumErrorText(new ApiError('x', 400, 'MALFORMED_REQUEST'), 'en')).toBe('Invalid request. Please reload the page.')
  expect(forumErrorText(new ApiError('x', 418, 'UNKNOWN_CODE'), 'vi')).toBe('Yêu cầu không hợp lệ. Hãy tải lại trang.')
  expect(forumErrorText(new Error('network'), 'vi')).toBe('Yêu cầu không hợp lệ. Hãy tải lại trang.')
  expect(isReportAlreadyHandled(new ApiError('x', 409, 'REPORT_ALREADY_HANDLED'))).toBe(true)
  expect(isReportAlreadyHandled(new ApiError('x', 409, 'FORUM_STATE_INVALID'))).toBe(false)
})

it('formats placeholders and maps reaction, report reason and status labels in vi and en', () => {
  expect(forumText('vi')('answersCount', { n: 5 })).toBe('5 câu trả lời')
  expect(forumText('en')('answersCount', { n: 5 })).toBe('5 answers')
  expect(moderatorReportText('vi')('moreReports', { n: 3 })).toBe('+3 báo cáo khác')
  expect(moderatorReportText('en')('moreReports', { n: 3 })).toBe('+3 more reports')
  expect(forumReactionMeta.LOVE.label.vi).toBe('Yêu thích')
  expect(reportReasonLabel.MISLEADING.vi).toBe('Sai lệch, gây hiểu lầm')
  expect(reportStatusLabel.ACTIONED.vi).toBe('Đã ẩn nội dung')
})
