import type { ArticleAuthor, ArticleOption } from './articles'

export type InterviewLevel = 'EASY' | 'MEDIUM' | 'HARD'
export type InterviewStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'CHANGES_REQUESTED' | 'AUTHOR_HIDDEN' | 'HIDDEN' | 'REMOVED'
export type InterviewVisibilityAction = 'HIDE' | 'UNHIDE'
export type InterviewReviewDecision = 'APPROVE' | 'REQUEST_CHANGES'
export type InterviewPublicationAction = 'HIDE' | 'RESTORE' | 'REMOVE'
export type InterviewMarkFilter = 'SAVED' | 'REVIEWED'
export type InterviewVerdict = 'GOOD' | 'PARTIAL' | 'OFF_TRACK'

export type InterviewQuestion = {
  id: string
  topic: ArticleOption
  level: InterviewLevel
  question: string
  sampleAnswer: string
  hint: string | null
  status: InterviewStatus
  aiAssisted: boolean
  version: number
  moderationNote: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type InterviewForm = {
  topicId: string
  level: InterviewLevel
  question: string
  sampleAnswer: string
  hint: string
}

export type InterviewAiDraftRequest = {
  topicId: string
  level: InterviewLevel
  instruction?: string
  sourceText?: string
  count: number
}

export type InterviewAiDraftsResponse = {
  questions: InterviewQuestion[]
  requested: number
}

export type ModeratorInterviewQuestion = {
  question: InterviewQuestion
  author: ArticleAuthor
  authorEligible: boolean
  reviewToken: string
}

export type InterviewViewerState = {
  reviewed: boolean
  saved: boolean
}

export type PublishedInterviewQuestion = {
  id: string
  topic: ArticleOption
  level: InterviewLevel
  question: string
  author: ArticleAuthor
  publishedAt: string
  hasHint: boolean
  viewer: InterviewViewerState | null
}

export type InterviewAnswerResponse = {
  hint: string | null
  sampleAnswer: string
}

export type InterviewMarkRequest = {
  reviewed?: boolean
  saved?: boolean
}

export type InterviewFeedback = {
  verdict: InterviewVerdict
  strengths: string[]
  missing: string[]
  advice: string
}

export type InterviewAuthorAction = 'withdraw' | 'copy' | 'hide' | 'unhide' | 'delete'
export type ModeratorInterviewAction = 'APPROVE' | 'REQUEST_CHANGES' | 'HIDE' | 'RESTORE' | 'REMOVE'

export type InterviewFilter = {
  topicId: string
  level: InterviewLevel | ''
  mark: InterviewMarkFilter | ''
  keyword: string
  page: number
}
