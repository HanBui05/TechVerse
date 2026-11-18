import { ApiError } from '../services/api/client'
import { aiErrorText } from './aiAssistI18n'
import type { ExerciseDifficulty, ExerciseStatus, ExerciseType } from '../types/exercises'
import type { Language } from '../types/preferences'

type Copy = { vi: string; en: string }
const unavailable: Copy = { vi: 'Dịch vụ đang gián đoạn. Hãy thử lại.', en: 'The service is temporarily unavailable. Try again.' }
const badState: Copy = { vi: 'Không thực hiện được ở trạng thái hiện tại.', en: 'This cannot be done in the current state.' }
const tooFast: Copy = { vi: 'Bạn thao tác quá nhanh, hãy thử lại sau.', en: 'You are going too fast; try again shortly.' }
const signIn: Copy = { vi: 'Đăng nhập để tiếp tục.', en: 'Sign in to continue.' }

/** Every code of the 1a + 1c tables; the backend message is English, so the UI translates by code. AI_* codes use the AI table. */
export const EXERCISE_ERRORS: Record<string, Copy> = {
  VALIDATION_ERROR: { vi: 'Kiểm tra lại thông tin đã nhập.', en: 'Check the information you entered.' },
  MALFORMED_REQUEST: { vi: 'Yêu cầu không đúng định dạng.', en: 'The request format is invalid.' },
  EXERCISE_TOPIC_INACTIVE: { vi: 'Chủ đề đã ngừng hoạt động.', en: 'The topic is no longer active.' },
  EXERCISE_QUESTIONS_INVALID: { vi: 'Mỗi bộ tối đa 50 câu.', en: 'A set holds at most 50 questions.' },
  EXERCISE_CONTENT_INVALID: { vi: 'Nội dung chứa định dạng không được hỗ trợ.', en: 'The content uses unsupported formatting.' },
  AUTH_ACCESS_TOKEN_REQUIRED: signIn,
  AUTH_INVALID_ACCESS_TOKEN: signIn,
  ACCESS_DENIED: { vi: 'Bạn không có quyền.', en: 'You do not have permission.' },
  EXERCISE_SET_NOT_FOUND: { vi: 'Không tìm thấy bộ bài tập.', en: 'Exercise set not found.' },
  EXERCISE_NOT_EDITABLE: { vi: 'Bộ bài tập đang ở trạng thái không sửa được.', en: 'This set is in a state that cannot be edited.' },
  EXERCISE_NOT_READY: { vi: 'Bộ bài tập chưa đủ điều kiện gửi duyệt.', en: 'This set is not ready to be submitted.' },
  EXERCISE_STATE_INVALID: badState,
  EXERCISE_NOT_DELETABLE: { vi: 'Không xóa được bộ đã công khai hoặc đang chờ duyệt.', en: 'A published or pending set cannot be deleted.' },
  EXERCISE_VERSION_CONFLICT: { vi: 'Bộ bài tập đã được sửa ở nơi khác. Hãy tải lại trước khi lưu.', en: 'This set was changed elsewhere. Reload it before saving.' },
  EXERCISE_RATE_LIMITED: tooFast,
  EXERCISE_STORAGE_UNAVAILABLE: unavailable,
}

export const isExerciseConflict = (error: unknown) => error instanceof ApiError && error.code === 'EXERCISE_VERSION_CONFLICT'

/** `code × language`; AI_* codes reuse the AI table, unknown 5xx get the generic message, anything else the fallback. */
export function exerciseErrorText(error: unknown, language: Language, fallback: string) {
  if (!(error instanceof ApiError)) return fallback
  const code = error.code ?? ''
  if (code.startsWith('AI_')) return aiErrorText(error, language)
  const copy = EXERCISE_ERRORS[code] ?? (error.status === 403 ? EXERCISE_ERRORS.ACCESS_DENIED : error.status >= 500 ? unavailable : null)
  return copy ? copy[language] : fallback
}

export const typeLabel: Record<ExerciseType, Copy> = { MULTIPLE_CHOICE: { vi: 'Trắc nghiệm', en: 'Multiple choice' }, FLASHCARD: { vi: 'Flashcard', en: 'Flashcards' } }
export const difficultyLabel: Record<ExerciseDifficulty, Copy> = { EASY: { vi: 'Dễ', en: 'Easy' }, MEDIUM: { vi: 'Vừa', en: 'Medium' }, HARD: { vi: 'Khó', en: 'Hard' } }
export const statusLabel: Record<ExerciseStatus, Copy> = {
  DRAFT: { vi: 'Bản nháp', en: 'Draft' }, PENDING: { vi: 'Chờ duyệt', en: 'Pending' }, PUBLISHED: { vi: 'Đang công khai', en: 'Published' },
  CHANGES_REQUESTED: { vi: 'Cần sửa', en: 'Changes requested' }, AUTHOR_HIDDEN: { vi: 'Đã ẩn', en: 'Hidden' },
  HIDDEN: { vi: 'Bị ẩn bởi kiểm duyệt', en: 'Hidden by moderator' }, REMOVED: { vi: 'Đã gỡ', en: 'Removed' },
}

const vi = {
  // List
  title: 'Bài tập của tôi', newSet: 'Tạo bộ bài tập', status: 'Trạng thái', type: 'Loại', difficulty: 'Độ khó', all: 'Tất cả', search: 'Tìm theo tiêu đề', searchPlaceholder: 'Tìm theo tiêu đề…',
  questions: '{n} câu', cards: '{n} thẻ', updated: 'Cập nhật {date}', aiUsed: 'Có dùng AI', moderatorNote: 'Ghi chú của Moderator', loading: 'Đang tải…', loadError: 'Dịch vụ đang gián đoạn. Hãy thử lại.', retry: 'Thử lại',
  emptyTitle: 'Bạn chưa có bộ bài tập nào.', noMatch: 'Không có bộ nào khớp bộ lọc.', clearFilters: 'Xóa lọc', list: 'Danh sách bộ bài tập',
  edit: 'Sửa', view: 'Xem', copy: 'Tạo bản sao', delete: 'Xóa', withdraw: 'Rút lại', hide: 'Ẩn', unhide: 'Hiện lại', done: 'Đã cập nhật.', copied: 'Đã tạo bản sao.', deleted: 'Đã xóa bộ bài tập.',
  deleteTitle: 'Xóa bộ bài tập này? Không thể hoàn tác.', withdrawTitle: 'Rút bộ bài tập về bản nháp?', cancel: 'Hủy', close: 'Đóng',
  // Editor
  back: 'Bài tập của tôi', info: 'Thông tin', titleField: 'Tiêu đề', description: 'Mô tả', topic: 'Chủ đề', chooseTopic: 'Chọn chủ đề', typeField: 'Loại', typeLocked: 'Không đổi được sau khi tạo.',
  create: 'Tạo', save: 'Lưu', saving: 'Đang lưu…', unsaved: 'Chưa lưu', submit: 'Gửi duyệt', submitTitle: 'Gửi bộ bài tập này để Moderator duyệt?', submitText: 'Bộ sẽ chờ duyệt và không sửa được cho tới khi Moderator phản hồi.',
  preview: 'Xem trước', notReady: 'Cần ít nhất 3 câu trắc nghiệm (hoặc 5 thẻ) để gửi duyệt.', readOnly: 'Bộ đã công khai không sửa được. Hãy tạo bản sao để chỉnh sửa.', readOnlyPending: 'Bộ bài tập đang ở trạng thái không sửa được.',
  changesRequested: 'Moderator yêu cầu sửa', questionsHeading: 'Câu hỏi', cardsHeading: 'Thẻ', addQuestion: 'Thêm câu hỏi', addCard: 'Thêm thẻ', moveUp: 'Chuyển lên', moveDown: 'Chuyển xuống', removeQuestion: 'Xóa',
  question: 'Câu {n}', card: 'Thẻ {n}', questionInvalid: 'Câu {n}: thông tin chưa hợp lệ.', cardInvalid: 'Thẻ {n}: thông tin chưa hợp lệ.', fixQuestions: 'Hãy sửa các câu chưa hợp lệ trước khi lưu.', tooMany: 'Mỗi bộ tối đa 50 câu.',
  notFound: 'Không tìm thấy bộ bài tập.', toList: 'Về danh sách', conflictTitle: 'Bộ bài tập đã được sửa ở nơi khác. Hãy tải lại trước khi lưu.', reload: 'Tải lại', leave: 'Bạn có thay đổi chưa lưu. Rời trang?', stay: 'Ở lại', leaveNow: 'Rời trang',
  saved: 'Đã lưu.', created: 'Đã tạo bộ bài tập. Hãy thêm câu hỏi.', submitted: 'Đã gửi duyệt.',
  // Question dialog
  content: 'Nội dung', addCode: 'Thêm đoạn code', codeLanguage: 'Ngôn ngữ', codeSnippet: 'Mã nguồn', options: 'Lựa chọn', option: 'Lựa chọn {n}', correct: 'Đáp án đúng', addOption: 'Thêm lựa chọn', removeOption: 'Xóa lựa chọn {n}',
  explanation: 'Giải thích', optional: 'tùy chọn', faceFront: 'Mặt trước', faceBack: 'Mặt sau', finish: 'Xong', questionDialog: 'Soạn câu hỏi', showAnswer: 'Đáp án đúng',
  // Validation
  titleLength: 'Tiêu đề từ 5 đến 255 ký tự.', descriptionLength: 'Mô tả tối đa 2.000 ký tự.', topicRequired: 'Hãy chọn chủ đề.', difficultyRequired: 'Hãy chọn độ khó.',
  required: 'Không được để trống.', tooLong: 'Nội dung quá dài.', optionCount: 'Cần từ 2 đến 6 lựa chọn.', optionDuplicate: 'Lựa chọn bị trùng.', correctRequired: 'Hãy chọn đáp án đúng.', languageRequired: 'Hãy nhập ngôn ngữ của đoạn code.', contentInvalid: 'Nội dung chứa định dạng không được hỗ trợ.',
  // AI
  ai: 'Tạo câu hỏi bằng AI', aiHint: 'AI có thể sai. Hãy kiểm tra trước khi dùng. Kết quả chưa được lưu vào bộ.', instruction: 'Yêu cầu', source: 'Nội dung nguồn (dán vào)', count: 'Số câu', generate: 'Tạo câu hỏi', generating: 'Đang tạo…',
  quotaLeft: 'Còn {remaining}/{limit} lượt hôm nay', quotaOut: 'Bạn đã dùng hết lượt AI hôm nay.', instructionLength: 'Yêu cầu tối đa 500 ký tự.', sourceLength: 'Nội dung nguồn tối đa 8.000 ký tự.', countRange: 'Số câu từ 1 đến 10.',
  aiResult: 'AI tạo được {n}/{count} câu. Hãy kiểm tra trước khi dùng.', suggestion: 'Câu đề xuất {n}', pick: 'Chọn {title}', selectAll: 'Chọn tất cả', clearAll: 'Bỏ chọn', addSelected: 'Thêm câu đã chọn', editSuggestion: 'Xem/Sửa', added: 'Đã thêm {n} câu vào danh sách đang soạn. Hãy bấm Lưu.',
}
export type ExerciseCopy = typeof vi
const en: ExerciseCopy = {
  title: 'My exercises', newSet: 'New exercise set', status: 'Status', type: 'Type', difficulty: 'Difficulty', all: 'All', search: 'Search by title', searchPlaceholder: 'Search by title…',
  questions: '{n} questions', cards: '{n} cards', updated: 'Updated {date}', aiUsed: 'AI-assisted', moderatorNote: 'Moderator note', loading: 'Loading…', loadError: 'The service is temporarily unavailable. Try again.', retry: 'Retry',
  emptyTitle: 'You have no exercise sets yet.', noMatch: 'No sets match the filters.', clearFilters: 'Clear filters', list: 'Exercise sets',
  edit: 'Edit', view: 'View', copy: 'Duplicate', delete: 'Delete', withdraw: 'Withdraw', hide: 'Hide', unhide: 'Unhide', done: 'Updated.', copied: 'Copy created.', deleted: 'Exercise set deleted.',
  deleteTitle: 'Delete this exercise set? This cannot be undone.', withdrawTitle: 'Withdraw this set back to draft?', cancel: 'Cancel', close: 'Close',
  back: 'My exercises', info: 'Details', titleField: 'Title', description: 'Description', topic: 'Topic', chooseTopic: 'Choose a topic', typeField: 'Type', typeLocked: 'Cannot be changed after creation.',
  create: 'Create', save: 'Save', saving: 'Saving…', unsaved: 'Unsaved', submit: 'Submit', submitTitle: 'Submit this set for moderator review?', submitText: 'It will wait for review and cannot be edited until the moderator responds.',
  preview: 'Preview', notReady: 'At least 3 questions (or 5 cards) are needed to submit.', readOnly: 'Published sets cannot be edited. Duplicate to make changes.', readOnlyPending: 'This set is in a state that cannot be edited.',
  changesRequested: 'The moderator asked for changes', questionsHeading: 'Questions', cardsHeading: 'Cards', addQuestion: 'Add question', addCard: 'Add card', moveUp: 'Move up', moveDown: 'Move down', removeQuestion: 'Delete',
  question: 'Question {n}', card: 'Card {n}', questionInvalid: 'Question {n}: the information is not valid yet.', cardInvalid: 'Card {n}: the information is not valid yet.', fixQuestions: 'Fix the invalid questions before saving.', tooMany: 'A set holds at most 50 questions.',
  notFound: 'Exercise set not found.', toList: 'Back to the list', conflictTitle: 'This set was changed elsewhere. Reload it before saving.', reload: 'Reload', leave: 'You have unsaved changes. Leave?', stay: 'Stay', leaveNow: 'Leave',
  saved: 'Saved.', created: 'Exercise set created. Add some questions.', submitted: 'Submitted for review.',
  content: 'Content', addCode: 'Add a code snippet', codeLanguage: 'Language', codeSnippet: 'Source code', options: 'Choices', option: 'Choice {n}', correct: 'Correct answer', addOption: 'Add choice', removeOption: 'Remove choice {n}',
  explanation: 'Explanation', optional: 'optional', faceFront: 'Front', faceBack: 'Back', finish: 'Done', questionDialog: 'Edit question', showAnswer: 'Correct answer',
  titleLength: 'The title must be 5–255 characters.', descriptionLength: 'The description is at most 2,000 characters.', topicRequired: 'Choose a topic.', difficultyRequired: 'Choose a difficulty.',
  required: 'This field is required.', tooLong: 'This is too long.', optionCount: 'Use 2 to 6 choices.', optionDuplicate: 'This choice is a duplicate.', correctRequired: 'Pick the correct answer.', languageRequired: 'Enter the language of the snippet.', contentInvalid: 'The content uses unsupported formatting.',
  ai: 'Generate with AI', aiHint: 'AI can be wrong. Review before using. Results are not saved to the set.', instruction: 'Request', source: 'Source text (paste)', count: 'Questions', generate: 'Generate', generating: 'Generating…',
  quotaLeft: '{remaining}/{limit} left today', quotaOut: 'You have used today’s AI allowance.', instructionLength: 'The request is at most 500 characters.', sourceLength: 'The source text is at most 8,000 characters.', countRange: 'Choose 1 to 10 questions.',
  aiResult: 'AI produced {n}/{count} questions. Review before using.', suggestion: 'Suggestion {n}', pick: 'Select {title}', selectAll: 'Select all', clearAll: 'Clear', addSelected: 'Add selected', editSuggestion: 'View/Edit', added: 'Added {n} to the list you are editing. Press Save.',
}

export function exerciseText(language: Language) {
  const copy = language === 'vi' ? vi : en
  return (key: keyof ExerciseCopy, values: Record<string, string | number> = {}) => copy[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}
