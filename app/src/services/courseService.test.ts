import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAccessToken } from './api/client'
import { lessonTutor, authorCourses, authorShare, changedLessonFields, courseFilter, courseSearch, embedUrl, flatLessons, lessonAccess, publicCourses, courseChangedFields, courseReadiness, isCourseImage, lessonChangedFields, moderatorCourses, orders, adminOrders, commission, revenue, revenueByCourse, payoutAccount, payouts, rateBps, amountText, priceValid, payosSrc, qrSrc, videoLink, visibleChanges, vnd, youtubeId } from './courseService'
import type { AuthorCourse, ChangeChapter, Lesson, ModeratorCourseDetail } from '../types/courses'

const fetchMock = vi.fn<typeof fetch>()
const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ status, message: 'OK', data }), { status })
const call = (i = 0) => ({ url: new URL(String(fetchMock.mock.calls[i][0])), init: fetchMock.mock.calls[i][1]! })
const headers = (i = 0) => new Headers(call(i).init.headers)

beforeEach(() => { setAccessToken('t'); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => { setAccessToken(null); vi.unstubAllGlobals() })

const course = {
  id: 'c1', authorId: 'a1', title: 'Java', summary: 'Sum', description: 'Desc', level: 'BEGINNER', coverImageUrl: null, topic: { id: 't1', name: 'Java' }, tags: [{ id: 'g1', name: 'oop' }],
  workflowStatus: 'DRAFT', publicationStatus: 'UNPUBLISHED', fingerprint: 'f', hasUnpublishedChanges: false, publishedVersion: null, imageIssues: [], moderationNote: null, reviewedAt: null, publishedAt: null, createdAt: '', updatedAt: '', priceAmount: 0, commissionRateBps: 2000,
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
    const form = { title: 'Java', summary: 'New', description: 'Desc', level: 'BEGINNER' as const, topicId: 't1', tagIds: ['g1'], coverImageUrl: null, priceAmount: 0 }
    expect(courseChangedFields(form, course)).toEqual({ summary: 'New' })
    expect(courseChangedFields({ ...form, priceAmount: 350000 }, course)).toEqual({ summary: 'New', priceAmount: 350000 })
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

describe('reader course API and helpers', () => {
  it('lists with size 9, no empty params, and calls detail/lesson/start/completion/mine on the public paths', async () => {
    fetchMock.mockResolvedValue(ok({}))
    await publicCourses.list({ keyword: 'java', topicId: '', tagId: '', level: 'ADVANCED', sort: 'NEWEST', page: 1 })
    expect(Object.fromEntries(call(0).url.searchParams)).toEqual({ keyword: 'java', level: 'ADVANCED', sort: 'NEWEST', page: '1', size: '9' })
    await publicCourses.options()
    await publicCourses.detail('c1'); await publicCourses.lesson('c1', 'l1'); await publicCourses.start('c1')
    await publicCourses.complete('c1', 'l1', true); await publicCourses.complete('c1', 'l1', false); await publicCourses.mine(2)
    const calls = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${new URL(String(url)).pathname}`)
    expect(calls.slice(1)).toEqual(['GET /api/v1/courses/options', 'GET /api/v1/courses/c1', 'GET /api/v1/courses/c1/lessons/l1', 'POST /api/v1/courses/c1/start',
      'PUT /api/v1/courses/c1/lessons/l1/completion', 'DELETE /api/v1/courses/c1/lessons/l1/completion', 'GET /api/v1/me/courses'])
    expect(call(7).url.searchParams.get('page')).toBe('2')
  })

  it('round-trips the URL filter and falls back on unknown level/sort/page', () => {
    const filter = courseFilter(new URLSearchParams('keyword=%20x%20&level=BAD&sort=OLDEST&page=-3&topicId=t'))
    expect(filter).toEqual({ keyword: 'x', topicId: 't', tagId: '', level: '', sort: 'OLDEST', page: 0 })
    expect(courseSearch({ ...filter, level: 'BEGINNER', page: 2 }).toString()).toBe('keyword=x&topicId=t&level=BEGINNER&sort=OLDEST&page=2')
    expect(courseSearch(courseFilter(new URLSearchParams())).toString()).toBe('')
  })

  it('decides what clicking a lesson does by viewer and preview', () => {
    const l = (preview: boolean) => ({ preview })
    expect(lessonAccess(l(false), { enrolled: true, canStart: true }, true)).toBe('open')
    expect(lessonAccess(l(true), { enrolled: false, canStart: true }, false)).toBe('open')
    expect(lessonAccess(l(false), { enrolled: false, canStart: true }, false)).toBe('login')
    expect(lessonAccess(l(false), { enrolled: false, canStart: true }, true)).toBe('start')
    expect(lessonAccess(l(false), { enrolled: false, canStart: false }, true)).toBe('locked')
  })

  it('sends a signed-in Learner of a paid course to buy, never to start; Guest, owner, preview and enrolled keep their mode', () => {
    const l = (preview: boolean) => ({ preview })
    expect(lessonAccess(l(false), { enrolled: false, canStart: true }, true, true)).toBe('buy')
    expect(lessonAccess(l(false), { enrolled: false, canStart: true }, false, true)).toBe('login')
    expect(lessonAccess(l(false), { enrolled: false, canStart: false }, true, true)).toBe('locked')
    expect(lessonAccess(l(true), { enrolled: false, canStart: true }, true, true)).toBe('open')
    expect(lessonAccess(l(false), { enrolled: true, canStart: true }, true, true)).toBe('open')
  })

  it('embeds only a valid YouTube id on youtube-nocookie and flattens lessons in order', () => {
    expect(embedUrl({ provider: 'YOUTUBE', videoId: 'dQw4w9WgXcQ' })).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(embedUrl({ provider: 'VIMEO', videoId: 'dQw4w9WgXcQ' })).toBeNull()
    expect(embedUrl({ provider: 'YOUTUBE', videoId: '"><script' })).toBeNull()
    expect(flatLessons([{ id: 'c', title: '', position: 0, lessons: [{ id: 'a' }, { id: 'b' }] }, { id: 'd', title: '', position: 1, lessons: [{ id: 'e' }] }] as never).map(x => x.id)).toEqual(['a', 'b', 'e'])
  })
})

describe('price helpers (Task 1a rules: 0 or 10.000–50.000.000 whole VND)', () => {
  it('accepts the free price and the paid range with its edges, nothing else', () => {
    for (const ok of [0, 10_000, 350_000, 50_000_000]) expect(priceValid(ok), String(ok)).toBe(true)
    for (const bad of [9_999, 50_000_001, -1, 1.5, Number.NaN, 1 / 0]) expect(priceValid(bad), String(bad)).toBe(false)
  })

  it('splits a price by basis points with floor, like the server snapshot', () => {
    expect(authorShare(350_000, 2000)).toEqual({ platform: 70_000, author: 280_000 })
    expect(authorShare(10_001, 3333)).toEqual({ platform: 3333, author: 6668 })
    expect(authorShare(350_000, 0)).toEqual({ platform: 0, author: 350_000 })
  })

  it('formats whole VND by language', () => {
    expect(vnd(350_000, 'vi')).toMatch(/^350\.000\s₫$/)
    expect(vnd(1_250_000, 'en')).toMatch(/1,250,000/)
    expect(vnd(0, 'vi')).toMatch(/^0\s₫$/)
  })
})

describe('orders API', () => {
  it('creates an order with only the course id and returns the order to open', async () => {
    fetchMock.mockResolvedValue(ok({ orderCode: 'TV000000000123' }, 201))
    const order = await orders.create('c1')
    expect(order.orderCode).toBe('TV000000000123')
    expect(call().url.pathname).toBe('/api/v1/orders')
    expect(call().init.method).toBe('POST')
    expect(JSON.parse(String(call().init.body))).toEqual({ courseId: 'c1' })
  })

  it('lists my orders by page, reads one by code and reports a transfer without a body', async () => {
    fetchMock.mockResolvedValue(ok({ content: [], page: 0, size: 9, totalElements: 0, totalPages: 0, hasNext: false }))
    await orders.mine(2)
    expect(call().url.pathname).toBe('/api/v1/me/orders'); expect(Object.fromEntries(call().url.searchParams)).toEqual({ page: '2', size: '9' })
    fetchMock.mockResolvedValue(ok({ orderCode: 'TV000000000123' }))
    await orders.get('TV/1')
    expect(call(1).url.pathname).toBe('/api/v1/orders/TV%2F1')
    await orders.reportTransfer('TV000000000123')
    expect(call(2).url.pathname).toBe('/api/v1/orders/TV000000000123/transfer-report'); expect(call(2).init.method).toBe('POST'); expect(call(2).init.body).toBeUndefined()
  })

  it('accepts only an https QR image from the API; anything else counts as a failed QR', () => {
    expect(qrSrc('https://img.vietqr.io/image/970415-0123-compact2.png?amount=350000&addInfo=TV1')).toBe('https://img.vietqr.io/image/970415-0123-compact2.png?amount=350000&addInfo=TV1')
    for (const bad of ['', 'javascript:alert(1)', 'http://img.vietqr.io/x.png', 'data:image/png;base64,AAAA', '//img.vietqr.io/x.png', 'not a url']) expect(qrSrc(bad)).toBeNull()
  })

  it('syncs an order with payOS by POST without a body, for the buyer and the admin', async () => {
    fetchMock.mockResolvedValue(ok({ orderCode: 'TV000000000123' }))
    await orders.sync('TV000000000123')
    expect(call(0).url.pathname).toBe('/api/v1/orders/TV000000000123/sync'); expect(call(0).init.method).toBe('POST'); expect(call(0).init.body).toBeUndefined()
    await adminOrders.sync('TV/1')
    expect(call(1).url.pathname).toBe('/api/v1/admin/orders/TV%2F1/sync'); expect(call(1).init.method).toBe('POST')
  })

  it('accepts only a payOS checkout URL of the form the embed library needs', () => {
    const url = 'https://pay.payos.vn/web/0123456789abcdef0123456789ABCDEF'
    expect(payosSrc(url)).toBe(url)
    for (const bad of ['', 'http://pay.payos.vn/web/0123456789abcdef0123456789abcdef', 'https://evil.vn/web/0123456789abcdef0123456789abcdef', 'https://pay.payos.vn/web/123', 'javascript:alert(1)', 'https://pay.payos.vn.evil.vn/web/0123456789abcdef0123456789abcdef']) expect(payosSrc(bad)).toBeNull()
  })
})

describe('moderator shapes carry no money', () => {
  it('has no price or commission on the moderator course type (checked by the compiler)', () => {
    const detail = { course: {} } as ModeratorCourseDetail
    // @ts-expect-error Moderators never receive the price
    void detail.course.priceAmount
    // @ts-expect-error nor the commission rate
    void detail.course.commissionRateBps
    expect(true).toBe(true)
  })
})

describe('admin payment services (Task 2c)', () => {
  it('lists admin orders with the filters that are set (undefined ones are dropped) and POSTs the exact confirm/reconcile bodies', async () => {
    fetchMock.mockResolvedValue(ok({}))
    await adminOrders.list({ status: 'PENDING', code: 'TV1', transferReported: true, needsReconciliation: false, page: 2 })
    expect(call(0).url.pathname).toBe('/api/v1/admin/orders')
    expect(call(0).url.searchParams.get('status')).toBe('PENDING'); expect(call(0).url.searchParams.get('code')).toBe('TV1')
    expect(call(0).url.searchParams.get('transferReported')).toBe('true'); expect(call(0).url.searchParams.get('needsReconciliation')).toBe('false')
    expect(call(0).url.searchParams.get('page')).toBe('2')
    await adminOrders.confirm('TV000000000123', 350000, 'FT123')
    expect(call(1).url.pathname).toBe('/api/v1/admin/orders/TV000000000123/confirm'); expect(call(1).init.method).toBe('POST'); expect(JSON.parse(String(call(1).init.body))).toEqual({ amount: 350000, bankReference: 'FT123' })
    await adminOrders.reconcile('TV000000000123', 2)
    expect(call(2).url.pathname).toBe('/api/v1/admin/orders/TV000000000123/reconcile'); expect(JSON.parse(String(call(2).init.body))).toEqual({ paymentCount: 2 })
  })

  it('sends revenue filters, the by-course list, payout account and payout history on the author paths', async () => {
    fetchMock.mockResolvedValue(ok({}))
    await revenue(2, { from: '2026-11-01', to: '', courseId: 'c1' }); await revenueByCourse(0, { from: '', to: '2026-11-16' })
    await payoutAccount.get(); await payoutAccount.save({ bankId: '970436', accountNo: '0123456789', accountName: 'NGUYEN VAN A' }); await payouts(1)
    expect(Object.fromEntries(call(0).url.searchParams)).toEqual({ page: '2', size: '10', from: '2026-11-01', courseId: 'c1' })
    expect(call(1).url.pathname).toBe('/api/v1/author/revenue/courses'); expect(Object.fromEntries(call(1).url.searchParams)).toEqual({ page: '0', size: '10', to: '2026-11-16' })
    expect(call(2).url.pathname).toBe('/api/v1/author/payout-account')
    expect(call(3).init.method).toBe('PUT'); expect(JSON.parse(String(call(3).init.body))).toEqual({ bankId: '970436', accountNo: '0123456789', accountName: 'NGUYEN VAN A' })
    expect(call(4).url.pathname).toBe('/api/v1/author/payouts'); expect(call(4).url.searchParams.get('page')).toBe('1')
  })

  it('reads and changes the commission policy with an integer rateBps only; revenue is paged', async () => {
    fetchMock.mockResolvedValue(ok({}))
    await commission.get(); await commission.change(1500); await revenue(1)
    expect(call(0).url.pathname).toBe('/api/v1/admin/commission-policy')
    expect(call(1).init.method).toBe('PUT'); expect(JSON.parse(String(call(1).init.body))).toEqual({ rateBps: 1500 })
    expect(call(2).url.pathname).toBe('/api/v1/author/revenue'); expect(call(2).url.searchParams.get('page')).toBe('1')
  })

  it('turns a percent into whole basis points: 0-100 with at most 2 decimals, else null', () => {
    expect(rateBps('15')).toBe(1500); expect(rateBps('12.5')).toBe(1250); expect(rateBps('12,34')).toBe(1234); expect(rateBps(' 0 ')).toBe(0); expect(rateBps('100')).toBe(10000); expect(rateBps('1.15')).toBe(115)
    for (const bad of ['', 'abc', '-1', '100.01', '101', '1.234', '1e2', '.5', '5.', '1 5']) expect(rateBps(bad)).toBeNull()
  })

  it('accepts a statement amount only as a positive whole number of at most 15 digits', () => {
    expect(amountText('350000')).toBe(350000); expect(amountText(' 10000 ')).toBe(10000)
    for (const bad of ['', '0', '-5', '1.5', '1,000', 'abc', '0123', '1'.repeat(16)]) expect(amountText(bad)).toBeNull()
  })
})

describe('lessonTutor API', () => {
  it('posts the question to the lesson stream and hands over the preflight quota and parsed events', async () => {
    const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode(['event: metadata', 'data: {"generationId":"g","timeoutSeconds":60,"contextTruncated":true}', '', 'event: delta', 'data: {"text":"Hi"}', '', ''].join('\n'))); c.close() } })
    fetchMock.mockResolvedValue(new Response(body, { status: 200, headers: { 'X-AI-Quota-Limit': '20', 'X-AI-Quota-Remaining': '19' } }))
    const events: unknown[] = []; let quota: unknown
    await lessonTutor.stream('c 1', 'l1', { question: 'Q', history: [{ role: 'USER', content: 'a' }] }, new AbortController().signal, e => events.push(e), q => { quota = q })
    expect(call().url.pathname).toBe('/api/v1/courses/c%201/lessons/l1/tutor:stream'); expect(call().init.method).toBe('POST')
    expect(JSON.parse(String(call().init.body))).toEqual({ question: 'Q', history: [{ role: 'USER', content: 'a' }] })
    expect(quota).toEqual({ limit: 20, remaining: 19 })
    expect(events).toEqual([{ type: 'metadata', generationId: 'g', timeoutSeconds: 60, contextTruncated: true }, { type: 'delta', text: 'Hi' }])
  })

  it('reads the daily allowance without reserving anything', async () => {
    fetchMock.mockResolvedValue(ok({ limit: 20, remaining: 7 }))
    expect(await lessonTutor.quota()).toEqual({ limit: 20, remaining: 7 })
    expect(call().url.pathname).toBe('/api/v1/me/ai-tutor/quota'); expect(call().init.method ?? 'GET').toBe('GET')
  })
})
