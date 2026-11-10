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
  kicker: 'Không gian tác giả', title: 'Khóa học của tôi', subtitle: 'Soạn khóa học miễn phí, gửi duyệt và quản lý bản đã công khai.', newCourse: 'Tạo khóa học',
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
}
export type CourseCopy = typeof vi

const en: CourseCopy = {
  kicker: 'Author workspace', title: 'My courses', subtitle: 'Write free courses, submit them for review and manage the published version.', newCourse: 'Create course',
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
