import { request } from './api/client'
import type { ArticleOption, AuthorArticleFilter, HistoryEntry, ImageIssue, ModeratorArticleFilter, Page } from '../types/articles'
import type { AuthorCourse, CourseFilter, CourseLearning, CourseLevel, MyCourse, PublicChapter, PublicCourseDetail, PublicCourseSummary, PublicLesson, Viewer, AuthorCourseSummary, ChangeChapter, CourseFields, CourseWrite, Lesson, LessonFields, LessonWrite, ModeratorCourseDetail, ModeratorCourseSummary } from '../types/courses'

const base = '/api/v1/author/courses'
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })
const withKey = (method: string, body: unknown, name: string, key: string): RequestInit => ({ ...json(method, body), headers: { [name]: key } })
const multipart = (file: File, headers: HeadersInit = {}): RequestInit => { const body = new FormData(); body.append('file', file); return { method: 'POST', headers, body } }
const query = (filter: object) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) if (value !== '' && value !== undefined) params.set(key, String(value))
  return params
}

export const authorCourses = {
  list: (filter: AuthorArticleFilter) => request<Page<AuthorCourseSummary>>(`${base}?${query(filter)}`),
  options: () => request<{ topics: Page<ArticleOption>; tags: Page<ArticleOption> }>(`${base}/options?topicSize=100&tagSize=100`),
  detail: (id: string) => request<AuthorCourse>(`${base}/${id}`),
  create: (body: CourseWrite, idempotencyKey: string) => request<AuthorCourse>(base, withKey('POST', body, 'Idempotency-Key', idempotencyKey)),
  update: (id: string, body: CourseWrite) => request<AuthorCourse>(`${base}/${id}`, json('PATCH', body)),
  withdraw: (id: string) => request<AuthorCourse>(`${base}/${id}/withdraw`, { method: 'POST' }),
  discard: (id: string) => request<AuthorCourse>(`${base}/${id}/discard`, { method: 'POST' }),
  publication: (id: string, action: 'HIDE' | 'UNHIDE') => request<AuthorCourse>(`${base}/${id}/publication`, json('PATCH', { action })),
  remove: (id: string) => request<void>(`${base}/${id}`, { method: 'DELETE' }),
  history: (id: string, page: number) => request<Page<HistoryEntry>>(`${base}/${id}/history?page=${page}&size=10`),
  importFile: (file: File) => request<{ filename: string; content: string; imageIssues: ImageIssue[] }>(`${base}/import`, multipart(file)),
  uploadCourseImage: (id: string, file: File, uploadKey: string) => request<{ url: string }>(`${base}/${id}/images`, multipart(file, { 'Upload-Key': uploadKey })),
  uploadLessonImage: (id: string, lessonId: string, file: File, uploadKey: string) => request<{ url: string }>(`${base}/${id}/lessons/${lessonId}/images`, multipart(file, { 'Upload-Key': uploadKey })),
  addChapter: (id: string, title: string) => request<AuthorCourse>(`${base}/${id}/chapters`, json('POST', { title })),
  editChapter: (id: string, chapterId: string, title: string) => request<AuthorCourse>(`${base}/${id}/chapters/${chapterId}`, json('PATCH', { title })),
  deleteChapter: (id: string, chapterId: string) => request<AuthorCourse>(`${base}/${id}/chapters/${chapterId}`, { method: 'DELETE' }),
  reorderChapters: (id: string, ids: string[]) => request<AuthorCourse>(`${base}/${id}/chapters:reorder`, json('PUT', { ids })),
  createLesson: (id: string, chapterId: string, body: LessonWrite, idempotencyKey: string) => request<Lesson>(`${base}/${id}/chapters/${chapterId}/lessons`, withKey('POST', body, 'Idempotency-Key', idempotencyKey)),
  reorderLessons: (id: string, chapterId: string, ids: string[]) => request<AuthorCourse>(`${base}/${id}/chapters/${chapterId}/lessons:reorder`, json('PUT', { ids })),
  lesson: (id: string, lessonId: string, versionId?: string) => request<Lesson>(`${base}/${id}/lessons/${lessonId}${versionId ? `?versionId=${encodeURIComponent(versionId)}` : ''}`),
  updateLesson: (id: string, lessonId: string, body: LessonWrite) => request<Lesson>(`${base}/${id}/lessons/${lessonId}`, json('PATCH', body)),
  deleteLesson: (id: string, lessonId: string) => request<AuthorCourse>(`${base}/${id}/lessons/${lessonId}`, { method: 'DELETE' }),
}

const moderatorBase = '/api/v1/moderator/courses'
const note = (text: string) => text.trim() || null

export const moderatorCourses = {
  list: (filter: ModeratorArticleFilter) => request<Page<ModeratorCourseSummary>>(`${moderatorBase}?${query(filter)}`),
  detail: (id: string) => request<ModeratorCourseDetail>(`${moderatorBase}/${id}`),
  lesson: (id: string, lessonId: string, versionId?: string) => request<Lesson>(`${moderatorBase}/${id}/lessons/${lessonId}${versionId ? `?versionId=${encodeURIComponent(versionId)}` : ''}`),
  review: (id: string, decision: 'APPROVE' | 'REQUEST_CHANGES', reviewToken: string, text: string) =>
    request<ModeratorCourseDetail>(`${moderatorBase}/${id}/review`, json('PATCH', { decision, reviewToken, moderationNote: note(text) })),
  publication: (id: string, action: 'HIDE' | 'RESTORE' | 'REMOVE', reviewToken: string, text: string) =>
    request<ModeratorCourseDetail>(`${moderatorBase}/${id}/publication`, json('PATCH', { action, reviewToken, moderationNote: note(text) })),
  history: (id: string, page: number) => request<Page<HistoryEntry>>(`${moderatorBase}/${id}/history?page=${page}&size=10`),
}

/** “Changes only” hides UNCHANGED lessons, and UNCHANGED chapters left without a changed lesson. */
export function visibleChanges(tree: ChangeChapter[], all: boolean): ChangeChapter[] {
  if (all) return tree
  return tree.flatMap(chapter => {
    const lessons = chapter.lessons.filter(lesson => lesson.changeStatus !== 'UNCHANGED')
    return chapter.changeStatus !== 'UNCHANGED' || lessons.length ? [{ ...chapter, lessons }] : []
  })
}

export type LessonField = 'title' | 'summary' | 'preview' | 'video' | 'content'
/** Lesson fields of the proposal that differ from the live snapshot; video compares by ID. */
export function changedLessonFields(proposed: Lesson, live: Lesson): LessonField[] {
  const differs: [LessonField, boolean][] = [
    ['title', proposed.title !== live.title], ['summary', (proposed.summary ?? '') !== (live.summary ?? '')], ['preview', proposed.preview !== live.preview],
    ['video', (proposed.video?.videoId ?? null) !== (live.video?.videoId ?? null)], ['content', (proposed.content ?? '') !== (live.content ?? '')],
  ]
  return differs.filter(([, d]) => d).map(([field]) => field)
}

/** ArticleImageService.prefix for COURSE (`course/<author>/<course>/`) and LESSON (`lesson/<author>/<course>/<lesson>/`) on Cloudinary; no query/port/userinfo. */
export function isCourseImage(url: string, authorId: string, courseId: string) {
  const match = /^https:\/\/res\.cloudinary\.com\/[^/?#:@]+\/image\/upload\/v\d+\/([A-Za-z0-9_/-]+)\/[A-Za-z0-9_-]+\.png$/.exec(url)
  if (!match) return false
  const path = `/${match[1]}`
  return path.endsWith(`/course/${authorId}/${courseId}`) || new RegExp(`/lesson/${authorId}/${courseId}/[A-Za-z0-9-]+$`).test(path)
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
/**
 * Client copy of the backend YouTube rule, only to show a preview: HTTPS, no userinfo/port, youtube.com `watch?v=`, `/shorts/`, `/embed/` or youtu.be.
 * The server stays the final judge (`LESSON_VIDEO_INVALID`).
 */
export function youtubeId(input: string): string | null {
  let url: URL
  try { url = new URL(input.trim()) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  const host = url.hostname.toLowerCase()
  const parts = url.pathname.split('/').filter(Boolean)
  const id = host === 'youtu.be' ? (parts.length === 1 ? parts[0] : null)
    : host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com'
      ? (url.pathname === '/watch' ? url.searchParams.get('v') : parts.length === 2 && (parts[0] === 'shorts' || parts[0] === 'embed') ? parts[1] : null)
      : null
  return id && VIDEO_ID.test(id) ? id : null
}
export const videoLink = (videoId: string) => `https://youtu.be/${videoId}`

/** Fields that differ from the saved course (PATCH sends only these); tags compare as a set. */
export function courseChangedFields(form: CourseFields, saved: AuthorCourse | null): Partial<CourseFields> {
  if (!saved) return form
  const savedTags = saved.tags.map(tag => tag.id)
  const diff: Partial<CourseFields> = {}
  if (form.title !== saved.title) diff.title = form.title
  if (form.summary !== (saved.summary ?? '')) diff.summary = form.summary
  if (form.description !== (saved.description ?? '')) diff.description = form.description
  if (form.level !== saved.level) diff.level = form.level
  if (form.topicId !== saved.topic.id) diff.topicId = form.topicId
  if (form.tagIds.length !== savedTags.length || form.tagIds.some(id => !savedTags.includes(id))) diff.tagIds = form.tagIds
  if (form.coverImageUrl !== saved.coverImageUrl) diff.coverImageUrl = form.coverImageUrl
  return diff
}

/** Lesson fields that differ from the saved lesson; an emptied summary/content/video is sent as null (clear). */
export function lessonChangedFields(form: LessonFields, saved: Lesson): LessonWrite {
  const diff: LessonWrite = {}
  const savedVideo = saved.video ? videoLink(saved.video.videoId) : ''
  if (form.title !== saved.title) diff.title = form.title
  if (form.summary !== (saved.summary ?? '')) diff.summary = form.summary.trim() ? form.summary : null
  if (form.content !== (saved.content ?? '')) diff.content = form.content.trim() ? form.content : null
  if (form.videoUrl.trim() !== savedVideo) diff.videoUrl = form.videoUrl.trim() || null
  if (form.preview !== saved.preview) diff.preview = form.preview
  return diff
}

export type Readiness = { kind: 'noChapter' } | { kind: 'summary' } | { kind: 'description' } | { kind: 'emptyChapter'; chapterId: string } | { kind: 'images'; count: number }
/** What the server will refuse on SUBMIT, computed from the tree (`COURSE_NOT_READY` is the final word). */
export function courseReadiness(course: AuthorCourse): Readiness[] {
  const missing: Readiness[] = []
  if (!course.chapters.length) missing.push({ kind: 'noChapter' })
  if (!course.summary?.trim()) missing.push({ kind: 'summary' })
  if (!course.description?.trim()) missing.push({ kind: 'description' })
  for (const chapter of course.chapters) if (!chapter.lessons.length) missing.push({ kind: 'emptyChapter', chapterId: chapter.id })
  if (course.imageIssues.length) missing.push({ kind: 'images', count: course.imageIssues.length })
  return missing
}

// Reader side (PublishedCourseController): public GETs carry the optional bearer; start/completion/mine need a signed-in Reader.
export const COURSE_PAGE_SIZE = 9
const publicBase = '/api/v1/courses'
export const publicCourses = {
  list: (filter: CourseFilter) => request<Page<PublicCourseSummary>>(`${publicBase}?${query({ ...filter, size: COURSE_PAGE_SIZE })}`),
  options: () => request<{ topics: Page<ArticleOption>; tags: Page<ArticleOption> }>(`${publicBase}/options?topicSize=100&tagSize=100`),
  detail: (id: string) => request<PublicCourseDetail>(`${publicBase}/${encodeURIComponent(id)}`),
  lesson: (id: string, lessonId: string) => request<PublicLesson>(`${publicBase}/${encodeURIComponent(id)}/lessons/${encodeURIComponent(lessonId)}`),
  start: (id: string) => request<CourseLearning>(`${publicBase}/${encodeURIComponent(id)}/start`, { method: 'POST' }),
  complete: (id: string, lessonId: string, done: boolean) => request<CourseLearning>(`${publicBase}/${encodeURIComponent(id)}/lessons/${encodeURIComponent(lessonId)}/completion`, { method: done ? 'PUT' : 'DELETE' }),
  mine: (page: number) => request<Page<MyCourse>>(`/api/v1/me/courses?${query({ page, size: COURSE_PAGE_SIZE })}`),
}

const LEVELS: string[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']
/** `/courses` query → filter; unknown level/sort and malformed page fall back to the defaults. */
export function courseFilter(params: URLSearchParams): CourseFilter {
  const page = Number(params.get('page'))
  const level = params.get('level') ?? ''
  return {
    keyword: (params.get('keyword') ?? '').trim(), topicId: params.get('topicId') ?? '', tagId: params.get('tagId') ?? '', level: LEVELS.includes(level) ? level as CourseLevel : '',
    sort: params.get('sort') === 'OLDEST' ? 'OLDEST' : 'NEWEST', page: Number.isInteger(page) && page > 0 ? page : 0,
  }
}
/** Filter → query without empty or default params (NEWEST, page 0). */
export function courseSearch({ keyword, topicId, tagId, level, sort, page }: CourseFilter) {
  const params = new URLSearchParams()
  if (keyword.trim()) params.set('keyword', keyword.trim())
  if (topicId) params.set('topicId', topicId)
  if (tagId) params.set('tagId', tagId)
  if (level) params.set('level', level)
  if (sort !== 'NEWEST') params.set('sort', sort)
  if (page > 0) params.set('page', String(page))
  return params
}

export type LessonAccess = 'open' | 'login' | 'start' | 'locked'
/** Wireframe 2c-2 table: enrolled or preview opens; otherwise Guest logs in, a Learner starts, the owner stays locked. */
export function lessonAccess(lesson: { preview: boolean }, viewer: Viewer, authenticated: boolean): LessonAccess {
  if (viewer.enrolled || lesson.preview) return 'open'
  if (!authenticated) return 'login'
  return viewer.canStart ? 'start' : 'locked'
}

export const flatLessons = (chapters: PublicChapter[]) => chapters.flatMap(chapter => chapter.lessons)

/** The only iframe source: a YouTube id the backend already validated, re-checked here; never a raw URL. */
export function embedUrl(video: { provider: string; videoId: string } | null) {
  return video?.provider === 'YOUTUBE' && VIDEO_ID.test(video.videoId) ? `https://www.youtube-nocookie.com/embed/${video.videoId}` : null
}
