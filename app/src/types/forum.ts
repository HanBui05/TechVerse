import type { ArticleAuthor, ArticleOption } from './articles'

export type ForumReactionType = 'LIKE' | 'LOVE' | 'HAHA' | 'ANGRY'
export type ForumPostStatus = 'VISIBLE' | 'HIDDEN' | 'DELETED'
export type ReportReason = 'SPAM' | 'INAPPROPRIATE' | 'COPYRIGHT' | 'MISLEADING' | 'OTHER'
export type ReportStatus = 'OPEN' | 'ACTIONED' | 'DISMISSED'
export type ReportResolveAction = 'HIDE_CONTENT' | 'DISMISS'
export type ModeratorVisibilityAction = 'HIDE' | 'RESTORE'

export type ForumPostViewer = {
  canEdit: boolean
  canDelete: boolean
  canReport: boolean
  canReact: boolean
}

export type ForumQuestionViewer = {
  canEdit: boolean
  canDelete: boolean
  canReport: boolean
  canAccept: boolean
  canAnswer: boolean
  canReact: boolean
}

export type ForumReactionCounts = Record<ForumReactionType, number>

export type ForumReactions = {
  counts: ForumReactionCounts
  mine: ForumReactionType | null
}

export type ForumReactor = {
  user: ArticleAuthor
  type: ForumReactionType
  reactedAt: string
}

export type ForumQuestionSummary = {
  id: string
  title: string
  excerpt: string
  topic: ArticleOption
  author: ArticleAuthor
  answerCount: number
  reactionCount: number
  solved: boolean
  createdAt: string
  editedAt?: string | null
}

export type ForumAnswer = {
  id: string
  content: string
  author: ArticleAuthor
  accepted: boolean
  createdAt: string
  editedAt?: string | null
  viewer: ForumPostViewer
  reactions: ForumReactions
}

export type ForumQuestionDetail = {
  id: string
  title?: string
  content?: string
  topic: ArticleOption
  author?: ArticleAuthor
  deleted: boolean
  solved: boolean
  acceptedAnswerId?: string | null
  answerCount: number
  createdAt: string
  editedAt?: string | null
  viewer: ForumQuestionViewer
  reactions?: ForumReactions
  answers: ForumAnswer[]
}

export type ForumListFilter = {
  topicId: string
  keyword: string
  solved: '' | 'true' | 'false'
  mine: boolean
  page: number
}

export type ForumQuestionForm = {
  title: string
  topicId: string
  content: string
}

export type ReportCreated = {
  id: string
  status: ReportStatus
  createdAt: string
}

export type ModeratedForumPost = {
  id: string
  type: 'QUESTION' | 'ANSWER'
  questionId: string
  questionTitle?: string | null
  content: string
  author: ArticleAuthor
  status: ForumPostStatus
  publiclyVisible: boolean
  moderationNote?: string | null
  hiddenBy?: ArticleAuthor | null
  hiddenAt?: string | null
}

export type ModeratorReportItem = {
  id: string
  reason: ReportReason
  description?: string | null
  status: ReportStatus
  reporter: ArticleAuthor
  createdAt: string
  handledAt?: string | null
  resolutionNote?: string | null
  post: ModeratedForumPost
  otherOpenReports: number
}

export type ModeratorReportsTab = 'open' | 'handled' | 'hidden'

export type ModeratorReportsFilter = {
  tab: ModeratorReportsTab
  status: 'ACTIONED' | 'DISMISSED'
  reason: ReportReason | ''
  page: number
}
