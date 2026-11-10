// Author-side shapes of the course backend (server/.../dto/response/Course*Response.java, LessonResponse.java, dto/request/*Write*Request.java).
import type { ArticleAuthor, ArticleOption, ArticleStatus, HistoryEntry, ImageIssue } from './articles'

export type CourseLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

export type LessonItem = { id: string; title: string; summary: string | null; position: number; preview: boolean; hasVideo: boolean; hasContent: boolean; aiAssisted: boolean }
export type CourseChapter = { id: string; title: string; position: number; lessons: LessonItem[] }
export type CourseVersion = { id: string; versionNumber: number; approvedAt: string; fingerprint: string; chapters: CourseChapter[] }

export type AuthorCourse = ArticleStatus & {
  id: string; authorId: string; title: string; summary: string | null; description: string | null; level: CourseLevel; coverImageUrl: string | null
  topic: ArticleOption; tags: ArticleOption[]; fingerprint: string; hasUnpublishedChanges: boolean; chapters: CourseChapter[]
  publishedVersion: CourseVersion | null; imageIssues: ImageIssue[]; moderationNote: string | null; reviewedAt: string | null; publishedAt: string | null
  createdAt: string; updatedAt: string
}

export type AuthorCourseSummary = ArticleStatus & {
  id: string; title: string; summary: string | null; coverImageUrl: string | null; level: CourseLevel; topic: ArticleOption
  hasUnpublishedChanges: boolean; publishedAt: string | null; createdAt: string; updatedAt: string
}

export type CourseFields = { title: string; summary: string; description: string; level: CourseLevel; topicId: string; tagIds: string[]; coverImageUrl: string | null }
export type CourseWrite = Partial<CourseFields> & { action: 'SAVE' | 'SUBMIT' }

export type Lesson = {
  id: string; chapterId: string; versionId: string | null; title: string; summary: string | null; content: string | null
  video: { provider: string; videoId: string } | null; preview: boolean; position: number; aiAssisted: boolean; fingerprint: string; imageIssues: ImageIssue[]
}
export type LessonFields = { title: string; summary: string; content: string; videoUrl: string; preview: boolean }
/** On PATCH omitted fields are kept; summary/content/videoUrl may be null to clear. `aiGenerationId` only from a verified AI draft. */
export type LessonWrite = { title?: string; summary?: string | null; content?: string | null; videoUrl?: string | null; preview?: boolean; aiGenerationId?: string }

export type CourseAction = 'viewLive' | 'withdraw' | 'discard' | 'hide' | 'unhide' | 'deleteHard' | 'deleteSoft' | 'history'

// Moderator shapes (ModeratorCourseSummaryResponse, ModeratorCourseDetailResponse): no money fields in this module.
export type ChangeStatus = 'NEW' | 'CHANGED' | 'ARCHIVED' | 'UNCHANGED'
export type ChangeLesson = { id: string; title: string; changeStatus: ChangeStatus }
export type ChangeChapter = { id: string; title: string; changeStatus: ChangeStatus; lessons: ChangeLesson[] }
export type ModeratorCourseSummary = { course: AuthorCourseSummary; author: ArticleAuthor; authorEligible: boolean }
/** `course` is the working copy; `history` holds the 5 newest entries; `changes` = working active nodes, then nodes only the live version has. */
export type ModeratorCourseDetail = { course: AuthorCourse; author: ArticleAuthor; reviewToken: string; authorEligible: boolean; history: HistoryEntry[]; changes: ChangeChapter[] }
