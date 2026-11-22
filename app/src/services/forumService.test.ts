import { expect, it } from 'vitest'
import {
  answerActions,
  forumFilter,
  forumSearch,
  moderatorReportsFilter,
  moderatorReportsSearch,
  questionActions,
  validateAnswerContent,
  validateModerationNote,
  validateQuestionForm,
  validateReportInput,
} from './forumService'
import type { ForumPostViewer, ForumQuestionForm, ForumQuestionViewer } from '../types/forum'

const long = (n: number) => 'a'.repeat(n)
const validQuestion = (over: Partial<ForumQuestionForm> = {}): ForumQuestionForm => ({
  title: 'Làm sao tránh N+1 query trong Spring Data JPA?',
  topicId: '11111111-1111-1111-1111-111111111111',
  content: 'Khi truy vấn danh sách thực thể có quan hệ @OneToMany, làm sao tối ưu bằng @EntityGraph hoặc JOIN FETCH?',
  ...over,
})

it('validates question title (10..150), topicId, and content (20..10000) at exact backend boundaries', () => {
  expect(validateQuestionForm(validQuestion())).toEqual({})
  expect(validateQuestionForm(validQuestion({ title: `  ${long(9)}  ` })).title).toBe('titleLength')
  expect(validateQuestionForm(validQuestion({ title: long(10) })).title).toBeUndefined()
  expect(validateQuestionForm(validQuestion({ title: long(150) })).title).toBeUndefined()
  expect(validateQuestionForm(validQuestion({ title: long(151) })).title).toBe('titleLength')
  expect(validateQuestionForm(validQuestion({ topicId: '   ' })).topicId).toBe('topicRequired')
  expect(validateQuestionForm(validQuestion({ content: `  ${long(19)}  ` })).content).toBe('questionContentLength')
  expect(validateQuestionForm(validQuestion({ content: long(20) })).content).toBeUndefined()
  expect(validateQuestionForm(validQuestion({ content: long(10000) })).content).toBeUndefined()
  expect(validateQuestionForm(validQuestion({ content: long(10001) })).content).toBe('questionContentLength')
})

it('validates answer content bounds (10..10000 after trim)', () => {
  expect(validateAnswerContent(`  ${long(9)}  `)).toBe('answerContentLength')
  expect(validateAnswerContent(long(10))).toBeNull()
  expect(validateAnswerContent(long(10000))).toBeNull()
  expect(validateAnswerContent(long(10001))).toBe('answerContentLength')
})

it('only checks NUL and length on client, letting backend decide Markdown images/HTML (including ```, ~~~, and 4-space code blocks)', () => {
  expect(
    validateQuestionForm(
      validQuestion({
        content: 'Ví dụ ảnh trong ```:\n```md\n![alt](https://a.b/c.png)\n```\nvà đủ 20 ký tự.',
      }),
    ),
  ).toEqual({})
  expect(
    validateQuestionForm(
      validQuestion({
        content: 'Ví dụ ảnh trong ~~~:\n~~~\n![alt](https://a.b/c.png)\n~~~\nvà đủ 20 ký tự.',
      }),
    ),
  ).toEqual({})
  expect(
    validateQuestionForm(
      validQuestion({
        content: 'Ví dụ code thụt 4 dấu cách:\n\n    ![alt](https://a.b/c.png)\n    <div>HTML</div>\n\nhợp lệ.',
      }),
    ),
  ).toEqual({})
  expect(validateQuestionForm(validQuestion({ content: `Nội dung có ký tự NUL\0bên trong chuỗi dài.` })).content).toBe('contentInvalid')
  expect(validateAnswerContent('    ![x](https://a.b/x.png) và <div>trong code</div>')).toBeNull()
  expect(validateAnswerContent('Trả lời có ký tự\0NUL không hợp lệ')).toBe('contentInvalid')
})

it('validates report reason and description (OTHER requires 10..1000 chars, others optional <= 1000)', () => {
  expect(validateReportInput('', '')).toEqual({ reason: 'reasonRequired' })
  expect(validateReportInput('SPAM', '')).toEqual({})
  expect(validateReportInput('SPAM', long(1000))).toEqual({})
  expect(validateReportInput('SPAM', long(1001)).description).toBe('descriptionLength')
  expect(validateReportInput('OTHER', 'ngắn 9 kt').description).toBe('descriptionLength')
  expect(validateReportInput('OTHER', 'Mô tả đầy đủ trên 10 ký tự')).toEqual({})
  expect(validateReportInput('OTHER', `Hợp lệ nhưng có\0NUL`).description).toBe('descriptionLength')
})

it('validates moderation note according to action requirement (1..1000 when required, <= 1000 when optional)', () => {
  expect(validateModerationNote(true, '   ')).toBe('noteRequired')
  expect(validateModerationNote(true, 'Vi phạm quy tắc cộng đồng')).toBeNull()
  expect(validateModerationNote(true, long(1001))).toBe('noteRequired')
  expect(validateModerationNote(false, '')).toBeNull()
  expect(validateModerationNote(false, long(1000))).toBeNull()
  expect(validateModerationNote(false, long(1001))).toBe('noteRequired')
})

it('determines visible buttons purely from viewer.* flags and Moderator status', () => {
  const allFalseQ: ForumQuestionViewer = {
    canEdit: false,
    canDelete: false,
    canReport: false,
    canAccept: false,
    canAnswer: false,
    canReact: false,
  }
  expect(questionActions(allFalseQ)).toEqual({
    canEdit: false,
    canDelete: false,
    canReport: false,
    canAccept: false,
    canAnswer: false,
    canReact: false,
    canHide: false,
  })

  const ownerQ: ForumQuestionViewer = {
    canEdit: true,
    canDelete: true,
    canReport: false,
    canAccept: true,
    canAnswer: true,
    canReact: true,
  }
  expect(questionActions(ownerQ, { isModerator: false })).toEqual({
    canEdit: true,
    canDelete: true,
    canReport: false,
    canAccept: true,
    canAnswer: true,
    canReact: true,
    canHide: false,
  })
  // Deleted question disables question-level actions even if flags or moderator role are passed
  expect(questionActions(ownerQ, { deleted: true, isModerator: true })).toEqual({
    canEdit: false,
    canDelete: false,
    canReport: false,
    canAccept: false,
    canAnswer: false,
    canReact: false,
    canHide: false,
  })

  const answerV: ForumPostViewer = { canEdit: false, canDelete: false, canReport: true, canReact: true }
  expect(answerActions(answerV, { canAccept: true }, { isModerator: true })).toEqual({
    canEdit: false,
    canDelete: false,
    canReport: true,
    canReact: true,
    canAccept: true,
    canHide: true,
  })
  expect(answerActions(answerV, { canAccept: true }, { questionDeleted: true, isModerator: false })).toEqual({
    canEdit: false,
    canDelete: false,
    canReport: true,
    canReact: true,
    canAccept: false,
    canHide: false,
  })
})

it('parses and serializes /forum and /moderator/reports URL search params', () => {
  const qParams = new URLSearchParams('topicId=t1&keyword= spring &solved=true&mine=true&page=2')
  expect(forumFilter(qParams, true)).toEqual({ topicId: 't1', keyword: 'spring', solved: 'true', mine: true, page: 2 })
  expect(forumFilter(qParams, false)).toEqual({ topicId: 't1', keyword: 'spring', solved: 'true', mine: false, page: 2 })
  expect(forumSearch({ topicId: '', keyword: '', solved: '', mine: false, page: 0 }, true).toString()).toBe('')
  expect(forumSearch({ topicId: 't1', keyword: 'jpa', solved: 'false', mine: true, page: 1 }, true).toString()).toBe(
    'keyword=jpa&topicId=t1&solved=false&mine=true&page=1',
  )

  expect(moderatorReportsFilter(new URLSearchParams(''))).toEqual({ tab: 'open', status: 'ACTIONED', reason: '', page: 0 })
  expect(moderatorReportsFilter(new URLSearchParams('tab=handled&status=DISMISSED&reason=SPAM&page=1'))).toEqual({
    tab: 'handled',
    status: 'DISMISSED',
    reason: 'SPAM',
    page: 1,
  })
  expect(moderatorReportsSearch({ tab: 'open', status: 'ACTIONED', reason: '', page: 0 }).toString()).toBe('')
  expect(moderatorReportsSearch({ tab: 'hidden', status: 'ACTIONED', reason: 'SPAM', page: 2 }).toString()).toBe('tab=hidden&page=2')
})
