import { request } from './api/client'
import type { ArticleOption, AuthorArticleFilter, HistoryEntry, ImageIssue, Page } from '../types/articles'
import type { AuthorCourse, AuthorCourseSummary, CourseFields, CourseWrite, Lesson, LessonFields, LessonWrite } from '../types/courses'

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
