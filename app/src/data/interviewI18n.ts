import { ApiError } from '../services/api/client'
import type { InterviewLevel, InterviewMarkFilter, InterviewStatus, InterviewVerdict } from '../types/interview'
import type { Language } from '../types/preferences'

type Copy = { vi: string; en: string }

export const interviewLevelLabel: Record<InterviewLevel, Copy> = {
  EASY: { vi: 'Dễ', en: 'Easy' },
  MEDIUM: { vi: 'Vừa', en: 'Medium' },
  HARD: { vi: 'Khó', en: 'Hard' },
}

export const interviewStatusLabel: Record<InterviewStatus, Copy> = {
  DRAFT: { vi: 'Bản nháp', en: 'Draft' },
  PENDING: { vi: 'Chờ duyệt', en: 'Pending review' },
  PUBLISHED: { vi: 'Đang công khai', en: 'Published' },
  CHANGES_REQUESTED: { vi: 'Cần sửa', en: 'Changes requested' },
  AUTHOR_HIDDEN: { vi: 'Đã ẩn', en: 'Hidden' },
  HIDDEN: { vi: 'Bị ẩn bởi kiểm duyệt', en: 'Hidden by moderator' },
  REMOVED: { vi: 'Đã gỡ', en: 'Removed' },
}

export const interviewMarkLabel: Record<InterviewMarkFilter, Copy> = {
  SAVED: { vi: 'Đã lưu', en: 'Saved' },
  REVIEWED: { vi: 'Đã ôn', en: 'Reviewed' },
}

export const interviewVerdictLabel: Record<InterviewVerdict, Copy> = {
  GOOD: { vi: 'Trả lời tốt', en: 'Good answer' },
  PARTIAL: { vi: 'Đúng một phần', en: 'Partly correct' },
  OFF_TRACK: { vi: 'Chưa đúng trọng tâm', en: 'Off track' },
}

const sessionExpired: Copy = { vi: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', en: 'Your session expired. Please sign in again.' }
const forbidden: Copy = { vi: 'Bạn không có quyền.', en: 'You do not have permission.' }
const unavailable: Copy = { vi: 'Dịch vụ đang gián đoạn. Hãy thử lại.', en: 'The service is temporarily unavailable. Try again.' }
const aiDown: Copy = { vi: 'Dịch vụ AI đang gián đoạn. Hãy thử lại.', en: 'The AI service is temporarily unavailable. Try again.' }

/** Table 1a + 1c error codes for Author & Moderator interview pages. */
export const INTERVIEW_ERRORS: Record<string, Copy> = {
  VALIDATION_ERROR: { vi: 'Dữ liệu chưa hợp lệ. Hãy kiểm tra lại các trường.', en: 'Some fields are invalid. Please check your input.' },
  MALFORMED_REQUEST: { vi: 'Dữ liệu chưa hợp lệ. Hãy kiểm tra lại các trường.', en: 'Some fields are invalid. Please check your input.' },
  INTERVIEW_TOPIC_INACTIVE: { vi: 'Chủ đề đã ngừng hoạt động.', en: 'This topic is no longer active.' },
  INTERVIEW_CONTENT_INVALID: { vi: 'Nội dung chứa định dạng không được hỗ trợ.', en: 'Content contains unsupported formatting.' },
  AUTH_ACCESS_TOKEN_REQUIRED: sessionExpired,
  AUTH_INVALID_ACCESS_TOKEN: sessionExpired,
  ACCESS_DENIED: forbidden,
  INTERVIEW_QUESTION_NOT_FOUND: { vi: 'Không tìm thấy câu hỏi phỏng vấn.', en: 'Interview question not found.' },
  INTERVIEW_NOT_EDITABLE: { vi: 'Câu hỏi đang ở trạng thái không sửa được.', en: 'This question cannot be edited in its current state.' },
  INTERVIEW_STATE_INVALID: { vi: 'Thao tác không hợp lệ ở trạng thái hiện tại.', en: 'This action is not valid in the current state.' },
  INTERVIEW_NOT_DELETABLE: { vi: 'Không xóa được câu hỏi đã công khai hoặc đang chờ duyệt.', en: 'Published or pending questions cannot be deleted.' },
  INTERVIEW_VERSION_CONFLICT: { vi: 'Câu hỏi đã được sửa ở nơi khác. Hãy tải lại trước khi lưu.', en: 'This question was modified elsewhere. Reload before saving.' },
  INTERVIEW_REVIEW_STALE: { vi: 'Câu hỏi đã thay đổi. Hãy tải lại trước khi duyệt.', en: 'The question changed. Reload before reviewing.' },
  INTERVIEW_AUTHOR_INELIGIBLE: { vi: 'Tác giả không còn đủ điều kiện xuất bản.', en: 'The author is no longer eligible to publish.' },
  INTERVIEW_RATE_LIMITED: { vi: 'Bạn thao tác quá nhanh, hãy thử lại sau.', en: 'You are going too fast; try again shortly.' },
  INTERVIEW_STORAGE_UNAVAILABLE: unavailable,
  // Copy from the "Copy hiển thị" column of table 1c.
  AI_RATE_LIMITED: { vi: 'Bạn thao tác quá nhanh.', en: 'You are going too fast.' },
  AI_QUOTA_EXCEEDED: { vi: 'Bạn đã dùng hết lượt AI hôm nay.', en: 'You have used today’s AI allowance.' },
  AI_OUTPUT_INVALID: { vi: 'AI trả về nội dung không dùng được. Hãy thử lại.', en: 'AI returned unusable content. Please try again.' },
  AI_OUTPUT_TRUNCATED: { vi: 'Kết quả bị cắt. Hãy thử lại với nội dung ngắn hơn.', en: 'The result was cut off. Try again with shorter input.' },
  AI_GENERATION_IN_PROGRESS: { vi: 'AI đang xử lý yêu cầu trước.', en: 'AI is still working on your previous request.' },
  AI_PROVIDER_UNAVAILABLE: aiDown,
  AI_PROVIDER_REQUEST_REJECTED: aiDown,
  AI_PROVIDER_AUTH_FAILED: aiDown,
  AI_PROVIDER_RATE_LIMITED: aiDown,
  AI_TIMEOUT: aiDown,
  AI_STORAGE_UNAVAILABLE: aiDown,
  AI_CONFIGURATION_INVALID: aiDown,
}

export function interviewErrorText(error: unknown, language: Language, fallback: string) {
  if (!(error instanceof ApiError)) return fallback
  if (error.code && INTERVIEW_ERRORS[error.code]) return INTERVIEW_ERRORS[error.code][language]
  if (error.status === 401) return sessionExpired[language]
  if (error.status === 403) return forbidden[language]
  if (error.status >= 500) return unavailable[language]
  return fallback
}

export const isInterviewConflict = (error: unknown) => error instanceof ApiError && error.code === 'INTERVIEW_VERSION_CONFLICT'
export const isInterviewStale = (error: unknown) => error instanceof ApiError && (error.code === 'INTERVIEW_REVIEW_STALE' || error.code === 'INTERVIEW_STATE_INVALID')

const vi = {
  // Author list & editor (Task 2a)
  heading: 'Câu hỏi phỏng vấn',
  subtitle: 'Soạn thảo câu hỏi phỏng vấn, đáp án mẫu và gửi kiểm duyệt trước khi công khai.',
  newQuestion: 'Tạo câu hỏi',
  editQuestion: 'Chỉnh sửa câu hỏi',
  generateAi: 'Tạo bằng AI',
  aiDialogTitle: 'Tạo câu hỏi bằng AI',
  aiDialogSubtitle: 'AI tạo bản nháp câu hỏi kèm đáp án mẫu và lưu ngay vào danh sách bản nháp của bạn.',
  list: 'Danh sách câu hỏi',
  loading: 'Đang tải…',
  loadError: 'Dịch vụ đang gián đoạn. Hãy thử lại.',
  retry: 'Thử lại',
  back: 'Câu hỏi phỏng vấn',
  toList: 'Về danh sách',
  notFound: 'Không tìm thấy câu hỏi phỏng vấn.',
  status: 'Trạng thái',
  allStatuses: 'Tất cả trạng thái',
  level: 'Mức độ',
  allLevels: 'Tất cả mức độ',
  topic: 'Chủ đề',
  allTopics: 'Tất cả chủ đề',
  chooseTopic: 'Chọn chủ đề',
  search: 'Tìm theo câu hỏi',
  searchPlaceholder: 'Nhập từ khóa câu hỏi…',
  clearFilters: 'Xóa lọc',
  emptyTitle: 'Bạn chưa có câu hỏi phỏng vấn nào.',
  noMatch: 'Không có câu hỏi nào khớp bộ lọc.',
  updated: 'Cập nhật {date}',
  aiUsed: 'Có dùng AI',
  newDraftBadge: 'Mới tạo',
  moderatorNote: 'Ghi chú của Moderator',
  changesRequested: 'Moderator yêu cầu sửa',
  readOnly: 'Câu hỏi đang ở trạng thái không sửa được. Hãy tạo bản sao nếu muốn chỉnh sửa.',
  readOnlyPending: 'Câu hỏi đang chờ duyệt. Hãy rút lại nếu muốn chỉnh sửa.',
  questionField: 'Câu hỏi',
  questionPlaceholder: 'Nhập nội dung câu hỏi phỏng vấn (10–1.000 ký tự, hỗ trợ Markdown)…',
  sampleAnswerField: 'Đáp án mẫu',
  sampleAnswerPlaceholder: 'Nhập đáp án mẫu chi tiết (20–5.000 ký tự, hỗ trợ Markdown)…',
  hintField: 'Gợi ý (tùy chọn)',
  hintPlaceholder: 'Gợi ý ngắn giúp người học định hướng câu trả lời (tối đa 500 ký tự)…',
  editorPane: 'Soạn thảo',
  previewPane: 'Xem trước',
  previewEmpty: 'Nhập nội dung ở cột bên trái để xem trước Markdown.',
  create: 'Lưu',
  save: 'Lưu',
  saving: 'Đang lưu…',
  unsaved: 'Chưa lưu',
  submit: 'Gửi duyệt',
  edit: 'Sửa',
  view: 'Xem',
  withdraw: 'Rút lại',
  copy: 'Tạo bản sao',
  hide: 'Ẩn',
  unhide: 'Hiện lại',
  delete: 'Xóa',
  cancel: 'Hủy',
  close: 'Đóng',
  reload: 'Tải lại',
  submitTitle: 'Gửi câu hỏi phỏng vấn này để Moderator duyệt?',
  submitText: 'Trong lúc chờ duyệt bạn sẽ không sửa được trừ khi rút lại.',
  withdrawTitle: 'Rút câu hỏi phỏng vấn về bản nháp để sửa?',
  deleteTitle: 'Xóa câu hỏi phỏng vấn này? Không thể hoàn tác.',
  conflictTitle: 'Câu hỏi đã được sửa ở nơi khác. Hãy tải lại trước khi lưu.',
  created: 'Đã lưu câu hỏi phỏng vấn.',
  saved: 'Đã lưu.',
  submitted: 'Đã gửi duyệt.',
  withdrawn: 'Đã rút về bản nháp.',
  copied: 'Đã tạo bản sao.',
  hiddenMsg: 'Đã ẩn câu hỏi.',
  unhiddenMsg: 'Đã hiện lại câu hỏi.',
  deleted: 'Đã xóa câu hỏi phỏng vấn.',
  leave: 'Bạn có thay đổi chưa lưu. Rời trang?',
  stay: 'Ở lại',
  leaveNow: 'Rời trang',
  // Validation messages (Table 1a & 1c)
  topicRequired: 'Hãy chọn chủ đề.',
  levelRequired: 'Hãy chọn mức độ.',
  questionLength: 'Câu hỏi cần từ 10 đến 1.000 ký tự.',
  sampleAnswerLength: 'Đáp án mẫu cần từ 20 đến 5.000 ký tự.',
  hintLength: 'Gợi ý tối đa 500 ký tự.',
  contentInvalid: 'Nội dung chứa định dạng không được hỗ trợ.',
  instruction: 'Yêu cầu',
  instructionPlaceholder: 'Ví dụ: Tập trung vào transaction isolation và deadlock trong hệ thống thực tế…',
  sourceText: 'Tài liệu nguồn',
  sourcePlaceholder: 'Dán nội dung tài liệu tham khảo (tối đa 8.000 ký tự)…',
  count: 'Số câu',
  instructionLength: 'Yêu cầu tối đa 500 ký tự.',
  sourceLength: 'Tài liệu nguồn tối đa 8.000 ký tự.',
  countRange: 'Số câu cần từ 1 đến 5.',
  quotaLeft: 'Còn {remaining}/{limit} lượt hôm nay',
  quotaOut: 'Bạn đã dùng hết lượt AI hôm nay.',
  generatingAi: 'Đang tạo câu hỏi…',
  aiDraftResult: 'AI tạo được {n}/{count} câu, đã lưu thành bản nháp. Hãy kiểm tra trước khi gửi duyệt.',
}

type InterviewCopy = typeof vi

const en: InterviewCopy = {
  heading: 'Interview questions',
  subtitle: 'Draft interview questions and sample answers, then submit them for review before publishing.',
  newQuestion: 'New question',
  editQuestion: 'Edit question',
  generateAi: 'Generate with AI',
  aiDialogTitle: 'Generate questions with AI',
  aiDialogSubtitle: 'AI generates draft questions with sample answers and saves them directly to your drafts.',
  list: 'Question list',
  loading: 'Loading…',
  loadError: 'The service is temporarily unavailable. Try again.',
  retry: 'Retry',
  back: 'Interview questions',
  toList: 'Back to list',
  notFound: 'Interview question not found.',
  status: 'Status',
  allStatuses: 'All statuses',
  level: 'Level',
  allLevels: 'All levels',
  topic: 'Topic',
  allTopics: 'All topics',
  chooseTopic: 'Choose a topic',
  search: 'Search questions',
  searchPlaceholder: 'Search by question text…',
  clearFilters: 'Clear filters',
  emptyTitle: 'You don’t have any interview questions yet.',
  noMatch: 'No questions match the filters.',
  updated: 'Updated {date}',
  aiUsed: 'AI-assisted',
  newDraftBadge: 'New',
  moderatorNote: 'Moderator note',
  changesRequested: 'Moderator requested changes',
  readOnly: 'This question cannot be edited in its current state. Duplicate it to make changes.',
  readOnlyPending: 'This question is pending review. Withdraw it to make changes.',
  questionField: 'Question',
  questionPlaceholder: 'Enter the interview question (10–1,000 characters, Markdown supported)…',
  sampleAnswerField: 'Sample answer',
  sampleAnswerPlaceholder: 'Enter a thorough sample answer (20–5,000 characters, Markdown supported)…',
  hintField: 'Hint (optional)',
  hintPlaceholder: 'Optional hint to guide the learner (up to 500 characters)…',
  editorPane: 'Editor',
  previewPane: 'Preview',
  previewEmpty: 'Type on the left to preview Markdown.',
  create: 'Save',
  save: 'Save',
  saving: 'Saving…',
  unsaved: 'Unsaved',
  submit: 'Submit for review',
  edit: 'Edit',
  view: 'View',
  withdraw: 'Withdraw',
  copy: 'Duplicate',
  hide: 'Hide',
  unhide: 'Unhide',
  delete: 'Delete',
  cancel: 'Cancel',
  close: 'Close',
  reload: 'Reload',
  submitTitle: 'Submit this interview question for review?',
  submitText: 'While pending review, it cannot be edited unless you withdraw it.',
  withdrawTitle: 'Withdraw this interview question back to draft?',
  deleteTitle: 'Delete this interview question? This cannot be undone.',
  conflictTitle: 'This question was modified elsewhere. Reload before saving.',
  created: 'Interview question saved.',
  saved: 'Saved.',
  submitted: 'Submitted for review.',
  withdrawn: 'Withdrawn to draft.',
  copied: 'Duplicated.',
  hiddenMsg: 'Question hidden.',
  unhiddenMsg: 'Question unhidden.',
  deleted: 'Interview question deleted.',
  leave: 'You have unsaved changes. Leave page?',
  stay: 'Stay',
  leaveNow: 'Leave',
  topicRequired: 'Choose a topic.',
  levelRequired: 'Choose a level.',
  questionLength: 'Question must be 10 to 1,000 characters.',
  sampleAnswerLength: 'Sample answer must be 20 to 5,000 characters.',
  hintLength: 'Hint must be at most 500 characters.',
  contentInvalid: 'Content contains unsupported formatting.',
  instruction: 'Instruction',
  instructionPlaceholder: 'E.g. Focus on transaction isolation and deadlocks in production systems…',
  sourceText: 'Source text',
  sourcePlaceholder: 'Paste reference material (up to 8,000 characters)…',
  count: 'Question count',
  instructionLength: 'Instruction must be at most 500 characters.',
  sourceLength: 'Source text must be at most 8,000 characters.',
  countRange: 'Question count must be from 1 to 5.',
  quotaLeft: '{remaining}/{limit} left today',
  quotaOut: 'You have used today’s AI allowance.',
  generatingAi: 'Generating questions…',
  aiDraftResult: 'AI created {n}/{count} draft questions. Review them before submitting.',
}

export function interviewText(language: Language) {
  const copy = language === 'vi' ? vi : en
  return (key: keyof InterviewCopy, values: Record<string, string | number> = {}) =>
    copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}

// ---- Moderator (Task 2a) ----

export const MODERATOR_INTERVIEW_STATUSES = ['PENDING', 'PUBLISHED', 'AUTHOR_HIDDEN', 'HIDDEN', 'REMOVED'] as const satisfies readonly InterviewStatus[]
export type ModeratorInterviewStatusFilter = (typeof MODERATOR_INTERVIEW_STATUSES)[number]
export const MODERATION_INTERVIEW_NOTE_MAX = 1000
export const MODERATION_INTERVIEW_NOTE_REQUIRED = ['REQUEST_CHANGES', 'HIDE', 'REMOVE'] as const

const modVi = {
  heading: 'Kiểm duyệt câu hỏi phỏng vấn',
  navShort: 'Câu hỏi phỏng vấn',
  subtitle: 'Xem câu hỏi, gợi ý và đáp án mẫu trước khi duyệt công khai.',
  status: 'Trạng thái',
  level: 'Mức độ',
  allLevels: 'Tất cả mức độ',
  topic: 'Chủ đề',
  allTopics: 'Tất cả chủ đề',
  search: 'Tìm kiếm',
  searchPlaceholder: 'Tìm theo nội dung câu hỏi…',
  clearFilters: 'Xóa lọc',
  loading: 'Đang tải danh sách kiểm duyệt…',
  loadError: 'Dịch vụ đang gián đoạn. Hãy thử lại.',
  retry: 'Thử lại',
  empty: 'Không có câu hỏi phỏng vấn nào.',
  emptyHint: 'Thử đổi trạng thái hoặc xóa bộ lọc.',
  aiUsed: 'Có dùng AI',
  ineligible: 'Tác giả không còn đủ điều kiện xuất bản.',
  updated: 'Cập nhật',
  backToQueue: 'Kiểm duyệt câu hỏi phỏng vấn',
  toList: 'Về danh sách',
  notFound: 'Không tìm thấy câu hỏi phỏng vấn.',
  previousNote: 'Ghi chú kiểm duyệt trước',
  questionSection: 'Câu hỏi',
  hintSection: 'Gợi ý',
  noHint: 'Không có gợi ý.',
  sampleAnswerSection: 'Đáp án mẫu',
  actions: 'Hành động',
  more: 'Thao tác khác',
  APPROVE: 'Duyệt',
  REQUEST_CHANGES: 'Yêu cầu sửa',
  HIDE: 'Ẩn',
  RESTORE: 'Khôi phục',
  REMOVE: 'Gỡ',
  APPROVE_title: 'Duyệt câu hỏi phỏng vấn này?',
  APPROVE_text: 'Câu hỏi sẽ được công khai trong mục Ôn phỏng vấn.',
  REQUEST_CHANGES_title: 'Yêu cầu tác giả chỉnh sửa?',
  REQUEST_CHANGES_text: 'Câu hỏi sẽ chuyển sang Cần sửa kèm lý do dưới đây.',
  HIDE_title: 'Ẩn câu hỏi đã xuất bản?',
  HIDE_text: 'Người học sẽ không còn thấy câu hỏi cho tới khi được khôi phục.',
  RESTORE_title: 'Khôi phục câu hỏi?',
  RESTORE_text: 'Câu hỏi sẽ hiển thị công khai trở lại.',
  REMOVE_title: 'Gỡ vĩnh viễn câu hỏi?',
  REMOVE_text: 'Gỡ không hoàn tác được. Người học sẽ không còn truy cập được câu hỏi này.',
  APPROVE_done: 'Đã duyệt câu hỏi phỏng vấn.',
  REQUEST_CHANGES_done: 'Đã gửi yêu cầu chỉnh sửa.',
  HIDE_done: 'Đã ẩn câu hỏi phỏng vấn.',
  RESTORE_done: 'Đã khôi phục câu hỏi phỏng vấn.',
  REMOVE_done: 'Đã gỡ câu hỏi phỏng vấn.',
  noteOptional: 'Ghi chú (không bắt buộc)',
  reasonRequired: 'Lý do (bắt buộc)',
  noteMissing: 'Hãy ghi lý do (tối đa 1.000 ký tự).',
  cancel: 'Hủy',
  reload: 'Tải lại',
}

type ModInterviewCopy = typeof modVi

const modEn: ModInterviewCopy = {
  heading: 'Review interview questions',
  navShort: 'Interview questions',
  subtitle: 'Inspect the question, hint, and sample answer before publishing.',
  status: 'Status',
  level: 'Level',
  allLevels: 'All levels',
  topic: 'Topic',
  allTopics: 'All topics',
  search: 'Search',
  searchPlaceholder: 'Search by question text…',
  clearFilters: 'Clear filters',
  loading: 'Loading the review queue…',
  loadError: 'The service is temporarily unavailable. Try again.',
  retry: 'Retry',
  empty: 'No interview questions found.',
  emptyHint: 'Try another status or clear the filters.',
  aiUsed: 'AI-assisted',
  ineligible: 'The author is no longer eligible to publish.',
  updated: 'Updated',
  backToQueue: 'Review interview questions',
  toList: 'Back to list',
  notFound: 'Interview question not found.',
  previousNote: 'Previous moderation note',
  questionSection: 'Question',
  hintSection: 'Hint',
  noHint: 'No hint provided.',
  sampleAnswerSection: 'Sample answer',
  actions: 'Actions',
  more: 'More actions',
  APPROVE: 'Approve',
  REQUEST_CHANGES: 'Request changes',
  HIDE: 'Hide',
  RESTORE: 'Restore',
  REMOVE: 'Remove',
  APPROVE_title: 'Approve this interview question?',
  APPROVE_text: 'The question will become public in Interview prep.',
  REQUEST_CHANGES_title: 'Request changes from the author?',
  REQUEST_CHANGES_text: 'The question will move to Changes requested with your note below.',
  HIDE_title: 'Hide this published question?',
  HIDE_text: 'Learners will no longer see it until it is restored.',
  RESTORE_title: 'Restore this question?',
  RESTORE_text: 'The question will be visible to learners again.',
  REMOVE_title: 'Permanently remove this question?',
  REMOVE_text: 'Removal cannot be undone. Learners will no longer have access.',
  APPROVE_done: 'Interview question approved.',
  REQUEST_CHANGES_done: 'Change request sent.',
  HIDE_done: 'Interview question hidden.',
  RESTORE_done: 'Interview question restored.',
  REMOVE_done: 'Interview question removed.',
  noteOptional: 'Note (optional)',
  reasonRequired: 'Reason (required)',
  noteMissing: 'Enter a reason (up to 1,000 characters).',
  cancel: 'Cancel',
  reload: 'Reload',
}

export function moderatorInterviewText(language: Language) {
  const copy = language === 'vi' ? modVi : modEn
  return (key: keyof ModInterviewCopy, values: Record<string, string | number> = {}) =>
    copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}

// ---- Learner / Public (Task 2b) ----

export type LearnerInterviewErrorKind = 'gone' | 'login' | 'forbidden' | 'quota' | 'busy' | 'retry' | 'other'

const learnerLogin: Copy = { vi: 'Đăng nhập để tiếp tục.', en: 'Sign in to continue.' }
const learnerGone: Copy = { vi: 'Câu hỏi không còn khả dụng.', en: 'This question is no longer available.' }

export const LEARNER_INTERVIEW_ERRORS: Record<string, Copy> = {
  ...INTERVIEW_ERRORS,
  VALIDATION_ERROR: { vi: 'Dữ liệu chưa hợp lệ.', en: 'Invalid input.' },
  MALFORMED_REQUEST: { vi: 'Dữ liệu chưa hợp lệ.', en: 'Invalid input.' },
  INTERVIEW_QUESTION_NOT_FOUND: learnerGone,
  AUTH_ACCESS_TOKEN_REQUIRED: learnerLogin,
  AUTH_INVALID_ACCESS_TOKEN: learnerLogin,
}

const TEMPORARY_AI_CODES = new Set([
  'AI_RATE_LIMITED',
  'AI_OUTPUT_INVALID',
  'AI_OUTPUT_TRUNCATED',
  'AI_GENERATION_IN_PROGRESS',
  'AI_PROVIDER_UNAVAILABLE',
  'AI_PROVIDER_REQUEST_REJECTED',
  'AI_PROVIDER_AUTH_FAILED',
  'AI_PROVIDER_RATE_LIMITED',
  'AI_TIMEOUT',
  'AI_STORAGE_UNAVAILABLE',
  'INTERVIEW_RATE_LIMITED',
  'INTERVIEW_STORAGE_UNAVAILABLE',
])

export function learnerInterviewErrorText(error: unknown, language: Language, fallback: string) {
  if (!(error instanceof ApiError)) return fallback
  if (error.code && LEARNER_INTERVIEW_ERRORS[error.code]) return LEARNER_INTERVIEW_ERRORS[error.code][language]
  if (error.status === 401) return learnerLogin[language]
  if (error.status === 404) return learnerGone[language]
  if (error.status === 403) return forbidden[language]
  if (error.status >= 500) return unavailable[language]
  return fallback
}

export function learnerInterviewErrorKind(error: unknown): LearnerInterviewErrorKind {
  if (!(error instanceof ApiError)) return 'retry'
  if (error.code === 'INTERVIEW_QUESTION_NOT_FOUND' || error.status === 404) return 'gone'
  if (error.code === 'AUTH_ACCESS_TOKEN_REQUIRED' || error.code === 'AUTH_INVALID_ACCESS_TOKEN' || error.status === 401) return 'login'
  if (error.code === 'AI_QUOTA_EXCEEDED') return 'quota'
  if (error.code === 'AI_GENERATION_IN_PROGRESS') return 'busy'
  if (error.code === 'ACCESS_DENIED' || error.status === 403) return 'forbidden'
  if ((error.code && TEMPORARY_AI_CODES.has(error.code)) || error.status === 429 || error.status >= 500) return 'retry'
  return 'other'
}

const learnerVi = {
  heading: 'Ôn phỏng vấn',
  subtitle: 'Luyện tập câu hỏi phỏng vấn tự luận theo chủ đề, đối chiếu đáp án mẫu và nhận xét bằng AI.',
  topic: 'Chủ đề',
  allTopics: 'Tất cả chủ đề',
  level: 'Mức độ',
  allLevels: 'Tất cả mức độ',
  markFilter: 'Trạng thái cá nhân',
  filterAll: 'Tất cả',
  filterSaved: 'Đã lưu',
  filterReviewed: 'Đã ôn',
  search: 'Tìm kiếm câu hỏi',
  searchPlaceholder: 'Tìm theo nội dung câu hỏi…',
  clearFilters: 'Xóa lọc',
  loading: 'Đang tải câu hỏi phỏng vấn…',
  loadError: 'Dịch vụ đang gián đoạn. Hãy thử lại.',
  retry: 'Thử lại',
  empty: 'Chưa có câu hỏi phỏng vấn nào.',
  noMatch: 'Không có câu hỏi nào khớp bộ lọc.',
  by: 'Tác giả: {name}',
  hasHintBadge: 'Có gợi ý',
  showHint: 'Xem gợi ý',
  hideHint: 'Ẩn gợi ý',
  showSampleAnswer: 'Xem đáp án mẫu',
  hideSampleAnswer: 'Ẩn đáp án mẫu',
  hintHeading: 'Gợi ý',
  sampleAnswerHeading: 'Đáp án mẫu',
  loadingAnswer: 'Đang tải…',
  markReviewed: 'Đánh dấu đã ôn',
  reviewed: 'Đã ôn',
  save: 'Lưu lại',
  saved: 'Đã lưu',
  guestPrompt: 'Đăng nhập để xem gợi ý, đáp án mẫu và luyện trả lời.',
  signIn: 'Đăng nhập',
  practiceHeading: 'Luyện trả lời',
  practiceHelper: 'Viết câu trả lời của bạn bằng lời của mình, sau đó bấm Nhận xét bằng AI để đối chiếu với đáp án mẫu.',
  answerLabel: 'Câu trả lời của bạn',
  answerPlaceholder: 'Nhập câu trả lời của bạn (1–4.000 ký tự)…',
  answerLengthError: 'Câu trả lời cần từ 1 đến 4.000 ký tự.',
  getFeedback: 'Nhận xét bằng AI',
  reviewing: 'Đang nhận xét…',
  quotaLeft: 'Còn {remaining}/{limit} lượt hôm nay',
  quotaOut: 'Bạn đã dùng hết lượt AI hôm nay.',
  strengths: 'Bạn làm tốt',
  missing: 'Còn thiếu',
  advice: 'Lời khuyên',
  aiDisclaimer: 'Nhận xét do AI tạo, có thể chưa chính xác. Hãy đối chiếu với đáp án mẫu.',
  gone: 'Câu hỏi không còn khả dụng.',
  toList: 'Về danh sách',
  back: 'Ôn phỏng vấn',
}

type LearnerInterviewCopy = typeof learnerVi

const learnerEn: LearnerInterviewCopy = {
  heading: 'Interview prep',
  subtitle: 'Practice open-ended interview questions by topic, compare with sample answers, and get AI feedback.',
  topic: 'Topic',
  allTopics: 'All topics',
  level: 'Level',
  allLevels: 'All levels',
  markFilter: 'Personal status',
  filterAll: 'All',
  filterSaved: 'Saved',
  filterReviewed: 'Reviewed',
  search: 'Search questions',
  searchPlaceholder: 'Search by question text…',
  clearFilters: 'Clear filters',
  loading: 'Loading interview questions…',
  loadError: 'The service is temporarily unavailable. Try again.',
  retry: 'Retry',
  empty: 'No interview questions yet.',
  noMatch: 'No questions match the filters.',
  by: 'By {name}',
  hasHintBadge: 'Hint available',
  showHint: 'Show hint',
  hideHint: 'Hide hint',
  showSampleAnswer: 'Show sample answer',
  hideSampleAnswer: 'Hide sample answer',
  hintHeading: 'Hint',
  sampleAnswerHeading: 'Sample answer',
  loadingAnswer: 'Loading…',
  markReviewed: 'Mark as reviewed',
  reviewed: 'Reviewed',
  save: 'Save',
  saved: 'Saved',
  guestPrompt: 'Sign in to view the hint, sample answer, and practice answering.',
  signIn: 'Sign in',
  practiceHeading: 'Practice your answer',
  practiceHelper: 'Write your answer in your own words, then request AI feedback to compare with the sample answer.',
  answerLabel: 'Your answer',
  answerPlaceholder: 'Write your answer here (1–4,000 characters)…',
  answerLengthError: 'Your answer must be 1 to 4,000 characters.',
  getFeedback: 'Get AI feedback',
  reviewing: 'Reviewing…',
  quotaLeft: '{remaining}/{limit} left today',
  quotaOut: 'You have used today’s AI allowance.',
  strengths: 'What you did well',
  missing: 'What is missing',
  advice: 'Advice',
  aiDisclaimer: 'Feedback is AI-generated and may be inaccurate. Compare with the sample answer.',
  gone: 'This question is no longer available.',
  toList: 'Back to list',
  back: 'Interview prep',
}

export function learnerInterviewText(language: Language) {
  const copy = language === 'vi' ? learnerVi : learnerEn
  return (key: keyof LearnerInterviewCopy, values: Record<string, string | number> = {}) =>
    copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}
