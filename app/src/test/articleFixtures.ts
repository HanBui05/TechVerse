import type { AuthorArticle, HistoryEntry, ImageIssue, ModeratorArticleDetail, ModeratorArticleSummary, PublicationVersion } from '../types/articles'

// JSON exactly as the backend serializes ArticleResponse/ArticlePublicationVersionResponse (Task 1a–1c) and the
// Moderator summary/detail/history responses (Task 1b). Kept out of *.test.ts so importing them does not re-run those tests.
export const versionFixture: PublicationVersion = { id: 'v-1', versionNumber: 3, title: 'Live', summary: 'S', content: '# Live', coverImageUrl: null, topic: { id: 'java', name: 'Java', active: true }, tags: [], approvedBy: 'mod-1', approvedAt: '2026-11-03T10:00:00Z', contentFingerprint: 'a'.repeat(64), readingMinutes: 2 }
export const issueFixture: ImageIssue = { type: 'LOCAL_FILE', alt: 'sơ đồ', source: './img/a.png', occurrence: 1, line: 3, column: 1, filename: 'a.png' }
export const articleFixture: AuthorArticle = {
  id: 'art-1', authorId: 'author-1', title: 'Draft', summary: 'Sum', content: 'Intro\n\n![sơ đồ](./img/a.png)', coverImageUrl: null,
  topic: { id: 'java', name: 'Java', active: true }, tags: [{ id: 'spring', name: 'Spring', active: true }],
  workflowStatus: 'DRAFT', publicationStatus: 'PUBLISHED', hasUnpublishedChanges: true, publishedVersion: versionFixture, imageIssues: [issueFixture],
  moderationNote: null, reviewedBy: null, reviewedAt: null, publishedAt: '2026-11-01T10:00:00Z', createdAt: '2026-11-01T09:00:00Z', createdBy: 'author-1', updatedAt: '2026-11-04T10:42:00Z', updatedBy: 'author-1',
}

const moderatorAuthor = { id: 'author-1', fullName: 'Trần B', avatarUrl: null }
export const historyFixture: HistoryEntry = { id: 'h-1', action: 'REQUEST_CHANGES', note: 'Bổ sung ví dụ', actor: { id: 'mod-1', fullName: 'Nguyễn A', avatarUrl: null }, fromWorkflowStatus: 'PENDING', toWorkflowStatus: 'CHANGES_REQUESTED', fromPublicationStatus: 'PUBLISHED', toPublicationStatus: 'PUBLISHED', versionNumber: null, createdAt: '2026-11-04T08:00:00Z' }
export const moderatorDetailFixture: ModeratorArticleDetail = {
  article: { ...articleFixture, title: 'Live (sửa)', content: '# Live\n\nThêm ví dụ', workflowStatus: 'PENDING', imageIssues: [], moderationNote: 'Bổ sung ví dụ', reviewedBy: 'mod-1', reviewedAt: '2026-11-04T08:00:00Z' },
  author: moderatorAuthor, reviewToken: 'a'.repeat(64), authorEligible: true, history: [historyFixture],
}
export const moderatorSummaryFixture: ModeratorArticleSummary = {
  id: 'art-1', title: 'Live (sửa)', summary: 'Sum', coverImageUrl: null, author: moderatorAuthor, topic: { id: 'java', name: 'Java', active: true },
  workflowStatus: 'PENDING', publicationStatus: 'PUBLISHED', hasUnpublishedChanges: true, authorEligible: true, createdAt: '2026-11-01T09:00:00Z', updatedAt: '2026-11-04T10:42:00Z',
}
