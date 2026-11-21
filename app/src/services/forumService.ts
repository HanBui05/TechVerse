import { ApiError, request } from './api/client'
import { REPORT_REASONS } from '../data/forumI18n'
import type { ArticleOption, Page } from '../types/articles'
import type {
  ForumAnswer,
  ForumListFilter,
  ForumPostViewer,
  ForumQuestionDetail,
  ForumQuestionForm,
  ForumQuestionSummary,
  ForumQuestionViewer,
  ForumReactions,
  ForumReactionType,
  ForumReactor,
  ModeratedForumPost,
  ModeratorReportItem,
  ModeratorReportsFilter,
  ModeratorReportsTab,
  ModeratorVisibilityAction,
  ReportCreated,
  ReportReason,
  ReportResolveAction,
  ReportStatus,
} from '../types/forum'

const FORUM_BASE = '/api/v1/forum'
const REPORTS_BASE = '/api/v1/reports'
const MOD_REPORTS_BASE = '/api/v1/moderator/reports'
const MOD_FORUM_BASE = '/api/v1/moderator/forum/posts'

const REASONS = new Set<string>(REPORT_REASONS)
const STALE_OR_MISSING_CODES = new Set([
  'FORUM_POST_NOT_FOUND',
  'REPORT_TARGET_NOT_FOUND',
  'FORUM_QUESTION_CLOSED',
  'FORUM_ANSWER_INVALID',
  'FORUM_STATE_INVALID',
])

const clean = (v?: string | null) => v?.trim() ?? ''

export function isForumMarkdownInvalid(value?: string | null): boolean {
  return Boolean(value && value.includes('\0'))
}

export function shouldReloadForumDetail(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 404 || (Boolean(error.code) && STALE_OR_MISSING_CODES.has(error.code!)))
  )
}

export type QuestionFormErrorKey = 'titleLength' | 'topicRequired' | 'questionContentLength' | 'contentInvalid'

export function validateQuestionForm(form: ForumQuestionForm): Partial<Record<keyof ForumQuestionForm, QuestionFormErrorKey>> {
  const errors: Partial<Record<keyof ForumQuestionForm, QuestionFormErrorKey>> = {}
  const title = clean(form.title)
  if (form.title.includes('\0') || title.length < 10 || title.length > 150) {
    errors.title = 'titleLength'
  }
  if (!clean(form.topicId)) {
    errors.topicId = 'topicRequired'
  }
  const content = clean(form.content)
  if (isForumMarkdownInvalid(form.content)) {
    errors.content = 'contentInvalid'
  } else if (content.length < 20 || content.length > 10000) {
    errors.content = 'questionContentLength'
  }
  return errors
}

export type AnswerErrorKey = 'answerContentLength' | 'contentInvalid'

export function validateAnswerContent(content: string): AnswerErrorKey | null {
  if (isForumMarkdownInvalid(content)) return 'contentInvalid'
  const trimmed = clean(content)
  if (trimmed.length < 10 || trimmed.length > 10000) return 'answerContentLength'
  return null
}

export type ReportFormErrorKey = 'reasonRequired' | 'descriptionLength'

export function validateReportInput(
  reason: string,
  description: string,
): Partial<Record<'reason' | 'description', ReportFormErrorKey>> {
  const errors: Partial<Record<'reason' | 'description', ReportFormErrorKey>> = {}
  if (!REASONS.has(reason)) {
    errors.reason = 'reasonRequired'
  }
  const desc = clean(description)
  if (description.includes('\0') || desc.length > 1000 || (reason === 'OTHER' && desc.length < 10)) {
    errors.description = 'descriptionLength'
  }
  return errors
}

export function validateModerationNote(required: boolean, note: string): 'noteRequired' | null {
  if (note.includes('\0')) return 'noteRequired'
  const trimmed = clean(note)
  if (trimmed.length > 1000) return 'noteRequired'
  if (required && trimmed.length === 0) return 'noteRequired'
  return null
}

/**
 * Pure mapping of server `viewer.*` flags to visible controls on a question (Rule 5: never infer ownership/permissions from role,
 * except Moderator's direct Hide button on visible posts).
 */
export function questionActions(
  viewer: ForumQuestionViewer,
  options: { deleted?: boolean; isModerator?: boolean } = {},
) {
  const deleted = Boolean(options.deleted)
  return {
    canEdit: !deleted && Boolean(viewer.canEdit),
    canDelete: !deleted && Boolean(viewer.canDelete),
    canReport: !deleted && Boolean(viewer.canReport),
    canAccept: !deleted && Boolean(viewer.canAccept),
    canAnswer: !deleted && Boolean(viewer.canAnswer),
    canReact: !deleted && Boolean(viewer.canReact),
    canHide: !deleted && Boolean(options.isModerator),
  }
}

/** Pure mapping of server `viewer.*` flags to visible controls on an answer. */
export function answerActions(
  viewer: ForumPostViewer,
  questionViewer: Pick<ForumQuestionViewer, 'canAccept'>,
  options: { questionDeleted?: boolean; isModerator?: boolean } = {},
) {
  const questionDeleted = Boolean(options.questionDeleted)
  return {
    canEdit: Boolean(viewer.canEdit),
    canDelete: Boolean(viewer.canDelete),
    canReport: Boolean(viewer.canReport),
    canReact: Boolean(viewer.canReact),
    canAccept: !questionDeleted && Boolean(questionViewer.canAccept),
    canHide: Boolean(options.isModerator),
  }
}

export function forumFilter(search: URLSearchParams, authenticated = true): ForumListFilter {
  const solved = search.get('solved')
  const page = Number.parseInt(search.get('page') ?? '0', 10)
  return {
    topicId: clean(search.get('topicId')),
    keyword: clean(search.get('keyword')),
    solved: solved === 'true' || solved === 'false' ? solved : '',
    mine: authenticated && search.get('mine') === 'true',
    page: Number.isFinite(page) && page > 0 ? page : 0,
  }
}

export function forumSearch(filter: ForumListFilter, authenticated = true): URLSearchParams {
  const params = new URLSearchParams()
  if (clean(filter.keyword)) params.set('keyword', clean(filter.keyword))
  if (clean(filter.topicId)) params.set('topicId', clean(filter.topicId))
  if (filter.solved === 'true' || filter.solved === 'false') params.set('solved', filter.solved)
  if (authenticated && filter.mine) params.set('mine', 'true')
  if (filter.page > 0) params.set('page', String(filter.page))
  return params
}

export function moderatorReportsFilter(search: URLSearchParams): ModeratorReportsFilter {
  const rawTab = search.get('tab')
  const tab: ModeratorReportsTab = rawTab === 'handled' || rawTab === 'hidden' ? rawTab : 'open'
  const rawStatus = search.get('status')
  const status: 'ACTIONED' | 'DISMISSED' = rawStatus === 'DISMISSED' ? 'DISMISSED' : 'ACTIONED'
  const rawReason = search.get('reason') ?? ''
  const reason: ReportReason | '' = REASONS.has(rawReason) ? (rawReason as ReportReason) : ''
  const page = Number.parseInt(search.get('page') ?? '0', 10)
  return {
    tab,
    status,
    reason,
    page: Number.isFinite(page) && page > 0 ? page : 0,
  }
}

export function moderatorReportsSearch(filter: ModeratorReportsFilter): URLSearchParams {
  const params = new URLSearchParams()
  if (filter.tab !== 'open') params.set('tab', filter.tab)
  if (filter.tab === 'handled' && filter.status === 'DISMISSED') params.set('status', 'DISMISSED')
  if (filter.tab !== 'hidden' && filter.reason) params.set('reason', filter.reason)
  if (filter.page > 0) params.set('page', String(filter.page))
  return params
}

function query(params: Record<string, string | number | boolean | undefined>) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue
    q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const forumService = {
  options: () => request<ArticleOption[]>(`${FORUM_BASE}/options`),
  listQuestions: (filter: Partial<ForumListFilter> & { size?: number } = {}) =>
    request<Page<ForumQuestionSummary>>(
      `${FORUM_BASE}/questions${query({
        topicId: clean(filter.topicId) || undefined,
        keyword: clean(filter.keyword) || undefined,
        solved: filter.solved === 'true' ? true : filter.solved === 'false' ? false : undefined,
        mine: filter.mine ? true : undefined,
        page: filter.page ?? 0,
        size: filter.size ?? 20,
      })}`,
    ),
  questionDetail: (id: string) => request<ForumQuestionDetail>(`${FORUM_BASE}/questions/${id}`),
  createQuestion: (form: ForumQuestionForm) =>
    request<ForumQuestionDetail>(`${FORUM_BASE}/questions`, {
      method: 'POST',
      body: JSON.stringify({
        title: clean(form.title),
        topicId: clean(form.topicId),
        content: clean(form.content),
      }),
    }),
  updateQuestion: (id: string, patch: Partial<ForumQuestionForm>) => {
    const body: Record<string, string> = {}
    if (patch.title !== undefined) body.title = clean(patch.title)
    if (patch.topicId !== undefined) body.topicId = clean(patch.topicId)
    if (patch.content !== undefined) body.content = clean(patch.content)
    return request<ForumQuestionDetail>(`${FORUM_BASE}/questions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  },
  deleteQuestion: (id: string) =>
    request<void>(`${FORUM_BASE}/questions/${id}`, { method: 'DELETE' }),
  createAnswer: (questionId: string, content: string) =>
    request<ForumAnswer>(`${FORUM_BASE}/questions/${questionId}/answers`, {
      method: 'POST',
      body: JSON.stringify({ content: clean(content) }),
    }),
  updateAnswer: (answerId: string, content: string) =>
    request<ForumAnswer>(`${FORUM_BASE}/answers/${answerId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: clean(content) }),
    }),
  deleteAnswer: (answerId: string) =>
    request<void>(`${FORUM_BASE}/answers/${answerId}`, { method: 'DELETE' }),
  setAcceptedAnswer: (questionId: string, answerId: string | null) =>
    request<ForumQuestionDetail>(`${FORUM_BASE}/questions/${questionId}/accepted-answer`, {
      method: 'PUT',
      body: JSON.stringify({ answerId }),
    }),
  react: (postId: string, type: ForumReactionType) =>
    request<ForumReactions>(`${FORUM_BASE}/posts/${postId}/reaction`, {
      method: 'PUT',
      body: JSON.stringify({ type }),
    }),
  unreact: (postId: string) =>
    request<ForumReactions>(`${FORUM_BASE}/posts/${postId}/reaction`, {
      method: 'DELETE',
    }),
  listReactions: (postId: string, params: { type?: ForumReactionType | ''; page?: number; size?: number } = {}) =>
    request<Page<ForumReactor>>(
      `${FORUM_BASE}/posts/${postId}/reactions${query({
        type: params.type || undefined,
        page: params.page ?? 0,
        size: params.size ?? 20,
      })}`,
    ),
  createReport: (input: { targetId: string; reason: ReportReason; description?: string }) =>
    request<ReportCreated>(REPORTS_BASE, {
      method: 'POST',
      body: JSON.stringify({
        targetType: 'FORUM_POST',
        targetId: input.targetId,
        reason: input.reason,
        ...(clean(input.description) ? { description: clean(input.description) } : {}),
      }),
    }),
}

export const moderatorReportService = {
  listReports: (params: { status?: ReportStatus; reason?: ReportReason | ''; page?: number; size?: number } = {}) =>
    request<Page<ModeratorReportItem>>(
      `${MOD_REPORTS_BASE}${query({
        status: params.status ?? 'OPEN',
        reason: params.reason || undefined,
        page: params.page ?? 0,
        size: params.size ?? 20,
      })}`,
    ),
  resolveReport: (id: string, body: { action: ReportResolveAction; note?: string }) =>
    request<ModeratorReportItem>(`${MOD_REPORTS_BASE}/${id}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({
        action: body.action,
        ...(clean(body.note) ? { note: clean(body.note) } : {}),
      }),
    }),
  listHiddenPosts: (params: { page?: number; size?: number } = {}) =>
    request<Page<ModeratedForumPost>>(
      `${MOD_FORUM_BASE}${query({
        status: 'HIDDEN',
        page: params.page ?? 0,
        size: params.size ?? 20,
      })}`,
    ),
  setPostVisibility: (postId: string, body: { action: ModeratorVisibilityAction; note?: string }) =>
    request<ModeratedForumPost>(`${MOD_FORUM_BASE}/${postId}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({
        action: body.action,
        ...(clean(body.note) ? { note: clean(body.note) } : {}),
      }),
    }),
}
