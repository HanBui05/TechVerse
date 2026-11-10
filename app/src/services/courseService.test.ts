import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAccessToken } from './api/client'
import { authorCourses, changedLessonFields, courseChangedFields, courseReadiness, isCourseImage, lessonChangedFields, moderatorCourses, videoLink, visibleChanges, youtubeId } from './courseService'
import type { AuthorCourse, ChangeChapter, Lesson } from '../types/courses'

const fetchMock = vi.fn<typeof fetch>()
const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ status, message: 'OK', data }), { status })
const call = (i = 0) => ({ url: new URL(String(fetchMock.mock.calls[i][0])), init: fetchMock.mock.calls[i][1]! })
const headers = (i = 0) => new Headers(call(i).init.headers)

beforeEach(() => { setAccessToken('t'); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => { setAccessToken(null); vi.unstubAllGlobals() })

const course = {
  id: 'c1', authorId: 'a1', title: 'Java', summary: 'Sum', description: 'Desc', level: 'BEGINNER', coverImageUrl: null, topic: { id: 't1', name: 'Java' }, tags: [{ id: 'g1', name: 'oop' }],
  workflowStatus: 'DRAFT', publicationStatus: 'UNPUBLISHED', fingerprint: 'f', hasUnpublishedChanges: false, publishedVersion: null, imageIssues: [], moderationNote: null, reviewedAt: null, publishedAt: null, createdAt: '', updatedAt: '',
  chapters: [{ id: 'ch1', title: 'One', position: 0, lessons: [{ id: 'l1', title: 'A', summary: null, position: 0, preview: false, hasVideo: true, hasContent: false, aiAssisted: false }] }],
} as AuthorCourse
const lesson = { id: 'l1', chapterId: 'ch1', versionId: null, title: 'A', summary: null, content: '# hi', video: { provider: 'YOUTUBE', videoId: 'dQw4w9WgXcQ' }, preview: false, position: 0, aiAssisted: false, fingerprint: '', imageIssues: [] } as Lesson

describe('authorCourses API', () => {
  it('lists with the article filter and sends no empty params', async () => {
    fetchMock.mockResolvedValue(ok({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, hasNext: false }))
    await authorCourses.list({ page: 0, size: 20, keyword: '', workflowStatus: 'DRAFT', sortBy: 'UPDATED_AT', direction: 'DESC' })
    const { url } = call()
    expect(url.pathname).toBe('/api/v1/author/courses')
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '0', size: '20', workflowStatus: 'DRAFT', sortBy: 'UPDATED_AT', direction: 'DESC' })
  })

  it('creates with an Idempotency-Key and patches, withdraws, discards and hides on the course paths', async () => {
    fetchMock.mockResolvedValue(ok(course))
    await authorCourses.create({ action: 'SAVE', title: 'Java' }, 'key-1')
    expect(call().init.method).toBe('POST'); expect(headers().get('Idempotency-Key')).toBe('key-1')
    await authorCourses.update('c1', { action: 'SUBMIT' })
    expect(call(1).url.pathname).toBe('/api/v1/author/courses/c1'); expect(call(1).init.method).toBe('PATCH')
    await authorCourses.withdraw('c1'); await authorCourses.discard('c1'); await authorCourses.publication('c1', 'HIDE')
    expect(call(2).url.pathname).toBe('/api/v1/author/courses/c1/withdraw')
    expect(call(3).url.pathname).toBe('/api/v1/author/courses/c1/discard')
    expect(call(4).url.pathname).toBe('/api/v1/author/courses/c1/publication'); expect(JSON.parse(String(call(4).init.body))).toEqual({ action: 'HIDE' })
  })

  it('manages chapters and reorders by the exact colon paths', async () => {
    fetchMock.mockResolvedValue(ok(course))
    await authorCourses.addChapter('c1', 'One'); await authorCourses.editChapter('c1', 'ch1', 'Two'); await authorCourses.deleteChapter('c1', 'ch1')
    await authorCourses.reorderChapters('c1', ['b', 'a']); await authorCourses.reorderLessons('c1', 'ch1', ['y', 'x'])
    expect(call(0).url.pathname).toBe('/api/v1/author/courses/c1/chapters'); expect(call(0).init.method).toBe('POST')
    expect(JSON.parse(String(call(1).init.body))).toEqual({ title: 'Two' }); expect(call(2).init.method).toBe('DELETE')
    expect(call(3).url.pathname).toBe('/api/v1/author/courses/c1/chapters:reorder'); expect(call(3).init.method).toBe('PUT')
    expect(JSON.parse(String(call(3).init.body))).toEqual({ ids: ['b', 'a'] })
    expect(call(4).url.pathname).toBe('/api/v1/author/courses/c1/chapters/ch1/lessons:reorder')
  })

  it('creates a lesson with an Idempotency-Key, reads a snapshot lesson with versionId and uploads with an Upload-Key', async () => {
    fetchMock.mockResolvedValue(ok(lesson))
    await authorCourses.createLesson('c1', 'ch1', { title: 'A', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }, 'k2')
    expect(call(0).url.pathname).toBe('/api/v1/author/courses/c1/chapters/ch1/lessons'); expect(headers(0).get('Idempotency-Key')).toBe('k2')
    await authorCourses.lesson('c1', 'l1'); await authorCourses.lesson('c1', 'l1', 'v9')
    expect(call(1).url.search).toBe(''); expect(call(2).url.searchParams.get('versionId')).toBe('v9')
    await authorCourses.updateLesson('c1', 'l1', { content: null }); expect(call(3).init.method).toBe('PATCH'); expect(JSON.parse(String(call(3).init.body))).toEqual({ content: null })
    await authorCourses.deleteLesson('c1', 'l1'); expect(call(4).init.method).toBe('DELETE')
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await authorCourses.uploadLessonImage('c1', 'l1', file, 'up-1'); await authorCourses.uploadCourseImage('c1', file, 'up-2')
    expect(call(5).url.pathname).toBe('/api/v1/author/courses/c1/lessons/l1/images'); expect(headers(5).get('Upload-Key')).toBe('up-1')
    expect(call(6).url.pathname).toBe('/api/v1/author/courses/c1/images'); expect(headers(6).get('Upload-Key')).toBe('up-2')
  })

  it('imports, lists options and history, and deletes', async () => {
    fetchMock.mockResolvedValue(ok({}))
    await authorCourses.importFile(new File(['# x'], 'a.md')); await authorCourses.options(); await authorCourses.history('c1', 2); await authorCourses.remove('c1')
    expect(call(0).url.pathname).toBe('/api/v1/author/courses/import')
    expect(call(1).url.pathname).toBe('/api/v1/author/courses/options')
    expect(call(2).url.searchParams.get('page')).toBe('2')
    expect(call(3).init.method).toBe('DELETE')
  })
})

describe('YouTube helpers', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'], ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'], ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('reads the ID of %s', (url, id) => expect(youtubeId(url)).toBe(id))

  it.each(['http://youtu.be/dQw4w9WgXcQ', 'https://evil.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ', 'https://u@youtu.be/dQw4w9WgXcQ',
    'https://youtu.be:444/dQw4w9WgXcQ', 'https://www.youtube.com/playlist?list=abc', 'https://youtu.be/short', 'nonsense', ''])('rejects %s', url => expect(youtubeId(url)).toBeNull())

  it('renders a stored ID back as the youtu.be link', () => expect(videoLink('dQw4w9WgXcQ')).toBe('https://youtu.be/dQw4w9WgXcQ'))
})

describe('course helpers', () => {
  it('sends only changed course fields and compares tags as a set', () => {
    const form = { title: 'Java', summary: 'New', description: 'Desc', level: 'BEGINNER' as const, topicId: 't1', tagIds: ['g1'], coverImageUrl: null }
    expect(courseChangedFields(form, course)).toEqual({ summary: 'New' })
    expect(courseChangedFields({ ...form, tagIds: ['g1', 'g2'] }, course)).toEqual({ summary: 'New', tagIds: ['g1', 'g2'] })
    expect(courseChangedFields(form, null)).toBe(form)
  })

  it('sends only changed lesson fields; an emptied optional field becomes null', () => {
    const form = { title: 'A', summary: '', content: '', videoUrl: 'https://youtu.be/dQw4w9WgXcQ', preview: true }
    expect(lessonChangedFields(form, lesson)).toEqual({ content: null, preview: true })
    expect(lessonChangedFields({ ...form, videoUrl: '' }, lesson)).toMatchObject({ videoUrl: null })
  })

  it('lists what is missing before submit as links to tree items', () => {
    expect(courseReadiness(course)).toEqual([])
    const empty = { ...course, summary: '', description: ' ', chapters: [{ id: 'ch1', title: 'One', position: 0, lessons: [] }], imageIssues: [{}, {}] } as unknown as AuthorCourse
    expect(courseReadiness(empty)).toEqual([{ kind: 'summary' }, { kind: 'description' }, { kind: 'emptyChapter', chapterId: 'ch1' }, { kind: 'images', count: 2 }])
    expect(courseReadiness({ ...course, chapters: [] })).toEqual([{ kind: 'noChapter' }])
  })
})

describe('moderator courses', () => {
  it('sends the review token and a trimmed note (null when blank); the lesson of a snapshot goes by versionId', async () => {
    fetchMock.mockImplementation(async () => ok({}))
    await moderatorCourses.review('c1', 'REQUEST_CHANGES', 'tok', '  fix  ')
    await moderatorCourses.publication('c1', 'RESTORE', 'tok', '  ')
    await moderatorCourses.lesson('c1', 'l1', 'v1')
    await moderatorCourses.list({ page: 0, size: 12, workflowStatus: 'PENDING', keyword: '' })
    expect([call(0).url.pathname, call(0).init.method, JSON.parse(String(call(0).init.body))]).toEqual(['/api/v1/moderator/courses/c1/review', 'PATCH', { decision: 'REQUEST_CHANGES', reviewToken: 'tok', moderationNote: 'fix' }])
    expect(JSON.parse(String(call(1).init.body))).toEqual({ action: 'RESTORE', reviewToken: 'tok', moderationNote: null })
    expect(call(2).url.pathname + call(2).url.search).toBe('/api/v1/moderator/courses/c1/lessons/l1?versionId=v1')
    expect(call(3).url.search).toBe('?page=0&size=12&workflowStatus=PENDING')
  })

  it('keeps only changed nodes by default; a chapter stays when one of its lessons changed', () => {
    const tree: ChangeChapter[] = [
      { id: 'a', title: 'A', changeStatus: 'UNCHANGED', lessons: [{ id: 'a1', title: 'A1', changeStatus: 'UNCHANGED' }, { id: 'a2', title: 'A2', changeStatus: 'NEW' }] },
      { id: 'b', title: 'B', changeStatus: 'UNCHANGED', lessons: [{ id: 'b1', title: 'B1', changeStatus: 'UNCHANGED' }] },
      { id: 'c', title: 'C', changeStatus: 'ARCHIVED', lessons: [] },
    ]
    expect(visibleChanges(tree, false)).toEqual([{ ...tree[0], lessons: [tree[0].lessons[1]] }, tree[2]])
    expect(visibleChanges(tree, true)).toBe(tree)
  })

  it('compares lesson fields: title, summary, preview, video by ID and content', () => {
    const live = { ...lesson, versionId: 'v1' }
    expect(changedLessonFields(lesson, live)).toEqual([])
    expect(changedLessonFields({ ...lesson, title: 'B', summary: '', preview: true, video: null, content: 'x' }, live)).toEqual(['title', 'preview', 'video', 'content'])
  })

  it('shows only images stored under this author and course (course or lesson scope)', () => {
    const root = 'https://res.cloudinary.com/demo/image/upload/v1/techverse'
    expect(isCourseImage(`${root}/course/a1/c1/img.png`, 'a1', 'c1')).toBe(true)
    expect(isCourseImage(`${root}/lesson/a1/c1/l1/img.png`, 'a1', 'c1')).toBe(true)
    expect(isCourseImage(`${root}/course/a2/c1/img.png`, 'a1', 'c1')).toBe(false)
    expect(isCourseImage(`${root}/lesson/a1/c9/l1/img.png`, 'a1', 'c1')).toBe(false)
    expect(isCourseImage('https://evil.com/course/a1/c1/img.png', 'a1', 'c1')).toBe(false)
    expect(isCourseImage(`${root}/course/a1/c1/img.png?x=1`, 'a1', 'c1')).toBe(false)
  })
})
