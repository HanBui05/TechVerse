// Shapes of the article-flow backend DTOs (server/.../dto/response/Article*Response.java).
export type WorkflowStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'CHANGES_REQUESTED'
export type PublicationStatus = 'UNPUBLISHED' | 'PUBLISHED' | 'AUTHOR_HIDDEN' | 'HIDDEN' | 'AUTHOR_DELETED' | 'REMOVED'
export type HistoryAction = 'APPROVE' | 'REQUEST_CHANGES' | 'HIDE' | 'RESTORE' | 'REMOVE' | 'AUTHOR_HIDE' | 'AUTHOR_UNHIDE' | 'AUTHOR_DELETE'

export type ArticleOption = { id: string; name: string; active?: boolean }
export type Page<T> = { content: T[]; page: number; size: number; totalElements: number; totalPages: number; hasNext: boolean }

export type ImageIssue = { type: 'LOCAL_FILE' | 'EXTERNAL_URL' | 'UNMANAGED_ASSET'; alt: string; source: string; occurrence: number; line: number; column: number; filename: string | null }

export type PublicationVersion = {
  id: string; versionNumber: number; title: string; summary: string | null; content: string; coverImageUrl: string | null
  topic: ArticleOption; tags: ArticleOption[]; approvedBy: string | null; approvedAt: string; contentFingerprint: string; readingMinutes: number
}

export type ArticleStatus = { workflowStatus: WorkflowStatus; publicationStatus: PublicationStatus }

export type AuthorArticle = ArticleStatus & {
  id: string; authorId: string; title: string; summary: string | null; content: string | null; coverImageUrl: string | null
  topic: ArticleOption; tags: ArticleOption[]; hasUnpublishedChanges: boolean; publishedVersion: PublicationVersion | null; imageIssues: ImageIssue[]
  moderationNote: string | null; reviewedBy: string | null; reviewedAt: string | null; publishedAt: string | null
  createdAt: string; createdBy: string | null; updatedAt: string; updatedBy: string | null
}

export type AuthorArticleSummary = ArticleStatus & {
  id: string; title: string; summary: string | null; coverImageUrl: string | null; topic: ArticleOption
  hasUnpublishedChanges: boolean; publishedAt: string | null; createdAt: string; updatedAt: string
}

export type HistoryEntry = {
  id: string; action: HistoryAction; note: string | null; actor: { id: string; fullName: string; avatarUrl: string | null } | null
  fromWorkflowStatus: WorkflowStatus | null; toWorkflowStatus: WorkflowStatus | null
  fromPublicationStatus: PublicationStatus | null; toPublicationStatus: PublicationStatus | null; versionNumber: number | null; createdAt: string
}

export type ArticleFields = { title: string; topicId: string; tagIds: string[]; summary: string; content: string; coverImageUrl: string | null }
export type ArticleWrite = Partial<ArticleFields> & { action: 'SAVE' | 'SUBMIT' }

export type AuthorArticleFilter = {
  page: number; size: number; keyword?: string; workflowStatus?: WorkflowStatus | ''; publicationStatus?: PublicationStatus | ''
  topicId?: string; tagId?: string; sortBy?: 'CREATED_AT' | 'UPDATED_AT' | 'TITLE'; direction?: 'ASC' | 'DESC'
}

export type AuthorAction = 'viewLive' | 'withdraw' | 'discard' | 'hide' | 'unhide' | 'deleteHard' | 'deleteSoft' | 'history'

export type ArticleAuthor = { id: string; fullName: string; avatarUrl: string | null }

export type ModeratorArticleSummary = ArticleStatus & {
  id: string; title: string; summary: string | null; coverImageUrl: string | null; author: ArticleAuthor; topic: ArticleOption
  hasUnpublishedChanges: boolean; authorEligible: boolean; createdAt: string; updatedAt: string
}

/** `article` is the working copy (ArticleResponse, same shape as the Author detail); `history` holds the 5 newest entries. */
export type ModeratorArticleDetail = { article: AuthorArticle; author: ArticleAuthor; reviewToken: string; authorEligible: boolean; history: HistoryEntry[] }

export type ModeratorArticleFilter = Omit<AuthorArticleFilter, 'workflowStatus' | 'publicationStatus'> & {
  workflowStatus?: WorkflowStatus | ''; publicationStatus?: PublicationStatus | ''; authorId?: string; createdFrom?: string; createdTo?: string
}

export type ModeratorAction = 'REQUEST_CHANGES' | 'APPROVE' | 'HIDE' | 'RESTORE' | 'REMOVE'
export type CompareField = 'title' | 'summary' | 'cover' | 'topic' | 'tags' | 'content'
