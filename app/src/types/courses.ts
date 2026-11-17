// Author-side shapes of the course backend (server/.../dto/response/Course*Response.java, LessonResponse.java, dto/request/*Write*Request.java).
import type { ArticleAuthor, ArticleOption, ArticleStatus, HistoryEntry, ImageIssue } from './articles'

export type CourseLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

export type LessonItem = { id: string; title: string; summary: string | null; position: number; preview: boolean; hasVideo: boolean; hasContent: boolean; aiAssisted: boolean }
export type CourseChapter = { id: string; title: string; position: number; lessons: LessonItem[] }
export type CourseVersion = { id: string; versionNumber: number; approvedAt: string; fingerprint: string; chapters: CourseChapter[] }

/** Course as the Moderator sees it: no price, currency or commission (ModeratorCourseResponse). */
export type ModeratorCourse = ArticleStatus & {
  id: string; authorId: string; title: string; summary: string | null; description: string | null; level: CourseLevel; coverImageUrl: string | null
  topic: ArticleOption; tags: ArticleOption[]; fingerprint: string; hasUnpublishedChanges: boolean; chapters: CourseChapter[]
  publishedVersion: CourseVersion | null; imageIssues: ImageIssue[]; moderationNote: string | null; reviewedAt: string | null; publishedAt: string | null
  createdAt: string; updatedAt: string
}
/** `commissionRateBps` is the active policy, only to estimate the share after fees; the server stays the judge. */
export type AuthorCourse = ModeratorCourse & { priceAmount: number; commissionRateBps: number }

export type ModeratorCourseSummaryItem = ArticleStatus & {
  id: string; title: string; summary: string | null; coverImageUrl: string | null; level: CourseLevel; topic: ArticleOption
  hasUnpublishedChanges: boolean; publishedAt: string | null; createdAt: string; updatedAt: string
}
export type AuthorCourseSummary = ModeratorCourseSummaryItem & { priceAmount: number; studentCount?: number }
export type CourseStudent = { fullName: string; avatarUrl: string | null; enrolledAt: string; lastAccessedAt: string | null; completedLessons: number; totalLessons: number }
export type CourseStudents = { students: import('./articles').Page<CourseStudent>; summary: { total: number; notStarted: number; completed: number } }
export type StudentProgress = '' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'

export type CourseFields = { title: string; summary: string; description: string; level: CourseLevel; topicId: string; tagIds: string[]; coverImageUrl: string | null; priceAmount: number }
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
export type ModeratorCourseSummary = { course: ModeratorCourseSummaryItem; author: ArticleAuthor; authorEligible: boolean }
/** `course` is the working copy; `history` holds the 5 newest entries; `changes` = working active nodes, then nodes only the live version has. */
export type ModeratorCourseDetail = { course: ModeratorCourse; author: ArticleAuthor; reviewToken: string; authorEligible: boolean; history: HistoryEntry[]; changes: ChangeChapter[] }

// Reader shapes (PublishedCourse*Response, PublishedLessonResponse, CourseProgressResponse, MyCourseResponse): snapshot content; the price is live on the course.
export type PublicCourseSummary = {
  id: string; title: string; summary: string | null; coverImageUrl: string | null; level: CourseLevel; topic: ArticleOption; tags: ArticleOption[]
  author: ArticleAuthor; publishedAt: string; updatedAt: string; priceAmount: number
}
export type CourseFilter = { keyword: string; topicId: string; tagId: string; level: CourseLevel | ''; sort: 'NEWEST' | 'OLDEST'; page: number }
export type Progress = { completed: number; total: number; percent: number }
export type ContinueLesson = { id: string; title: string; chapterId: string }
export type CourseLearning = {
  courseId: string; progress: Progress; chapters: { chapterId: string; completed: number; total: number; percent: number }[]
  completedLessonIds: string[]; continueLesson: ContinueLesson | null
}
export type Viewer = { enrolled: boolean; canStart: boolean }
export type PublicChapter = { id: string; title: string; position: number; lessons: Omit<LessonItem, 'aiAssisted'>[] }
export type PublicCourseDetail = PublicCourseSummary & {
  description: string | null; versionNumber: number; chapterCount: number; lessonCount: number; chapters: PublicChapter[]; viewer: Viewer; learning: CourseLearning | null
}
export type PublicLesson = {
  courseId: string; courseTitle: string; chapters: PublicChapter[]; viewer: Viewer; learning: CourseLearning | null
  lesson: { id: string; chapterId: string; title: string; summary: string | null; content: string | null; video: { provider: string; videoId: string } | null; position: number; preview: boolean }
}
export type MyCourse = { course: PublicCourseSummary; progress: Progress; continueLesson: ContinueLesson | null; grantedAt: string; lastAccessedAt: string | null }

// OrderResponse (Task 1b): the buyer's view; `vietQr` only while PENDING/EXPIRED and when the receiving account is configured.
export type OrderStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED' | 'CANCELLED'
export type VietQr = { bankId: string; accountNo: string; accountName: string; amount: number; content: string; imageUrl: string }
export type CourseOrder = {
  orderCode: string; courseId: string; courseTitle: string; amount: number; currency: string; status: OrderStatus
  createdAt: string; expiresAt: string; paidAt: string | null; transferReportedAt: string | null; vietQr: VietQr | null
}

// Admin / Author payment shapes (AdminOrderResponse, CommissionPolicyResponse, AuthorRevenueResponse).
export type AdminPayment = { reference: string; amount: number; source: string; confirmedAt: string }
export type AdminOrder = {
  orderCode: string; buyerId: string; buyerName: string | null; buyerEmail: string | null; courseId: string; courseTitle: string; amount: number; currency: string; status: OrderStatus
  createdAt: string; expiresAt: string; paidAt: string | null; transferReportedAt: string | null; needsReconciliation: boolean; reconciledAt: string | null; payments: AdminPayment[]
}
export type AdminOrderFilter = { status?: OrderStatus; code?: string; transferReported?: boolean; needsReconciliation?: boolean; page?: number }
export type CommissionPolicy = { id: string; rateBps: number; effectiveFrom: string }
export type RevenueItem = { courseId: string; courseTitle: string; paidAt: string; unitPriceAmount: number; commissionRateBps: number; commissionAmount: number; authorNetAmount: number }
export type AuthorRevenue = { totals: { itemCount: number; grossAmount: number; platformAmount: number; authorAmount: number; paidOutAmount: number; balanceAmount: number }; items: import('./articles').Page<RevenueItem> }
export type RevenueFilter = { from?: string; to?: string; courseId?: string }
export type RevenueCourseRow = { courseId: string; courseTitle: string; itemCount: number; grossAmount: number; platformAmount: number; authorAmount: number }
export type PayoutAccountForm = { bankId: string; accountNo: string; accountName: string }
export type PayoutAccount = PayoutAccountForm & { bankName: string; updatedAt: string }
export type PayoutAccountView = { account: PayoutAccount | null; banks: { id: string; name: string }[] }
/** `accountNo` arrives masked to its last 4 characters. */
export type AdminRevenue = { totals: { itemCount: number; grossAmount: number; platformAmount: number; authorAmount: number }; ledger: { earnedAmount: number; paidOutAmount: number; owedAmount: number }; courses: import('./articles').Page<RevenueCourseRow & { authorId: string; authorName: string }> }
export type AuthorBalance = { authorId: string; fullName: string; email: string; earnedAmount: number; paidOutAmount: number; balanceAmount: number; account: PayoutAccount | null; vietQr: VietQr | null }
export type AdminPayout = { id: string; authorId: string; authorName: string; amount: number; bankReference: string; bankId: string; bankName: string; accountNo: string; accountName: string; recordedById: string; recordedByName: string; createdAt: string; accountChanged: boolean | null }
export type PayoutRecord = { authorId: string; amount: number; bankReference: string; bankId: string; accountNo: string; accountName: string }
export type AuthorPayout = { amount: number; bankReference: string; accountNo: string; createdAt: string }
