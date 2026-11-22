import { ApiError } from '../services/api/client'
import type { ForumReactionType, ReportReason, ReportStatus } from '../types/forum'
import type { Language } from '../types/preferences'

type Copy = { vi: string; en: string }

export const FORUM_REACTION_TYPES: readonly ForumReactionType[] = ['LIKE', 'LOVE', 'HAHA', 'ANGRY'] as const

export const forumReactionMeta: Record<ForumReactionType, { emoji: string; label: Copy }> = {
  LIKE: { emoji: '👍', label: { vi: 'Thích', en: 'Like' } },
  LOVE: { emoji: '❤️', label: { vi: 'Yêu thích', en: 'Love' } },
  HAHA: { emoji: '😂', label: { vi: 'Haha', en: 'Haha' } },
  ANGRY: { emoji: '😡', label: { vi: 'Phẫn nộ', en: 'Angry' } },
}

export const REPORT_REASONS: readonly ReportReason[] = ['SPAM', 'INAPPROPRIATE', 'COPYRIGHT', 'MISLEADING', 'OTHER'] as const

export const reportReasonLabel: Record<ReportReason, Copy> = {
  SPAM: { vi: 'Spam', en: 'Spam' },
  INAPPROPRIATE: { vi: 'Nội dung không phù hợp', en: 'Inappropriate' },
  COPYRIGHT: { vi: 'Vi phạm bản quyền', en: 'Copyright' },
  MISLEADING: { vi: 'Sai lệch, gây hiểu lầm', en: 'Misleading' },
  OTHER: { vi: 'Khác', en: 'Other' },
}

export const reportStatusLabel: Record<ReportStatus, Copy> = {
  OPEN: { vi: 'Chờ xử lý', en: 'Open' },
  ACTIONED: { vi: 'Đã ẩn nội dung', en: 'Content hidden' },
  DISMISSED: { vi: 'Đã bỏ qua', en: 'Dismissed' },
}

const fallbackError: Copy = {
  vi: 'Yêu cầu không hợp lệ. Hãy tải lại trang.',
  en: 'Invalid request. Please reload the page.',
}

const signInGeneral: Copy = { vi: 'Đăng nhập để tiếp tục.', en: 'Sign in to continue.' }
const signInReport: Copy = { vi: 'Đăng nhập để báo cáo.', en: 'Sign in to report.' }
const signInReact: Copy = { vi: 'Đăng nhập để bày tỏ cảm xúc.', en: 'Sign in to react.' }
const forbidden: Copy = { vi: 'Bạn không có quyền.', en: 'You do not have permission.' }
const unavailable: Copy = { vi: 'Dịch vụ đang gián đoạn. Hãy thử lại.', en: 'The service is temporarily unavailable. Try again.' }

/** Table 1a, 1b, 1c error codes. */
export const FORUM_ERRORS: Record<string, Copy> = {
  VALIDATION_ERROR: fallbackError,
  MALFORMED_REQUEST: fallbackError,
  AUTH_ACCESS_TOKEN_REQUIRED: signInGeneral,
  AUTH_INVALID_ACCESS_TOKEN: signInGeneral,
  ACCESS_DENIED: forbidden,
  FORUM_TOPIC_INACTIVE: { vi: 'Chủ đề đã ngừng hoạt động.', en: 'This topic is no longer active.' },
  FORUM_CONTENT_INVALID: { vi: 'Nội dung chứa định dạng không được hỗ trợ.', en: 'Content contains unsupported formatting.' },
  FORUM_POST_NOT_FOUND: { vi: 'Không tìm thấy bài viết.', en: 'Post not found.' },
  FORUM_QUESTION_CLOSED: { vi: 'Bài hỏi đã bị xóa, không thể trả lời.', en: 'This question was deleted and can no longer be answered.' },
  FORUM_ANSWER_INVALID: { vi: 'Câu trả lời không còn khả dụng.', en: 'This answer is no longer available.' },
  FORUM_ANSWER_LIMIT: { vi: 'Bài hỏi đã đạt giới hạn câu trả lời.', en: 'This question has reached its answer limit.' },
  FORUM_DUPLICATE_POST: { vi: 'Bạn vừa gửi nội dung này.', en: 'You just posted this content.' },
  FORUM_RATE_LIMITED: { vi: 'Bạn thao tác quá nhanh, hãy thử lại sau.', en: 'You are going too fast; try again shortly.' },
  FORUM_STORAGE_UNAVAILABLE: unavailable,
  FORUM_STATE_INVALID: { vi: 'Không thực hiện được ở trạng thái hiện tại.', en: 'This action is not valid in the current state.' },
  REPORT_TARGET_NOT_FOUND: { vi: 'Nội dung không còn khả dụng.', en: 'This content is no longer available.' },
  REPORT_OWN_CONTENT: { vi: 'Bạn không thể báo cáo bài của chính mình.', en: 'You cannot report your own content.' },
  REPORT_ALREADY_SUBMITTED: { vi: 'Bạn đã báo cáo nội dung này.', en: 'You have already reported this content.' },
  REPORT_NOT_FOUND: { vi: 'Không tìm thấy báo cáo.', en: 'Report not found.' },
  REPORT_ALREADY_HANDLED: { vi: 'Báo cáo đã được xử lý. Hãy tải lại.', en: 'This report was already handled. Reload.' },
}

export const FORUM_REACT_CLOSED_COPY: Copy = {
  vi: 'Bài hỏi đã bị xóa.',
  en: 'This question was deleted.',
}

export type ForumErrorContext = 'general' | 'react' | 'report'

export function forumErrorText(error: unknown, language: Language, context: ForumErrorContext = 'general', fallback?: string) {
  const defaultCopy = fallback ?? fallbackError[language]
  if (!(error instanceof ApiError)) return defaultCopy
  if (error.code === 'FORUM_QUESTION_CLOSED' && context === 'react') {
    return FORUM_REACT_CLOSED_COPY[language]
  }
  if ((error.code === 'AUTH_ACCESS_TOKEN_REQUIRED' || error.code === 'AUTH_INVALID_ACCESS_TOKEN' || error.status === 401)) {
    if (context === 'react') return signInReact[language]
    if (context === 'report') return signInReport[language]
    return signInGeneral[language]
  }
  if (error.code && FORUM_ERRORS[error.code]) return FORUM_ERRORS[error.code][language]
  if (error.status === 403) return forbidden[language]
  if (error.status >= 500) return unavailable[language]
  return defaultCopy
}

export const isReportAlreadyHandled = (error: unknown) =>
  error instanceof ApiError && error.code === 'REPORT_ALREADY_HANDLED'

const vi = {
  // Task 2a — Forum list, detail, editor, react, report
  heading: 'Hỏi đáp',
  subtitle: 'Đặt câu hỏi lập trình theo chủ đề, thảo luận giải pháp bằng Markdown và đánh dấu lời giải hữu ích.',
  topic: 'Chủ đề',
  allTopics: 'Tất cả chủ đề',
  chooseTopic: 'Chọn chủ đề',
  search: 'Tìm câu hỏi',
  searchPlaceholder: 'Tìm câu hỏi theo tiêu đề hoặc nội dung…',
  filterAll: 'Tất cả',
  filterUnsolved: 'Chưa giải quyết',
  filterSolved: 'Đã giải quyết',
  filterMine: 'Bài của tôi',
  clearFilters: 'Xóa lọc',
  askQuestion: 'Đặt câu hỏi',
  postQuestion: 'Đăng câu hỏi',
  editQuestion: 'Chỉnh sửa câu hỏi',
  postAnswer: 'Gửi câu trả lời',
  edit: 'Sửa',
  delete: 'Xóa',
  save: 'Lưu',
  saving: 'Đang lưu…',
  cancel: 'Hủy',
  close: 'Đóng',
  lostDraft: 'Nội dung bạn đã soạn (chưa gửi được)',
  copyDraft: 'Sao chép nội dung',
  retry: 'Thử lại',
  reload: 'Tải lại',
  backToList: 'Về danh sách hỏi đáp',
  backToQuestion: 'Quay lại câu hỏi',
  forbidden: 'Bạn không có quyền.',
  titleField: 'Tiêu đề',
  titlePlaceholder: 'Tóm tắt câu hỏi của bạn (10–150 ký tự)…',
  contentField: 'Nội dung',
  contentPlaceholder: 'Mô tả chi tiết vấn đề, đoạn mã liên quan và kết quả mong muốn (20–10.000 ký tự, hỗ trợ Markdown, không chèn ảnh)…',
  yourAnswer: 'Câu trả lời của bạn',
  answerPlaceholder: 'Viết câu trả lời chi tiết bằng Markdown (10–10.000 ký tự, không chèn ảnh)…',
  writeTab: 'Soạn thảo',
  previewTab: 'Xem trước',
  previewEmpty: 'Nhập nội dung Markdown để xem trước.',
  markSolution: 'Chọn làm lời giải',
  unmarkSolution: 'Bỏ chọn',
  solution: 'Lời giải',
  solved: 'Đã giải quyết',
  unsolved: 'Chưa giải quyết',
  answersCount: '{n} câu trả lời',
  edited: 'Đã sửa',
  guestPrompt: 'Đăng nhập để đặt câu hỏi và trả lời.',
  signIn: 'Đăng nhập',
  deleteConfirmTitle: 'Xóa bài này? Không thể hoàn tác.',
  deletedQuestionNotice: 'Bài hỏi đã bị người đăng xóa.',
  report: 'Báo cáo',
  reportReason: 'Lý do',
  chooseReason: 'Chọn lý do',
  reportDetails: 'Mô tả thêm',
  reportDetailsPlaceholder: 'Mô tả cụ thể vi phạm (bắt buộc tối thiểu 10 ký tự khi chọn Khác)…',
  submitReport: 'Gửi báo cáo',
  reportSubmitted: 'Đã gửi báo cáo. Cảm ơn bạn.',
  hide: 'Ẩn',
  hideReason: 'Lý do ẩn',
  hideReasonPlaceholder: 'Nhập lý do ẩn bài viết này (tối đa 1.000 ký tự)…',
  postHidden: 'Đã ẩn bài.',
  reactButton: 'Bày tỏ cảm xúc',
  reactionsDialogTitle: 'Người đã bày tỏ cảm xúc',
  reactionsAll: 'Tất cả',
  showMore: 'Xem thêm',
  noReactions: 'Chưa có ai bày tỏ cảm xúc.',
  emptyQuestions: 'Chưa có câu hỏi phù hợp.',
  emptyAnswers: 'Chưa có câu trả lời. Hãy là người đầu tiên.',
  unsavedChanges: 'Bạn có thay đổi chưa lưu. Rời trang?',
  stay: 'Ở lại',
  leave: 'Rời trang',
  loading: 'Đang tải…',
  loadError: 'Dịch vụ đang gián đoạn. Hãy thử lại.',
  notFound: 'Không tìm thấy bài viết.',
  moreActions: 'Thao tác khác',
  // Validation messages (Table 1a & 1b)
  titleLength: 'Tiêu đề từ 10 đến 150 ký tự.',
  questionContentLength: 'Nội dung từ 20 đến 10.000 ký tự.',
  answerContentLength: 'Câu trả lời từ 10 đến 10.000 ký tự.',
  topicRequired: 'Hãy chọn chủ đề.',
  contentInvalid: 'Nội dung chứa định dạng không được hỗ trợ.',
  reasonRequired: 'Hãy chọn lý do.',
  descriptionLength: 'Hãy mô tả vi phạm (10–1.000 ký tự).',
  noteRequired: 'Hãy ghi lý do (tối đa 1.000 ký tự).',
  keywordLength: 'Từ khóa tìm kiếm cần từ 2 đến 100 ký tự.',
}

type ForumCopy = typeof vi

const en: ForumCopy = {
  heading: 'Q&A',
  subtitle: 'Ask programming questions by topic, share Markdown answers, and mark accepted solutions.',
  topic: 'Topic',
  allTopics: 'All topics',
  chooseTopic: 'Choose a topic',
  search: 'Search questions',
  searchPlaceholder: 'Search questions by title or content…',
  filterAll: 'All',
  filterUnsolved: 'Unsolved',
  filterSolved: 'Solved',
  filterMine: 'My posts',
  clearFilters: 'Clear filters',
  askQuestion: 'Ask a question',
  postQuestion: 'Post question',
  editQuestion: 'Edit question',
  postAnswer: 'Post answer',
  edit: 'Edit',
  delete: 'Delete',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  close: 'Close',
  lostDraft: 'Your unsent draft',
  copyDraft: 'Copy text',
  retry: 'Retry',
  reload: 'Reload',
  backToList: 'Back to Q&A',
  backToQuestion: 'Back to question',
  forbidden: 'You do not have permission.',
  titleField: 'Title',
  titlePlaceholder: 'Summarize your question (10–150 characters)…',
  contentField: 'Details',
  contentPlaceholder: 'Describe the problem, code snippet, and expected outcome (20–10,000 characters, Markdown supported, no images)…',
  yourAnswer: 'Your answer',
  answerPlaceholder: 'Write a clear answer in Markdown (10–10,000 characters, no images)…',
  writeTab: 'Write',
  previewTab: 'Preview',
  previewEmpty: 'Enter Markdown content to preview.',
  markSolution: 'Mark as solution',
  unmarkSolution: 'Unmark',
  solution: 'Solution',
  solved: 'Solved',
  unsolved: 'Unsolved',
  answersCount: '{n} answers',
  edited: 'Edited',
  guestPrompt: 'Sign in to ask and answer.',
  signIn: 'Sign in',
  deleteConfirmTitle: 'Delete this post? This cannot be undone.',
  deletedQuestionNotice: 'This question was deleted by its author.',
  report: 'Report',
  reportReason: 'Reason',
  chooseReason: 'Choose a reason',
  reportDetails: 'Details',
  reportDetailsPlaceholder: 'Provide details about this violation (at least 10 characters when Other is selected)…',
  submitReport: 'Submit report',
  reportSubmitted: 'Report submitted. Thank you.',
  hide: 'Hide',
  hideReason: 'Reason for hiding',
  hideReasonPlaceholder: 'Enter the reason for hiding this post (up to 1,000 characters)…',
  postHidden: 'Post hidden.',
  reactButton: 'React',
  reactionsDialogTitle: 'Reactions',
  reactionsAll: 'All',
  showMore: 'Show more',
  noReactions: 'No reactions yet.',
  emptyQuestions: 'No matching questions.',
  emptyAnswers: 'No answers yet. Be the first.',
  unsavedChanges: 'You have unsaved changes. Leave?',
  stay: 'Stay',
  leave: 'Leave',
  loading: 'Loading…',
  loadError: 'The service is temporarily unavailable. Try again.',
  notFound: 'Post not found.',
  moreActions: 'More actions',
  titleLength: 'Title must be 10 to 150 characters.',
  questionContentLength: 'Details must be 20 to 10,000 characters.',
  answerContentLength: 'Answer must be 10 to 10,000 characters.',
  topicRequired: 'Choose a topic.',
  contentInvalid: 'Content contains unsupported formatting.',
  reasonRequired: 'Choose a reason.',
  descriptionLength: 'Describe the issue (10–1,000 characters).',
  noteRequired: 'Enter a reason (up to 1,000 characters).',
  keywordLength: 'Search keyword must be 2 to 100 characters.',
}

export function forumText(language: Language) {
  const copy = language === 'vi' ? vi : en
  return (key: keyof ForumCopy, values: Record<string, string | number> = {}) =>
    copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}

// ---- Task 2b — Moderator Reports ----

const modReportVi = {
  heading: 'Báo cáo vi phạm',
  subtitle: 'Xử lý báo cáo bài hỏi và câu trả lời từ cộng đồng hoặc khôi phục nội dung đang ẩn.',
  tabOpen: 'Chờ xử lý',
  tabHandled: 'Đã xử lý',
  tabHidden: 'Nội dung đang ẩn',
  statusOpen: 'Chờ xử lý',
  statusActioned: 'Đã ẩn nội dung',
  statusDismissed: 'Đã bỏ qua',
  reasonFilter: 'Lý do',
  allReasons: 'Tất cả lý do',
  statusFilter: 'Kết quả xử lý',
  hideContent: 'Ẩn nội dung',
  dismiss: 'Bỏ qua',
  restore: 'Hiện lại',
  openInForum: 'Mở trong diễn đàn',
  noLongerPublic: 'Không còn công khai',
  questionLabel: 'Bài hỏi',
  answerLabel: 'Câu trả lời',
  reporterLabel: 'Người báo cáo',
  authorLabel: 'Người đăng',
  hiddenByLabel: 'Người ẩn',
  moreReports: '+{n} báo cáo khác',
  noteLabelRequired: 'Lý do ẩn (bắt buộc)',
  noteLabelOptional: 'Ghi chú (tùy chọn)',
  noteMissing: 'Hãy ghi lý do (tối đa 1.000 ký tự).',
  alreadyHandled: 'Báo cáo đã được xử lý. Hãy tải lại.',
  emptyOpen: 'Không có báo cáo nào chờ xử lý.',
  emptyHandled: 'Không có báo cáo nào trong mục này.',
  emptyHidden: 'Không có nội dung nào đang ẩn.',
  hideDialogTitle: 'Ẩn nội dung bị báo cáo?',
  hideDialogDesc: 'Bài viết sẽ bị ẩn khỏi diễn đàn và toàn bộ báo cáo chờ xử lý của bài này sẽ được đóng.',
  dismissDialogTitle: 'Bỏ qua báo cáo này?',
  dismissDialogDesc: 'Bài viết vẫn hiển thị trên diễn đàn và toàn bộ báo cáo chờ xử lý của bài này sẽ chuyển sang Đã bỏ qua.',
  restoreDialogTitle: 'Hiện lại nội dung này?',
  restoreDialogDesc: 'Bài viết sẽ hiển thị công khai trở lại trên diễn đàn.',
  resolvedHiddenMsg: 'Đã ẩn nội dung và đóng báo cáo.',
  resolvedDismissedMsg: 'Đã bỏ qua báo cáo.',
  restoredMsg: 'Đã hiện lại nội dung.',
  expandContent: 'Xem đầy đủ',
  collapseContent: 'Thu gọn',
  cancel: 'Hủy',
  reload: 'Tải lại',
  retry: 'Thử lại',
  loading: 'Đang tải…',
  loadError: 'Dịch vụ đang gián đoạn. Hãy thử lại.',
}

type ModReportCopy = typeof modReportVi

const modReportEn: ModReportCopy = {
  heading: 'Reports',
  subtitle: 'Review community reports on forum questions and answers or restore hidden content.',
  tabOpen: 'Open',
  tabHandled: 'Handled',
  tabHidden: 'Hidden content',
  statusOpen: 'Open',
  statusActioned: 'Content hidden',
  statusDismissed: 'Dismissed',
  reasonFilter: 'Reason',
  allReasons: 'All reasons',
  statusFilter: 'Resolution',
  hideContent: 'Hide content',
  dismiss: 'Dismiss',
  restore: 'Restore',
  openInForum: 'Open in forum',
  noLongerPublic: 'No longer public',
  questionLabel: 'Question',
  answerLabel: 'Answer',
  reporterLabel: 'Reporter',
  authorLabel: 'Author',
  hiddenByLabel: 'Hidden by',
  moreReports: '+{n} more reports',
  noteLabelRequired: 'Reason for hiding (required)',
  noteLabelOptional: 'Note (optional)',
  noteMissing: 'Enter a reason (up to 1,000 characters).',
  alreadyHandled: 'This report was already handled. Reload.',
  emptyOpen: 'No open reports.',
  emptyHandled: 'No handled reports found.',
  emptyHidden: 'No hidden content.',
  hideDialogTitle: 'Hide reported content?',
  hideDialogDesc: 'The post will be hidden from the forum and all open reports for it will be marked as handled.',
  dismissDialogTitle: 'Dismiss this report?',
  dismissDialogDesc: 'The post will remain visible and all open reports for it will be marked as dismissed.',
  restoreDialogTitle: 'Restore this content?',
  restoreDialogDesc: 'The post will become visible in the forum again.',
  resolvedHiddenMsg: 'Content hidden and report resolved.',
  resolvedDismissedMsg: 'Report dismissed.',
  restoredMsg: 'Content restored.',
  expandContent: 'Show full content',
  collapseContent: 'Collapse',
  cancel: 'Cancel',
  reload: 'Reload',
  retry: 'Retry',
  loading: 'Loading…',
  loadError: 'The service is temporarily unavailable. Try again.',
}

export function moderatorReportText(language: Language) {
  const copy = language === 'vi' ? modReportVi : modReportEn
  return (key: keyof ModReportCopy, values: Record<string, string | number> = {}) =>
    copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}
