import { expect, it } from 'vitest'
import { aiErrorText, aiText } from './aiAssistI18n'
import { ApiError } from '../services/api/client'

// Spec “Mã lỗi, HTTP và copy vi/en”: code → copy, never the English backend message.
const table: [string, string, string][] = [
  ['VALIDATION_ERROR', 'Kiểm tra lại thông tin đã nhập.', 'Check the information you entered.'],
  ['MALFORMED_REQUEST', 'Yêu cầu không đúng định dạng.', 'The request format is invalid.'],
  ['ACCESS_DENIED', 'Bạn không có quyền dùng trợ lý AI.', 'You do not have permission to use AI assist.'],
  ['TOPIC_NOT_FOUND', 'Chủ đề hoặc thẻ không còn tồn tại.', 'The topic or tag no longer exists.'],
  ['TAG_NOT_FOUND', 'Chủ đề hoặc thẻ không còn tồn tại.', 'The topic or tag no longer exists.'],
  ['AI_GENERATION_NOT_FOUND', 'Phiên viết không còn tồn tại.', 'The generation no longer exists.'],
  ['ARTICLE_ASSOCIATION_INACTIVE', 'Chủ đề hoặc thẻ đã ngừng hoạt động.', 'The topic or tag is inactive.'],
  ['ARTICLE_NOT_EDITABLE', 'Trạng thái hiện tại không cho phép sửa bài.', 'The current state does not allow editing.'],
  ['AI_GENERATION_IN_PROGRESS', 'Một bản nháp khác đang được viết.', 'Another draft is already being generated.'],
  ['AI_GENERATION_INVALID', 'Phiên AI không khớp với bản nháp này. Hãy tạo lại.', 'The AI generation does not match this draft. Generate it again.'],
  ['AI_OUTPUT_INVALID', 'AI trả nội dung chưa hợp lệ. Hãy thử tạo lại.', 'AI returned invalid content. Try generating it again.'],
  ['AI_OUTPUT_TRUNCATED', 'Nội dung bị ngắt do quá dài. Hãy chọn độ dài ngắn hơn hoặc thử lại.', 'The content was cut off. Choose a shorter length or try again.'],
  ['AI_RATE_LIMITED', 'Bạn thao tác quá nhanh. Hãy thử lại sau.', 'Too many requests. Try again shortly.'],
  ['AI_QUOTA_EXCEEDED', 'Bạn đã dùng hết lượt AI hôm nay.', 'You have used today’s AI allowance.'],
  ['AI_CONFIGURATION_INVALID', 'Trợ lý AI chưa được cấu hình.', 'AI assist is not configured.'],
  ['AI_PROVIDER_UNAVAILABLE', 'Dịch vụ AI đang gián đoạn. Hãy thử lại.', 'The AI service is temporarily unavailable. Try again.'],
  ['AI_PROVIDER_REQUEST_REJECTED', 'Dịch vụ AI từ chối yêu cầu. Hãy thử lại sau.', 'The AI service rejected the request. Try again later.'],
  ['AI_PROVIDER_AUTH_FAILED', 'Dịch vụ AI chưa sẵn sàng.', 'The AI service is not ready.'],
  ['AI_PROVIDER_RATE_LIMITED', 'Dịch vụ AI đang bận. Hãy thử lại sau.', 'The AI service is busy. Try again later.'],
  ['AI_STORAGE_UNAVAILABLE', 'Trợ lý AI tạm thời không khả dụng.', 'AI assist is temporarily unavailable.'],
  ['AI_TIMEOUT', 'AI phản hồi quá lâu. Hãy thử lại.', 'AI took too long to respond. Try again.'],
  ['AI_STREAM_INTEGRITY_FAILED', 'Nội dung nhận được không toàn vẹn. Hãy tạo lại.', 'The received content failed integrity validation. Generate it again.'],
]

it.each(table)('maps %s to vi/en copy', (code, vi, en) => {
  expect(aiErrorText(code, 'vi')).toBe(vi)
  expect(aiErrorText(new ApiError('English backend text', 400, code), 'en')).toBe(en)
})

it('falls back by status and treats fetch failures as a lost connection', () => {
  expect(aiErrorText(new ApiError('x', 403), 'vi')).toBe('Bạn không có quyền dùng trợ lý AI.')
  expect(aiErrorText(new ApiError('x', 503, 'SOMETHING_NEW'), 'en')).toBe('AI assist is temporarily unavailable.')
  expect(aiErrorText(new TypeError('Failed to fetch'), 'vi')).toBe('Mất kết nối. Ý tưởng và dàn ý của bạn vẫn được giữ.')
  expect(aiErrorText(new TypeError('Failed to fetch'), 'en')).toBe('Connection lost. Your idea and outline are still saved.')
})

it('has the same keys in vi and en and interpolates values', () => {
  expect(aiText('vi')('quota', { remaining: 4, limit: 5 })).toContain('4/5')
  expect(aiText('en')('quota', { remaining: 4, limit: 5 })).toContain('4/5')
})
