import { ApiError } from '../services/api/client'
import type { Language } from '../types/preferences'

type Copy = { vi: string; en: string }
const taxonomyGone: Copy = { vi: 'Chủ đề hoặc thẻ không còn tồn tại.', en: 'The topic or tag no longer exists.' }
const unavailable: Copy = { vi: 'Trợ lý AI tạm thời không khả dụng.', en: 'AI assist is temporarily unavailable.' }

// Spec “Mã lỗi, HTTP và copy vi/en”; the backend message is always English, so the UI translates by code.
const errors: Record<string, Copy> = {
  VALIDATION_ERROR: { vi: 'Kiểm tra lại thông tin đã nhập.', en: 'Check the information you entered.' },
  MALFORMED_REQUEST: { vi: 'Yêu cầu không đúng định dạng.', en: 'The request format is invalid.' },
  ACCESS_DENIED: { vi: 'Bạn không có quyền dùng trợ lý AI.', en: 'You do not have permission to use AI assist.' },
  TOPIC_NOT_FOUND: taxonomyGone,
  TAG_NOT_FOUND: taxonomyGone,
  AI_GENERATION_NOT_FOUND: { vi: 'Phiên viết không còn tồn tại.', en: 'The generation no longer exists.' },
  ARTICLE_ASSOCIATION_INACTIVE: { vi: 'Chủ đề hoặc thẻ đã ngừng hoạt động.', en: 'The topic or tag is inactive.' },
  ARTICLE_NOT_EDITABLE: { vi: 'Trạng thái hiện tại không cho phép sửa bài.', en: 'The current state does not allow editing.' },
  AI_GENERATION_IN_PROGRESS: { vi: 'Một bản nháp khác đang được viết.', en: 'Another draft is already being generated.' },
  AI_GENERATION_INVALID: { vi: 'Phiên AI không khớp với bản nháp này. Hãy tạo lại.', en: 'The AI generation does not match this draft. Generate it again.' },
  AI_OUTPUT_INVALID: { vi: 'AI trả nội dung chưa hợp lệ. Hãy thử tạo lại.', en: 'AI returned invalid content. Try generating it again.' },
  AI_OUTPUT_TRUNCATED: { vi: 'Nội dung bị ngắt do quá dài. Hãy chọn độ dài ngắn hơn hoặc thử lại.', en: 'The content was cut off. Choose a shorter length or try again.' },
  AI_RATE_LIMITED: { vi: 'Bạn thao tác quá nhanh. Hãy thử lại sau.', en: 'Too many requests. Try again shortly.' },
  AI_QUOTA_EXCEEDED: { vi: 'Bạn đã dùng hết lượt AI hôm nay.', en: 'You have used today’s AI allowance.' },
  AI_CONFIGURATION_INVALID: { vi: 'Trợ lý AI chưa được cấu hình.', en: 'AI assist is not configured.' },
  AI_PROVIDER_UNAVAILABLE: { vi: 'Dịch vụ AI đang gián đoạn. Hãy thử lại.', en: 'The AI service is temporarily unavailable. Try again.' },
  AI_PROVIDER_REQUEST_REJECTED: { vi: 'Dịch vụ AI từ chối yêu cầu. Hãy thử lại sau.', en: 'The AI service rejected the request. Try again later.' },
  AI_PROVIDER_AUTH_FAILED: { vi: 'Dịch vụ AI chưa sẵn sàng.', en: 'The AI service is not ready.' },
  AI_PROVIDER_RATE_LIMITED: { vi: 'Dịch vụ AI đang bận. Hãy thử lại sau.', en: 'The AI service is busy. Try again later.' },
  AI_STORAGE_UNAVAILABLE: unavailable,
  AI_TIMEOUT: { vi: 'AI phản hồi quá lâu. Hãy thử lại.', en: 'AI took too long to respond. Try again.' },
  // Frontend-only: the SHA-256 of the received buffer differs from `completed.contentSha256`.
  AI_STREAM_INTEGRITY_FAILED: { vi: 'Nội dung nhận được không toàn vẹn. Hãy tạo lại.', en: 'The received content failed integrity validation. Generate it again.' },
}
const network: Copy = { vi: 'Mất kết nối. Ý tưởng và dàn ý của bạn vẫn được giữ.', en: 'Connection lost. Your idea and outline are still saved.' }
const unknown: Copy = { vi: 'Đã có lỗi xảy ra. Hãy thử lại.', en: 'Something went wrong. Try again.' }

/** Copy for a backend/SSE error code, an ApiError, or a failed fetch (TypeError = network). */
export function aiErrorText(error: unknown, language: Language) {
  if (typeof error === 'string') return (errors[error] ?? unknown)[language]
  if (error instanceof ApiError) return ((error.code && errors[error.code]) || (error.status === 403 ? errors.ACCESS_DENIED : error.status >= 500 ? unavailable : unknown))[language]
  return (error instanceof TypeError ? network : unknown)[language]
}

const vi = {
  entry: 'Tạo bằng AI', kicker: 'Trợ lý viết bài', title: 'Tạo bài bằng AI', subtitle: 'Từ ý tưởng tới dàn ý, rồi AI viết bản nháp để bạn kiểm tra.', back: 'Bài viết của tôi',
  restored: 'Đã khôi phục form và dàn ý của phiên trước.', restoredCompleted: 'Đã khôi phục bản nháp hoàn tất và kiểm tra lại toàn vẹn.',
  interrupted: 'Phiên viết trước đã bị gián đoạn và không thể tiếp tục. Phiên cũ có thể còn giữ lượt viết tới khoảng 3 phút; nếu bị báo đang viết, hãy thử lại sau.',
  reset: 'Bắt đầu lại', resetTitle: 'Bắt đầu lại từ đầu?', resetText: 'Form, dàn ý và bản nháp hoàn tất trong tab này sẽ bị xóa.', cancel: 'Hủy', retry: 'Thử lại', backToBlogs: 'Về bài viết của tôi',
  step1: '1 · Ý tưởng bài viết', titleField: 'Tiêu đề (tùy chọn)', topic: 'Chủ đề', chooseTopic: 'Chọn chủ đề', idea: 'Ý tưởng',
  ideaPlaceholder: 'Bài viết cần giải thích điều gì, cho ví dụ nào…', length: 'Độ dài', SHORT: 'Ngắn', MEDIUM: 'Vừa', LONG: 'Dài', audience: 'Đối tượng đọc', audiencePlaceholder: 'Ví dụ: Sinh viên đã biết Java cơ bản',
  formHelp: 'Chọn chủ đề, nhập ý tưởng (20–4.000 ký tự) và đối tượng đọc để tạo dàn ý.', generateOutline: 'Tạo dàn ý', generating: 'Đang tạo dàn ý…', collapse: 'Thu gọn', expand: 'Mở rộng', optionsError: 'Không tải được chủ đề và thẻ.',
  quota: '{remaining}/{limit}', quotaOutline: 'Còn {value} lượt dàn ý', quotaDraft: 'Còn {value} lượt viết', quotaUnknown: 'Số lượt sẽ cập nhật sau lần dùng đầu.',
  titleLength: 'Tiêu đề cần 5–255 ký tự.', topicRequired: 'Hãy chọn chủ đề.', ideaLength: 'Ý tưởng cần 20–4.000 ký tự.', audienceLength: 'Đối tượng đọc cần 3–200 ký tự.',
  summaryLength: 'Tóm tắt cần 50–500 ký tự.', sectionCount: 'Dàn ý cần 3–8 mục H2.', headingLength: 'Tiêu đề mục cần 5–120 ký tự.', headingDuplicate: 'Tiêu đề mục bị trùng với mục khác.',
  tooLarge: 'Dữ liệu gửi đi vượt 16 KiB. Hãy rút gọn ý tưởng hoặc dàn ý.', fixOutline: 'Hãy sửa các lỗi trong dàn ý trước khi viết bài.',
  step2: '2 · Chỉnh dàn ý', outlineTitle: 'Tiêu đề', summary: 'Tóm tắt', tags: 'Thẻ', suggested: 'Gợi ý', tagsFull: 'Đã đủ 10 thẻ. Bỏ một thẻ để thêm gợi ý.', removeTag: 'Bỏ thẻ {name}',
  section: 'Mục {n}', heading: 'Tiêu đề mục {n}', sub: 'Mục con {n}.{m}', moveUp: 'Đưa {name} lên', moveDown: 'Đưa {name} xuống', remove: 'Xóa {name}',
  addSub: 'Mục con', addSection: 'Thêm H2', otherOutline: 'Tạo dàn ý khác', otherTitle: 'Tạo dàn ý khác?', otherText: 'Dàn ý mới sẽ thay bản bạn đã sửa và tốn thêm một lượt dàn ý.', write: 'Viết bài',
  streaming: '3 · AI đang viết', connecting: 'Đang kết nối…', progress: 'Phần {done}/{total} · tối đa {seconds} giây', streamNote: 'Chỉ dùng được nội dung sau khi kiểm tra hoàn tất.', preview: 'Bản xem trước', stop: 'Dừng',
  completed: '3 · Bản nháp hoàn tất', verified: 'Đã kiểm tra', completedNote: 'Nội dung đã qua kiểm tra hợp lệ và toàn vẹn. Bài sẽ được lưu dạng nháp, chưa gửi duyệt.',
  regenerate: 'Tạo lại', regenerateTitle: 'Tạo lại bản nháp?', regenerateText: 'AI sẽ viết bản mới và tốn một lượt viết; bản hiện tại sẽ bị bỏ.',
  handoff: 'Lưu nháp và mở trình soạn thảo', saving: 'Đang lưu…', createFailed: 'Chưa lưu được bài. Nội dung vẫn được giữ.', rewrite: 'Viết lại',
  stopped: 'Đã dừng. Phần nội dung dở chỉ để đọc, không thể lưu.', partial: 'Phần đã nhận (chỉ đọc)',
  aiBadge: 'AI hỗ trợ', aiBanner: 'Bản nháp có nội dung do AI hỗ trợ — hãy kiểm tra tính chính xác, mã nguồn và liên kết trước khi gửi duyệt.', closeBanner: 'Đóng thông báo AI hỗ trợ',
}
type AiCopy = typeof vi
const en: AiCopy = {
  entry: 'Create with AI', kicker: 'Writing assistant', title: 'Create an article with AI', subtitle: 'From idea to outline, then AI writes a draft for you to review.', back: 'My articles',
  restored: 'Your form and outline from the previous session were restored.', restoredCompleted: 'The completed draft was restored and its integrity re-checked.',
  interrupted: 'The previous generation was interrupted and cannot continue. It may hold your draft slot for about 3 minutes; if you are told a draft is in progress, try again later.',
  reset: 'Start over', resetTitle: 'Start over?', resetText: 'The form, outline and completed draft in this tab will be cleared.', cancel: 'Cancel', retry: 'Retry', backToBlogs: 'Back to my articles',
  step1: '1 · Article idea', titleField: 'Title (optional)', topic: 'Topic', chooseTopic: 'Choose a topic', idea: 'Idea',
  ideaPlaceholder: 'What should the article explain, with which examples…', length: 'Length', SHORT: 'Short', MEDIUM: 'Medium', LONG: 'Long', audience: 'Audience', audiencePlaceholder: 'E.g. students who know basic Java',
  formHelp: 'Choose a topic and enter an idea (20–4,000 characters) and an audience to create an outline.', generateOutline: 'Create outline', generating: 'Creating outline…', collapse: 'Collapse', expand: 'Expand', optionsError: 'Could not load topics and tags.',
  quota: '{remaining}/{limit}', quotaOutline: '{value} outlines left', quotaDraft: '{value} drafts left', quotaUnknown: 'The count updates after your first use.',
  titleLength: 'The title needs 5–255 characters.', topicRequired: 'Choose a topic.', ideaLength: 'The idea needs 20–4,000 characters.', audienceLength: 'The audience needs 3–200 characters.',
  summaryLength: 'The summary needs 50–500 characters.', sectionCount: 'The outline needs 3–8 H2 sections.', headingLength: 'Headings need 5–120 characters.', headingDuplicate: 'This heading duplicates another one.',
  tooLarge: 'The request exceeds 16 KiB. Shorten the idea or the outline.', fixOutline: 'Fix the outline errors before writing.',
  step2: '2 · Edit the outline', outlineTitle: 'Title', summary: 'Summary', tags: 'Tags', suggested: 'Suggested', tagsFull: '10 tags selected. Remove one to add a suggestion.', removeTag: 'Remove tag {name}',
  section: 'Section {n}', heading: 'Section {n} heading', sub: 'Subsection {n}.{m}', moveUp: 'Move {name} up', moveDown: 'Move {name} down', remove: 'Delete {name}',
  addSub: 'Subsection', addSection: 'Add H2', otherOutline: 'Create another outline', otherTitle: 'Create another outline?', otherText: 'The new outline replaces your edits and uses one more outline.', write: 'Write article',
  streaming: '3 · AI is writing', connecting: 'Connecting…', progress: 'Section {done}/{total} · up to {seconds} seconds', streamNote: 'Content can only be used once validation completes.', preview: 'Preview', stop: 'Stop',
  completed: '3 · Draft completed', verified: 'Verified', completedNote: 'The content passed validity and integrity checks. It is saved as a draft, not submitted for review.',
  regenerate: 'Regenerate', regenerateTitle: 'Regenerate the draft?', regenerateText: 'AI writes a new draft and uses one draft; the current one is discarded.',
  handoff: 'Save draft and open the editor', saving: 'Saving…', createFailed: 'The article was not saved. Your content is kept.', rewrite: 'Write again',
  stopped: 'Stopped. The partial content is read-only and cannot be saved.', partial: 'Received so far (read-only)',
  aiBadge: 'AI-assisted', aiBanner: 'This draft contains AI-assisted content — check accuracy, source code and links before submitting for review.', closeBanner: 'Dismiss the AI-assisted notice',
}

export function aiText(language: Language) {
  const copy = language === 'vi' ? vi : en
  return (key: keyof AiCopy, values: Record<string, string | number> = {}) => copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}
