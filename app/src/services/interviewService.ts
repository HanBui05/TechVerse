import { ApiError, readEnvelope, request, requestRaw } from './api/client'
import { quotaOf } from './aiAssistService'
import type { AiQuota } from '../types/aiAssist'
import type { ArticleOption, Page } from '../types/articles'
import type {
  InterviewAiDraftRequest,
  InterviewAiDraftsResponse,
  InterviewAnswerResponse,
  InterviewAuthorAction,
  InterviewFeedback,
  InterviewFilter,
  InterviewForm,
  InterviewLevel,
  InterviewMarkFilter,
  InterviewMarkRequest,
  InterviewPublicationAction,
  InterviewQuestion,
  InterviewReviewDecision,
  InterviewStatus,
  InterviewViewerState,
  InterviewVisibilityAction,
  ModeratorInterviewAction,
  ModeratorInterviewQuestion,
  PublishedInterviewQuestion,
} from '../types/interview'

const AUTHOR_BASE = '/api/v1/author/interview-questions'
const MODERATOR_BASE = '/api/v1/moderator/interview-questions'
const PUBLIC_BASE = '/api/v1/interview-questions'

const LEVELS = new Set<InterviewLevel>(['EASY', 'MEDIUM', 'HARD'])
const MARKS = new Set<InterviewMarkFilter>(['SAVED', 'REVIEWED'])
// Both inline `![alt](url)` and reference `![alt][id]` images are forbidden by AuthorInterviewService.
const MD_IMAGE = /!\[[^\]]*]\s*[([]/

const clean = (v?: string | null) => v?.trim() ?? ''
const hasUnsupportedContent = (v?: string | null) => Boolean(v && (v.includes('\0') || MD_IMAGE.test(v)))

function query(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    const s = typeof v === 'string' ? v.trim() : v !== undefined ? String(v) : ''
    if (s) q.set(k, s)
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

// requestRaw keeps the shared bearer + one refresh on 401; the quota headers ride on errors too.
async function requestWithQuota<T>(path: string, body: unknown): Promise<{ data: T; quota: AiQuota | null }> {
  const response = await requestRaw(path, { method: 'POST', body: JSON.stringify(body) })
  const quota = quotaOf(response.headers)
  try {
    return { data: await readEnvelope<T>(response), quota }
  } catch (e) {
    throw Object.assign(e as ApiError, { quota })
  }
}

export type InterviewFormErrorKey = 'topicRequired' | 'levelRequired' | 'questionLength' | 'sampleAnswerLength' | 'hintLength' | 'contentInvalid'

export function interviewFormErrors(form: InterviewForm): Partial<Record<keyof InterviewForm, InterviewFormErrorKey>> {
  const errors: Partial<Record<keyof InterviewForm, InterviewFormErrorKey>> = {}
  if (!clean(form.topicId)) errors.topicId = 'topicRequired'
  if (!LEVELS.has(form.level)) errors.level = 'levelRequired'

  const q = clean(form.question)
  if (hasUnsupportedContent(form.question)) errors.question = 'contentInvalid'
  else if (q.length < 10 || q.length > 1000) errors.question = 'questionLength'

  const a = clean(form.sampleAnswer)
  if (hasUnsupportedContent(form.sampleAnswer)) errors.sampleAnswer = 'contentInvalid'
  else if (a.length < 20 || a.length > 5000) errors.sampleAnswer = 'sampleAnswerLength'

  const h = clean(form.hint)
  if (hasUnsupportedContent(form.hint)) errors.hint = 'contentInvalid'
  else if (h.length > 500) errors.hint = 'hintLength'

  return errors
}

export type InterviewAiDraftErrorKey = 'topicRequired' | 'levelRequired' | 'instructionLength' | 'sourceLength' | 'countRange'

export function interviewAiDraftErrors(input: InterviewAiDraftRequest): Partial<Record<'topicId' | 'level' | 'instruction' | 'sourceText' | 'count', InterviewAiDraftErrorKey>> {
  const errors: Partial<Record<'topicId' | 'level' | 'instruction' | 'sourceText' | 'count', InterviewAiDraftErrorKey>> = {}
  if (!clean(input.topicId)) errors.topicId = 'topicRequired'
  if (!LEVELS.has(input.level)) errors.level = 'levelRequired'
  if (clean(input.instruction).length > 500) errors.instruction = 'instructionLength'
  if (clean(input.sourceText).length > 8000) errors.sourceText = 'sourceLength'
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 5) errors.count = 'countRange'
  return errors
}

export function validateFeedbackAnswer(answer: string): 'answerLengthError' | null {
  const trimmed = clean(answer)
  return trimmed.length >= 1 && trimmed.length <= 4000 ? null : 'answerLengthError'
}

export function interviewActions(item: Pick<InterviewQuestion, 'status' | 'publishedAt'>): {
  primary: 'edit' | 'view'
  actions: InterviewAuthorAction[]
  readOnly: boolean
} {
  const canDelete = (item.status === 'DRAFT' || item.status === 'CHANGES_REQUESTED') && !item.publishedAt
  if (item.status === 'DRAFT' || item.status === 'CHANGES_REQUESTED') {
    return { primary: 'edit', actions: canDelete ? ['copy', 'delete'] : ['copy'], readOnly: false }
  }
  if (item.status === 'PENDING') return { primary: 'view', actions: ['withdraw', 'copy'], readOnly: true }
  if (item.status === 'PUBLISHED') return { primary: 'view', actions: ['copy', 'hide'], readOnly: true }
  if (item.status === 'AUTHOR_HIDDEN') return { primary: 'view', actions: ['copy', 'unhide'], readOnly: true }
  return { primary: 'view', actions: ['copy'], readOnly: true }
}

export function moderatorInterviewActions(status: InterviewStatus): ModeratorInterviewAction[] {
  if (status === 'PENDING') return ['REQUEST_CHANGES', 'APPROVE']
  if (status === 'PUBLISHED' || status === 'AUTHOR_HIDDEN') return ['HIDE', 'REMOVE']
  if (status === 'HIDDEN') return ['RESTORE', 'REMOVE']
  return []
}

export const authorInterviews = {
  options: () => request<ArticleOption[]>(`${AUTHOR_BASE}/options`),
  list: (params: { status?: InterviewStatus | ''; level?: InterviewLevel | ''; topicId?: string; keyword?: string; page?: number; size?: number } = {}) =>
    request<Page<InterviewQuestion>>(`${AUTHOR_BASE}${query(params)}`),
  detail: (id: string) => request<InterviewQuestion>(`${AUTHOR_BASE}/${id}`),
  create: (form: InterviewForm) =>
    request<InterviewQuestion>(AUTHOR_BASE, {
      method: 'POST',
      body: JSON.stringify({
        topicId: clean(form.topicId),
        level: form.level,
        question: clean(form.question),
        sampleAnswer: clean(form.sampleAnswer),
        hint: clean(form.hint) || null,
      }),
    }),
  update: (id: string, version: number, form: InterviewForm) =>
    request<InterviewQuestion>(`${AUTHOR_BASE}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        version,
        topicId: clean(form.topicId),
        level: form.level,
        question: clean(form.question),
        sampleAnswer: clean(form.sampleAnswer),
        hint: clean(form.hint),
      }),
    }),
  submit: (id: string) => request<InterviewQuestion>(`${AUTHOR_BASE}/${id}/submit`, { method: 'POST' }),
  withdraw: (id: string) => request<InterviewQuestion>(`${AUTHOR_BASE}/${id}/withdraw`, { method: 'POST' }),
  visibility: (id: string, action: InterviewVisibilityAction) =>
    request<InterviewQuestion>(`${AUTHOR_BASE}/${id}/visibility`, { method: 'PATCH', body: JSON.stringify({ action }) }),
  copy: (id: string) => request<InterviewQuestion>(`${AUTHOR_BASE}/${id}/copy`, { method: 'POST' }),
  remove: (id: string) => request<void>(`${AUTHOR_BASE}/${id}`, { method: 'DELETE' }),
  generateAiDrafts: async (input: InterviewAiDraftRequest): Promise<{ drafts: InterviewAiDraftsResponse; quota: AiQuota | null }> => {
    const body = {
      topicId: clean(input.topicId),
      level: input.level,
      ...(clean(input.instruction) ? { instruction: clean(input.instruction) } : {}),
      ...(clean(input.sourceText) ? { sourceText: clean(input.sourceText) } : {}),
      count: input.count,
    }
    const { data, quota } = await requestWithQuota<InterviewAiDraftsResponse>(`${AUTHOR_BASE}/ai/drafts`, body)
    return { drafts: data, quota }
  },
}

export const moderatorInterviews = {
  options: () => request<ArticleOption[]>(`${PUBLIC_BASE}/options`),
  list: (params: { status?: InterviewStatus | ''; level?: InterviewLevel | ''; topicId?: string; keyword?: string; page?: number; size?: number } = {}) =>
    request<Page<ModeratorInterviewQuestion>>(`${MODERATOR_BASE}${query({ ...params, status: params.status || 'PENDING' })}`),
  detail: (id: string) => request<ModeratorInterviewQuestion>(`${MODERATOR_BASE}/${id}`),
  review: (id: string, body: { decision: InterviewReviewDecision; reviewToken: string; note?: string }) =>
    request<ModeratorInterviewQuestion>(`${MODERATOR_BASE}/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ ...body, ...(body.note?.trim() ? { note: body.note.trim() } : { note: undefined }) }),
    }),
  publication: (id: string, body: { action: InterviewPublicationAction; reviewToken: string; reason?: string }) =>
    request<ModeratorInterviewQuestion>(`${MODERATOR_BASE}/${id}/publication`, {
      method: 'PATCH',
      body: JSON.stringify({ ...body, ...(body.reason?.trim() ? { reason: body.reason.trim() } : { reason: undefined }) }),
    }),
}

export function interviewFilter(search: URLSearchParams, authenticated = true): InterviewFilter {
  const level = search.get('level') ?? ''
  const mark = search.get('mark') ?? ''
  const page = Number.parseInt(search.get('page') ?? '0', 10)
  return {
    topicId: (search.get('topicId') ?? '').trim(),
    level: LEVELS.has(level as InterviewLevel) ? (level as InterviewLevel) : '',
    mark: authenticated && MARKS.has(mark as InterviewMarkFilter) ? (mark as InterviewMarkFilter) : '',
    keyword: (search.get('keyword') ?? '').trim(),
    page: Number.isFinite(page) && page > 0 ? page : 0,
  }
}

export function interviewSearch(filter: InterviewFilter, authenticated = true): URLSearchParams {
  const params = new URLSearchParams()
  if (filter.keyword.trim()) params.set('keyword', filter.keyword.trim())
  if (filter.topicId) params.set('topicId', filter.topicId)
  if (filter.level) params.set('level', filter.level)
  if (authenticated && filter.mark) params.set('mark', filter.mark)
  if (filter.page > 0) params.set('page', String(filter.page))
  return params
}

export const publicInterviews = {
  options: () => request<ArticleOption[]>(`${PUBLIC_BASE}/options`),
  list: (filter: Partial<InterviewFilter> & { size?: number } = {}) =>
    request<Page<PublishedInterviewQuestion>>(
      `${PUBLIC_BASE}${query({
        topicId: filter.topicId,
        level: filter.level,
        mark: filter.mark,
        keyword: filter.keyword,
        page: filter.page ?? 0,
        size: filter.size ?? 12,
      })}`,
    ),
  detail: (id: string) => request<PublishedInterviewQuestion>(`${PUBLIC_BASE}/${id}`),
  answer: (id: string) => request<InterviewAnswerResponse>(`${PUBLIC_BASE}/${id}/answer`),
  mark: (id: string, body: InterviewMarkRequest) =>
    request<InterviewViewerState>(`${PUBLIC_BASE}/${id}/mark`, { method: 'PUT', body: JSON.stringify(body) }),
  feedback: async (id: string, answer: string): Promise<{ feedback: InterviewFeedback; quota: AiQuota | null }> => {
    const { data, quota } = await requestWithQuota<InterviewFeedback>(`${PUBLIC_BASE}/${id}/feedback`, { answer: answer.trim() })
    return { feedback: data, quota }
  },
  feedbackQuota: () => request<{ limit: number; remaining: number }>('/api/v1/me/interview-feedback/quota'),
}
