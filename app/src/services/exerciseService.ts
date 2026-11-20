import { request, requestRaw } from './api/client'
import { quotaOf, unwrap } from './aiAssistService'
import type { AiQuota } from '../types/aiAssist'
import type { ArticleOption, Page } from '../types/articles'
import type { AiQuestionsRequest, AiSuggestions, ExerciseFilter, ExerciseInfo, ExerciseModeration, ExerciseQuestion, ExerciseSet, ExerciseStatus, ExerciseSummary, ExerciseType, ModeratorExerciseDetail, ModeratorExerciseFilter, ModeratorExerciseSummary, AttemptBody, AttemptItem, PracticeAttempt, PracticeFilter, PracticeQuestions, PracticeSet, QuizItem } from '../types/exercises'

const base = '/api/v1/author/exercise-sets'
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })
const query = (filter: object) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) if (value !== '' && value !== undefined) params.set(key, String(value))
  return params
}

export const authorExercises = {
  list: (filter: ExerciseFilter) => request<Page<ExerciseSummary>>(`${base}?${query(filter)}`),
  options: () => request<ArticleOption[]>(`${base}/options`),
  detail: (id: string) => request<ExerciseSet>(`${base}/${id}`),
  create: (body: ExerciseInfo) => request<ExerciseSet>(base, json('POST', body)),
  // `type` never changes after creation, so PATCH must not send it.
  update: (id: string, version: number, { type: _type, ...info }: ExerciseInfo) => request<ExerciseSet>(`${base}/${id}`, json('PATCH', { version, ...info })),
  saveQuestions: (id: string, version: number, questions: ExerciseQuestion[]) => request<ExerciseSet>(`${base}/${id}/questions`, json('PUT', { version, questions: questions.map(questionBody) })),
  submit: (id: string) => request<ExerciseSet>(`${base}/${id}/submit`, { method: 'POST' }),
  withdraw: (id: string) => request<ExerciseSet>(`${base}/${id}/withdraw`, { method: 'POST' }),
  visibility: (id: string, action: 'HIDE' | 'UNHIDE') => request<ExerciseSet>(`${base}/${id}/visibility`, json('PATCH', { action })),
  copy: (id: string) => request<ExerciseSet>(`${base}/${id}/copy`, { method: 'POST' }),
  remove: (id: string) => request<void>(`${base}/${id}`, { method: 'DELETE' }),
  /** Quota comes from the headers of the call, so a refusal still reports it (see aiAssistService.unwrap). */
  suggest: async (id: string, body: AiQuestionsRequest) => {
    const response = await requestRaw(`${base}/${id}/ai/questions`, json('POST', { ...body, instruction: body.instruction.trim() || undefined, sourceText: body.sourceText.trim() || undefined }))
    return { suggestions: await unwrap<AiSuggestions>(response), quota: quotaOf(response.headers) as AiQuota | null }
  },
}

export const MAX_QUESTIONS = 50
export const MIN_TO_SUBMIT: Record<ExerciseType, number> = { MULTIPLE_CHOICE: 3, FLASHCARD: 5 }
const LIMITS = { content: 2000, explanation: 2000, option: 500, snippet: 5000, language: 50, card: 1000 }

export const emptyQuestion = (type: ExerciseType): ExerciseQuestion => type === 'FLASHCARD'
  ? { content: null, codeSnippet: null, codeLanguage: null, options: null, correctIndex: null, explanation: '', front: '', back: '' }
  : { content: '', codeSnippet: null, codeLanguage: null, options: ['', ''], correctIndex: null, explanation: '', front: null, back: null }

/** Only the fields of the set's type: the server rejects options/correctIndex on cards. */
export function questionBody(q: ExerciseQuestion) {
  return q.front !== null
    ? { front: q.front, back: q.back, explanation: q.explanation ?? '' }
    : { content: q.content, codeSnippet: q.codeSnippet || null, codeLanguage: q.codeSnippet ? q.codeLanguage : null, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation }
}

export type QuestionErrorKey = 'required' | 'tooLong' | 'optionCount' | 'optionDuplicate' | 'correctRequired' | 'languageRequired' | 'contentInvalid'
export type InfoErrorKey = 'titleLength' | 'descriptionLength' | 'topicRequired' | 'difficultyRequired'

// Markdown images are refused (the article checker allows them); raw HTML and links are left to the server (EXERCISE_CONTENT_INVALID).
const badMarkdown = (text: string) => /!\[[^\]]*\]\([^)]*\)/.test(text) || text.includes('\0')
const fits = (text: string | null, max: number, min = 1): QuestionErrorKey | null => {
  const n = (text ?? '').trim().length
  return n < min ? 'required' : n > max ? 'tooLong' : badMarkdown(text ?? '') ? 'contentInvalid' : null
}

/** Client copy of the 1a rows “Câu trắc nghiệm” / “Thẻ flashcard”; keys are the field names (`option-<i>` per choice). */
export function questionErrors(q: ExerciseQuestion): Record<string, QuestionErrorKey> {
  const errors: Record<string, QuestionErrorKey> = {}
  const set = (key: string, error: QuestionErrorKey | null) => { if (error) errors[key] = error }
  if (q.front !== null) {
    set('front', fits(q.front, LIMITS.card)); set('back', fits(q.back, LIMITS.card)); set('explanation', fits(q.explanation, LIMITS.explanation, 0))
    return errors
  }
  set('content', fits(q.content, LIMITS.content)); set('explanation', fits(q.explanation, LIMITS.explanation))
  const options = q.options ?? []
  if (options.length < 2 || options.length > 6) errors.options = 'optionCount'
  const seen = new Set<string>()
  options.forEach((option, i) => {
    set(`option-${i}`, fits(option, LIMITS.option))
    const key = option.trim().toLowerCase()
    if (!errors[`option-${i}`] && seen.has(key)) errors[`option-${i}`] = 'optionDuplicate'
    seen.add(key)
  })
  if (q.correctIndex === null || q.correctIndex < 0 || q.correctIndex >= options.length) errors.correct = 'correctRequired'
  if (q.codeSnippet) {
    if (q.codeSnippet.length > LIMITS.snippet) errors.codeSnippet = 'tooLong'
    const language = (q.codeLanguage ?? '').trim()
    if (!language) errors.codeLanguage = 'languageRequired'
    else if (language.length > LIMITS.language) errors.codeLanguage = 'tooLong'
  }
  return errors
}

export function infoErrors(info: ExerciseInfo): Partial<Record<keyof ExerciseInfo, InfoErrorKey>> {
  const title = info.title.trim().length
  return {
    ...(title < 5 || title > 255 ? { title: 'titleLength' as const } : {}),
    ...(info.description.length > 2000 ? { description: 'descriptionLength' as const } : {}),
    ...(!info.topicId ? { topicId: 'topicRequired' as const } : {}),
    ...(!info.difficulty ? { difficulty: 'difficultyRequired' as const } : {}),
  }
}

export type ExerciseAction = 'edit' | 'view' | 'copy' | 'delete' | 'withdraw' | 'hide' | 'unhide'
/** Author buttons per status (wireframe 1; actions the backend would refuse are absent). Delete only before the first publication. */
export function exerciseActions({ status, publishedAt }: { status: ExerciseStatus; publishedAt: string | null }): { primary: 'edit' | 'view'; actions: ExerciseAction[]; readOnly: boolean } {
  const editable = status === 'DRAFT' || status === 'CHANGES_REQUESTED'
  const actions: ExerciseAction[] = editable ? ['copy', ...(publishedAt === null ? ['delete' as const] : [])]
    : status === 'PENDING' ? ['withdraw', 'copy']
      : status === 'PUBLISHED' ? ['copy', 'hide']
        : status === 'AUTHOR_HIDDEN' ? ['copy', 'unhide'] : ['copy']
  return { primary: editable ? 'edit' : 'view', actions, readOnly: !editable }
}

const moderatorBase = '/api/v1/moderator/exercise-sets'
// Topic filter source: the public options endpoint (active topics), since author options need the AUTHOR role.
export const moderatorExercises = {
  list: (filter: ModeratorExerciseFilter) => request<Page<ModeratorExerciseSummary>>(`${moderatorBase}?${query(filter)}`),
  options: () => request<ArticleOption[]>('/api/v1/exercise-sets/options'),
  detail: (id: string) => request<ModeratorExerciseDetail>(`${moderatorBase}/${id}`),
  review: (id: string, decision: 'APPROVE' | 'REQUEST_CHANGES', reviewToken: string, note: string) =>
    request<ModeratorExerciseDetail>(`${moderatorBase}/${id}/review`, json('PATCH', { decision, reviewToken, note: note.trim() || undefined })),
  publication: (id: string, action: 'HIDE' | 'RESTORE' | 'REMOVE', reviewToken: string, reason: string) =>
    request<ModeratorExerciseDetail>(`${moderatorBase}/${id}/publication`, json('PATCH', { action, reviewToken, reason: reason.trim() || undefined })),
}

export const MODERATION_NOTE_MAX = 1000
export const MODERATION_NOTE_REQUIRED: ExerciseModeration[] = ['REQUEST_CHANGES', 'HIDE', 'REMOVE']
/** Wireframe 5 table: pending → review; published/author-hidden → hide or remove; moderator-hidden → restore or remove; others read-only. */
export function moderatorExerciseActions(status: ExerciseStatus): ExerciseModeration[] {
  return status === 'PENDING' ? ['REQUEST_CHANGES', 'APPROVE']
    : status === 'PUBLISHED' || status === 'AUTHOR_HIDDEN' ? ['HIDE', 'REMOVE']
      : status === 'HIDDEN' ? ['RESTORE', 'REMOVE'] : []
}

// ---- Practice (learner) ----
export const PRACTICE_PAGE_SIZE = 9
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD']
const TYPES = ['MULTIPLE_CHOICE', 'FLASHCARD']
/** `/practice` query → filter; unknown enums and malformed pages fall back to the defaults (never a raw 400). */
export function practiceFilter(params: URLSearchParams): PracticeFilter {
  const page = Number(params.get('page'))
  const difficulty = params.get('difficulty') ?? ''
  const type = params.get('type') ?? ''
  return {
    topicId: params.get('topicId') ?? '', keyword: (params.get('keyword') ?? '').trim().slice(0, 100), page: Number.isInteger(page) && page > 0 ? page : 0,
    difficulty: DIFFICULTIES.includes(difficulty) ? difficulty as PracticeFilter['difficulty'] : '', type: TYPES.includes(type) ? type as PracticeFilter['type'] : '',
  }
}
export function practiceSearch({ keyword, topicId, difficulty, type, page }: PracticeFilter) {
  const params = new URLSearchParams()
  if (keyword.trim()) params.set('keyword', keyword.trim())
  if (topicId) params.set('topicId', topicId)
  if (difficulty) params.set('difficulty', difficulty)
  if (type) params.set('type', type)
  if (page > 0) params.set('page', String(page))
  return params
}

const publicBase = '/api/v1/exercise-sets'
export const practice = {
  list: (filter: PracticeFilter) => request<Page<PracticeSet>>(`${publicBase}?${query({ ...filter, size: PRACTICE_PAGE_SIZE })}`),
  options: () => request<ArticleOption[]>(`${publicBase}/options`),
  detail: (id: string) => request<PracticeSet>(`${publicBase}/${id}`),
  questions: (id: string) => request<PracticeQuestions>(`${publicBase}/${id}/questions`),
  /** The same key must be reused when a failed submit is retried; the server then returns the stored attempt. */
  submit: (id: string, body: AttemptBody, key: string) => request<PracticeAttempt>(`${publicBase}/${id}/attempts`, { ...json('POST', body), headers: { 'Idempotency-Key': key } }),
  history: (page: number, exerciseSetId = '') => request<Page<PracticeAttempt>>(`/api/v1/me/exercise-attempts?${query({ page, size: 20, exerciseSetId })}`),
  attempt: (id: string) => request<PracticeAttempt>(`/api/v1/me/exercise-attempts/${id}`),
}

export const unansweredCount = (ids: string[], answers: Record<string, number | null>) => ids.filter(id => answers[id] == null).length

/** Quiz: every question with its pick or null; flashcards: every card, unmarked = not remembered (server rule). */
export function attemptBody(type: ExerciseType, ids: string[], marks: Record<string, number | boolean | null>, durationSeconds: number): AttemptBody {
  return type === 'FLASHCARD'
    ? { results: ids.map(questionId => ({ questionId, remembered: marks[questionId] === true })), durationSeconds }
    : { answers: ids.map(questionId => ({ questionId, selectedIndex: typeof marks[questionId] === 'number' ? marks[questionId] as number : null })), durationSeconds }
}

export const wrongItems = (items: AttemptItem[]) => items.filter(item => 'correct' in item && !item.correct)
export const isQuizItem = (item: AttemptItem): item is QuizItem => 'correct' in item

// The fence is longer than any backtick run inside the code, so the snippet cannot close it early.
export const fenced = (code: string, language: string | null) => { const fence = '`'.repeat(Math.max(3, ...(code.match(/`+/g) ?? []).map(run => run.length + 1))); const label = /^[\w+#.-]{1,50}$/.test(language ?? '') ? language : ''
  return `${fence}${label}\n${code}\n${fence}` }
