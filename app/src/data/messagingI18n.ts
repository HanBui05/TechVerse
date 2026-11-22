import { ApiError } from '../services/api/client'
import type { Language } from '../types/preferences'

type Bi = { vi: string; en: string }

const DEFAULT_ERROR: Bi = {
  vi: 'Yêu cầu không hợp lệ. Hãy tải lại trang.',
  en: 'Invalid request. Please reload the page.',
}

export const MESSAGING_ERRORS: Record<string, Bi> = {
  AUTH_ACCESS_TOKEN_REQUIRED: { vi: 'Đăng nhập để tiếp tục.', en: 'Sign in to continue.' },
  AUTH_INVALID_ACCESS_TOKEN: { vi: 'Đăng nhập để tiếp tục.', en: 'Sign in to continue.' },
  ACCESS_DENIED: { vi: 'Bạn không có quyền.', en: 'You do not have permission.' },
  VALIDATION_ERROR: DEFAULT_ERROR,
  CONVERSATION_NOT_ALLOWED: { vi: 'Không thể nhắn cho tác giả của khóa này.', en: 'Cannot message the author of this course.' },
  CONVERSATION_NOT_FOUND: { vi: 'Không tìm thấy cuộc trò chuyện.', en: 'Conversation not found.' },
  MESSAGE_CONTENT_INVALID: { vi: 'Tin nhắn chứa định dạng không được hỗ trợ.', en: 'Message contains unsupported formatting.' },
  MESSAGE_CLIENT_ID_CONFLICT: { vi: 'Yêu cầu trùng. Hãy gửi lại.', en: 'Duplicate request. Please send again.' },
  CONVERSATION_BLOCKED: { vi: 'Cuộc trò chuyện đã bị chặn.', en: 'This conversation is blocked.' },
  CONVERSATION_LOCKED: { vi: 'Cuộc trò chuyện đã bị khóa bởi kiểm duyệt.', en: 'This conversation was locked by moderation.' },
  CONVERSATION_AWAITING_REPLY: { vi: 'Hãy chờ tác giả trả lời trước khi gửi thêm.', en: 'Please wait for the author to reply before sending more.' },
  MESSAGE_RATE_LIMITED: { vi: 'Bạn gửi quá nhanh, hãy thử lại sau.', en: 'You are sending messages too fast, please try again later.' },
  MESSAGE_STORAGE_UNAVAILABLE: { vi: 'Dịch vụ đang gián đoạn. Hãy thử lại.', en: 'Service is temporarily unavailable. Please try again.' },
  REPORT_TARGET_NOT_FOUND: { vi: 'Nội dung không còn khả dụng.', en: 'This content is no longer available.' },
  REPORT_TARGET_EMPTY: { vi: 'Chưa có tin nhắn nào để báo cáo.', en: 'There are no messages to report yet.' },
  REPORT_NOT_ALLOWED: { vi: 'Bạn không thể báo cáo nội dung này.', en: 'You cannot report this content.' },
  REPORT_OWN_CONTENT: { vi: 'Bạn không thể báo cáo nội dung của chính mình.', en: 'You cannot report your own content.' },
  REPORT_ALREADY_SUBMITTED: { vi: 'Bạn đã báo cáo nội dung này.', en: 'You already reported this content.' },
  REPORT_NOT_FOUND: { vi: 'Không tìm thấy báo cáo.', en: 'Report not found.' },
  REPORT_ALREADY_HANDLED: { vi: 'Báo cáo đã được xử lý. Hãy tải lại.', en: 'This report has already been handled. Please reload.' },
  CONVERSATION_STATE_INVALID: { vi: 'Không thực hiện được ở trạng thái hiện tại.', en: 'Cannot perform this action in the current state.' },
  FORUM_RATE_LIMITED: { vi: 'Bạn thao tác quá nhanh, hãy thử lại sau.', en: 'You are acting too fast, please try again later.' },
  FORUM_STORAGE_UNAVAILABLE: { vi: 'Dịch vụ đang gián đoạn. Hãy thử lại.', en: 'Service is temporarily unavailable. Please try again.' },
}

export function messagingErrorText(error: unknown, language: Language = 'vi', fallback?: string): string {
  if (error instanceof ApiError && error.code && MESSAGING_ERRORS[error.code]) {
    return MESSAGING_ERRORS[error.code][language]
  }
  return fallback ?? DEFAULT_ERROR[language]
}

const COPY = {
  // Task 2a spec copy table
  title: { vi: 'Tin nhắn', en: 'Messages' },
  roleAuthor: { vi: 'Tác giả', en: 'Author' },
  roleLearner: { vi: 'Người học', en: 'Learner' },
  inputPlaceholder: { vi: 'Nhập tin nhắn…', en: 'Type a message…' },
  send: { vi: 'Gửi', en: 'Send' },
  sending: { vi: 'Đang gửi…', en: 'Sending…' },
  resend: { vi: 'Gửi lại', en: 'Resend' },
  loadOlder: { vi: 'Tải tin cũ hơn', en: 'Load older messages' },
  emptyMessages: { vi: 'Chưa có tin nhắn. Hãy gửi lời chào.', en: 'No messages yet. Say hello.' },
  messageAuthor: { vi: 'Nhắn tác giả', en: 'Message the author' },
  aboutCourse: { vi: 'Hỏi về: {title}', en: 'About: {title}' },
  aboutCoursePrefix: { vi: 'Hỏi về:', en: 'About:' },
  enrolled: { vi: 'Đã đăng ký', en: 'Enrolled' },
  notEnrolled: { vi: 'Chưa đăng ký', en: 'Not enrolled' },
  remainingBeforeReply: {
    vi: 'Bạn có thể gửi thêm {n} tin trước khi tác giả trả lời.',
    en: 'You can send {n} more messages before the author replies.',
  },
  awaitingReply: {
    vi: 'Hãy chờ tác giả trả lời trước khi gửi thêm.',
    en: 'Please wait for the author to reply before sending more.',
  },
  block: { vi: 'Chặn', en: 'Block' },
  unblock: { vi: 'Bỏ chặn', en: 'Unblock' },
  report: { vi: 'Báo cáo', en: 'Report' },
  reportPrivacyNotice: {
    vi: 'Khi bạn báo cáo, kiểm duyệt viên sẽ xem được toàn bộ tin nhắn trong cuộc trò chuyện này.',
    en: 'When you report, moderators will be able to read every message in this conversation.',
  },
  confirmBlock: {
    vi: 'Chặn cuộc trò chuyện này? Cả hai bên sẽ không gửi được tin mới.',
    en: 'Block this conversation? Neither side will be able to send new messages.',
  },
  blockedByMe: { vi: 'Bạn đã chặn cuộc trò chuyện này.', en: 'You blocked this conversation.' },
  blockedByOther: { vi: 'Cuộc trò chuyện đã bị chặn.', en: 'This conversation is blocked.' },
  lockedByMod: { vi: 'Cuộc trò chuyện đã bị khóa bởi kiểm duyệt.', en: 'This conversation was locked by moderation.' },
  emptyConversations: { vi: 'Bạn chưa có cuộc trò chuyện nào.', en: 'You have no conversations yet.' },
  unreadConversations: { vi: '{n} cuộc trò chuyện chưa đọc', en: '{n} unread conversations' },
  contentLengthError: { vi: 'Tin nhắn từ 1 đến 2.000 ký tự.', en: 'Message must be between 1 and 2,000 characters.' },

  // Task 2b spec copy table
  targetConversation: { vi: 'Cuộc trò chuyện', en: 'Conversation' },
  viewMessages: { vi: 'Xem tin nhắn', en: 'View messages' },
  lockConversation: { vi: 'Khóa cuộc trò chuyện', en: 'Lock conversation' },
  unlockConversation: { vi: 'Mở khóa', en: 'Unlock' },
  dismissReport: { vi: 'Bỏ qua', en: 'Dismiss' },
  participants: { vi: 'Người tham gia', en: 'Participants' },
  statusBlocked: { vi: 'Đang bị chặn', en: 'Blocked' },
  statusLocked: { vi: 'Đang bị khóa', en: 'Locked' },
  moderatorPrivacyNote: {
    vi: 'Bạn chỉ xem được vì cuộc trò chuyện này đã bị báo cáo.',
    en: 'You can view this only because the conversation was reported.',
  },
  moderatorReasonRequired: {
    vi: 'Hãy ghi lý do (tối đa 1.000 ký tự).',
    en: 'Enter a reason (up to 1,000 characters).',
  },

  // Additional UI copy (listed in messaging.log.md under "Lệch khác spec")
  reconnecting: { vi: 'Đang kết nối lại…', en: 'Reconnecting…' },
  loadMoreConversations: { vi: 'Tải thêm', en: 'Load more' },
  selectConversation: {
    vi: 'Chọn một cuộc trò chuyện ở bên trái để bắt đầu.',
    en: 'Select a conversation on the left to start.',
  },
  browseCourses: { vi: 'Xem các khóa học', en: 'Browse courses' },
  sendFailed: { vi: 'Gửi lỗi', en: 'Failed to send' },
  newMessagesBelow: { vi: '↓ Tin mới', en: '↓ New messages' },
  enterHint: {
    vi: 'Enter để gửi · Shift+Enter xuống dòng',
    en: 'Enter to send · Shift+Enter for new line',
  },
  backToList: { vi: 'Danh sách tin nhắn', en: 'Back to conversations' },
  moreActions: { vi: 'Tùy chọn cuộc trò chuyện', en: 'Conversation options' },
  cancel: { vi: 'Hủy', en: 'Cancel' },
  retry: { vi: 'Thử lại', en: 'Retry' },
  loading: { vi: 'Đang tải…', en: 'Loading…' },
  unreadDot: { vi: 'Chưa đọc', en: 'Unread' },
  reportTitle: { vi: 'Báo cáo cuộc trò chuyện', en: 'Report conversation' },
  reportReasonLabel: { vi: 'Lý do báo cáo', en: 'Reason' },
  reportDescriptionLabel: { vi: 'Mô tả thêm', en: 'Additional details' },
  reportSubmit: { vi: 'Gửi báo cáo', en: 'Submit report' },
  reportSubmitted: { vi: 'Đã gửi báo cáo.', en: 'Report submitted.' },
  reportOtherRequired: {
    vi: 'Hãy mô tả vi phạm (10–1.000 ký tự).',
    en: 'Describe the violation (10–1,000 characters).',
  },
  today: { vi: 'Hôm nay', en: 'Today' },
  yesterday: { vi: 'Hôm qua', en: 'Yesterday' },
} as const

export type MessagingCopyKey = keyof typeof COPY

export function messagingText(language: Language = 'vi') {
  return (key: MessagingCopyKey, params?: Record<string, string | number>): string => {
    let text: string = COPY[key][language]
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v))
      }
    }
    return text
  }
}
