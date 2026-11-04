import { describe, expect, it } from 'vitest'
import { ApiError } from '../services/api/client'
import { articleCopy, articleErrorText, historyActionLabel, isStaleError, moderatorCopy, moderatorErrorText, moderatorPublicationLabel, publicationLabel, workflowLabel, readerCopy, readerErrorText, relativeDate } from './articleI18n'

const WORKFLOW = ['DRAFT', 'PENDING', 'PUBLISHED', 'CHANGES_REQUESTED']
const PUBLICATION = ['UNPUBLISHED', 'PUBLISHED', 'AUTHOR_HIDDEN', 'HIDDEN', 'AUTHOR_DELETED', 'REMOVED']
const HISTORY = ['APPROVE', 'REQUEST_CHANGES', 'HIDE', 'RESTORE', 'REMOVE', 'AUTHOR_HIDE', 'AUTHOR_UNHIDE', 'AUTHOR_DELETE']
// Every code Task 2a's Author API can return (spec “API và validation”).
const CODES = ['VALIDATION_ERROR', 'TOPIC_NOT_FOUND', 'TAG_NOT_FOUND', 'ARTICLE_ASSOCIATION_INACTIVE', 'ARTICLE_CONTENT_INVALID', 'ARTICLE_IMAGE_INVALID', 'ARTICLE_FILE_INVALID', 'ARTICLE_FILE_TOO_LARGE', 'ARTICLE_FILE_UNSUPPORTED', 'ARTICLE_KEY_CONFLICT', 'ARTICLE_REQUEST_IN_PROGRESS', 'ARTICLE_RATE_LIMITED', 'ARTICLE_IMAGE_UPLOAD_FAILED', 'ARTICLE_STORAGE_UNAVAILABLE', 'ARTICLE_NO_CHANGES', 'ARTICLE_NOT_EDITABLE', 'ARTICLE_NOT_WITHDRAWABLE', 'ARTICLE_NOT_DISCARDABLE', 'ARTICLE_PUBLICATION_TRANSITION_INVALID', 'ARTICLE_AUTHOR_UNHIDE_NOT_ALLOWED', 'ARTICLE_NOT_DELETABLE', 'ARTICLE_NOT_FOUND', 'ACCESS_DENIED']

describe('article labels', () => {
  it.each([[workflowLabel, WORKFLOW], [publicationLabel, PUBLICATION], [historyActionLabel, HISTORY]] as const)('cover every enum in vi and en', (labels, values) => {
    expect(Object.keys(labels).sort()).toEqual([...values].sort())
    for (const value of values) {
      const copy = (labels as Record<string, { vi: string; en: string }>)[value]
      expect(copy.vi.trim()).not.toBe('')
      expect(copy.en.trim()).not.toBe('')
      expect(copy.vi).not.toBe(value)
    }
  })

  it('has the same UI copy keys in both languages', () => {
    expect(Object.keys(articleCopy.en).sort()).toEqual(Object.keys(articleCopy.vi).sort())
  })
})

describe('articleErrorText', () => {
  it.each(CODES)('%s has its own vi/en copy, never the backend English message', code => {
    const error = new ApiError('Backend english message', 409, code)
    const vi = articleErrorText(error, 'vi', 'fallback')
    const en = articleErrorText(error, 'en', 'fallback')
    expect(vi).not.toBe('fallback')
    expect(en).not.toBe('fallback')
    expect(vi).not.toBe(en)
    expect(vi).not.toContain('Backend')
  })

  it('uses the spec copy for key Author errors', () => {
    expect(articleErrorText(new ApiError('x', 409, 'ARTICLE_NO_CHANGES'), 'vi', '')).toBe('Chưa có thay đổi để gửi duyệt.')
    expect(articleErrorText(new ApiError('x', 409, 'ARTICLE_AUTHOR_UNHIDE_NOT_ALLOWED'), 'en', '')).toBe('A moderator hid this article, so you cannot unhide it.')
    expect(articleErrorText(new ApiError('x', 429, 'ARTICLE_RATE_LIMITED'), 'vi', '')).toBe('Thao tác quá nhanh, hãy thử lại sau.')
  })

  it('falls back to a generic system message for 5xx/unknown codes and to the caller text for non-API errors', () => {
    expect(articleErrorText(new ApiError('boom', 500, 'SOMETHING_NEW'), 'vi', 'f')).toBe('Hệ thống tạm thời gián đoạn. Vui lòng thử lại sau.')
    expect(articleErrorText(new TypeError('Failed to fetch'), 'en', 'Could not load')).toBe('Could not load')
  })
})

// Codes the Moderator review/publication API returns (spec “API và validation”, Task 2b).
const MODERATOR_CODES = ['ARTICLE_NOT_PENDING', 'ARTICLE_REVIEW_STALE', 'ARTICLE_REVIEW_NOTE_REQUIRED', 'ARTICLE_SELF_REVIEW_NOT_ALLOWED', 'ARTICLE_AUTHOR_INELIGIBLE', 'ARTICLE_PUBLICATION_TRANSITION_INVALID', 'ARTICLE_PUBLICATION_NOTE_REQUIRED', 'ARTICLE_IMAGE_INVALID', 'ARTICLE_ASSOCIATION_INACTIVE', 'ARTICLE_NOT_FOUND', 'ACCESS_DENIED', 'VALIDATION_ERROR']

describe('moderator copy', () => {
  it.each(MODERATOR_CODES)('%s has moderator vi/en copy', code => {
    const error = new ApiError('Backend english message', 409, code)
    const vi = moderatorErrorText(error, 'vi', 'fallback')
    const en = moderatorErrorText(error, 'en', 'fallback')
    expect([vi, en]).not.toContain('fallback')
    expect(vi).not.toBe(en)
  })

  it('uses the moderator wording where it differs from the Author one', () => {
    expect(moderatorErrorText(new ApiError('x', 409, 'ARTICLE_PUBLICATION_TRANSITION_INVALID'), 'vi', '')).toBe('Trạng thái xuất bản đã thay đổi, hãy tải lại.')
    expect(moderatorErrorText(new ApiError('x', 400, 'ARTICLE_PUBLICATION_NOTE_REQUIRED'), 'en', '')).toBe('A reason is required to hide or remove an article.')
    expect(moderatorErrorText(new ApiError('x', 500), 'vi', 'f')).toBe('Hệ thống tạm thời gián đoạn. Vui lòng thử lại sau.')
  })

  it('treats a changed article as stale (reload instead of retry)', () => {
    expect(['ARTICLE_REVIEW_STALE', 'ARTICLE_PUBLICATION_TRANSITION_INVALID', 'ARTICLE_NOT_PENDING'].map(code => isStaleError(new ApiError('x', 409, code)))).toEqual([true, true, true])
    expect(isStaleError(new ApiError('x', 403, 'ARTICLE_SELF_REVIEW_NOT_ALLOWED'))).toBe(false)
  })

  it('labels every status from the moderator point of view in both languages', () => {
    expect(Object.keys(moderatorCopy.en).sort()).toEqual(Object.keys(moderatorCopy.vi).sort())
    expect(Object.keys(moderatorPublicationLabel).sort()).toEqual([...PUBLICATION].sort())
    expect(moderatorPublicationLabel.AUTHOR_HIDDEN.vi).toBe('Tác giả tự ẩn')
  })
})

describe('reader copy', () => {
  it('has the same keys in vi/en and says “does not exist or is hidden” for a missing article', () => {
    expect(Object.keys(readerCopy.en).sort()).toEqual(Object.keys(readerCopy.vi).sort())
    expect(readerErrorText(new ApiError('Not found', 404, 'ARTICLE_NOT_FOUND'), 'vi', 'f')).toBe('Bài viết không tồn tại hoặc đã bị ẩn.')
    expect(readerErrorText(new ApiError('Not found', 404, 'ARTICLE_NOT_FOUND'), 'en', 'f')).toBe('The article does not exist or is hidden.')
    expect(readerErrorText(new ApiError('Bad', 400, 'VALIDATION_ERROR'), 'vi', 'f')).toBe('Kiểm tra lại bộ lọc bài viết.')
    expect(readerErrorText(new ApiError('Boom', 503), 'en', 'f')).toBe('The service is temporarily unavailable. Please try again later.')
  })

  it('formats relative dates with the largest fitting unit and never in the future', () => {
    const now = Date.parse('2026-11-04T10:00:00Z')
    expect(relativeDate('2026-11-01T10:00:00Z', 'vi', now)).toBe('3 ngày trước')
    expect(relativeDate('2026-11-04T07:00:00Z', 'en', now)).toBe('3 hours ago')
    expect(relativeDate('2026-11-05T10:00:00Z', 'en', now)).toBe('this minute')
  })
})
