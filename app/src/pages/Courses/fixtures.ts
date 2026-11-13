import type { CourseLearning, PublicCourseDetail, PublicCourseSummary, PublicLesson } from '../../types/courses'

export const json = (data: unknown, status = 200, code?: string) => new Response(JSON.stringify({ status, code, message: 'English message', data }), { status })
export const page = <T,>(content: T[], totalPages = 1) => ({ content, page: 0, size: 9, totalElements: content.length, totalPages, hasNext: false })
export const options = { topics: page([{ id: 'java', name: 'Java' }]), tags: page([{ id: 'spring', name: 'Spring' }]) }

export const summary: PublicCourseSummary = {
  id: 'c1', title: 'Java cơ bản', summary: 'Học Java từ đầu', coverImageUrl: null, level: 'BEGINNER', topic: { id: 'java', name: 'Java' }, tags: [{ id: 'spring', name: 'Spring' }],
  author: { id: 'a1', fullName: 'Trần B', avatarUrl: null }, publishedAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-08T00:00:00Z',
}
const item = (id: string, position: number, title: string, preview = false, hasVideo = false) => ({ id, title, summary: null, position, preview, hasVideo, hasContent: !hasVideo })
export const chapters = [
  { id: 'ch1', title: 'Làm quen', position: 0, lessons: [item('l1', 0, 'Giới thiệu', true), item('l2', 1, 'Cài đặt', false, true)] },
  { id: 'ch2', title: 'Nâng cao', position: 1, lessons: [item('l3', 0, 'Lớp và đối tượng')] },
]
export const learning: CourseLearning = {
  courseId: 'c1', progress: { completed: 1, total: 3, percent: 33 }, chapters: [{ chapterId: 'ch1', completed: 1, total: 2, percent: 50 }, { chapterId: 'ch2', completed: 0, total: 1, percent: 0 }],
  completedLessonIds: ['l1'], continueLesson: { id: 'l2', title: 'Cài đặt', chapterId: 'ch1' },
}
export const detail = (over: Partial<PublicCourseDetail> = {}): PublicCourseDetail => ({
  ...summary, description: '## Bạn sẽ học\n\nNội dung chi tiết', versionNumber: 1, chapterCount: 2, lessonCount: 3, chapters, viewer: { enrolled: false, canStart: true }, learning: null, ...over,
})
export const lessonOf = (id: string, over: Partial<PublicLesson> = {}): PublicLesson => ({
  courseId: 'c1', courseTitle: 'Java cơ bản', chapters, viewer: { enrolled: true, canStart: true }, learning,
  lesson: { id, chapterId: 'ch1', title: id === 'l2' ? 'Cài đặt' : 'Giới thiệu', summary: null, content: '## Mở đầu\n\nXin chào\n\n### Chi tiết\n\nThêm', video: null, position: 1, preview: false }, ...over,
})
