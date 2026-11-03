import { ApiError } from '../../services/api/client'
import type { Language } from '../../types/preferences'

type Copy = { vi: string; en: string }

// Backend `message` is always English, so Admin pages translate the error code; unknown codes fall back to the HTTP status.
const byCode: Record<string, Copy> = {
  TOPIC_EXISTED: { vi: 'Tên chủ đề đã tồn tại. Hãy chọn tên khác.', en: 'A topic with this name already exists. Choose another name.' },
  TAG_EXISTED: { vi: 'Tên thẻ đã tồn tại. Hãy chọn tên khác.', en: 'A tag with this name already exists. Choose another name.' },
  TOPIC_NOT_FOUND: { vi: 'Không tìm thấy chủ đề. Có thể nó đã bị xóa.', en: 'Topic not found. It may have been removed.' },
  TAG_NOT_FOUND: { vi: 'Không tìm thấy thẻ. Có thể nó đã bị xóa.', en: 'Tag not found. It may have been removed.' },
  USER_NOT_FOUND: { vi: 'Không tìm thấy người dùng.', en: 'User not found.' },
  INVALID_USER_SELECTION: { vi: 'Danh sách người dùng đã chọn không hợp lệ.', en: 'The selected users are not valid.' },
  ADMIN_SELF_LOCK_NOT_ALLOWED: { vi: 'Bạn không thể tự khóa tài khoản của mình.', en: 'You cannot lock your own account.' },
  LAST_ACTIVE_ADMIN_CANNOT_BE_LOCKED: { vi: 'Phải còn ít nhất một quản trị viên đang hoạt động.', en: 'At least one active administrator must remain.' },
  AUTHOR_APPLICATION_NOT_FOUND: { vi: 'Không tìm thấy hồ sơ tác giả.', en: 'Author application not found.' },
  AUTHOR_APPLICATION_ALREADY_REVIEWED: { vi: 'Hồ sơ này đã được xét duyệt.', en: 'This application has already been reviewed.' },
  AUTHOR_APPLICATION_STALE_VERSION: { vi: 'Hồ sơ đã thay đổi. Hãy tải lại rồi thử lại.', en: 'The application has changed. Reload it and try again.' },
  AUTHOR_SELF_REVIEW_NOT_ALLOWED: { vi: 'Bạn không thể tự duyệt hồ sơ của mình.', en: 'You cannot review your own application.' },
  AUTHOR_NOT_APPROVED: { vi: 'Chỉ tác giả đã được duyệt mới có thể bị tạm ngưng.', en: 'Only approved authors can be suspended.' },
  AUTHOR_NOT_SUSPENDED: { vi: 'Chỉ tác giả đang bị tạm ngưng mới có thể khôi phục.', en: 'Only suspended authors can be restored.' },
  AUTHOR_SELF_STATUS_CHANGE_NOT_ALLOWED: { vi: 'Bạn không thể tự tạm ngưng hoặc khôi phục hồ sơ của mình.', en: 'You cannot suspend or restore your own author profile.' },
  // Moderator article review shares this translator.
  ARTICLE_NOT_FOUND: { vi: 'Không tìm thấy bài viết. Có thể nó đã bị xóa.', en: 'Article not found. It may have been removed.' },
  ARTICLE_NOT_PENDING: { vi: 'Bài viết không còn chờ duyệt. Hãy tải lại danh sách.', en: 'This article is no longer pending. Reload the list.' },
  ARTICLE_REVIEW_STALE: { vi: 'Bài viết đã thay đổi. Hãy mở lại bài để kiểm tra trước khi duyệt.', en: 'The article has changed. Reopen it and check before reviewing.' },
  ARTICLE_SELF_REVIEW_NOT_ALLOWED: { vi: 'Bạn không thể tự duyệt bài viết của mình.', en: 'You cannot review your own article.' },
  ARTICLE_REVIEW_NOTE_REQUIRED: { vi: 'Cần nhập nhận xét khi yêu cầu chỉnh sửa.', en: 'Feedback is required when requesting changes.' },
  ARTICLE_ASSOCIATION_INACTIVE: { vi: 'Chủ đề hoặc thẻ của bài đã bị ẩn. Hãy yêu cầu tác giả đổi phân loại.', en: 'The article’s topic or a tag is now hidden. Ask the author to change it.' },
  ARTICLE_AUTHOR_INELIGIBLE: { vi: 'Tác giả không còn quyền đăng bài nên chưa thể xuất bản.', en: 'The author can no longer publish, so this article cannot go live.' },
}

const byStatus: Record<number, Copy> = {
  400: { vi: 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.', en: 'Some information is invalid. Please check it again.' },
  403: { vi: 'Bạn không có quyền thực hiện thao tác này.', en: 'You do not have permission to do this.' },
  404: { vi: 'Không tìm thấy dữ liệu. Có thể nó đã bị xóa.', en: 'The item was not found. It may have been removed.' },
  409: { vi: 'Dữ liệu đã thay đổi. Hãy tải lại rồi thử lại.', en: 'The data has changed. Reload and try again.' },
  429: { vi: 'Thao tác quá nhanh. Vui lòng thử lại sau ít phút.', en: 'Too many requests. Please try again shortly.' },
}
const unavailable: Copy = { vi: 'Hệ thống tạm thời gián đoạn. Vui lòng thử lại sau.', en: 'The service is temporarily unavailable. Please try again later.' }

export function adminErrorText(error: unknown, language: Language, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  const copy = (error.code && byCode[error.code]) || byStatus[error.status] || (error.status >= 500 ? unavailable : null)
  return copy ? copy[language] : fallback
}
