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

/** Copy lookup with `{name}` placeholders. */
export function articleText(language: Language) {
  const copy = articleCopy[language]
  return (key: keyof ArticleCopy, values: Record<string, string | number> = {}) => copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}
