import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, MemoryRouter, Route, RouterProvider, Routes, useLocation } from 'react-router-dom'
import { CourseEditorPage } from './CourseEditorPage'
import { setAccessToken } from '../../../services/api/client'

const topic = { id: 'java', name: 'Java', active: true }
const lessonItem = (id: string, title: string, over: object = {}) => ({ id, title, summary: null, position: 0, preview: false, hasVideo: false, hasContent: true, aiAssisted: false, ...over })
const baseCourse = () => ({
  id: 'c1', authorId: 'a1', title: 'Java căn bản', summary: 'Tóm tắt', description: '# Mô tả', level: 'BEGINNER', coverImageUrl: null, topic, tags: [], workflowStatus: 'DRAFT', publicationStatus: 'UNPUBLISHED',
  fingerprint: 'f', hasUnpublishedChanges: false, publishedVersion: null as null | object, imageIssues: [], moderationNote: null, reviewedAt: null, publishedAt: null, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T10:42:00Z',
  chapters: [{ id: 'ch1', title: 'Mở đầu', position: 0, lessons: [lessonItem('l1', 'Giới thiệu', { hasVideo: true, hasContent: false }), lessonItem('l2', 'Cài đặt')] }],
})
const lessonOf = (id: string) => ({ id, chapterId: 'ch1', versionId: null, title: id === 'l1' ? 'Giới thiệu' : 'Cài đặt', summary: null, content: id === 'l1' ? null : '# Cài JDK', video: id === 'l1' ? { provider: 'YOUTUBE', videoId: 'dQw4w9WgXcQ' } : null, preview: false, position: 0, aiAssisted: false, fingerprint: '', imageIssues: [] })

let course: ReturnType<typeof baseCourse>
let failNext: { code: string; status: number } | null
const fetchMock = vi.fn<typeof fetch>()
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ status, message: 'x', data }), { status })
const errorResponse = (code: string, status: number) => new Response(JSON.stringify({ status, message: 'English', code, data: null }), { status })
const calls = () => fetchMock.mock.calls.map(([url, init]) => ({ url: new URL(String(url)), method: init?.method || 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body, headers: new Headers(init?.headers) }))
const find = (method: string, path: string) => calls().filter(c => c.method === method && c.url.pathname === `/api/v1/author/courses${path}`)

async function backend(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(String(input))
  const path = url.pathname.replace('/api/v1/author/courses', '')
  const method = init?.method || 'GET'
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null
  if (method !== 'GET' && failNext) { const { code, status } = failNext; failNext = null; return errorResponse(code, status) }
  if (path === '/options') return response({ topics: { content: [topic], hasNext: false }, tags: { content: [], hasNext: false } })
  if (path === '/import') return response({ filename: 'a.md', content: '# Nhập vào', imageIssues: [] })
  if (path === '' && method === 'POST') { course = { ...baseCourse(), title: body.title, chapters: [] }; return response(course, 201) }
  if (path === '/c1' && method === 'GET') return response(course)
  if (path === '/c1' && method === 'PATCH') { Object.assign(course, body.action === 'SUBMIT' ? { workflowStatus: 'PENDING' } : body); return response(course) }
  if (path === '/c1/withdraw') { course.workflowStatus = 'DRAFT'; return response(course) }
  if (path === '/c1/chapters' && method === 'POST') { course.chapters.push({ id: 'ch2', title: body.title, position: 1, lessons: [] }); return response(course, 201) }
  if (path === '/c1/chapters/ch1/lessons:reorder') { const lessons = course.chapters[0].lessons; course.chapters[0].lessons = body.ids.map((id: string) => lessons.find(l => l.id === id)!); return response(course) }
  if (path.startsWith('/c1/lessons/') && path.endsWith('/images')) return response({ url: 'https://res.cloudinary.com/demo/image/upload/v1/techverse/a1/c1/l2/img.png' })
  if (path.startsWith('/c1/lessons/') && method === 'GET') return response(lessonOf(path.split('/')[3]))
  if (path.startsWith('/c1/lessons/') && method === 'PATCH') return response({ ...lessonOf(path.split('/')[3]), ...body, video: body.videoUrl ? { provider: 'YOUTUBE', videoId: 'dQw4w9WgXcQ' } : null })
  if (path.startsWith('/c1/lessons/') && method === 'DELETE') { course.chapters[0].lessons = course.chapters[0].lessons.filter(l => l.id !== path.split('/')[3]); return response(course) }
  if (path === '/c1/chapters/ch1/lessons' && method === 'POST') { course.chapters[0].lessons.push(lessonItem('l3', body.title)); return response({ ...lessonOf('l2'), id: 'l3', title: body.title }, 201) }
  return response(null, 404)
}

function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}{l.search}</output> }
function renderEditor(path: string, language: 'vi' | 'en' = 'vi') {
  const page = <><CourseEditorPage language={language} /><Where /></>
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/author/courses/new" element={page} /><Route path="/author/courses/:id/edit" element={page} /><Route path="/author/courses" element={<Where />} /></Routes></MemoryRouter>)
}
const tree = () => screen.getByRole('navigation', { name: 'Cấu trúc khóa học' })

beforeEach(() => {
  setAccessToken('t'); course = baseCourse(); failNext = null
  fetchMock.mockReset().mockImplementation(backend); vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); setAccessToken(null); sessionStorage.clear(); vi.unstubAllGlobals() })

it('creates a course with one Idempotency-Key, validates title/topic first, then opens the edit route', async () => {
  const user = userEvent.setup()
  renderEditor('/author/courses/new')
  await user.click(screen.getByRole('button', { name: 'Tạo khóa học' }))
  expect(screen.getByText('Nhập tiêu đề.')).toBeTruthy(); expect(screen.getByText('Chọn chủ đề.')).toBeTruthy()
  expect(find('POST', '')).toHaveLength(0)
  fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: 'Spring Boot' } })
  await screen.findByRole('option', { name: 'Java' })
  await user.selectOptions(screen.getByLabelText(/Chủ đề/), 'java')
  await user.click(screen.getByRole('button', { name: 'Tạo khóa học' }))
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/author/courses/c1/edit'))
  const [create] = find('POST', '')
  expect(create.body).toMatchObject({ action: 'SAVE', title: 'Spring Boot', topicId: 'java', level: 'BEGINNER' })
  expect(create.headers.get('Idempotency-Key')).toMatch(/[0-9a-f-]{36}/)
})

it('saves only the changed metadata and keeps unsaved edits guarded when switching items', async () => {
  const user = userEvent.setup()
  renderEditor('/author/courses/c1/edit')
  expect((await screen.findByRole('heading', { name: 'Java căn bản', level: 1 }))).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Mô tả ngắn'), { target: { value: 'Tóm tắt mới' } })
  await user.click(screen.getByRole('button', { name: 'Lưu' }))
  await screen.findByText('Đã lưu.')
  expect(find('PATCH', '/c1')[0].body).toEqual({ action: 'SAVE', summary: 'Tóm tắt mới' })
  // dirty → selecting another item saves it first
  fireEvent.change(screen.getByLabelText('Mô tả ngắn'), { target: { value: 'Lần hai' } })
  await user.click(within(tree()).getByRole("button", { name: /^Cài đặt/ }))
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/author/courses/c1/edit?lesson=l2'))
  expect(find('PATCH', '/c1')).toHaveLength(2)
})

it('asks before dropping unsaved changes when the autosave fails', async () => {
  const user = userEvent.setup()
  renderEditor('/author/courses/c1/edit')
  await screen.findByRole('heading', { name: 'Java căn bản', level: 1 })
  fireEvent.change(screen.getByLabelText('Mô tả ngắn'), { target: { value: 'Sẽ lỗi' } })
  failNext = { code: 'COURSE_NOT_EDITABLE', status: 409 }
  await user.click(within(tree()).getByRole("button", { name: /^Cài đặt/ }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText('Thay đổi chưa lưu sẽ mất')).toBeTruthy()
  await user.click(within(dialog).getByRole('button', { name: 'Ở lại' }))
  expect(screen.getByTestId('where').textContent).toBe('/author/courses/c1/edit')
  failNext = { code: 'COURSE_NOT_EDITABLE', status: 409 }
  await user.click(within(tree()).getByRole("button", { name: /^Cài đặt/ }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Rời đi' }))
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/author/courses/c1/edit?lesson=l2'))
})

it('adds a chapter, reorders a lesson with Down and removes one after a confirm (hard delete wording while never published)', async () => {
  const user = userEvent.setup()
  renderEditor('/author/courses/c1/edit')
  await screen.findByRole('heading', { name: 'Java căn bản', level: 1 })
  await user.click(within(tree()).getByRole('button', { name: 'Thêm chương' }))
  fireEvent.change(screen.getByLabelText(/Tên chương/), { target: { value: 'Nâng cao' } })
  await user.click(screen.getByRole('button', { name: 'Lưu' }))
  await waitFor(() => expect(find('POST', '/c1/chapters')[0]?.body).toEqual({ title: 'Nâng cao' }))
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/author/courses/c1/edit?chapter=ch2'))

  await user.click(within(tree()).getByRole('button', { name: 'Thao tác cho Giới thiệu' }))
  await user.click(screen.getByRole('menuitem', { name: 'Xuống' }))
  await waitFor(() => expect(find('PUT', '/c1/chapters/ch1/lessons:reorder')[0]?.body).toEqual({ ids: ['l2', 'l1'] }))
  await waitFor(() => expect(within(tree()).getAllByRole("button", { name: /^(Cài đặt|Giới thiệu)/ }).map(b => b.textContent)[0]).toMatch(/Cài đặt/))

  await user.click(within(tree()).getByRole('button', { name: 'Thao tác cho Cài đặt' }))
  await user.click(screen.getByRole('menuitem', { name: 'Xóa' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(/Xóa vĩnh viễn “Cài đặt”/)).toBeTruthy()
  await user.click(within(dialog).getByRole('button', { name: 'Xóa vĩnh viễn' }))
  await waitFor(() => expect(find('DELETE', '/c1/lessons/l2')).toHaveLength(1))
})

it('edits a lesson: nocookie preview, requires video or content, sends only the diff and clears the video with null', async () => {
  const user = userEvent.setup()
  renderEditor('/author/courses/c1/edit?lesson=l1')
  const video = await screen.findByLabelText('Video YouTube')
  expect((video as HTMLInputElement).value).toBe('https://youtu.be/dQw4w9WgXcQ')
  expect(screen.getByTitle('Xem trước video').getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  fireEvent.change(video, { target: { value: '' } })
  await user.click(screen.getAllByRole('button', { name: 'Lưu' })[0])
  expect(await screen.findByText('Bài học phải có video hoặc nội dung.')).toBeTruthy()
  expect(find('PATCH', '/c1/lessons/l1')).toHaveLength(0)
  fireEvent.change(video, { target: { value: 'https://youtu.be/AAAAAAAAAAA' } })
  expect(screen.getByTitle('Xem trước video').getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/AAAAAAAAAAA')
  fireEvent.change(screen.getByLabelText('Tóm tắt (tùy chọn)'), { target: { value: 'Một đoạn' } })
  await user.click(screen.getAllByRole('button', { name: 'Lưu' })[0])
  await waitFor(() => expect(find('PATCH', '/c1/lessons/l1')[0]?.body).toEqual({ summary: 'Một đoạn', videoUrl: 'https://youtu.be/AAAAAAAAAAA' }))
})

it('creates a new lesson with an Idempotency-Key, maps LESSON_VIDEO_INVALID under the field and imports Markdown', async () => {
  const user = userEvent.setup()
  renderEditor('/author/courses/c1/edit?newLesson=ch1')
  const title = await screen.findByLabelText(/Tên bài học/)
  expect(screen.getByRole('button', { name: 'Chèn ảnh' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByText('Lưu bài trước khi chèn ảnh')).toBeTruthy()
  fireEvent.change(title, { target: { value: 'Bài mới' } })
  await user.upload(screen.getByLabelText('Tệp Markdown'), new File(['# Nhập vào'], 'a.md', { type: 'text/markdown' }))
  await screen.findByText(/Đã nhập nội dung/)
  fireEvent.change(screen.getByLabelText('Video YouTube'), { target: { value: 'https://evil.example/x' } })
  failNext = { code: 'LESSON_VIDEO_INVALID', status: 400 }
  await user.click(screen.getAllByRole('button', { name: 'Lưu' })[0])
  expect(await screen.findByText('Liên kết YouTube không hợp lệ.')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Video YouTube'), { target: { value: '' } })
  await user.click(screen.getAllByRole('button', { name: 'Lưu' })[0])
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/author/courses/c1/edit?lesson=l3'))
  const creates = find('POST', '/c1/chapters/ch1/lessons')
  // The refused attempt and the corrected one differ in body, so the second must not reuse the first key (server would answer COURSE_KEY_CONFLICT).
  expect(creates).toHaveLength(2)
  expect(creates[0].body).toMatchObject({ videoUrl: 'https://evil.example/x' })
  expect(creates[1].body).toEqual({ title: 'Bài mới', preview: false, content: '# Nhập vào' })
  expect(creates[0].headers.get('Idempotency-Key')).toMatch(/[0-9a-f-]{36}/)
  expect(creates[1].headers.get('Idempotency-Key')).not.toBe(creates[0].headers.get('Idempotency-Key'))
})

it('uploads a lesson image into the Markdown through the lesson endpoint with an Upload-Key', async () => {
  const user = userEvent.setup()
  renderEditor('/author/courses/c1/edit?lesson=l2')
  await screen.findByLabelText('Tên bài học', { exact: false })
  await user.upload(screen.getByLabelText('Tệp ảnh chèn'), new File(['x'], 'a.png', { type: 'image/png' }))
  await waitFor(() => expect((screen.getByLabelText('Nội dung Markdown') as HTMLTextAreaElement).value).toContain('![](https://res.cloudinary.com/demo/image/upload/v1/techverse/a1/c1/l2/img.png)'))
  const [upload] = find('POST', '/c1/lessons/l2/images')
  expect(upload.headers.get('Upload-Key')).toMatch(/[0-9a-f-]{36}/)
})

it('lists what is missing when submit is refused, then submits and goes read-only until withdrawn', async () => {
  const user = userEvent.setup()
  course.chapters.push({ id: 'ch9', title: 'Rỗng', position: 1, lessons: [] })
  renderEditor('/author/courses/c1/edit')
  await screen.findByRole('heading', { name: 'Java căn bản', level: 1 })
  failNext = { code: 'COURSE_NOT_READY', status: 409 }
  await user.click(screen.getByRole('button', { name: 'Gửi duyệt' }))
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('Khóa học chưa đủ điều kiện gửi duyệt.')
  await user.click(within(alert).getByRole('button', { name: 'Chương “Rỗng” chưa có bài.' }))
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/author/courses/c1/edit?chapter=ch9'))
  await user.click(screen.getByRole('button', { name: 'Gửi duyệt' }))
  await screen.findByText('Đang chờ duyệt — rút lại để tiếp tục sửa.')
  expect(find('PATCH', '/c1').some(c => (c.body as { action: string }).action === 'SUBMIT')).toBe(true)
  expect(screen.queryByRole('button', { name: 'Gửi duyệt' })).toBeNull()
  expect((screen.getByLabelText(/Tên chương/) as HTMLInputElement).readOnly).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Rút lại' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Rút lại' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi duyệt' })).toBeTruthy())
})

it('marks lessons missing from the live version as new and offers the live tab; shows 404 for an unknown course', async () => {
  const user = userEvent.setup()
  course.publicationStatus = 'PUBLISHED'
  course.publishedVersion = { id: 'v1', versionNumber: 2, approvedAt: '2026-11-03T00:00:00Z', fingerprint: 'x', chapters: [{ id: 'ch1', title: 'Mở đầu', position: 0, lessons: [lessonItem('l1', 'Giới thiệu')] }] }
  renderEditor('/author/courses/c1/edit?lesson=l1')
  await screen.findByLabelText('Video YouTube')
  expect(within(within(tree()).getByRole("button", { name: /^Cài đặt/ })).getByText('Mới')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Học thử' }).getAttribute('href')).toBe('/courses/c1')
  await user.click(screen.getByRole('button', { name: 'Bản công khai v2' }))
  await waitFor(() => expect(calls().some(c => c.url.searchParams.get('versionId') === 'v1')).toBe(true))
  cleanup()
  fetchMock.mockImplementation(async () => errorResponse('COURSE_NOT_FOUND', 404))
  renderEditor('/author/courses/c1/edit')
  expect(await screen.findByText('Không tìm thấy khóa học')).toBeTruthy()
})

async function openAiDraft(user: ReturnType<typeof userEvent.setup>) {
  const text = '## Tải JDK\nNội dung do AI viết.\n'
  const { sha256Hex } = await import('../../../services/aiAssistService')
  sessionStorage.setItem('techverse-ai-lesson:v1:c1:l2', JSON.stringify({ form: { title: '', idea: 'Hướng dẫn cài JDK cho người mới bắt đầu.', length: 'MEDIUM', targetAudience: 'Sinh viên' }, outline: { title: 'Cài JDK nhanh', summary: 'Tóm tắt do AI viết cho bài học cài đặt JDK trên Windows, đủ năm mươi ký tự.', topicId: '', tagIds: [], suggestedTagIds: [], sections: [] }, completed: { generationId: 'g1', content: text, sha: await sha256Hex(text) } }))
  renderEditor('/author/courses/c1/edit?lesson=l2')
  await screen.findByLabelText('Nội dung Markdown')
  await user.click(screen.getByRole('button', { name: 'Soạn bằng AI' }))
  await user.click(await screen.findByRole('button', { name: 'Dùng bản nháp này cho bài học' }))
  return text
}

it('hands an AI draft to the lesson after confirming the replacement and claims it with aiGenerationId on the next save', async () => {
  const user = userEvent.setup()
  const text = await openAiDraft(user)
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Thay nội dung' }))
  expect((screen.getByLabelText('Nội dung Markdown') as HTMLTextAreaElement).value).toBe(text)
  expect((screen.getByLabelText(/Tên bài học/) as HTMLInputElement).value).toBe('Cài JDK nhanh')
  await user.click(screen.getAllByRole('button', { name: 'Lưu' })[0])
  await waitFor(() => expect(find('PATCH', '/c1/lessons/l2')[0]?.body).toMatchObject({ title: 'Cài JDK nhanh', content: text, aiGenerationId: 'g1' }))
})

it('drops the AI claim when the Author edits the draft afterwards, so the server never sees a mismatching hash', async () => {
  const user = userEvent.setup()
  await openAiDraft(user)
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Thay nội dung' }))
  fireEvent.change(screen.getByLabelText('Nội dung Markdown'), { target: { value: 'Tôi đã sửa lại' } })
  await user.click(screen.getAllByRole('button', { name: 'Lưu' })[0])
  await waitFor(() => expect(find('PATCH', '/c1/lessons/l2')).toHaveLength(1))
  expect(find('PATCH', '/c1/lessons/l2')[0].body).not.toHaveProperty('aiGenerationId')
})

it('saves a dirty course form before submitting (the save does not swallow the submit)', async () => {
  const user = userEvent.setup()
  renderEditor('/author/courses/c1/edit')
  await screen.findByRole('heading', { name: 'Java căn bản', level: 1 })
  fireEvent.change(screen.getByLabelText('Mô tả ngắn'), { target: { value: 'Sửa rồi gửi' } })
  await user.click(screen.getByRole('button', { name: 'Gửi duyệt' }))
  await screen.findByText('Đã gửi duyệt.')
  const actions = find('PATCH', '/c1').map(c => (c.body as { action: string }).action)
  expect(actions).toEqual(['SAVE', 'SUBMIT'])
})

// A data router is what main.tsx mounts; it is the only one where in-app navigation (Sidebar, Back) can be blocked.
function renderInDataRouter(path: string) {
  const page = <><CourseEditorPage language="vi" /><Where /></>
  const router = createMemoryRouter([
    { path: '/author/courses/:id/edit', element: <><CourseEditorPage language="vi" /><Link to="/elsewhere">Sidebar</Link><Where /></> },
    { path: '/author/courses', element: page }, { path: '/elsewhere', element: <Where /> },
  ], { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

it('blocks leaving to another route while dirty: saves first and proceeds when it worked', async () => {
  const user = userEvent.setup()
  renderInDataRouter('/author/courses/c1/edit')
  await screen.findByRole('heading', { name: 'Java căn bản', level: 1 })
  fireEvent.change(screen.getByLabelText('Mô tả ngắn'), { target: { value: 'Rời bằng Sidebar' } })
  await user.click(screen.getByRole('link', { name: 'Sidebar' }))
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/elsewhere'))
  expect(find('PATCH', '/c1')[0]?.body).toEqual({ action: 'SAVE', summary: 'Rời bằng Sidebar' })
})

it('keeps the Author on the page and asks when the save before leaving fails', async () => {
  const user = userEvent.setup()
  renderInDataRouter('/author/courses/c1/edit')
  await screen.findByRole('heading', { name: 'Java căn bản', level: 1 })
  fireEvent.change(screen.getByLabelText('Mô tả ngắn'), { target: { value: 'Sẽ lỗi' } })
  failNext = { code: 'COURSE_NOT_EDITABLE', status: 409 }
  await user.click(screen.getByRole('link', { name: 'Sidebar' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Ở lại' }))
  expect(screen.getByTestId('where').textContent).toBe('/author/courses/c1/edit')
  failNext = { code: 'COURSE_NOT_EDITABLE', status: 409 }
  await user.click(screen.getByRole('link', { name: 'Sidebar' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Rời đi' }))
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/elsewhere'))
})

it('does not let the Author submit or save while an image is still uploading', async () => {
  const user = userEvent.setup()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  fetchMock.mockImplementation(async (input, init) => { if (String(input).endsWith('/images')) await gate; return backend(input, init) })
  renderEditor('/author/courses/c1/edit?lesson=l2')
  await screen.findByLabelText('Nội dung Markdown')
  const upload = user.upload(screen.getByLabelText('Tệp ảnh chèn'), new File(['x'], 'a.png', { type: 'image/png' }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Gửi duyệt' }) as HTMLButtonElement).disabled).toBe(true))
  expect((screen.getAllByRole('button', { name: 'Lưu' })[0] as HTMLButtonElement).disabled).toBe(true)
  release(); await upload
  await waitFor(() => expect((screen.getByRole('button', { name: 'Gửi duyệt' }) as HTMLButtonElement).disabled).toBe(false))
})

it('re-baselines the lesson after a save, so editing back to the old value is sent again', async () => {
  const user = userEvent.setup()
  renderEditor('/author/courses/c1/edit?lesson=l2')
  const area = await screen.findByLabelText('Nội dung Markdown')
  fireEvent.change(area, { target: { value: 'B' } })
  await user.click(screen.getAllByRole('button', { name: 'Lưu' })[0])
  await waitFor(() => expect(find('PATCH', '/c1/lessons/l2')).toHaveLength(1))
  fireEvent.change(area, { target: { value: '# Cài JDK' } })
  await user.click(screen.getAllByRole('button', { name: 'Lưu' })[0])
  await waitFor(() => expect(find('PATCH', '/c1/lessons/l2')).toHaveLength(2))
  expect(find('PATCH', '/c1/lessons/l2')[1].body).toEqual({ content: '# Cài JDK' })
})

it('keeps text typed while an image uploads', async () => {
  const user = userEvent.setup()
  renderEditor('/author/courses/c1/edit?lesson=l2')
  const area = await screen.findByLabelText('Nội dung Markdown') as HTMLTextAreaElement
  const pending = user.upload(screen.getByLabelText('Tệp ảnh chèn'), new File(['x'], 'a.png', { type: 'image/png' }))
  fireEvent.change(area, { target: { value: '# Cài JDK\nGõ thêm' } })
  await pending
  await waitFor(() => expect(area.value).toContain('![](https://res.cloudinary.com'))
  expect(area.value).toContain('Gõ thêm')
})
