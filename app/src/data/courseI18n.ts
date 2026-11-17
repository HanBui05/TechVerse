import { ApiError } from '../services/api/client'
import type { Language } from '../types/preferences'
import { aiErrorText } from './aiAssistI18n'
import { moderatorCopy } from './articleI18n'

type Copy = { vi: string; en: string }
const unavailable: Copy = { vi: 'Hệ thống tạm thời gián đoạn. Vui lòng thử lại sau.', en: 'The service is temporarily unavailable. Please try again later.' }
const notFound: Copy = { vi: 'Không tìm thấy khóa học hoặc bài học.', en: 'Course or lesson not found.' }
const taxonomy: Copy = { vi: 'Chủ đề hoặc thẻ không còn hoạt động.', en: 'The topic or a tag is inactive.' }

// Closed list of the backend codes the course screens can meet; the UI translates by code because `message` is always English.
export const COURSE_ERROR_CODES = [
  'COURSE_CONTENT_INVALID', 'COURSE_FILE_TOO_LARGE', 'COURSE_TAXONOMY_INACTIVE', 'COURSE_NOT_EDITABLE', 'COURSE_NOT_READY', 'COURSE_NO_CHANGES', 'COURSE_NOT_PENDING',
  'COURSE_NOT_WITHDRAWABLE', 'COURSE_PUBLICATION_TRANSITION_INVALID', 'COURSE_NOT_FOUND', 'LESSON_NOT_FOUND', 'COURSE_ORDER_INVALID', 'COURSE_KEY_CONFLICT',
  'COURSE_REQUEST_IN_PROGRESS', 'COURSE_NOT_DISCARDABLE', 'COURSE_NOT_DELETABLE', 'COURSE_AUTHOR_UNHIDE_NOT_ALLOWED', 'COURSE_FILE_INVALID', 'COURSE_FILE_UNSUPPORTED',
  'COURSE_IMAGE_INVALID', 'COURSE_IMAGE_TOO_LARGE', 'COURSE_IMAGE_UNSUPPORTED', 'COURSE_IMAGE_UPLOAD_FAILED', 'COURSE_RATE_LIMITED', 'COURSE_STORAGE_UNAVAILABLE',
  'LESSON_CONTENT_REQUIRED', 'LESSON_VIDEO_INVALID', 'COURSE_REVIEW_STALE', 'COURSE_SELF_REVIEW_NOT_ALLOWED', 'COURSE_AUTHOR_INELIGIBLE', 'COURSE_REVIEW_NOTE_REQUIRED',
  'COURSE_PUBLICATION_NOTE_REQUIRED', 'LESSON_PREVIEW_ONLY', 'COURSE_ENROLLMENT_REQUIRED', 'ACCESS_DENIED', 'VALIDATION_ERROR', 'MALFORMED_REQUEST',
  'COURSE_PRICE_INVALID', 'COURSE_PRICE_TYPE_LOCKED', 'COURSE_PURCHASE_REQUIRED', 'ORDER_INVALID', 'ORDER_COURSE_UNAVAILABLE', 'ORDER_ALREADY_ENROLLED', 'PAYMENT_UNAVAILABLE',
  'ORDER_RATE_LIMITED', 'ORDER_NOT_FOUND', 'ORDER_TRANSFER_REPORT_NOT_ALLOWED', 'AUTH_ACCESS_TOKEN_REQUIRED', 'AUTH_INVALID_ACCESS_TOKEN',
  'PAYMENT_INVALID', 'PAYMENT_AMOUNT_MISMATCH', 'PAYMENT_STATE_INVALID', 'PAYMENT_REFERENCE_CONFLICT', 'PAYMENT_RECONCILIATION_NOT_REQUIRED', 'PAYMENT_RECONCILIATION_STALE', 'COMMISSION_RATE_INVALID',
  'PAYMENT_PROVIDER_UNAVAILABLE', 'COURSE_STUDENT_FILTER_INVALID', 'PAYOUT_ACCOUNT_INVALID', 'REVENUE_FILTER_INVALID', 'PAYOUT_INVALID', 'PAYOUT_REFERENCE_CONFLICT', 'PAYOUT_EXCEEDS_BALANCE', 'USER_NOT_FOUND',
] as const

const errors: Record<(typeof COURSE_ERROR_CODES)[number], Copy> = {
  VALIDATION_ERROR: { vi: 'Kiểm tra lại các trường được đánh dấu.', en: 'Check the highlighted fields.' },
  MALFORMED_REQUEST: { vi: 'Yêu cầu không đúng định dạng.', en: 'The request format is invalid.' },
  ACCESS_DENIED: { vi: 'Bạn không có quyền thực hiện thao tác này.', en: 'You do not have permission to do this.' },
  COURSE_CONTENT_INVALID: { vi: 'Nội dung chứa HTML hoặc liên kết không được hỗ trợ.', en: 'Content contains unsupported HTML or links.' },
  COURSE_FILE_TOO_LARGE: { vi: 'Tệp hoặc nội dung vượt giới hạn dung lượng.', en: 'The file or content exceeds the size limit.' },
  COURSE_TAXONOMY_INACTIVE: taxonomy,
  COURSE_NOT_EDITABLE: { vi: 'Trạng thái hiện tại không cho phép sửa khóa học.', en: 'The current state does not allow editing.' },
  COURSE_NOT_READY: { vi: 'Khóa học chưa đủ điều kiện gửi duyệt.', en: 'The course is not ready to be submitted for review.' },
  COURSE_NO_CHANGES: { vi: 'Chưa có thay đổi để gửi duyệt.', en: 'There are no changes to submit.' },
  COURSE_NOT_PENDING: { vi: 'Khóa học không còn chờ duyệt.', en: 'The course is no longer pending review.' },
  COURSE_NOT_WITHDRAWABLE: { vi: 'Chỉ bản đang chờ duyệt mới có thể rút lại.', en: 'Only a pending revision can be withdrawn.' },
  COURSE_PUBLICATION_TRANSITION_INVALID: { vi: 'Khóa học không ở trạng thái cho phép thao tác này.', en: 'The publication state does not allow this action.' },
  COURSE_NOT_FOUND: notFound,
  LESSON_NOT_FOUND: notFound,
  COURSE_ORDER_INVALID: { vi: 'Thứ tự không còn khớp cấu trúc hiện tại. Đã tải lại cấu trúc.', en: 'The order no longer matches the structure. The structure was reloaded.' },
  COURSE_KEY_CONFLICT: { vi: 'Khóa thao tác đã được dùng hoặc mục tương ứng đã bị xóa.', en: 'This request key was used or its item was deleted.' },
  COURSE_REQUEST_IN_PROGRESS: { vi: 'Yêu cầu đang được xử lý, hãy thử lại với cùng khóa.', en: 'The request is in progress; retry with the same key.' },
  COURSE_NOT_DISCARDABLE: { vi: 'Không có bản chỉnh sửa phù hợp để hủy.', en: 'There is no editable revision to discard.' },
  COURSE_NOT_DELETABLE: { vi: 'Trạng thái hiện tại không cho phép xóa khóa học.', en: 'The course cannot be deleted in its current state.' },
  COURSE_AUTHOR_UNHIDE_NOT_ALLOWED: { vi: 'Khóa do kiểm duyệt viên ẩn nên bạn không thể tự hiện lại.', en: 'A moderator hid this course, so you cannot unhide it.' },
  COURSE_FILE_INVALID: { vi: 'Tệp rỗng, nhị phân hoặc không phải UTF-8.', en: 'The file is empty, binary or not UTF-8.' },
  COURSE_FILE_UNSUPPORTED: { vi: 'Định dạng không được hỗ trợ: chỉ nhận .md/.txt hoặc ảnh JPEG, PNG, WebP.', en: 'Unsupported format: only .md/.txt or JPEG, PNG, WebP images.' },
  COURSE_IMAGE_INVALID: { vi: 'Ảnh không hợp lệ hoặc không thuộc khóa học/bài học này.', en: 'The image is invalid or does not belong to this course or lesson.' },
  COURSE_IMAGE_TOO_LARGE: { vi: 'Ảnh vượt 5 MiB.', en: 'The image is larger than 5 MiB.' },
  COURSE_IMAGE_UNSUPPORTED: { vi: 'Ảnh phải là JPEG, PNG hoặc WebP tĩnh.', en: 'The image must be a static JPEG, PNG or WebP.' },
  COURSE_IMAGE_UPLOAD_FAILED: { vi: 'Dịch vụ ảnh từ chối tải lên. Hãy thử lại.', en: 'The image service rejected the upload. Try again.' },
  COURSE_RATE_LIMITED: { vi: 'Thao tác quá nhanh, hãy thử lại sau.', en: 'Too many operations; try again later.' },
  COURSE_STORAGE_UNAVAILABLE: { vi: 'Kho ảnh tạm thời gián đoạn. Hãy thử lại sau.', en: 'Image storage is temporarily unavailable. Try again later.' },
  LESSON_CONTENT_REQUIRED: { vi: 'Bài học phải có video hoặc nội dung.', en: 'A lesson needs a video or content.' },
  LESSON_VIDEO_INVALID: { vi: 'Liên kết YouTube không hợp lệ.', en: 'The YouTube link is invalid.' },
  COURSE_REVIEW_STALE: { vi: 'Khóa học đã thay đổi. Hãy tải lại trước khi duyệt.', en: 'The course has changed. Reload it before reviewing.' },
  COURSE_SELF_REVIEW_NOT_ALLOWED: { vi: 'Bạn không thể duyệt khóa học của chính mình.', en: 'You cannot review your own course.' },
  COURSE_AUTHOR_INELIGIBLE: { vi: 'Tác giả chưa đủ điều kiện để công khai khóa học.', en: 'The author is not eligible to publish.' },
  COURSE_REVIEW_NOTE_REQUIRED: { vi: 'Hãy nhập góp ý khi yêu cầu sửa.', en: 'Feedback is required when requesting changes.' },
  COURSE_PUBLICATION_NOTE_REQUIRED: { vi: 'Hãy nhập lý do khi ẩn hoặc gỡ khóa học.', en: 'A reason is required to hide or remove a course.' },
  LESSON_PREVIEW_ONLY: { vi: 'Đăng nhập và bắt đầu khóa học để đọc bài này.', en: 'Sign in and start the course to read this lesson.' },
  COURSE_ENROLLMENT_REQUIRED: { vi: 'Hãy bắt đầu khóa học trước.', en: 'Start the course first.' },
  COURSE_PRICE_INVALID: { vi: 'Giá khóa học không hợp lệ.', en: 'The course price is invalid.' },
  COURSE_PRICE_TYPE_LOCKED: { vi: 'Không thể đổi loại giá của khóa đã công khai.', en: 'A published course cannot switch between free and paid.' },
  COURSE_PURCHASE_REQUIRED: { vi: 'Hãy mua khóa học để tiếp tục.', en: 'Buy this course to continue.' },
  ORDER_INVALID: { vi: 'Thông tin đơn hàng không hợp lệ.', en: 'The order details are invalid.' },
  ORDER_COURSE_UNAVAILABLE: { vi: 'Không thể mua khóa học này.', en: 'This course cannot be purchased.' },
  ORDER_ALREADY_ENROLLED: { vi: 'Bạn đã có quyền học khóa này. Hãy tải lại trang.', en: 'You already have access to this course. Reload the page.' },
  PAYMENT_UNAVAILABLE: { vi: 'Thanh toán tạm thời không khả dụng.', en: 'Payment is temporarily unavailable.' },
  ORDER_RATE_LIMITED: { vi: 'Bạn thao tác quá nhanh, hãy thử lại sau.', en: 'You are going too fast; try again later.' },
  ORDER_NOT_FOUND: { vi: 'Không tìm thấy đơn.', en: 'Order not found.' },
  ORDER_TRANSFER_REPORT_NOT_ALLOWED: { vi: 'Đơn này không cần báo chuyển khoản.', en: 'This order does not need a transfer report.' },
  PAYMENT_INVALID: { vi: 'Thông tin đối chiếu không hợp lệ.', en: 'The reconciliation details are invalid.' },
  PAYMENT_AMOUNT_MISMATCH: { vi: 'Số tiền không khớp đơn; hãy đối chiếu sao kê.', en: 'The amount does not match the order; check the bank statement.' },
  PAYMENT_STATE_INVALID: { vi: 'Không thể xác nhận đơn ở trạng thái này.', en: 'This order cannot be confirmed in its current state.' },
  PAYMENT_REFERENCE_CONFLICT: { vi: 'Mã giao dịch đã được dùng hoặc không khớp.', en: 'This reference is already used or does not match.' },
  PAYMENT_RECONCILIATION_NOT_REQUIRED: { vi: 'Không có khoản cần đối chiếu.', en: 'Nothing needs reconciling.' },
  PAYMENT_RECONCILIATION_STALE: { vi: 'Có khoản thanh toán mới; hãy xem lại danh sách.', en: 'A new payment arrived; review the list again.' },
  COMMISSION_RATE_INVALID: { vi: 'Tỷ lệ không hợp lệ.', en: 'The rate is invalid.' },
  PAYMENT_PROVIDER_UNAVAILABLE: { vi: 'Cổng thanh toán tạm thời không phản hồi; hãy thử lại.', en: 'The payment gateway is not responding; please try again.' },
  COURSE_STUDENT_FILTER_INVALID: { vi: 'Bộ lọc không hợp lệ.', en: 'The filters are invalid.' },
  PAYOUT_ACCOUNT_INVALID: { vi: 'Thông tin tài khoản không hợp lệ.', en: 'Bank account details are invalid.' },
  REVENUE_FILTER_INVALID: { vi: 'Khoảng ngày không hợp lệ.', en: 'The date range is invalid.' },
  PAYOUT_INVALID: { vi: 'Thông tin khoản chi không hợp lệ.', en: 'Payout details are invalid.' },
  PAYOUT_REFERENCE_CONFLICT: { vi: 'Mã sao kê này đã được dùng.', en: 'This bank reference is already used.' },
  PAYOUT_EXCEEDS_BALANCE: { vi: 'Số tiền vượt quá số còn phải chi.', en: 'Amount exceeds what is owed.' },
  USER_NOT_FOUND: { vi: 'Không tìm thấy tác giả.', en: 'Author not found.' },
  AUTH_ACCESS_TOKEN_REQUIRED: { vi: 'Hãy đăng nhập để tiếp tục.', en: 'Sign in to continue.' },
  AUTH_INVALID_ACCESS_TOKEN: { vi: 'Hãy đăng nhập để tiếp tục.', en: 'Sign in to continue.' },
}

/** `code × language`; AI_* codes reuse the AI table, unknown 5xx get the generic message, anything else the fallback. */
export function courseErrorText(error: unknown, language: Language, fallback: string) {
  if (!(error instanceof ApiError)) return fallback
  const code = error.code ?? ''
  if (code.startsWith('AI_')) return aiErrorText(error, language)
  const copy = (code in errors ? errors[code as keyof typeof errors] : null) ?? (error.status === 403 ? errors.ACCESS_DENIED : error.status >= 500 ? unavailable : null)
  return copy ? copy[language] : fallback
}

const vi = {
  kicker: 'Không gian tác giả', title: 'Khóa học của tôi', subtitle: 'Soạn khóa học, đặt giá, gửi duyệt và quản lý bản đã công khai.', newCourse: 'Tạo khóa học',
  total: 'Tổng', stats: 'Số liệu khóa học', filters: 'Bộ lọc', search: 'Tìm theo tên khóa học', searchPlaceholder: 'Tìm theo tên khóa học...', topic: 'Chủ đề', tag: 'Thẻ', sort: 'Sắp xếp',
  all: 'Tất cả', allTopics: 'Mọi chủ đề', allTags: 'Mọi thẻ', newest: 'Mới tạo nhất', oldest: 'Cũ nhất', recentlyEdited: 'Sửa gần đây', titleAz: 'Tên A–Z',
  workflowFilter: 'Soạn thảo', publicationFilter: 'Công khai', list: 'Danh sách khóa học', count: '{n} khóa học', edit: 'Sửa', view: 'Xem', more: 'Thao tác khác cho {title}', moreShort: 'Thao tác khóa học',
  updated: 'Sửa {date}', publishedOn: 'Công khai {date}', moderatorHidden: 'Kiểm duyệt viên đã ẩn khóa học', unpublishedChanges: 'Có thay đổi chưa xuất bản', statusList: 'Trạng thái khóa học',
  emptyTitle: 'Bạn chưa có khóa học nào', emptyText: 'Khóa học đi qua ba bước trước khi tới học viên.', steps: 'Soạn khóa|Thêm chương/bài|Gửi duyệt', createFirst: 'Tạo khóa học đầu tiên',
  noMatch: 'Không có khóa học khớp bộ lọc', clearFilters: 'Xóa bộ lọc', loadError: 'Không thể tải khóa học.', retry: 'Thử lại', loading: 'Đang tải khóa học...', cancel: 'Hủy', close: 'Đóng',
  viewLive: 'Xem bản công khai', withdraw: 'Rút lại', discard: 'Hủy bản sửa', hide: 'Ẩn khóa học', unhide: 'Hiện lại', deleteHard: 'Xóa vĩnh viễn', deleteSoft: 'Xóa khóa học', history: 'Lịch sử',
  withdrawText: 'Bản cập nhật rời hàng đợi duyệt và trở về bản nháp để bạn sửa tiếp.', discardText: 'Nội dung quay về bản đang công khai; thay đổi chưa được duyệt sẽ mất.',
  hideText: 'Học viên sẽ không còn thấy khóa học cho tới khi bạn hiện lại.', unhideText: 'Bản công khai hiển thị lại với học viên ngay.',
  deleteHardText: 'Xóa vĩnh viễn, không khôi phục.', deleteSoftText: 'Khóa học gỡ khỏi trang công khai và danh sách của bạn, không khôi phục.', actionDone: 'Đã cập nhật khóa học.', deleted: 'Đã xóa khóa học.',
  historyTitle: 'Lịch sử khóa học', historyEmpty: 'Chưa có lịch sử', loadMore: 'Tải thêm', version: 'v{n}',
  // editor
  back: 'Khóa học của tôi', backToList: 'Về danh sách', notFound: 'Không tìm thấy khóa học', newTitle: 'Tạo khóa học', editTitle: 'Sửa khóa học', viewTitle: 'Xem khóa học',
  create: 'Tạo khóa học', save: 'Lưu', submit: 'Gửi duyệt', previewCourse: 'Học thử', savedAt: 'Đã lưu {time}', saved: 'Đã lưu.', submitted: 'Đã gửi duyệt.', noChanges: 'Không có thay đổi để lưu.',
  createHint: 'Ảnh bìa, mô tả chi tiết và chương/bài thêm sau khi tạo.', reload: 'Tải lại',
  structure: 'Cấu trúc khóa học', courseInfo: 'Thông tin khóa học', chapterN: 'Chương {n}', addChapter: 'Thêm chương', addLesson: 'Thêm bài', counts: '{c} chương · {l} bài', pickItem: 'Chọn mục cấu trúc',
  up: 'Lên', down: 'Xuống', moveUp: 'Đưa {name} lên', moveDown: 'Đưa {name} xuống', rename: 'Đổi tên', remove: 'Xóa', itemMenu: 'Thao tác cho {name}', previewBadge: 'Học thử', newBadge: 'Mới', changedBadge: 'Đã sửa', aiBadge: 'AI',
  deleteChapter: 'Xóa chương', deleteLesson: 'Xóa bài', deleteHardItem: 'Xóa vĩnh viễn “{name}”. Không khôi phục.', deleteSoftItem: 'Gỡ “{name}” khỏi bản sửa; học viên vẫn thấy tới khi bản mới được duyệt, tiến độ học viên được giữ.',
  titleField: 'Tiêu đề', level: 'Trình độ', BEGINNER: 'Cơ bản', INTERMEDIATE: 'Trung cấp', ADVANCED: 'Nâng cao', summary: 'Mô tả ngắn', description: 'Mô tả chi tiết',
  cover: 'Ảnh bìa', uploadCover: 'Tải ảnh bìa', removeCover: 'Bỏ ảnh bìa', coverFile: 'Tệp ảnh bìa', chooseTopic: 'Chọn chủ đề',
  titleRequired: 'Nhập tiêu đề.', topicRequired: 'Chọn chủ đề.', chapterTitle: 'Tên chương', chapterRequired: 'Nhập tên chương.', lessonTitle: 'Tên bài học', lessonSummary: 'Tóm tắt (tùy chọn)', lessonCount: '{n} bài',
  lessonOf: 'Bài học · Chương {n}', previewLesson: 'Cho học thử', previewHelp: 'Ai cũng xem được bài này, kể cả khách.', video: 'Video YouTube', removeVideo: 'Bỏ video',
  videoHelp: 'Tải video lên kênh của bạn ở chế độ Không công khai rồi dán liên kết.', videoPreviewTitle: 'Xem trước video', videoInvalid: 'Liên kết YouTube không hợp lệ.', content: 'Nội dung', contentField: 'Nội dung Markdown',
  needVideoOrContent: 'Bài học phải có video hoặc nội dung.', saveLessonFirst: 'Lưu bài trước khi chèn ảnh', importFile: 'Nhập .md/.txt', importInput: 'Tệp Markdown', imported: 'Đã nhập nội dung. Hãy lưu để giữ thay đổi.',
  insertImage: 'Chèn ảnh', insertInput: 'Tệp ảnh chèn', aiCompose: 'Soạn bằng AI', fileType: 'Chỉ nhận ảnh JPEG, PNG, WebP.', tooLarge: 'Ảnh vượt 5 MiB.', uploading: 'Đang tải ảnh…',
  preview: 'Xem trước', published: 'Bản công khai v{n}', previewMode: 'Chế độ xem', imagePlaceholder: 'Ảnh cần tải lên', untitled: 'Chưa có tiêu đề', imagesIssues: '⚠ {n} ảnh cần tải lên', imagesHelp: 'Tải lại các ảnh này vào khóa học trước khi gửi duyệt.',
  lessonLoading: 'Đang tải bài học…', lessonError: 'Không thể tải bài học.',
  notReady: 'Khóa học chưa đủ điều kiện gửi duyệt.', rNoChapter: 'Chưa có chương nào.', rSummary: 'Thiếu mô tả ngắn.', rDescription: 'Thiếu mô tả chi tiết.', rEmptyChapter: 'Chương “{name}” chưa có bài.', rImages: 'Còn {n} ảnh cần tải lên.',
  pendingBanner: 'Đang chờ duyệt — rút lại để tiếp tục sửa.', changesBanner: 'Kiểm duyệt viên yêu cầu sửa: {note}', changesBannerNoNote: 'Kiểm duyệt viên yêu cầu sửa.', liveBanner: 'Đang công khai bản v{n}. Bản sửa chỉ tới học viên sau khi được duyệt.',
  hiddenBanner: 'Kiểm duyệt viên đã ẩn khóa học.', authorHiddenBanner: 'Bạn đang ẩn khóa học.', removedBanner: 'Khóa học đã bị gỡ: {note}', removedBannerNoNote: 'Khóa học đã bị gỡ.',
  leaveTitle: 'Thay đổi chưa lưu sẽ mất', leaveText: 'Mục đang sửa chưa lưu được. Rời đi sẽ bỏ các thay đổi này.', stay: 'Ở lại', leave: 'Rời đi', structureSheet: 'Cấu trúc: {name}', compose: 'Soạn thảo', mobileView: 'Soạn thảo hoặc xem trước',
  aiSheetTitle: 'Soạn bài học bằng AI', aiNote: 'Dùng chủ đề và thẻ của khóa học.', useDraft: 'Dùng bản nháp này cho bài học', aiInvalid: 'Bản nháp AI không còn hợp lệ. Hãy tạo lại.',
  replaceContent: 'Thay nội dung đang có?', replaceContentText: 'Bản nháp AI sẽ thay tiêu đề, tóm tắt và nội dung đang soạn của bài này.', replace: 'Thay nội dung',
  price: 'Giá (VND)', priceFree: 'Miễn phí', priceHelp: 'Miễn phí hoặc từ 10.000 đến 50.000.000 ₫. Giá được áp dụng ngay cho đơn mới, không cần gửi duyệt; đơn cũ giữ giá lúc tạo.',
  priceLocked: 'Khóa đã công khai không đổi giữa miễn phí và trả phí.', priceInvalid: 'Giá khóa học không hợp lệ.', share: 'Nền tảng giữ {rate}%, bạn nhận {amount}',
  studentsTitle: 'Học viên', studentsTotal: 'Tổng học viên', studentsNotStarted: 'Chưa học', studentsCompleted: 'Đã hoàn thành', studentsInProgress: 'Đang học', studentProgress: 'Tiến độ',
  studentSearch: 'Tìm theo tên học viên', studentLessons: '{done}/{total} bài', studentNone: 'Chưa học bài nào', studentsEmpty: 'Khóa học chưa có học viên.', studentsNoMatch: 'Không có học viên khớp bộ lọc.',
  studentCount: '{count} học viên', enrolledOn: 'Vào học {date}', lastSeen: 'Học gần nhất {date}', studentsError: 'Không thể tải danh sách học viên.',
}
export type CourseCopy = typeof vi

const en: CourseCopy = {
  kicker: 'Author workspace', title: 'My courses', subtitle: 'Write courses, set a price, submit them for review and manage the published version.', newCourse: 'Create course',
  total: 'Total', stats: 'Course counts', filters: 'Filters', search: 'Search by course title', searchPlaceholder: 'Search by course title...', topic: 'Topic', tag: 'Tag', sort: 'Sort',
  all: 'All', allTopics: 'All topics', allTags: 'All tags', newest: 'Newest', oldest: 'Oldest', recentlyEdited: 'Recently edited', titleAz: 'Title A–Z',
  workflowFilter: 'Editing', publicationFilter: 'Publication', list: 'Courses', count: '{n} courses', edit: 'Edit', view: 'View', more: 'More actions for {title}', moreShort: 'Course actions',
  updated: 'Edited {date}', publishedOn: 'Published {date}', moderatorHidden: 'A moderator hid this course', unpublishedChanges: 'Unpublished changes', statusList: 'Course status',
  emptyTitle: 'You have no courses yet', emptyText: 'Courses go through three steps before learners see them.', steps: 'Write the course|Add chapters/lessons|Submit', createFirst: 'Create your first course',
  noMatch: 'No courses match the filters', clearFilters: 'Clear filters', loadError: 'Unable to load courses.', retry: 'Retry', loading: 'Loading courses...', cancel: 'Cancel', close: 'Close',
  viewLive: 'View live version', withdraw: 'Withdraw', discard: 'Discard revision', hide: 'Hide course', unhide: 'Unhide', deleteHard: 'Delete permanently', deleteSoft: 'Delete course', history: 'History',
  withdrawText: 'The revision leaves the review queue and returns to draft so you can keep editing.', discardText: 'Content returns to the live version; unapproved edits are lost.',
  hideText: 'Learners will not see the course until you unhide it.', unhideText: 'The live version becomes visible to learners right away.',
  deleteHardText: 'Deleted permanently; this cannot be undone.', deleteSoftText: 'The course leaves the public pages and your list; this cannot be undone.', actionDone: 'Course updated.', deleted: 'Course deleted.',
  historyTitle: 'Course history', historyEmpty: 'No history yet', loadMore: 'Load more', version: 'v{n}',
  back: 'My courses', backToList: 'Back to my courses', notFound: 'Course not found', newTitle: 'Create course', editTitle: 'Edit course', viewTitle: 'View course',
  create: 'Create course', save: 'Save', submit: 'Submit for review', previewCourse: 'Preview', savedAt: 'Saved {time}', saved: 'Saved.', submitted: 'Submitted for review.', noChanges: 'Nothing to save.',
  createHint: 'The cover image, long description and chapters/lessons are added after creating.', reload: 'Reload',
  structure: 'Course structure', courseInfo: 'Course information', chapterN: 'Chapter {n}', addChapter: 'Add chapter', addLesson: 'Add lesson', counts: '{c} chapters · {l} lessons', pickItem: 'Choose a structure item',
  up: 'Up', down: 'Down', moveUp: 'Move {name} up', moveDown: 'Move {name} down', rename: 'Rename', remove: 'Delete', itemMenu: 'Actions for {name}', previewBadge: 'Preview', newBadge: 'New', changedBadge: 'Changed', aiBadge: 'AI',
  deleteChapter: 'Delete chapter', deleteLesson: 'Delete lesson', deleteHardItem: 'Delete “{name}” permanently. This cannot be undone.', deleteSoftItem: 'Remove “{name}” from the revision; learners still see it until the new version is approved, and learner progress is kept.',
  titleField: 'Title', level: 'Level', BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced', summary: 'Short description', description: 'Detailed description',
  cover: 'Cover image', uploadCover: 'Upload cover', removeCover: 'Remove cover', coverFile: 'Cover image file', chooseTopic: 'Choose a topic',
  titleRequired: 'Enter a title.', topicRequired: 'Choose a topic.', chapterTitle: 'Chapter title', chapterRequired: 'Enter a chapter title.', lessonTitle: 'Lesson title', lessonSummary: 'Summary (optional)', lessonCount: '{n} lessons',
  lessonOf: 'Lesson · Chapter {n}', previewLesson: 'Allow preview', previewHelp: 'Anyone can view this lesson, guests included.', video: 'YouTube video', removeVideo: 'Remove video',
  videoHelp: 'Upload the video to your channel as Unlisted, then paste the link.', videoPreviewTitle: 'Video preview', videoInvalid: 'The YouTube link is invalid.', content: 'Content', contentField: 'Markdown content',
  needVideoOrContent: 'A lesson needs a video or content.', saveLessonFirst: 'Save the lesson before inserting images', importFile: 'Import .md/.txt', importInput: 'Markdown file', imported: 'Content imported. Save to keep it.',
  insertImage: 'Insert image', insertInput: 'Image file to insert', aiCompose: 'Write with AI', fileType: 'Only JPEG, PNG, WebP images.', tooLarge: 'The image is larger than 5 MiB.', uploading: 'Uploading image…',
  preview: 'Preview', published: 'Live version v{n}', previewMode: 'View mode', imagePlaceholder: 'Image needs uploading', untitled: 'Untitled', imagesIssues: '⚠ {n} images need uploading', imagesHelp: 'Upload these images to the course again before submitting.',
  lessonLoading: 'Loading lesson…', lessonError: 'Unable to load the lesson.',
  notReady: 'The course is not ready to be submitted for review.', rNoChapter: 'There are no chapters yet.', rSummary: 'The short description is missing.', rDescription: 'The detailed description is missing.', rEmptyChapter: 'Chapter “{name}” has no lessons.', rImages: '{n} images still need uploading.',
  pendingBanner: 'Pending review — withdraw it to keep editing.', changesBanner: 'A moderator requested changes: {note}', changesBannerNoNote: 'A moderator requested changes.', liveBanner: 'Version v{n} is live. Edits reach learners only after approval.',
  hiddenBanner: 'A moderator hid this course.', authorHiddenBanner: 'You are hiding this course.', removedBanner: 'This course was removed: {note}', removedBannerNoNote: 'This course was removed.',
  leaveTitle: 'Unsaved changes will be lost', leaveText: 'The item you are editing could not be saved. Leaving drops these changes.', stay: 'Stay', leave: 'Leave', structureSheet: 'Structure: {name}', compose: 'Write', mobileView: 'Write or preview',
  aiSheetTitle: 'Write the lesson with AI', aiNote: 'Uses the course topic and tags.', useDraft: 'Use this draft for the lesson', aiInvalid: 'The AI draft is no longer valid. Generate it again.',
  replaceContent: 'Replace the current content?', replaceContentText: 'The AI draft replaces this lesson’s title, summary and content.', replace: 'Replace content',
  price: 'Price (VND)', priceFree: 'Free', priceHelp: 'Free or between 10,000 and 50,000,000 ₫. A new price applies to new orders right away, with no review; existing orders keep the price they were created with.',
  priceLocked: 'A published course cannot switch between free and paid.', priceInvalid: 'The course price is invalid.', share: 'Platform keeps {rate}%; you receive {amount}',
  studentsTitle: 'Students', studentsTotal: 'Total students', studentsNotStarted: 'Not started', studentsCompleted: 'Completed', studentsInProgress: 'In progress', studentProgress: 'Progress',
  studentSearch: 'Search by student name', studentLessons: '{done}/{total} lessons', studentNone: 'Not started', studentsEmpty: 'This course has no students yet.', studentsNoMatch: 'No students match the filters.',
  studentCount: '{count} students', enrolledOn: 'Joined {date}', lastSeen: 'Last active {date}', studentsError: 'Unable to load the students.',
}

export function courseText(language: Language) {
  const copy = language === 'vi' ? vi : en
  return (key: keyof CourseCopy, values: Record<string, string | number> = {}) => copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}

// Moderator: the article moderator copy with course wording on top (same screens, same dialogs).
const moderatorErrors: Partial<Record<string, Copy>> = {
  COURSE_SELF_REVIEW_NOT_ALLOWED: { vi: 'Bạn không thể duyệt khóa của mình.', en: 'You cannot review your own course.' },
  COURSE_AUTHOR_INELIGIBLE: { vi: 'Tác giả không còn đủ điều kiện.', en: 'The author is no longer eligible.' },
  COURSE_NOT_READY: { vi: 'Khóa học không còn đủ điều kiện xuất bản.', en: 'The course is no longer eligible to be published.' },
  COURSE_REVIEW_NOTE_REQUIRED: { vi: 'Cần nhập phản hồi.', en: 'Feedback is required.' },
  COURSE_PUBLICATION_NOTE_REQUIRED: { vi: 'Cần nhập lý do.', en: 'A reason is required.' },
  COURSE_PUBLICATION_TRANSITION_INVALID: { vi: 'Trạng thái công khai đã thay đổi. Hãy tải lại.', en: 'The publication state changed. Reload it.' },
  COURSE_NOT_PENDING: { vi: 'Khóa học không còn chờ duyệt. Hãy tải lại.', en: 'The course is no longer pending. Reload it.' },
}
export function moderatorCourseErrorText(error: unknown, language: Language, fallback: string) {
  const copy = error instanceof ApiError && error.code ? moderatorErrors[error.code] : undefined
  return copy ? copy[language] : courseErrorText(error, language, fallback)
}
/** The course changed under the moderator (token or state): the only fix is reloading the detail. */
export const isCourseStale = (error: unknown) => error instanceof ApiError && ['COURSE_REVIEW_STALE', 'COURSE_PUBLICATION_TRANSITION_INVALID', 'COURSE_NOT_PENDING'].includes(error.code ?? '')

const moderatorVi = {
  stats: 'Khóa học cần xử lý', title: 'Duyệt khóa học', subtitle: 'Duyệt bản gửi từ tác giả và quản lý khóa học đang công khai.', search: 'Tìm theo tên khóa học', searchPlaceholder: 'Tìm theo tên khóa học...',
  count: '{n} khóa học', list: 'Danh sách khóa học', noMatch: 'Không có khóa học khớp bộ lọc', noPending: 'Không còn khóa học chờ duyệt', loadError: 'Không thể tải khóa học.', loading: 'Đang tải khóa học...',
  articles: 'Khóa học', notFound: 'Không tìm thấy khóa học', detailError: 'Không thể tải khóa học.', ineligibleReason: 'Tác giả không còn đủ điều kiện nên chưa thể duyệt khóa.',
  removedBanner: 'Khóa học đã gỡ khỏi trang công khai; không còn thao tác kiểm duyệt.', deletedBanner: 'Tác giả đã xóa khóa học, chỉ còn để đối soát.',
  APPROVE: 'Duyệt khóa', HIDE: 'Ẩn khóa', REMOVE: 'Gỡ khóa', APPROVE_title: 'Duyệt và xuất bản khóa học', HIDE_title: 'Ẩn khóa học', RESTORE_title: 'Khôi phục khóa học', REMOVE_title: 'Gỡ khóa học',
  APPROVE_text: 'Toàn bộ khóa học (thông tin, chương, bài) thành bản công khai v{n}.', REQUEST_CHANGES_text: 'Khóa học trở về tác giả kèm phản hồi. Bản công khai (nếu có) giữ nguyên.',
  HIDE_text: 'Khóa học biến khỏi trang công khai; tiến độ học viên được giữ.', RESTORE_text: 'Khóa học trở về trạng thái trước khi bị ẩn.', REMOVE_text: 'Khóa học bị gỡ khỏi trang công khai. Không khôi phục được.',
  APPROVE_done: 'Đã duyệt và xuất bản khóa học.', REQUEST_CHANGES_done: 'Đã gửi yêu cầu sửa cho tác giả.', HIDE_done: 'Đã ẩn khóa học.', RESTORE_done: 'Đã khôi phục khóa học.', REMOVE_done: 'Đã gỡ khóa học.',
  noteRequired: 'Phản hồi cho tác giả (bắt buộc)', noteMissing: 'Cần nhập phản hồi.', reasonMissing: 'Cần nhập lý do.',
  // course-only
  changes: 'Thay đổi', changesOnly: 'Chỉ phần thay đổi', NEW: 'Mới', CHANGED: 'Đã sửa', ARCHIVED: 'Đã gỡ', noChanges: 'Không có chương hoặc bài nào thay đổi.',
  courseInfo: 'Thông tin khóa học', chapterN: 'Chương {n}', lessons: 'Danh sách bài', level: 'Trình độ', description: 'Mô tả chi tiết', noDescription: 'Chưa có mô tả chi tiết',
  preview: 'Học thử', previewOn: 'Cho học thử', previewOff: 'Không cho học thử', video: 'Video', noVideo: 'Không có video', noContent: 'Không có nội dung', videoTitle: 'Video bài học — {side}',
  lessonError: 'Không thể tải bài học.', lessonLoading: 'Đang tải bài học...', infoNote: 'Thông tin khóa học hiện theo bản đề xuất.',
  BEGINNER: 'Cơ bản', INTERMEDIATE: 'Trung cấp', ADVANCED: 'Nâng cao',
}
type ModeratorCourseCopy = typeof moderatorVi
const moderatorEn: ModeratorCourseCopy = {
  stats: 'Courses to handle', title: 'Course moderation', subtitle: 'Review author submissions and manage live courses.', search: 'Search by course title', searchPlaceholder: 'Search by course title...',
  count: '{n} courses', list: 'Courses', noMatch: 'No courses match the filters', noPending: 'No courses awaiting review', loadError: 'Unable to load courses.', loading: 'Loading courses...',
  articles: 'Courses', notFound: 'Course not found', detailError: 'Unable to load the course.', ineligibleReason: 'The author is no longer eligible, so this course cannot be approved.',
  removedBanner: 'This course was removed from the public pages; no moderation actions remain.', deletedBanner: 'The author deleted this course; it is available for audit only.',
  APPROVE: 'Approve course', HIDE: 'Hide course', REMOVE: 'Remove course', APPROVE_title: 'Approve and publish the course', HIDE_title: 'Hide course', RESTORE_title: 'Restore course', REMOVE_title: 'Remove course',
  APPROVE_text: 'The whole course (information, chapters, lessons) becomes live version v{n}.', REQUEST_CHANGES_text: 'The course goes back to the author with your feedback. The live version, if any, stays.',
  HIDE_text: 'The course disappears from the public pages; learner progress is kept.', RESTORE_text: 'The course returns to its state before it was hidden.', REMOVE_text: 'The course leaves the public pages. This cannot be undone.',
  APPROVE_done: 'Course approved and published.', REQUEST_CHANGES_done: 'Change request sent to the author.', HIDE_done: 'Course hidden.', RESTORE_done: 'Course restored.', REMOVE_done: 'Course removed.',
  noteRequired: 'Feedback for the author (required)', noteMissing: 'Feedback is required.', reasonMissing: 'A reason is required.',
  changes: 'Changes', changesOnly: 'Changes only', NEW: 'New', CHANGED: 'Changed', ARCHIVED: 'Archived', noChanges: 'No chapter or lesson changed.',
  courseInfo: 'Course information', chapterN: 'Chapter {n}', lessons: 'Lessons', level: 'Level', description: 'Detailed description', noDescription: 'No detailed description',
  preview: 'Preview', previewOn: 'Preview allowed', previewOff: 'No preview', video: 'Video', noVideo: 'No video', noContent: 'No content', videoTitle: 'Lesson video — {side}',
  lessonError: 'Unable to load the lesson.', lessonLoading: 'Loading lesson...', infoNote: 'Course information shows the proposed version.',
  BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced',
}

export function moderatorCourseText(language: Language) {
  const copy = { ...moderatorCopy[language], ...(language === 'vi' ? moderatorVi : moderatorEn) }
  return (key: keyof typeof copy, values: Record<string, string | number> = {}) => copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}
export type ModeratorCourseText = ReturnType<typeof moderatorCourseText>

// Reader (catalog, overview, lesson frame, my courses): wireframe section 5.
const readerVi = {
  kicker: 'Học trực tuyến', title: 'Khóa học', subtitle: 'Lộ trình có chương và bài học, học thử trước khi bắt đầu.', myCourses: 'Khóa học của tôi', allCourses: 'Tất cả khóa học',
  filters: 'Bộ lọc', search: 'Tìm khóa học', searchPlaceholder: 'Tìm khóa học…', clearSearch: 'Xóa từ khóa', tag: 'Thẻ', allTags: 'Mọi thẻ', level: 'Trình độ', allLevels: 'Mọi trình độ', sort: 'Sắp xếp',
  newest: 'Mới nhất', oldest: 'Cũ nhất', topics: 'Chủ đề', allTopics: 'Tất cả', count: '{n} khóa học', list: 'Danh sách khóa học', loading: 'Đang tải khóa học...', loadError: 'Không thể tải khóa học.',
  retry: 'Thử lại', optionsError: 'Không tải được bộ lọc.', empty: 'Chưa có khóa học nào', emptyText: 'Khóa học mới sẽ xuất hiện ở đây.', emptyFiltered: 'Không tìm thấy khóa học phù hợp', emptyFilteredText: 'Thử đổi hoặc xóa bộ lọc.', clearFilters: 'Xóa bộ lọc',
  BEGINNER: 'Cơ bản', INTERMEDIATE: 'Trung cấp', ADVANCED: 'Nâng cao', updated: 'Cập nhật {date}', viewCourse: 'Xem khóa học', viewCourseOf: 'Xem khóa học {title}', author: 'Tác giả', moreTags: '+{n}',
  back: 'Khóa học', courseFrame: 'Khung học', overview: 'Tổng quan khóa học', content: 'Nội dung khóa học', expandAll: 'Mở rộng tất cả', collapseAll: 'Thu gọn tất cả', chapterN: 'Chương {n}',
  chapters: '{n} chương', lessons: '{n} bài học', chapterProgress: 'Đã học {x}/{y} bài', progress: '{x}/{y} bài · {p}%', progressLabel: 'Tiến độ khóa học', introTitle: 'Giới thiệu khóa học',
  searchLessons: 'Tìm bài học…', searchLessonsLabel: 'Tìm bài học', noLessonMatch: 'Không có bài khớp', hideTree: 'Thu gọn', showTree: 'Mở nội dung khóa học', treeSheet: 'Nội dung khóa học', closeTree: 'Đóng',
  preview: 'Học thử', startLearning: 'Bắt đầu học', continueLearning: 'Tiếp tục học', continueAt: 'Tiếp tục học: {title}', review: 'Xem lại khóa học', done: 'Đã hoàn thành', lockedLesson: 'Chưa mở', hasVideo: 'Có video', ownerNote: 'Bạn là tác giả khóa này — chỉ xem bài học thử.',
  loginTitle: 'Đăng nhập để bắt đầu khóa học.', loginText: 'Bạn cần đăng nhập để học bài này và lưu tiến độ.', login: 'Đăng nhập', cancel: 'Hủy', startFailed: 'Không thể bắt đầu khóa học này.',
  notFound: 'Không tìm thấy khóa học hoặc bài học.', backToCourses: 'Về danh sách khóa học', skip: 'Bỏ qua tới nội dung bài', tocTitle: 'Mục lục bài học', toc: 'Mục lục', video: 'Video: {title}',
  complete: 'Hoàn thành bài học', uncomplete: 'Đánh dấu chưa hoàn thành', completedStatus: 'Đã hoàn thành, {x}/{y} bài', uncompletedStatus: 'Đã bỏ hoàn thành, {x}/{y} bài', completionFailed: 'Không cập nhật được tiến độ.',
  prev: 'Bài trước', next: 'Bài tiếp theo', prevOf: 'Bài trước: {title}', nextOf: 'Bài tiếp theo: {title}', previewHint: 'Bắt đầu khóa học để học tiếp và lưu tiến độ.', lockedTitle: 'Bài học này cần bắt đầu khóa học',
  lockedText: 'Hãy đăng nhập và bắt đầu khóa học để xem bài này.', breadcrumb: 'Đường dẫn',
  mineKicker: 'Góc của tôi', mineCount: '{n} khóa', mineEmpty: 'Bạn chưa bắt đầu khóa học nào', mineEmptyText: 'Bắt đầu một khóa miễn phí để theo dõi tiến độ tại đây.', explore: 'Khám phá khóa học',
  nextLesson: 'Tiếp theo: {title}', activeAgo: 'Hoạt động {when}', startedOn: 'Bắt đầu {when}', complete100: 'Hoàn thành',
  free: 'Miễn phí', buy: 'Mua khóa học', purchaseRequired: 'Hãy mua khóa học để tiếp tục.', noRefund: 'Khóa học đã mua không được hoàn tiền.', buyHint: 'Mua khóa học để học tiếp và lưu tiến độ.',
  buyLoginTitle: 'Đăng nhập để mua khóa học.', buyLoginText: 'Bạn cần đăng nhập để mua khóa học và lưu tiến độ.', buyFailed: 'Không thể tạo đơn hàng.',
}
type ReaderCourseCopy = typeof readerVi
const readerEn: ReaderCourseCopy = {
  kicker: 'Online learning', title: 'Courses', subtitle: 'Paths with chapters and lessons; preview before you start.', myCourses: 'My courses', allCourses: 'All courses',
  filters: 'Filters', search: 'Search courses', searchPlaceholder: 'Search courses…', clearSearch: 'Clear search', tag: 'Tag', allTags: 'All tags', level: 'Level', allLevels: 'All levels', sort: 'Sort',
  newest: 'Newest', oldest: 'Oldest', topics: 'Topics', allTopics: 'All', count: '{n} courses', list: 'Courses', loading: 'Loading courses...', loadError: 'Unable to load courses.',
  retry: 'Retry', optionsError: 'Unable to load the filters.', empty: 'No courses yet', emptyText: 'New courses will appear here.', emptyFiltered: 'No matching courses', emptyFilteredText: 'Try changing or clearing the filters.', clearFilters: 'Clear filters',
  BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced', updated: 'Updated {date}', viewCourse: 'View course', viewCourseOf: 'View course {title}', author: 'Author', moreTags: '+{n}',
  back: 'Courses', courseFrame: 'Learning frame', overview: 'Course overview', content: 'Course content', expandAll: 'Expand all', collapseAll: 'Collapse all', chapterN: 'Chapter {n}',
  chapters: '{n} chapters', lessons: '{n} lessons', chapterProgress: '{x}/{y} lessons completed', progress: '{x}/{y} lessons · {p}%', progressLabel: 'Course progress', introTitle: 'About this course',
  searchLessons: 'Search lessons…', searchLessonsLabel: 'Search lessons', noLessonMatch: 'No matching lessons', hideTree: 'Collapse', showTree: 'Open course content', treeSheet: 'Course content', closeTree: 'Close',
  preview: 'Preview', startLearning: 'Start learning', continueLearning: 'Continue learning', continueAt: 'Continue learning: {title}', review: 'Review course', done: 'Completed', lockedLesson: 'Locked', hasVideo: 'Has video', ownerNote: 'You are the author of this course — preview lessons only.',
  loginTitle: 'Sign in to start this course.', loginText: 'Sign in to take this lesson and save your progress.', login: 'Sign in', cancel: 'Cancel', startFailed: 'Unable to start this course.',
  notFound: 'Course or lesson not found.', backToCourses: 'Back to courses', skip: 'Skip to lesson content', tocTitle: 'Lesson contents', toc: 'Contents', video: 'Video: {title}',
  complete: 'Complete lesson', uncomplete: 'Mark as incomplete', completedStatus: 'Completed, {x}/{y} lessons', uncompletedStatus: 'Marked incomplete, {x}/{y} lessons', completionFailed: 'Unable to update progress.',
  prev: 'Previous lesson', next: 'Next lesson', prevOf: 'Previous lesson: {title}', nextOf: 'Next lesson: {title}', previewHint: 'Start the course to keep learning and save progress.', lockedTitle: 'Start the course to open this lesson',
  lockedText: 'Sign in and start the course to see this lesson.', breadcrumb: 'Breadcrumb',
  mineKicker: 'My corner', mineCount: '{n} courses', mineEmpty: 'You have not started any course', mineEmptyText: 'Start a free course to track your progress here.', explore: 'Explore courses',
  nextLesson: 'Next: {title}', activeAgo: 'Active {when}', startedOn: 'Started {when}', complete100: 'Completed',
  free: 'Free', buy: 'Buy course', purchaseRequired: 'Buy this course to continue.', noRefund: 'Purchased courses are non-refundable.', buyHint: 'Buy the course to keep learning and save progress.',
  buyLoginTitle: 'Sign in to buy this course.', buyLoginText: 'Sign in to buy the course and save your progress.', buyFailed: 'Unable to create the order.',
}
export function readerCourseText(language: Language) {
  const copy = language === 'vi' ? readerVi : readerEn
  return (key: keyof ReaderCourseCopy, values: Record<string, string | number> = {}) => copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}
export type ReaderCourseText = ReturnType<typeof readerCourseText>

// Lesson AI tutor sheet (course-ai-tutor wireframe): copy from the spec table, keyed by outcome rather than by backend code.
const tutorVi = {
  open: 'Hỏi AI về bài này', title: 'Trợ lý AI của bài học', notice: 'AI chỉ dựa trên nội dung chữ của bài này và có thể trả lời sai. Hãy đối chiếu với bài học.',
  empty: 'Hỏi bất cứ điều gì bạn chưa hiểu trong bài.', placeholder: 'Nhập câu hỏi của bạn…', send: 'Gửi', stop: 'Dừng', retry: 'Thử lại', quota: 'Còn {remaining}/{limit} câu hôm nay',
  quotaOut: 'Bạn đã dùng hết lượt hỏi AI hôm nay.', noText: 'Bài này chưa có nội dung chữ để AI dựa vào.', login: 'Đăng nhập để hỏi AI', cut: 'Bài học dài nên AI chỉ đọc phần đầu.',
  busy: 'AI đang trả lời câu trước.', rateLimited: 'Bạn hỏi quá nhanh, hãy thử lại sau ít phút.', unavailable: 'Dịch vụ AI đang gián đoạn. Hãy thử lại.', timeout: 'AI phản hồi quá lâu. Hãy thử lại.',
  truncated: 'Câu trả lời bị cắt. Hãy hỏi cụ thể hơn.', notReady: 'Trợ lý AI chưa sẵn sàng.', storage: 'Trợ lý AI tạm thời không khả dụng.', purchase: 'Hãy mua khóa học để tiếp tục.',
  previewOnly: 'Hãy bắt đầu học khóa này để hỏi AI về bài.', inputError: 'Hãy nhập câu hỏi (tối đa 500 ký tự).', invalid: 'Không gửi được câu hỏi. Hãy tải lại trang.', denied: 'Bạn không có quyền.',
  notFound: 'Không tìm thấy khóa học hoặc bài học.', signIn: 'Đăng nhập để hỏi AI.', ai: 'AI', close: 'Đóng', newMessages: 'Tin mới', question: 'Câu hỏi', count: '{n}/500',
}
type TutorCopy = typeof tutorVi
const tutorEn: TutorCopy = {
  open: 'Ask AI about this lesson', title: 'Lesson AI assistant', notice: 'The AI only uses this lesson\'s text and can be wrong. Check against the lesson.',
  empty: 'Ask about anything unclear in this lesson.', placeholder: 'Type your question…', send: 'Send', stop: 'Stop', retry: 'Retry', quota: '{remaining}/{limit} questions left today',
  quotaOut: 'You have used all AI questions for today.', noText: 'This lesson has no text for the AI to use.', login: 'Sign in to ask AI', cut: 'This lesson is long, so the AI only read the first part.',
  busy: 'The AI is still answering the previous question.', rateLimited: 'Too many questions; try again shortly.', unavailable: 'The AI service is temporarily unavailable. Try again.', timeout: 'The AI took too long. Try again.',
  truncated: 'The answer was cut off. Try a more specific question.', notReady: 'The AI assistant is not ready.', storage: 'The AI assistant is temporarily unavailable.', purchase: 'Buy this course to continue.',
  previewOnly: 'Start this course to ask AI about this lesson.', inputError: 'Enter a question (up to 500 characters).', invalid: 'The question could not be sent. Reload the page.', denied: 'You do not have permission.',
  notFound: 'Course or lesson not found.', signIn: 'Sign in to ask AI.', ai: 'AI', close: 'Close', newMessages: 'New messages', question: 'Question', count: '{n}/500',
}
export function tutorText(language: Language) {
  const copy = language === 'vi' ? tutorVi : tutorEn
  return (key: keyof TutorCopy, values: Record<string, string | number> = {}) => copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}

const tutorKeys: Record<string, keyof TutorCopy> = {
  AI_PROVIDER_UNAVAILABLE: 'unavailable', AI_PROVIDER_REQUEST_REJECTED: 'unavailable', AI_PROVIDER_AUTH_FAILED: 'unavailable', AI_PROVIDER_RATE_LIMITED: 'unavailable',
  AI_TIMEOUT: 'timeout', AI_OUTPUT_TRUNCATED: 'truncated', AI_RATE_LIMITED: 'rateLimited', AI_GENERATION_IN_PROGRESS: 'busy', AI_STORAGE_UNAVAILABLE: 'storage',
  AI_CONFIGURATION_INVALID: 'notReady', AI_TUTOR_LESSON_NO_CONTENT: 'noText', AI_QUOTA_EXCEEDED: 'quotaOut', COURSE_PURCHASE_REQUIRED: 'purchase', LESSON_PREVIEW_ONLY: 'previewOnly',
  VALIDATION_ERROR: 'invalid', MALFORMED_REQUEST: 'invalid', COURSE_NOT_FOUND: 'notFound', LESSON_NOT_FOUND: 'notFound', ACCESS_DENIED: 'denied', USER_INACTIVE: 'denied',
}
const tutorFinal = new Set<keyof TutorCopy>(['truncated', 'notReady', 'noText', 'quotaOut', 'purchase', 'previewOnly', 'invalid', 'denied', 'notFound'])

/** Copy + “Retry allowed” for an SSE `error` code or an HTTP failure before the stream opened; 401 asks to sign in, anything unknown (or a dropped connection) is a retryable outage. */
export function tutorError(error: unknown, language: Language) {
  const t = tutorText(language)
  if (error instanceof ApiError && error.status === 401) return { text: t('signIn'), retry: false, login: true }
  const code = typeof error === 'string' ? error : error instanceof ApiError ? error.code ?? '' : ''
  const key = tutorKeys[code] ?? 'unavailable'
  return { text: t(key), retry: !tutorFinal.has(key), login: false }
}

// Orders (wireframe 2b): payment copy from the spec table plus the wireframe section 5 rows.
const orderVi = {
  myOrders: 'Đơn hàng của tôi', kicker: 'Góc của tôi', count: '{n} đơn', loading: 'Đang tải đơn hàng...', loadError: 'Không thể tải đơn hàng.', retry: 'Thử lại', allCourses: 'Khóa học',
  empty: 'Bạn chưa có đơn hàng nào', emptyText: 'Đơn bạn tạo khi mua khóa học sẽ xuất hiện ở đây.', explore: 'Khám phá khóa học', notFoundBack: 'Đơn hàng của tôi',
  PENDING: 'Chờ Admin xác nhận chuyển khoản', PAID: 'Đã nhận tiền', EXPIRED: 'Hết hạn', FAILED: 'Không còn hiệu lực', CANCELLED: 'Không còn hiệu lực',
  reportedBadge: 'Đã báo chuyển khoản', created: 'Tạo {when}', expires: 'Hết hạn {when}', paidOn: 'Thanh toán {when}', remaining: 'Còn lại ~{n} giờ', remainingMin: 'Còn lại ~{n} phút',
  viewOrder: 'Xem đơn', learn: 'Vào học', course: 'Khóa học', total: 'Tổng', openOrder: 'Đơn {code}',
  transferTitle: 'Chuyển khoản ngân hàng', qrTitle: 'Quét mã VietQR', bank: 'Ngân hàng', accountNo: 'Số tài khoản', accountName: 'Chủ tài khoản', amount: 'Số tiền', content: 'Nội dung',
  copy: 'Sao chép {what}', matchNote: 'Nhập đúng nội dung để Admin đối chiếu.', qrAlt: 'Mã VietQR đơn {code}', qrHint: 'Mở app ngân hàng, quét mã; kiểm tra số tiền.',
  qrFailed: 'Không tải được QR; dùng thông tin chuyển khoản bên dưới.', qrReload: 'Tải lại ảnh',
  afterTitle: 'Sau khi chuyển khoản', afterText: 'Quyền học chỉ mở khi Admin đối chiếu sao kê. Khóa học đã mua không được hoàn tiền.',
  report: 'Tôi đã chuyển khoản', reported: 'Đã báo cho Admin lúc {time}; quyền học được mở sau khi Admin đối chiếu.', refresh: 'Làm mới trạng thái', buyAgain: 'Mua lại khóa học',
  expiredAlert: 'Đơn đã hết hạn; liên hệ Admin nếu đã chuyển khoản.', paidAlert: 'Đã nhận tiền', invalidAlert: 'Đơn này không còn hiệu lực.', buyFailed: 'Không thể tạo đơn hàng.', reportFailed: 'Không thể báo chuyển khoản.',
  PENDING_PAYOS: 'Chờ thanh toán', payosTitle: 'Thanh toán qua payOS', payosHint: 'Quét mã bằng ứng dụng ngân hàng để thanh toán. Đơn tự cập nhật sau khi nhận tiền.',
  payosOpen: 'Mở trang thanh toán payOS', payosFrame: 'Khung thanh toán payOS', checking: 'Đang kiểm tra thanh toán…', checkAgain: 'Kiểm tra lại', pay: 'Thanh toán',
  unseen: 'Chưa ghi nhận thanh toán. Nếu bạn đã chuyển, hãy bấm Kiểm tra lại sau ít phút.', underpaid: 'payOS đã nhận {paid}, còn thiếu {remaining}. Hãy chuyển nốt qua mã này.',
  underpaidShort: 'payOS đã nhận {paid}, còn thiếu {remaining}.', noLink: 'Chưa tạo được mã thanh toán; hãy thử lại.', frameFailed: 'Không tải được khung thanh toán. Hãy mở trang thanh toán payOS.',
  countdown: 'Còn {time}', expiredNow: 'Đơn đã hết hạn', notPayos: 'Đơn này không thanh toán qua payOS.', checkFailed: 'Không thể kiểm tra thanh toán.', noRefund: 'Khóa học đã mua không được hoàn tiền.',
}
type OrderCopy = typeof orderVi
const orderEn: OrderCopy = {
  myOrders: 'My orders', kicker: 'My corner', count: '{n} orders', loading: 'Loading orders...', loadError: 'Unable to load orders.', retry: 'Retry', allCourses: 'Courses',
  empty: 'You have no orders yet', emptyText: 'Orders you create when buying a course will appear here.', explore: 'Explore courses', notFoundBack: 'My orders',
  PENDING: 'Awaiting transfer confirmation', PAID: 'Payment received', EXPIRED: 'Expired', FAILED: 'No longer valid', CANCELLED: 'No longer valid',
  reportedBadge: 'Transfer reported', created: 'Created {when}', expires: 'Expires {when}', paidOn: 'Paid {when}', remaining: '~{n} hours left', remainingMin: '~{n} minutes left',
  viewOrder: 'View order', learn: 'Start learning', course: 'Course', total: 'Total', openOrder: 'Order {code}',
  transferTitle: 'Bank transfer', qrTitle: 'Scan VietQR', bank: 'Bank', accountNo: 'Account number', accountName: 'Account name', amount: 'Amount', content: 'Transfer note',
  copy: 'Copy {what}', matchNote: 'Use the exact transfer note so an admin can match it.', qrAlt: 'VietQR code for order {code}', qrHint: 'Open your banking app and scan; check the amount.',
  qrFailed: 'QR unavailable; use the transfer details below.', qrReload: 'Reload image',
  afterTitle: 'After you transfer', afterText: 'Access opens only after an admin verifies the bank statement. Purchased courses are non-refundable.',
  report: 'I have transferred', reported: 'Reported to admin at {time}; access opens after the admin verifies the transfer.', refresh: 'Refresh status', buyAgain: 'Buy again',
  expiredAlert: 'This order has expired; contact an admin if you already transferred.', paidAlert: 'Payment received', invalidAlert: 'This order is no longer valid.', buyFailed: 'Unable to create the order.', reportFailed: 'Unable to report the transfer.',
  PENDING_PAYOS: 'Awaiting payment', payosTitle: 'Pay with payOS', payosHint: 'Scan the code with your banking app. The order updates once the payment arrives.',
  payosOpen: 'Open the payOS payment page', payosFrame: 'payOS payment frame', checking: 'Checking your payment…', checkAgain: 'Check again', pay: 'Pay',
  unseen: 'No payment found yet. If you have paid, check again in a few minutes.', underpaid: 'payOS received {paid}; {remaining} is still due. Pay the rest with this code.',
  underpaidShort: 'payOS received {paid}; {remaining} is still due.', noLink: 'Could not create the payment code; please try again.', frameFailed: 'The payment frame failed to load. Open the payOS payment page instead.',
  countdown: '{time} left', expiredNow: 'The order has expired', notPayos: 'This order is not paid through payOS.', checkFailed: 'Unable to check the payment.', noRefund: 'Purchased courses are non-refundable.',
}
export function orderText(language: Language) {
  const copy = language === 'vi' ? orderVi : orderEn
  return (key: keyof OrderCopy, values: Record<string, string | number> = {}) => copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}

// Admin orders, commission policy and Author revenue (Task 2c).
const payVi = {
  ordersTitle: 'Đơn hàng', count: '{n} đơn', loading: 'Đang tải đơn hàng...', loadError: 'Không tải được đơn hàng.', retry: 'Thử lại', filters: 'Bộ lọc', kicker: 'Thanh toán',
  code: 'Mã đơn', codePlaceholder: 'Mã đơn đầy đủ, vd. TV000000000123', applyCode: 'Tìm mã đơn', clearCode: 'Xóa mã đơn', status: 'Trạng thái', all: 'Tất cả',
  PENDING: 'Chờ xác nhận', PAID: 'Đã nhận tiền', EXPIRED: 'Hết hạn', FAILED: 'Không còn hiệu lực', CANCELLED: 'Không còn hiệu lực',
  reportedFilter: 'Đã báo chuyển khoản', reconFilter: 'Cần đối chiếu', reportedAt: 'Người học đã báo chuyển khoản {time}', reportedHint: 'Cần kiểm tra sao kê trước khi xác nhận.',
  duplicate: 'Có khoản thanh toán trùng cần đối chiếu', reconciled: 'Đã đối chiếu', received: 'Đã nhận tiền', created: 'Tạo {when}', expires: 'Hết hạn {when}', paidOn: 'Thanh toán {when}',
  confirmBtn: 'Đối chiếu & xác nhận', viewBtn: 'Xem · Đối chiếu', empty: 'Không có đơn phù hợp', clearFilters: 'Xóa bộ lọc',
  sheetTitle: 'Xác nhận đơn {code}', reviewTitle: 'Đối chiếu đơn {code}', due: 'Số tiền cần nhận (theo đơn)', check: 'Kiểm tra sao kê ngân hàng (mã đơn, số tiền) trước khi xác nhận.',
  stmtAmount: 'Số tiền trên sao kê', stmtRef: 'Mã giao dịch sao kê', amountInvalid: 'Số tiền phải là số nguyên dương.', refInvalid: 'Mã giao dịch từ 1 đến 255 ký tự.',
  review: 'Kiểm tra lại…', cancel: 'Hủy', back: 'Quay lại', close: 'Đóng', reload: 'Tải lại', confirmReceived: 'Xác nhận đã nhận tiền',
  confirmQ: 'Xác nhận đã nhận {amount} cho đơn {code}, mã giao dịch {ref}? Hành động ghi nhận thanh toán và mở quyền học.',
  paymentsTitle: 'Đã nhận {n} khoản', dupBlock: 'Có khoản thanh toán trùng cần đối chiếu — tiền thừa xử lý ngoài hệ thống, không hoàn tiền trong sản phẩm.', addPayment: 'Ghi thêm khoản trùng',
  closeFlag: 'Đóng cờ đối chiếu', closeFlagQ: 'Đánh dấu đã đối chiếu {n} khoản thanh toán của đơn này?', markReconciled: 'Đánh dấu đã đối chiếu',
  okConfirm: 'Đã ghi nhận thanh toán.', okDuplicate: 'Đã ghi nhận; cần đối chiếu khoản thanh toán trùng.', okReconciled: 'Đã đối chiếu.', confirmFailed: 'Không thể xác nhận thanh toán.', reconcileFailed: 'Không thể đóng cờ đối chiếu.',
  commissionTitle: 'Tỷ lệ hoa hồng nền tảng', current: 'Hiện hành', platformKeeps: 'Nền tảng giữ', policy: 'Tỷ lệ hoa hồng · Hiệu lực từ {date}', policyNote: 'Đổi tỷ lệ có hiệu lực ngay cho đơn mới; đơn đã tạo giữ tỷ lệ cũ.',
  changeTitle: 'Đổi tỷ lệ', newRate: 'Tỷ lệ mới (%)', saveRate: 'Lưu tỷ lệ', example: 'Ví dụ: khóa {price} → nền tảng giữ {platform}, tác giả nhận {author}', rateInvalid: 'Tỷ lệ không hợp lệ.',
  rateQ: 'Đổi tỷ lệ nền tảng giữ thành {rate}% ngay bây giờ? Áp dụng cho đơn tạo từ lúc này.', changeRate: 'Đổi tỷ lệ', rateUpdated: 'Đã cập nhật tỷ lệ.', rateUnchanged: 'Tỷ lệ hiện tại không đổi.',
  noPolicy: 'Chưa có tỷ lệ; thanh toán tạm thời không khả dụng.', rateLoadError: 'Không tải được tỷ lệ hoa hồng.', rateLoading: 'Đang tải tỷ lệ...', rateFailed: 'Không thể đổi tỷ lệ.',
  revenueTitle: 'Doanh thu tác giả', authorSpace: 'Không gian tác giả', orders: 'Số đơn', gross: 'Tổng bán', platformShare: 'Nền tảng giữ', yourShare: 'Bạn nhận',
  snapshotNote: 'Số liệu theo tỷ lệ tại thời điểm mỗi đơn được tạo.', itemLine: 'Giá {price} · Nền tảng giữ {rate}% ({platform}) · Bạn nhận {author}',
  revenueEmpty: 'Chưa có doanh thu', revenueEmptyText: 'Doanh thu hiện khi có người học thanh toán khóa của bạn.', revenueLoading: 'Đang tải doanh thu...', revenueLoadError: 'Không tải được doanh thu.',
  paidOutTile: 'Đã nhận', pendingTile: 'Chờ chi', filteredHeading: 'Theo bộ lọc', allTimeHeading: 'Toàn thời gian', allTimeNote: 'Tính trên toàn bộ thời gian, không theo bộ lọc.',
  tabSales: 'Lượt bán', tabCourses: 'Theo khóa', tabPayouts: 'Chi trả', tabs: 'Nhóm doanh thu', fromDate: 'Từ ngày', toDate: 'Đến ngày', pickDate: 'Chọn ngày', filtering: 'Đang lọc: {course}', removeCourse: 'Gỡ bộ lọc khóa',
  filterEmpty: 'Không có lượt bán nào trong khoảng đã chọn.', rangeInvalid: 'Khoảng ngày không hợp lệ.', courseLine: '{n} lượt bán · Tổng thu {gross} · Hoa hồng {platform} · Bạn nhận {author}',
  noAccount: 'Hãy khai tài khoản ngân hàng để nhận doanh thu.', addAccount: 'Khai tài khoản', editAccount: 'Sửa', accountTitle: 'Tài khoản nhận tiền', bank: 'Ngân hàng', pickBank: 'Chọn ngân hàng', accountNo: 'Số tài khoản', accountName: 'Chủ tài khoản',
  payoutNote: 'Nền tảng chuyển khoản thủ công; thời gian nhận tùy đợt chi.', payoutHistory: 'Lịch sử chi trả', payoutEmpty: 'Chưa có khoản chi nào.', accountSaved: 'Đã lưu tài khoản nhận tiền.', saveAccount: 'Lưu', saving: 'Đang lưu...',
  accountLoadError: 'Không tải được tài khoản nhận tiền.', payoutsLoadError: 'Không tải được lịch sử chi trả.', payoutLine: 'Mã sao kê {ref} · TK {account}',
  confirm: 'Xác nhận', staleChanged: 'Số còn nợ đã thay đổi. Đóng Sheet và mở lại để xem số mới; nếu đã chuyển khoản, đối chiếu sao kê trước khi ghi.', staleOwed: 'Số còn nợ hiện tại: {amount}. Đóng Sheet và mở lại để chi theo số mới; nếu đã chuyển khoản, đối chiếu sao kê trước khi ghi.', adminRevenueTitle: 'Doanh thu', paidOrders: 'Đơn đã trả', totalIn: 'Tổng thu', platformFee: 'Hoa hồng sàn', authorShare: 'Phần tác giả', earnedTile: 'Tác giả được hưởng', spentTile: 'Đã chi', owedTile: 'Còn nợ',
  goPayouts: 'Chi trả tác giả', adminCourseLine: 'Thu {gross} · HH {platform} · Tác giả {author}', salesCount: '{n} lượt', adminRevenueLoadError: 'Không tải được doanh thu.', adminRevenueLoading: 'Đang tải doanh thu...',
  payoutsTitle: 'Chi trả tác giả', tabOwed: 'Công nợ', tabHistory: 'Lịch sử chi', showAll: 'Hiện cả tác giả đã chi đủ', earned: 'Đã kiếm', paid: 'Đã chi', owed: 'Còn nợ', payBtn: 'Chi trả', payBtnFor: 'Chi trả {name}',
  owedEmpty: 'Không còn khoản nào phải chi.', owedLoading: 'Đang tải công nợ...', owedLoadError: 'Không tải được công nợ.', historyLoadError: 'Không tải được lịch sử chi.', noAccountAuthor: 'Tác giả chưa khai tài khoản nhận tiền.',
  sheetPay: 'Chi trả — {name}', amountToSend: 'Số tiền cần chuyển', fixedAmount: 'cố định', copyWhat: 'Sao chép {what}', qrAlt: 'Mã VietQR chi trả cho {name}', qrUnavailable: 'Không tải được mã QR',
  holderCheck: 'Đối chiếu tên chủ tài khoản app ngân hàng hiện ra với tên bên dưới trước khi chuyển.', reference: 'Mã sao kê', referenceHint: '1–255 ký tự, lấy từ sao kê ngân hàng.', recordBtn: 'Ghi nhận đã chuyển',
  recordQ: 'Ghi nhận đã chuyển {amount} cho {name}? Không sửa được sau khi ghi.', recordOk: 'Đã ghi nhận khoản chi.', recordFailed: 'Không ghi nhận được khoản chi.',
  accountChanged: 'Tác giả đã đổi tài khoản sau khi bạn mở; khoản chi ghi theo tài khoản bạn đã chuyển.', authorHistory: 'Lịch sử chi của tác giả này', recordedBy: 'Ghi bởi: {name}', historyLine: '{bank} {no} · {holder}',
  srcPAYOS: 'payOS', srcMANUAL: 'Chuyển khoản tay', viewCheck: 'Xem · Kiểm tra', orderTitle: 'Đơn {code}', payosCheck: 'Kiểm tra với payOS', payosNoManual: 'Đơn payOS không xác nhận tay; hãy bấm kiểm tra với payOS.',
  payosReceived: 'payOS đã nhận {paid} / {total}', payosNone: 'Chưa ghi nhận thanh toán.', notPayos: 'Đơn này không thanh toán qua payOS.', checkFailed: 'Không thể kiểm tra với payOS.',
}
type PayCopy = typeof payVi
const payEn: PayCopy = {
  ordersTitle: 'Orders', count: '{n} orders', loading: 'Loading orders...', loadError: 'Unable to load orders.', retry: 'Retry', filters: 'Filters', kicker: 'Payments',
  code: 'Order code', codePlaceholder: 'Full order code, e.g. TV000000000123', applyCode: 'Find order code', clearCode: 'Clear order code', status: 'Status', all: 'All',
  PENDING: 'Awaiting confirmation', PAID: 'Payment received', EXPIRED: 'Expired', FAILED: 'No longer valid', CANCELLED: 'No longer valid',
  reportedFilter: 'Transfer reported', reconFilter: 'Needs reconciliation', reportedAt: 'Buyer reported a transfer {time}', reportedHint: 'Check the bank statement before confirming.',
  duplicate: 'Duplicate payment requires reconciliation', reconciled: 'Reconciled', received: 'Payment received', created: 'Created {when}', expires: 'Expires {when}', paidOn: 'Paid {when}',
  confirmBtn: 'Check & confirm', viewBtn: 'View · Reconcile', empty: 'No matching orders', clearFilters: 'Clear filters',
  sheetTitle: 'Confirm order {code}', reviewTitle: 'Reconcile order {code}', due: 'Amount due (per order)', check: 'Check the bank statement (order code, amount) before confirming.',
  stmtAmount: 'Statement amount', stmtRef: 'Statement reference', amountInvalid: 'The amount must be a positive whole number.', refInvalid: 'The reference must be 1 to 255 characters.',
  review: 'Review…', cancel: 'Cancel', back: 'Go back', close: 'Close', reload: 'Reload', confirmReceived: 'Confirm payment received',
  confirmQ: 'Confirm that {amount} was received for order {code}, reference {ref}? This records the payment and unlocks the course.',
  paymentsTitle: '{n} payments received', dupBlock: 'Duplicate payment requires reconciliation — excess money is handled outside the system; no refunds in the product.', addPayment: 'Record another duplicate payment',
  closeFlag: 'Close reconciliation flag', closeFlagQ: 'Mark {n} payments of this order as reconciled?', markReconciled: 'Mark as reconciled',
  okConfirm: 'Payment recorded.', okDuplicate: 'Recorded; the duplicate payment needs reconciliation.', okReconciled: 'Reconciled.', confirmFailed: 'Unable to confirm the payment.', reconcileFailed: 'Unable to close the flag.',
  commissionTitle: 'Platform commission rate', current: 'Current', platformKeeps: 'Platform share', policy: 'Commission rate · Effective from {date}', policyNote: 'A new rate applies at once to new orders; existing orders keep their old rate.',
  changeTitle: 'Change rate', newRate: 'New rate (%)', saveRate: 'Save rate', example: 'Example: a {price} course → platform keeps {platform}, author gets {author}', rateInvalid: 'The rate is invalid.',
  rateQ: 'Change the platform share to {rate}% right now? It applies to orders created from this moment.', changeRate: 'Change rate', rateUpdated: 'Rate updated.', rateUnchanged: 'The current rate is unchanged.',
  noPolicy: 'No rate is set; payment is temporarily unavailable.', rateLoadError: 'Unable to load the commission rate.', rateLoading: 'Loading rate...', rateFailed: 'Unable to change the rate.',
  revenueTitle: 'Author revenue', authorSpace: 'Author space', orders: 'Orders', gross: 'Gross sales', platformShare: 'Platform share', yourShare: 'Your share',
  snapshotNote: 'Figures use the rate at the time each order was created.', itemLine: 'Price {price} · Platform share {rate}% ({platform}) · Your share {author}',
  revenueEmpty: 'No revenue yet', revenueEmptyText: 'Revenue appears when learners pay for your courses.', revenueLoading: 'Loading revenue...', revenueLoadError: 'Unable to load revenue.',
  paidOutTile: 'Paid out', pendingTile: 'Pending payout', filteredHeading: 'Filtered', allTimeHeading: 'All time', allTimeNote: 'All time, not affected by filters.',
  tabSales: 'Sales', tabCourses: 'By course', tabPayouts: 'Payouts', tabs: 'Revenue sections', fromDate: 'From', toDate: 'To', pickDate: 'Pick a date', filtering: 'Filtering: {course}', removeCourse: 'Remove course filter',
  filterEmpty: 'No sales in the selected range.', rangeInvalid: 'The date range is invalid.', courseLine: '{n} sales · Gross {gross} · Platform {platform} · Your share {author}',
  noAccount: 'Add a bank account to receive your revenue.', addAccount: 'Add account', editAccount: 'Edit', accountTitle: 'Payout account', bank: 'Bank', pickBank: 'Choose a bank', accountNo: 'Account number', accountName: 'Account holder',
  payoutNote: 'Payouts are transferred manually; timing depends on the payout run.', payoutHistory: 'Payout history', payoutEmpty: 'No payouts yet.', accountSaved: 'Payout account saved.', saveAccount: 'Save', saving: 'Saving...',
  accountLoadError: 'Unable to load the payout account.', payoutsLoadError: 'Unable to load payout history.', payoutLine: 'Reference {ref} · Account {account}',
  confirm: 'Confirm', staleChanged: 'The amount owed has changed. Close this sheet and reopen it to see the new amount; if you already transferred, check the statement before recording.', staleOwed: 'Amount owed now: {amount}. Close this sheet and reopen it to pay the new amount; if you already transferred, check the statement before recording.', adminRevenueTitle: 'Revenue', paidOrders: 'Paid orders', totalIn: 'Total received', platformFee: 'Platform commission', authorShare: 'Author share', earnedTile: 'Owed to authors', spentTile: 'Paid out', owedTile: 'Still owed',
  goPayouts: 'Author payouts', adminCourseLine: 'Received {gross} · Platform {platform} · Author {author}', salesCount: '{n} sales', adminRevenueLoadError: 'Unable to load revenue.', adminRevenueLoading: 'Loading revenue...',
  payoutsTitle: 'Author payouts', tabOwed: 'Owed', tabHistory: 'Payout history', showAll: 'Show fully paid authors too', earned: 'Earned', paid: 'Paid out', owed: 'Owed', payBtn: 'Pay out', payBtnFor: 'Pay out {name}',
  owedEmpty: 'Nothing left to pay out.', owedLoading: 'Loading balances...', owedLoadError: 'Unable to load balances.', historyLoadError: 'Unable to load payout history.', noAccountAuthor: 'This author has not added a bank account.',
  sheetPay: 'Pay out — {name}', amountToSend: 'Amount to transfer', fixedAmount: 'fixed', copyWhat: 'Copy {what}', qrAlt: 'VietQR code for the payout to {name}', qrUnavailable: 'Unable to load the QR code',
  holderCheck: 'Check that the account holder shown by your banking app matches the name below before transferring.', reference: 'Bank reference', referenceHint: '1–255 characters, from the bank statement.', recordBtn: 'Record as transferred',
  recordQ: 'Record {amount} paid to {name}? This cannot be edited.', recordOk: 'Payout recorded.', recordFailed: 'Unable to record the payout.',
  accountChanged: 'The author changed their account after you opened this; the payout is recorded against the account you paid.', authorHistory: "This author's payouts", recordedBy: 'Recorded by: {name}', historyLine: '{bank} {no} · {holder}',
  srcPAYOS: 'payOS', srcMANUAL: 'Manual transfer', viewCheck: 'View · Check', orderTitle: 'Order {code}', payosCheck: 'Check with payOS', payosNoManual: 'payOS orders cannot be confirmed manually; check with payOS instead.',
  payosReceived: 'payOS received {paid} of {total}', payosNone: 'No payment recorded yet.', notPayos: 'This order is not paid through payOS.', checkFailed: 'Unable to check with payOS.',
}
export function payAdminText(language: Language) {
  const copy = language === 'vi' ? payVi : payEn
  return (key: keyof PayCopy, values: Record<string, string | number> = {}) => copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}
