import { ApiError } from '../services/api/client'
import type { Language } from '../types/preferences'
import type { HistoryAction, PublicationStatus, WorkflowStatus } from '../types/articles'

type Copy = { vi: string; en: string }

export const workflowLabel: Record<WorkflowStatus, Copy> = {
  DRAFT: { vi: 'Bản nháp', en: 'Draft' },
  PENDING: { vi: 'Chờ duyệt', en: 'Pending review' },
  CHANGES_REQUESTED: { vi: 'Cần sửa', en: 'Changes requested' },
  PUBLISHED: { vi: 'Khớp bản công khai', en: 'Matches live version' },
}

export const publicationLabel: Record<PublicationStatus, Copy> = {
  UNPUBLISHED: { vi: 'Chưa công khai', en: 'Not published' },
  PUBLISHED: { vi: 'Đang công khai', en: 'Live' },
  AUTHOR_HIDDEN: { vi: 'Bạn đang ẩn', en: 'Hidden by you' },
  HIDDEN: { vi: 'Bị kiểm duyệt ẩn', en: 'Hidden by moderator' },
  AUTHOR_DELETED: { vi: 'Đã xóa', en: 'Deleted' },
  REMOVED: { vi: 'Đã gỡ', en: 'Removed' },
}

export const historyActionLabel: Record<HistoryAction, Copy> = {
  APPROVE: { vi: 'Duyệt', en: 'Approved' },
  REQUEST_CHANGES: { vi: 'Yêu cầu sửa', en: 'Changes requested' },
  HIDE: { vi: 'Kiểm duyệt viên ẩn bài', en: 'Hidden by moderator' },
  RESTORE: { vi: 'Kiểm duyệt viên khôi phục', en: 'Restored by moderator' },
  REMOVE: { vi: 'Gỡ bài', en: 'Removed' },
  AUTHOR_HIDE: { vi: 'Tác giả ẩn bài', en: 'Hidden by author' },
  AUTHOR_UNHIDE: { vi: 'Tác giả hiện lại', en: 'Unhidden by author' },
  AUTHOR_DELETE: { vi: 'Tác giả xóa bài', en: 'Deleted by author' },
}

// Spec “API và validation”: the UI translates by code because the backend message is always English.
const errors: Record<string, Copy> = {
  VALIDATION_ERROR: { vi: 'Kiểm tra lại các trường được đánh dấu.', en: 'Check the highlighted fields.' },
  TOPIC_NOT_FOUND: { vi: 'Không tìm thấy chủ đề.', en: 'Topic not found.' },
  TAG_NOT_FOUND: { vi: 'Không tìm thấy thẻ.', en: 'Tag not found.' },
  ARTICLE_ASSOCIATION_INACTIVE: { vi: 'Chủ đề hoặc thẻ không còn hoạt động.', en: 'The topic or a tag is inactive.' },
  ARTICLE_CONTENT_INVALID: { vi: 'Nội dung chứa HTML hoặc liên kết không được hỗ trợ.', en: 'Content contains unsupported HTML or links.' },
  ARTICLE_IMAGE_INVALID: { vi: 'Ảnh không hợp lệ hoặc không thuộc bài viết này.', en: 'The image is invalid or does not belong to this article.' },
  ARTICLE_FILE_INVALID: { vi: 'Tệp rỗng, nhị phân hoặc không phải UTF-8.', en: 'The file is empty, binary or not UTF-8.' },
  ARTICLE_FILE_TOO_LARGE: { vi: 'Tệp hoặc nội dung vượt giới hạn dung lượng.', en: 'The file or content exceeds the size limit.' },
  ARTICLE_FILE_UNSUPPORTED: { vi: 'Định dạng không được hỗ trợ: chỉ nhận .md/.txt hoặc ảnh JPEG, PNG, WebP.', en: 'Unsupported format: only .md/.txt or JPEG, PNG, WebP images.' },
  ARTICLE_KEY_CONFLICT: { vi: 'Khóa thao tác đã được dùng hoặc bài tương ứng đã bị xóa.', en: 'This request key was used or its article was deleted.' },
  ARTICLE_REQUEST_IN_PROGRESS: { vi: 'Bài đang được tạo, hãy thử lại với cùng khóa.', en: 'Creation is in progress; retry with the same key.' },
  ARTICLE_RATE_LIMITED: { vi: 'Thao tác quá nhanh, hãy thử lại sau.', en: 'Too many article operations; try again later.' },
  ARTICLE_IMAGE_UPLOAD_FAILED: { vi: 'Dịch vụ ảnh từ chối tải lên. Hãy thử lại.', en: 'The image service rejected the upload. Try again.' },
  ARTICLE_STORAGE_UNAVAILABLE: { vi: 'Kho ảnh tạm thời gián đoạn. Hãy thử lại sau.', en: 'Image storage is temporarily unavailable. Try again later.' },
  ARTICLE_NO_CHANGES: { vi: 'Chưa có thay đổi để gửi duyệt.', en: 'There are no changes to submit.' },
  ARTICLE_NOT_EDITABLE: { vi: 'Trạng thái hiện tại không cho phép sửa bài.', en: 'The current state does not allow editing.' },
  ARTICLE_NOT_WITHDRAWABLE: { vi: 'Chỉ bản đang chờ duyệt mới có thể rút lại.', en: 'Only a pending revision can be withdrawn.' },
  ARTICLE_NOT_DISCARDABLE: { vi: 'Không có bản chỉnh sửa phù hợp để hủy.', en: 'There is no editable revision to discard.' },
  ARTICLE_PUBLICATION_TRANSITION_INVALID: { vi: 'Bài không ở trạng thái có thể ẩn.', en: 'The article cannot be hidden in its current state.' },
  ARTICLE_AUTHOR_UNHIDE_NOT_ALLOWED: { vi: 'Bài do kiểm duyệt viên ẩn nên bạn không thể tự hiện lại.', en: 'A moderator hid this article, so you cannot unhide it.' },
  ARTICLE_NOT_DELETABLE: { vi: 'Trạng thái hiện tại không cho phép xóa bài.', en: 'The article cannot be deleted in its current state.' },
  ARTICLE_NOT_FOUND: { vi: 'Không tìm thấy bài viết.', en: 'Article not found.' },
  ACCESS_DENIED: { vi: 'Bạn không có quyền thực hiện thao tác này.', en: 'You do not have permission to do this.' },
}
const unavailable: Copy = { vi: 'Hệ thống tạm thời gián đoạn. Vui lòng thử lại sau.', en: 'The service is temporarily unavailable. Please try again later.' }

/** Pure `code × language` lookup; unknown 5xx get the generic system message, never the backend English text. */
export function articleErrorText(error: unknown, language: Language, fallback: string) {
  if (!(error instanceof ApiError)) return fallback
  const copy = (error.code && errors[error.code]) || (error.status === 403 ? errors.ACCESS_DENIED : error.status >= 500 ? unavailable : null)
  return copy ? copy[language] : fallback
}

const vi = {
  kicker: 'Không gian tác giả', title: 'Bài viết của tôi', subtitle: 'Soạn, gửi duyệt và quản lý bài đã công khai.', newArticle: 'Viết bài mới',
  total: 'Tổng', stats: 'Số liệu bài viết', filters: 'Bộ lọc', search: 'Tìm theo tiêu đề', searchPlaceholder: 'Tìm theo tiêu đề...', topic: 'Chủ đề', tag: 'Thẻ', sort: 'Sắp xếp',
  all: 'Tất cả', allTopics: 'Mọi chủ đề', allTags: 'Mọi thẻ', newest: 'Mới tạo nhất', oldest: 'Cũ nhất', recentlyEdited: 'Sửa gần đây', titleAz: 'Tiêu đề A–Z',
  workflowFilter: 'Soạn thảo', publicationFilter: 'Công khai', list: 'Danh sách bài', count: '{n} bài', edit: 'Sửa', view: 'Xem', more: 'Thao tác khác cho {title}', moreShort: 'Thao tác khác',
  updated: 'Sửa {date}', publishedOn: 'Công khai {date}', moderatorHidden: 'Kiểm duyệt viên đã ẩn bài', unpublishedChanges: 'Có thay đổi chưa gửi', statusList: 'Trạng thái bài viết',
  emptyTitle: 'Bạn chưa có bài viết nào', emptyText: 'Bài viết đi qua ba bước trước khi tới độc giả.', steps: 'Viết|Gửi duyệt|Xuất bản', writeFirst: 'Viết bài đầu tiên',
  noMatch: 'Không có bài khớp bộ lọc', clearFilters: 'Xóa bộ lọc', loadError: 'Không thể tải bài viết.', retry: 'Thử lại', loading: 'Đang tải bài viết...', cancel: 'Hủy',
  viewLive: 'Xem bản công khai', withdraw: 'Rút lại', discard: 'Hủy bản sửa', hide: 'Ẩn bài', unhide: 'Hiện lại', deleteHard: 'Xóa vĩnh viễn', deleteSoft: 'Xóa bài', history: 'Lịch sử',
  withdrawText: 'Bản cập nhật rời hàng đợi duyệt và trở về bản nháp để bạn sửa tiếp.', discardText: 'Nội dung quay về bản đang công khai; mọi chỉnh sửa chưa duyệt sẽ mất.',
  hideText: 'Độc giả sẽ không còn thấy bài cho tới khi bạn hiện lại. Bản đang chờ duyệt (nếu có) vẫn ở hàng đợi.', unhideText: 'Bản công khai hiện lại ngay cho độc giả.',
  deleteHardText: 'Xóa vĩnh viễn, không khôi phục.', deleteSoftText: 'Bài gỡ khỏi trang đọc và khỏi danh sách của bạn, không khôi phục.', actionDone: 'Đã cập nhật bài viết.', deleted: 'Đã xóa bài viết.',
  historyTitle: 'Lịch sử bài viết', historyEmpty: 'Chưa có lịch sử', loadMore: 'Tải thêm', you: 'bạn', version: 'v{n}',
  back: 'Bài viết của tôi', backToList: 'Về danh sách', notFound: 'Không tìm thấy bài viết', newTitle: 'Viết bài mới', editTitle: 'Sửa bài', viewTitle: 'Xem bài',
  saveDraft: 'Lưu nháp', submit: 'Gửi duyệt', savedAt: 'Đã lưu {time}', saved: 'Đã lưu nháp.', submitted: 'Đã gửi duyệt.', noChanges: 'Không có thay đổi để lưu.',
  metadata: 'Thông tin bài', collapse: 'Thu gọn', expand: 'Mở rộng', titleField: 'Tiêu đề', summary: 'Tóm tắt', cover: 'Ảnh bìa', uploadCover: 'Tải ảnh bìa', removeCover: 'Bỏ ảnh bìa', coverFile: 'Tệp ảnh bìa', chooseTopic: 'Chọn chủ đề',
  required: 'Bắt buộc.', titleRequired: 'Nhập tiêu đề.', topicRequired: 'Chọn chủ đề.', summaryRequired: 'Nhập tóm tắt trước khi gửi duyệt.', contentRequired: 'Nhập nội dung trước khi gửi duyệt.',
  content: 'Nội dung Markdown', importFile: 'Nhập .md/.txt', importInput: 'Tệp Markdown', imported: 'Đã nhập nội dung. Hãy lưu nháp để giữ thay đổi.', insertImage: 'Chèn ảnh', insertInput: 'Tệp ảnh chèn vào nội dung',
  saveFirst: 'Nhập tiêu đề, chủ đề và lưu nháp trước', tooMany: 'Bài đã đủ 50 ảnh (gồm ảnh bìa).', tooLarge: 'Ảnh vượt 5 MiB.', fileType: 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.', uploading: 'Đang tải ảnh...',
  issues: '{n} ảnh cần tải lên', issuesShort: '⚠ {n} ảnh cần tải lên', issuesHelp: 'Tải ảnh thay thế hoặc bỏ ảnh; bài chỉ gửi duyệt được khi hết ảnh cần tải.', line: 'dòng {line} cột {column}', noAlt: 'không có alt',
  replace: 'Tải ảnh thay thế', replaceInput: 'Tệp thay thế cho ảnh {n}', removeImage: 'Bỏ ảnh', pickMany: 'Chọn nhiều ảnh – tự ghép theo tên file', pickManyInput: 'Tệp ảnh ghép theo tên', unmatched: 'Không khớp ảnh nào: {names}',
  stale: 'Nội dung đã đổi sau lần lưu trước. Lưu nháp để cập nhật danh sách ảnh.', submitBlocked: 'Còn {n} ảnh cần tải lên', imagesPending: 'Còn ảnh cần tải lên trước khi gửi duyệt.',
  preview: 'Xem trước', published: 'Bản công khai v{n}', previewMode: 'Chế độ xem', compose: 'Soạn thảo', mobileView: 'Soạn thảo hoặc xem trước', imagePlaceholder: 'Ảnh cần tải lên', untitled: 'Chưa có tiêu đề',
  pendingBanner: 'Đang chờ duyệt — rút lại để tiếp tục sửa.', changesBanner: 'Kiểm duyệt viên yêu cầu sửa: {note}', changesBannerNoNote: 'Kiểm duyệt viên yêu cầu sửa bài.', liveBanner: 'Độc giả vẫn đọc bản công khai v{n}. Bản sửa chỉ thay khi được duyệt.',
  hiddenBanner: 'Kiểm duyệt viên đã ẩn bài.', authorHiddenBanner: 'Bạn đang ẩn bài.', removedBanner: 'Bài đã bị gỡ: {note}', removedBannerNoNote: 'Bài đã bị gỡ và chỉ còn để xem.',
  close: 'Đóng', leaveTitle: 'Rời trang?', leaveText: 'Thay đổi chưa lưu sẽ mất.', stay: 'Ở lại', leave: 'Rời trang', reload: 'Tải lại',
}
type ArticleCopy = typeof vi

const en: ArticleCopy = {
  kicker: 'Author workspace', title: 'My articles', subtitle: 'Write, submit for review and manage your published articles.', newArticle: 'New article',
  total: 'Total', stats: 'Article counts', filters: 'Filters', search: 'Search by title', searchPlaceholder: 'Search by title...', topic: 'Topic', tag: 'Tag', sort: 'Sort',
  all: 'All', allTopics: 'All topics', allTags: 'All tags', newest: 'Newest', oldest: 'Oldest', recentlyEdited: 'Recently edited', titleAz: 'Title A–Z',
  workflowFilter: 'Editing', publicationFilter: 'Publication', list: 'Articles', count: '{n} articles', edit: 'Edit', view: 'View', more: 'More actions for {title}', moreShort: 'More actions',
  updated: 'Edited {date}', publishedOn: 'Published {date}', moderatorHidden: 'A moderator hid this article', unpublishedChanges: 'Unsubmitted changes', statusList: 'Article status',
  emptyTitle: 'You have no articles yet', emptyText: 'Articles go through three steps before readers see them.', steps: 'Write|Submit|Publish', writeFirst: 'Write your first article',
  noMatch: 'No articles match the filters', clearFilters: 'Clear filters', loadError: 'Unable to load articles.', retry: 'Retry', loading: 'Loading articles...', cancel: 'Cancel',
  viewLive: 'View live version', withdraw: 'Withdraw', discard: 'Discard revision', hide: 'Hide', unhide: 'Unhide', deleteHard: 'Delete permanently', deleteSoft: 'Delete article', history: 'History',
  withdrawText: 'The revision leaves the review queue and returns to draft so you can keep editing.', discardText: 'Content returns to the live version; unapproved edits are lost.',
  hideText: 'Readers will not see the article until you unhide it. A pending revision, if any, stays in the queue.', unhideText: 'The live version becomes visible to readers right away.',
  deleteHardText: 'Deleted permanently; this cannot be undone.', deleteSoftText: 'The article leaves the reader pages and your list; this cannot be undone.', actionDone: 'Article updated.', deleted: 'Article deleted.',
  historyTitle: 'Article history', historyEmpty: 'No history yet', loadMore: 'Load more', you: 'you', version: 'v{n}',
  back: 'My articles', backToList: 'Back to my articles', notFound: 'Article not found', newTitle: 'New article', editTitle: 'Edit article', viewTitle: 'View article',
  saveDraft: 'Save draft', submit: 'Submit for review', savedAt: 'Saved {time}', saved: 'Draft saved.', submitted: 'Submitted for review.', noChanges: 'Nothing to save.',
  metadata: 'Article details', collapse: 'Collapse', expand: 'Expand', titleField: 'Title', summary: 'Summary', cover: 'Cover image', uploadCover: 'Upload cover', removeCover: 'Remove cover', coverFile: 'Cover image file', chooseTopic: 'Choose a topic',
  required: 'Required.', titleRequired: 'Enter a title.', topicRequired: 'Choose a topic.', summaryRequired: 'Enter a summary before submitting.', contentRequired: 'Enter content before submitting.',
  content: 'Markdown content', importFile: 'Import .md/.txt', importInput: 'Markdown file', imported: 'Content imported. Save the draft to keep it.', insertImage: 'Insert image', insertInput: 'Image file to insert',
  saveFirst: 'Enter a title and topic, then save a draft first', tooMany: 'The article already has 50 images (cover included).', tooLarge: 'The image is larger than 5 MiB.', fileType: 'Only JPEG, PNG or WebP images.', uploading: 'Uploading image...',
  issues: '{n} images need uploading', issuesShort: '⚠ {n} images need uploading', issuesHelp: 'Upload a replacement or remove the image; you can submit once none are left.', line: 'line {line} column {column}', noAlt: 'no alt text',
  replace: 'Upload replacement', replaceInput: 'Replacement file for image {n}', removeImage: 'Remove image', pickMany: 'Pick several images – matched by filename', pickManyInput: 'Images matched by filename', unmatched: 'No matching image: {names}',
  stale: 'The content changed since the last save. Save the draft to refresh the image list.', submitBlocked: '{n} images still need uploading', imagesPending: 'Upload all images before submitting.',
  preview: 'Preview', published: 'Live version v{n}', previewMode: 'View mode', compose: 'Write', mobileView: 'Write or preview', imagePlaceholder: 'Image needs uploading', untitled: 'Untitled',
  pendingBanner: 'Pending review — withdraw it to keep editing.', changesBanner: 'A moderator requested changes: {note}', changesBannerNoNote: 'A moderator requested changes.', liveBanner: 'Readers still see live version v{n}. Your edits replace it only after approval.',
  hiddenBanner: 'A moderator hid this article.', authorHiddenBanner: 'You are hiding this article.', removedBanner: 'This article was removed: {note}', removedBannerNoNote: 'This article was removed and is read-only.',
  close: 'Close', leaveTitle: 'Leave this page?', leaveText: 'Unsaved changes will be lost.', stay: 'Stay', leave: 'Leave', reload: 'Reload',
}

export const articleCopy = { vi, en }

// ---------------------------------------------------------------- Moderator (Task 2b)

/** Moderator wording: the author's own choices are named as such, and a DRAFT here is always an update of a live article. */
export const moderatorPublicationLabel: Record<PublicationStatus, Copy> = {
  ...publicationLabel,
  AUTHOR_HIDDEN: { vi: 'Tác giả tự ẩn', en: 'Hidden by author' },
  HIDDEN: { vi: 'Bị ẩn', en: 'Hidden' },
  AUTHOR_DELETED: { vi: 'Tác giả đã xóa', en: 'Deleted by author' },
}
export const moderatorWorkflowLabel: Record<WorkflowStatus, Copy> = { ...workflowLabel, DRAFT: { vi: 'Nháp cập nhật', en: 'Update draft' } }

const moderatorErrors: Record<string, Copy> = {
  ARTICLE_NOT_PENDING: { vi: 'Bài viết không còn chờ duyệt. Hãy tải lại.', en: 'This article is no longer pending. Reload it.' },
  ARTICLE_REVIEW_STALE: { vi: 'Bài đã thay đổi, hãy tải lại.', en: 'The article changed; reload it.' },
  ARTICLE_SELF_REVIEW_NOT_ALLOWED: { vi: 'Bạn không thể tự duyệt bài viết của mình.', en: 'You cannot review your own article.' },
  ARTICLE_REVIEW_NOTE_REQUIRED: { vi: 'Cần nhập ghi chú khi yêu cầu sửa.', en: 'A note is required when requesting changes.' },
  ARTICLE_AUTHOR_INELIGIBLE: { vi: 'Tác giả không còn quyền đăng bài nên chưa thể xuất bản.', en: 'The author can no longer publish, so this article cannot go live.' },
  ARTICLE_PUBLICATION_TRANSITION_INVALID: { vi: 'Trạng thái xuất bản đã thay đổi, hãy tải lại.', en: 'The publication state changed; reload.' },
  ARTICLE_PUBLICATION_NOTE_REQUIRED: { vi: 'Cần nhập lý do ẩn hoặc gỡ bài.', en: 'A reason is required to hide or remove an article.' },
  ARTICLE_IMAGE_INVALID: { vi: 'Bài còn ảnh không hợp lệ hoặc ảnh đã mất; hãy yêu cầu tác giả sửa.', en: 'The article has invalid or missing images; ask the author to fix them.' },
  ARTICLE_ASSOCIATION_INACTIVE: { vi: 'Chủ đề hoặc thẻ của bài đã bị ẩn. Hãy yêu cầu tác giả đổi phân loại.', en: 'The article’s topic or a tag is now hidden. Ask the author to change it.' },
}

/** Moderator copy first, then the shared article copy (same pure `code × language` lookup). */
export function moderatorErrorText(error: unknown, language: Language, fallback: string) {
  const copy = error instanceof ApiError && error.code ? moderatorErrors[error.code] : undefined
  return copy ? copy[language] : articleErrorText(error, language, fallback)
}

/** The article changed under the moderator (stale token or state): the only fix is reloading the detail. */
export const isStaleError = (error: unknown) => error instanceof ApiError && ['ARTICLE_REVIEW_STALE', 'ARTICLE_PUBLICATION_TRANSITION_INVALID', 'ARTICLE_NOT_PENDING'].includes(error.code ?? '')

const moderatorVi = {
  dashboardTitle: 'Không gian kiểm duyệt', dashboardSubtitle: 'Theo dõi nội dung và hoạt động của cộng đồng.', queueTitle: 'Hàng đợi kiểm duyệt',
  queueText: '{n} bài đang chờ duyệt.', queueFallback: 'Xem và xử lý các bài viết được gửi từ tác giả.', openQueue: 'Mở danh sách bài viết',
  stats: 'Bài viết cần xử lý', title: 'Kiểm duyệt bài viết', subtitle: 'Duyệt bản gửi từ tác giả và quản lý bài đang công khai.', refresh: 'Làm mới',
  filters: 'Bộ lọc', search: 'Tìm theo tiêu đề', searchPlaceholder: 'Tìm theo tiêu đề...', topic: 'Chủ đề', tag: 'Thẻ', allTopics: 'Mọi chủ đề', allTags: 'Mọi thẻ',
  from: 'Gửi từ ngày', to: 'Đến ngày', dateInvalid: 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.', sort: 'Sắp xếp',
  newest: 'Mới gửi nhất', oldest: 'Cũ nhất', recentlyEdited: 'Sửa gần đây', titleAz: 'Tiêu đề A–Z', workflowFilter: 'Soạn thảo', publicationFilter: 'Công khai', all: 'Tất cả',
  count: '{n} bài', list: 'Danh sách bài viết', authorChip: 'Tác giả: {name}', removeAuthor: 'Bỏ lọc tác giả {name}', filterByAuthor: 'Lọc theo tác giả {name}',
  ineligible: 'Tác giả không còn đủ điều kiện', eligible: 'Đủ điều kiện', submitted: 'Gửi {date}', revision: 'Bản cập nhật',
  optionsError: 'Không thể tải danh sách chủ đề và thẻ.', noMatch: 'Không có bài khớp bộ lọc', noPending: 'Không còn bài chờ duyệt', clearFilters: 'Xóa bộ lọc', loadError: 'Không thể tải bài viết.', retry: 'Thử lại', loading: 'Đang tải bài viết...',
  breadcrumb: 'Đường dẫn', moderator: 'Kiểm duyệt', articles: 'Bài viết', actions: 'Thao tác kiểm duyệt',
  changesFrom: 'Thay đổi so với v{n}:', noFieldChanged: 'Không có trường nào khác bản công khai', compareMode: 'Chế độ so sánh', both: 'Song song',
  proposed: 'Bản đề xuất', live: 'Bản công khai v{n}', proposedShort: 'Đề xuất', liveShort: 'Công khai', changed: 'Đã đổi',
  fieldTitle: 'Tiêu đề', fieldSummary: 'Tóm tắt', fieldCover: 'Ảnh bìa', fieldTopic: 'Chủ đề', fieldTags: 'Thẻ', fieldContent: 'Nội dung',
  noSummary: 'Chưa có tóm tắt', noCover: 'Không có ảnh bìa', noTags: 'Không có thẻ', imagePlaceholder: 'Ảnh chưa tải lên', untitled: 'Chưa có tiêu đề',
  authorCard: 'Tác giả', ineligibleReason: 'Tác giả không còn quyền đăng bài nên chưa thể duyệt.', history: 'Lịch sử', historyRecent: 'Lịch sử (5 mới nhất)', viewAll: 'Xem tất cả', historyEmpty: 'Chưa có lịch sử',
  removedBanner: 'Bài đã gỡ khỏi trang đọc; không còn thao tác kiểm duyệt.', deletedBanner: 'Tác giả đã xóa bài, chỉ còn để đối soát.',
  notFound: 'Không tìm thấy bài viết', backToList: 'Về danh sách', detailError: 'Không thể tải bài viết.',
  APPROVE: 'Duyệt', REQUEST_CHANGES: 'Yêu cầu sửa', HIDE: 'Ẩn bài', RESTORE: 'Khôi phục', REMOVE: 'Gỡ bài',
  APPROVE_title: 'Duyệt và xuất bản', REQUEST_CHANGES_title: 'Yêu cầu sửa', HIDE_title: 'Ẩn bài', RESTORE_title: 'Khôi phục bài', REMOVE_title: 'Gỡ bài',
  APPROVE_text: 'Bản đề xuất sẽ thành v{n} trên cùng URL.', REQUEST_CHANGES_text: 'Bài trở về tác giả kèm ghi chú. Bản công khai (nếu có) giữ nguyên.',
  HIDE_text: 'Bài sẽ biến khỏi trang đọc.', RESTORE_text: 'Bài trở về trạng thái trước khi bị ẩn.', REMOVE_text: 'Bài bị gỡ khỏi trang đọc. Không khôi phục được.',
  APPROVE_done: 'Đã duyệt và xuất bản.', REQUEST_CHANGES_done: 'Đã gửi yêu cầu sửa cho tác giả.', HIDE_done: 'Đã ẩn bài.', RESTORE_done: 'Đã khôi phục bài.', REMOVE_done: 'Đã gỡ bài.',
  lastReturn: 'Lần trước trả về:', noteOptional: 'Ghi chú (tùy chọn)', noteRequired: 'Ghi chú cho tác giả (bắt buộc)', reasonRequired: 'Lý do (bắt buộc)',
  noteMissing: 'Nhập ghi chú trước khi yêu cầu sửa.', reasonMissing: 'Nhập lý do trước khi tiếp tục.', reload: 'Tải lại', cancel: 'Hủy', close: 'Đóng', backToTop: 'Lên đầu trang',
}
type ModeratorCopy = typeof moderatorVi

const moderatorEn: ModeratorCopy = {
  dashboardTitle: 'Moderation workspace', dashboardSubtitle: 'Follow community content and activity.', queueTitle: 'Moderation queue',
  queueText: '{n} articles awaiting review.', queueFallback: 'Review articles submitted by authors.', openQueue: 'Open article queue',
  stats: 'Articles to handle', title: 'Article moderation', subtitle: 'Review author submissions and manage live articles.', refresh: 'Refresh',
  filters: 'Filters', search: 'Search by title', searchPlaceholder: 'Search by title...', topic: 'Topic', tag: 'Tag', allTopics: 'All topics', allTags: 'All tags',
  from: 'Submitted from', to: 'To', dateInvalid: 'The start date must be on or before the end date.', sort: 'Sort',
  newest: 'Newest', oldest: 'Oldest', recentlyEdited: 'Recently edited', titleAz: 'Title A–Z', workflowFilter: 'Editing', publicationFilter: 'Publication', all: 'All',
  count: '{n} articles', list: 'Articles', authorChip: 'Author: {name}', removeAuthor: 'Remove author filter {name}', filterByAuthor: 'Filter by author {name}',
  ineligible: 'The author is no longer eligible', eligible: 'Eligible', submitted: 'Submitted {date}', revision: 'Update',
  optionsError: 'Unable to load topics and tags.', noMatch: 'No articles match the filters', noPending: 'No articles awaiting review', clearFilters: 'Clear filters', loadError: 'Unable to load articles.', retry: 'Retry', loading: 'Loading articles...',
  breadcrumb: 'Breadcrumb', moderator: 'Moderation', articles: 'Articles', actions: 'Moderation actions',
  changesFrom: 'Changes from v{n}:', noFieldChanged: 'No field differs from the live version', compareMode: 'Compare mode', both: 'Side by side',
  proposed: 'Proposed version', live: 'Live version v{n}', proposedShort: 'Proposed', liveShort: 'Live', changed: 'Changed',
  fieldTitle: 'Title', fieldSummary: 'Summary', fieldCover: 'Cover image', fieldTopic: 'Topic', fieldTags: 'Tags', fieldContent: 'Content',
  noSummary: 'No summary', noCover: 'No cover image', noTags: 'No tags', imagePlaceholder: 'Image not uploaded', untitled: 'Untitled',
  authorCard: 'Author', ineligibleReason: 'The author can no longer publish, so this article cannot be approved.', history: 'History', historyRecent: 'History (5 newest)', viewAll: 'View all', historyEmpty: 'No history yet',
  removedBanner: 'This article was removed from the reader pages; no moderation actions remain.', deletedBanner: 'The author deleted this article; it is available for audit only.',
  notFound: 'Article not found', backToList: 'Back to the list', detailError: 'Unable to load the article.',
  APPROVE: 'Approve', REQUEST_CHANGES: 'Request changes', HIDE: 'Hide', RESTORE: 'Restore', REMOVE: 'Remove',
  APPROVE_title: 'Approve and publish', REQUEST_CHANGES_title: 'Request changes', HIDE_title: 'Hide article', RESTORE_title: 'Restore article', REMOVE_title: 'Remove article',
  APPROVE_text: 'The proposed version becomes v{n} on the same URL.', REQUEST_CHANGES_text: 'The article goes back to the author with your note. The live version, if any, stays.',
  HIDE_text: 'The article disappears from the reader pages.', RESTORE_text: 'The article returns to its state before it was hidden.', REMOVE_text: 'The article leaves the reader pages. This cannot be undone.',
  APPROVE_done: 'Approved and published.', REQUEST_CHANGES_done: 'Change request sent to the author.', HIDE_done: 'Article hidden.', RESTORE_done: 'Article restored.', REMOVE_done: 'Article removed.',
  lastReturn: 'Last returned with:', noteOptional: 'Note (optional)', noteRequired: 'Note for the author (required)', reasonRequired: 'Reason (required)',
  noteMissing: 'Enter a note before requesting changes.', reasonMissing: 'Enter a reason before continuing.', reload: 'Reload', cancel: 'Cancel', close: 'Close', backToTop: 'Back to top',
}

export const moderatorCopy = { vi: moderatorVi, en: moderatorEn }
export type ModeratorKey = keyof ModeratorCopy

export function moderatorText(language: Language) {
  const copy = moderatorCopy[language]
  return (key: ModeratorKey, values: Record<string, string | number> = {}) => copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}

/** Copy lookup with `{name}` placeholders. */
export function articleText(language: Language) {
  const copy = articleCopy[language]
  return (key: keyof ArticleCopy, values: Record<string, string | number> = {}) => copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}

const readerVi = {
  kicker: 'Thư viện bài viết', title: 'Bài viết', subtitle: 'Kiến thức lập trình do tác giả TechVerse chia sẻ.', filters: 'Bộ lọc', count: '{n} bài',
  search: 'Tìm bài viết', searchPlaceholder: 'Tìm bài viết…', clearSearch: 'Xóa từ khóa', submitSearch: 'Tìm', topics: 'Chủ đề', allTopics: 'Tất cả', tag: 'Thẻ', allTags: 'Mọi thẻ',
  sort: 'Sắp xếp', newest: 'Mới nhất', oldest: 'Cũ nhất', optionsError: 'Không tải được chủ đề và thẻ.', list: 'Danh sách bài viết',
  emptyFiltered: 'Không tìm thấy bài viết phù hợp', emptyFilteredText: 'Thử từ khóa hoặc bộ lọc khác.', empty: 'Chưa có bài viết nào', emptyText: 'Bài viết sẽ xuất hiện ở đây khi được xuất bản.',
  clearFilters: 'Xóa bộ lọc', loadError: 'Không thể tải bài viết.', retry: 'Thử lại', loading: 'Đang tải bài viết...',
  minutes: '{n} phút đọc', readMore: 'Đọc tiếp', readMoreOf: 'Đọc tiếp: {title}', moreTags: '+{n}', moreTagsLabel: 'và {n} thẻ khác',
  save: 'Lưu', saved: 'Đã lưu', saveLabel: 'Lưu bài viết', saveError: 'Không cập nhật được bài đã lưu. Hãy thử lại.',
  breadcrumb: 'Đường dẫn', articles: 'Bài viết', updated: 'Cập nhật {date}', copyLink: 'Sao chép liên kết', copied: 'Đã sao chép', copyFailed: 'Không sao chép được',
  summary: 'Tóm tắt', tags: 'Thẻ bài viết', aboutAuthor: 'Về tác giả', toc: 'Mục lục', related: 'Bài liên quan', viewAll: 'Xem tất cả {topic}',
  backToList: 'Về danh sách', backToTop: 'Về đầu trang', notFound: 'Bài viết không tồn tại hoặc đã bị ẩn', notFoundText: 'Bài có thể đã bị tác giả hoặc kiểm duyệt viên ẩn.',
  sidebar: 'Thông tin bài viết', cover: 'Ảnh bìa: {title}',
  copyCode: 'Sao chép mã', copyHeading: 'Sao chép liên kết tới mục {title}', table: 'Bảng nội dung', code: 'mã',
  author: 'Tác giả', quickActions: 'Hành động nhanh', allArticles: 'Tất cả bài viết', sameTopic: 'Bài cùng chủ đề {topic}', progress: 'Tiến độ đọc',
  publishedOn: 'Đăng {date}',
}
type ReaderCopy = typeof readerVi
const readerEn: ReaderCopy = {
  kicker: 'Article library', title: 'Articles', subtitle: 'Programming knowledge shared by TechVerse authors.', filters: 'Filters', count: '{n} articles',
  search: 'Search articles', searchPlaceholder: 'Search articles…', clearSearch: 'Clear keyword', submitSearch: 'Search', topics: 'Topics', allTopics: 'All', tag: 'Tag', allTags: 'All tags',
  sort: 'Sort', newest: 'Newest', oldest: 'Oldest', optionsError: 'Unable to load topics and tags.', list: 'Articles',
  emptyFiltered: 'No matching articles', emptyFilteredText: 'Try another keyword or filter.', empty: 'No articles yet', emptyText: 'Articles appear here once they are published.',
  clearFilters: 'Clear filters', loadError: 'Unable to load articles.', retry: 'Retry', loading: 'Loading articles...',
  minutes: '{n} min read', readMore: 'Read more', readMoreOf: 'Read more: {title}', moreTags: '+{n}', moreTagsLabel: 'and {n} more tags',
  save: 'Save', saved: 'Saved', saveLabel: 'Save article', saveError: 'Could not update your saved articles. Try again.',
  breadcrumb: 'Breadcrumb', articles: 'Articles', updated: 'Updated {date}', copyLink: 'Copy link', copied: 'Copied', copyFailed: 'Could not copy',
  summary: 'Summary', tags: 'Article tags', aboutAuthor: 'About the author', toc: 'Contents', related: 'Related articles', viewAll: 'All {topic} articles',
  backToList: 'Back to list', backToTop: 'Back to top', notFound: 'The article does not exist or is hidden', notFoundText: 'The author or a moderator may have hidden it.',
  sidebar: 'Article details', cover: 'Cover: {title}',
  copyCode: 'Copy code', copyHeading: 'Copy link to section {title}', table: 'Content table', code: 'code',
  author: 'Author', quickActions: 'Quick actions', allArticles: 'All articles', sameTopic: 'More in {topic}', progress: 'Reading progress',
  publishedOn: 'Published {date}',
}
export const readerCopy = { vi: readerVi, en: readerEn }
export type ReaderKey = keyof ReaderCopy

export function readerText(language: Language) {
  const copy = readerCopy[language]
  return (key: ReaderKey, values: Record<string, string | number> = {}) => copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}

/** Reader errors: a missing article means “does not exist or is hidden” (spec PUT saved/detail 404), the rest as in the author copy. */
export function readerErrorText(error: unknown, language: Language, fallback: string) {
  if (error instanceof ApiError && (error.code === 'ARTICLE_NOT_FOUND' || error.status === 404)) return { vi: 'Bài viết không tồn tại hoặc đã bị ẩn.', en: 'The article does not exist or is hidden.' }[language]
  if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') return { vi: 'Kiểm tra lại bộ lọc bài viết.', en: 'Check the article filters.' }[language]
  return articleErrorText(error, language, fallback)
}

/** “3 ngày trước” / “3 days ago”: the largest unit that fits, never in the future. */
export function relativeDate(value: string, language: Language, now = Date.now()) {
  const seconds = Math.max(0, (now - Date.parse(value)) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]
  const [unit, size] = units.find(([, size]) => seconds >= size) ?? ['minute', 60]
  return new Intl.RelativeTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { numeric: 'auto' }).format(-Math.floor(seconds / size), unit)
}
