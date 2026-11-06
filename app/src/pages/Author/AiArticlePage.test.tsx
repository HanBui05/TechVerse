import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AiArticlePage, SESSION_KEY } from './AiArticlePage'
import { setAccessToken } from '../../services/api/client'
import { sha256Hex } from '../../services/aiAssistService'

const fetchMock = vi.fn<typeof fetch>()
const enc = new TextEncoder()
const outline = {
  title: 'Spring Security: JWT và refresh token', summary: 'Bài viết giải thích cách JWT và refresh token phối hợp trong ứng dụng web.', topicId: 'java', tagIds: ['jwt'], suggestedTagIds: ['spring', 'gone'],
  sections: [{ heading: 'JWT giải quyết gì?', subsections: ['Cấu trúc token'] }, { heading: 'Refresh token', subsections: [] }, { heading: 'Lưu trữ an toàn', subsections: [] }],
}
const form = { title: '', topicId: 'java', tagIds: ['jwt'], idea: 'Giải thích JWT và refresh token cho người mới.', length: 'MEDIUM', targetAudience: 'Sinh viên Java' }
const content = '## JWT giải quyết gì?\nNội dung.\n## Refresh token\nThêm.\n'
const json = (data: unknown, status = 200, headers: Record<string, string> = {}, code?: string) => new Response(JSON.stringify({ status, message: 'English', code, data }), { status, headers })
const frame = (event: string, data: object) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
type StreamPlan = { frames: string[]; hang?: boolean }
let streamPlan: StreamPlan
let createStatus: number[]
let quotaReply: object | null
let location = ''
const calls = () => fetchMock.mock.calls.map(([url, init]) => ({ path: new URL(String(url)).pathname, method: init?.method || 'GET', headers: new Headers(init?.headers), body: init?.body ? String(init.body) : '', keepalive: init?.keepalive }))

async function backend(input: RequestInfo | URL, init?: RequestInit) {
  const path = new URL(String(input)).pathname
  if (path.endsWith('/options')) return json({ topics: { content: [{ id: 'java', name: 'Java' }] }, tags: { content: [{ id: 'jwt', name: 'JWT' }, { id: 'spring', name: 'Spring Boot' }] } })
  if (path.endsWith('/ai/quota')) return quotaReply ? json(quotaReply) : json(null, 503)
  if (path.endsWith('/ai/outlines')) return json(outline, 200, { 'X-AI-Quota-Limit': '10', 'X-AI-Quota-Remaining': '7' })
  if (path.includes('/ai/generations/')) return json({ generationId: 'g1', status: 'CANCELLED' })
  if (path.endsWith('/drafts:stream')) {
    const plan = streamPlan
    return new Response(new ReadableStream({
      start(controller) {
        for (const f of plan.frames) controller.enqueue(enc.encode(f))
        if (plan.hang) init?.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')))
        else controller.close()
      },
    }), { status: 200, headers: { 'X-AI-Quota-Limit': '5', 'X-AI-Quota-Remaining': '4' } })
  }
  if (path === '/api/v1/author/articles' && init?.method === 'POST') {
    const status = createStatus.shift() ?? 201
    return status === 201 ? json({ id: 'art-9', aiAssisted: true }, 201) : json(null, status, {}, status === 409 ? 'AI_GENERATION_INVALID' : undefined)
  }
  return json(null, 404)
}

function Where() { location = useLocation().pathname; return null }
const renderPage = (language: 'vi' | 'en' = 'vi') => render(<MemoryRouter initialEntries={['/author/blogs/ai']}><Routes>
  <Route path="/author/blogs/ai" element={<AiArticlePage language={language} />} />
  <Route path="/author/blogs/:id/edit" element={<p>Editor</p>} />
</Routes><Where /></MemoryRouter>)
const saved = () => JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null')
const restoreOutline = (over: object = {}) => sessionStorage.setItem(SESSION_KEY, JSON.stringify({ v: 1, form, outline: { ...outline, suggestedTagIds: ['spring'] }, ...over }))

beforeEach(() => {
  sessionStorage.clear()
  setAccessToken('tok')
  createStatus = []
  quotaReply = null
  streamPlan = { frames: [] }
  fetchMock.mockReset().mockImplementation(backend)
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

it('keeps "Tạo dàn ý" disabled until required fields are valid, restores the outline and blocks a body over 16 KiB without calling the API', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('option', { name: 'Java' })
  const button = screen.getByRole('button', { name: 'Tạo dàn ý' }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText(/Ý tưởng/), { target: { value: 'quá ngắn' } })
  await user.selectOptions(screen.getByLabelText(/Chủ đề/), 'java')
  fireEvent.change(screen.getByLabelText(/Đối tượng đọc/), { target: { value: 'Dev' } })
  expect(button.disabled).toBe(true)
  cleanup()

  const big = 'ệ'.repeat(4000)
  restoreOutline({ form: { ...form, idea: big }, outline: { ...outline, sections: Array.from({ length: 8 }, (_, i) => ({ heading: `${i}${'ệ'.repeat(110)}`, subsections: [0, 1].map(j => `${i}.${j}${'ệ'.repeat(100)}`) })) } })
  renderPage()
  expect(await screen.findByText('Đã khôi phục form và dàn ý của phiên trước.')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Viết bài' }))
  expect(screen.getByText('Dữ liệu gửi đi vượt 16 KiB. Hãy rút gọn ý tưởng hoặc dàn ý.')).toBeTruthy()
  expect(calls().some(c => c.path.endsWith('/drafts:stream'))).toBe(false)
})

it('creates an outline, shows the header quota, maps suggestions by name and saves form + outline in the tab session', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.selectOptions(await screen.findByLabelText(/Chủ đề/), 'java')
  fireEvent.change(screen.getByLabelText(/Ý tưởng/), { target: { value: form.idea } })
  fireEvent.change(screen.getByLabelText(/Đối tượng đọc/), { target: { value: form.targetAudience } })
  expect(screen.getByText('Còn — lượt dàn ý')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Tạo dàn ý' }))
  expect(await screen.findByDisplayValue(outline.title)).toBeTruthy()
  const body = JSON.parse(calls().find(c => c.path.endsWith('/ai/outlines'))!.body)
  expect(body).toEqual({ topicId: 'java', tagIds: [], idea: form.idea, length: 'MEDIUM', targetAudience: form.targetAudience })
  expect(screen.getByText('Còn 7/10 lượt dàn ý')).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Spring Boot' })).toBeTruthy()
  expect(screen.queryByText('gone')).toBeNull()
  await waitFor(() => expect(saved()).toMatchObject({ v: 1, form: { idea: form.idea }, outline: { title: outline.title } }))
  expect(saved().completed).toBeUndefined()
})

it('streams a preview, sends DELETE keepalive on pagehide, and Dừng aborts + cancels so the partial text can never be saved', async () => {
  const user = userEvent.setup()
  restoreOutline()
  streamPlan = { frames: [frame('metadata', { generationId: 'g1', timeoutSeconds: 120 }), frame('delta', { text: '## JWT giải quyết gì?\nJWT là' })], hang: true }
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Viết bài' }))
  expect(await screen.findByText(/JWT là/)).toBeTruthy()
  expect(screen.getByText('Phần 1/3 · tối đa 120 giây')).toBeTruthy()
  expect(screen.getByText('Còn 4/5 lượt viết')).toBeTruthy()
  const draft = JSON.parse(calls().find(c => c.path.endsWith('/drafts:stream'))!.body)
  expect(draft).toMatchObject({ title: outline.title, summary: outline.summary, tagIds: ['jwt'], sections: outline.sections, idea: form.idea })
  expect(draft).not.toHaveProperty('suggestedTagIds')

  act(() => { window.dispatchEvent(new Event('pagehide')) })
  const leave = calls().find(c => c.method === 'DELETE')!
  expect(leave).toMatchObject({ path: '/api/v1/author/ai/generations/g1', keepalive: true })
  expect(leave.headers.get('Authorization')).toBe('Bearer tok')

  await user.click(screen.getByRole('button', { name: 'Dừng' }))
  expect(await screen.findByText('Đã dừng. Phần nội dung dở chỉ để đọc, không thể lưu.')).toBeTruthy()
  expect(calls().filter(c => c.method === 'DELETE')).toHaveLength(2)
  expect(screen.queryByRole('button', { name: 'Lưu nháp và mở trình soạn thảo' })).toBeNull()
  expect(JSON.stringify(saved())).not.toContain('JWT là')
})

it('shows the SSE error copy, the refunded terminal quota and a manual retry, without handoff', async () => {
  const user = userEvent.setup()
  restoreOutline()
  streamPlan = { frames: [frame('metadata', { generationId: 'g1', timeoutSeconds: 90 }), frame('delta', { text: 'dở' }), frame('error', { generationId: 'g1', code: 'AI_PROVIDER_UNAVAILABLE', message: 'English', retryable: true, quotaRemaining: 5 })] }
  renderPage('en')
  await user.click(await screen.findByRole('button', { name: 'Write article' }))
  expect(await screen.findByText('The AI service is temporarily unavailable. Try again.')).toBeTruthy()
  expect(screen.getByText('5/5 drafts left')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Save draft and open the editor' })).toBeNull()
  expect(screen.getByDisplayValue(outline.title)).toBeTruthy()
})

it('rejects a completed buffer whose SHA-256 differs', async () => {
  const user = userEvent.setup()
  restoreOutline()
  streamPlan = { frames: [frame('metadata', { generationId: 'g1', timeoutSeconds: 120 }), frame('delta', { text: content }), frame('completed', { generationId: 'g1', validated: true, contentBytes: 1, contentSha256: 'bad', quotaRemaining: 4 })] }
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Viết bài' }))
  expect(await screen.findByText('Nội dung nhận được không toàn vẹn. Hãy tạo lại.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Lưu nháp và mở trình soạn thảo' })).toBeNull()
  expect(saved().completed).toBeUndefined()
})

it('after a verified completed, saves with aiGenerationId and retries create with the same Idempotency-Key and payload, then opens the editor', async () => {
  const user = userEvent.setup()
  restoreOutline()
  createStatus = [503]
  streamPlan = { frames: [frame('metadata', { generationId: 'g1', timeoutSeconds: 120 }), frame('delta', { text: content.slice(0, 10) }), frame('delta', { text: content.slice(10) }),
    frame('completed', { generationId: 'g1', validated: true, contentBytes: enc.encode(content).length, contentSha256: await sha256Hex(content), quotaRemaining: 4 })] }
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Viết bài' }))
  const heading = await screen.findByRole('heading', { name: /Bản nháp hoàn tất/ })
  await waitFor(() => expect(document.activeElement).toBe(heading))
  expect(saved().completed).toMatchObject({ generationId: 'g1', content })

  await user.click(screen.getByRole('button', { name: 'Lưu nháp và mở trình soạn thảo' }))
  expect(await screen.findByText(/^Chưa lưu được bài\. Nội dung vẫn được giữ\. Trợ lý AI tạm thời không khả dụng\.$/)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Lưu nháp và mở trình soạn thảo' }))
  await waitFor(() => expect(location).toBe('/author/blogs/art-9/edit'))
  const creates = calls().filter(c => c.path === '/api/v1/author/articles')
  expect(creates).toHaveLength(2)
  expect(creates[0].headers.get('Idempotency-Key')).toBeTruthy()
  expect(creates[1].headers.get('Idempotency-Key')).toBe(creates[0].headers.get('Idempotency-Key'))
  expect(creates[1].body).toBe(creates[0].body)
  expect(JSON.parse(creates[0].body)).toEqual({ action: 'SAVE', aiGenerationId: 'g1', title: outline.title, topicId: 'java', tagIds: ['jwt'], summary: outline.summary, content, coverImageUrl: null })
  expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
})

it('editing the form after an outline syncs its tags into the draft and drops a completed draft', async () => {
  const sha = await sha256Hex(content)
  const payload = { action: 'SAVE', aiGenerationId: 'g1', title: outline.title, topicId: 'java', tagIds: ['jwt'], summary: outline.summary, content, coverImageUrl: null }
  restoreOutline({ outline: { ...outline, tagIds: ['jwt', 'spring'], suggestedTagIds: ['spring'] }, completed: { generationId: 'g1', content, sha, payload } })
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('button', { name: 'Lưu nháp và mở trình soạn thảo' })
  await user.click(screen.getByRole('button', { name: /1 · Ý tưởng bài viết/ }))
  await user.click(screen.getAllByRole('button', { name: 'Bỏ thẻ JWT' })[0]) // the form's TagPicker comes before the outline chips
  expect(screen.queryByRole('button', { name: 'Lưu nháp và mở trình soạn thảo' })).toBeNull()
  await waitFor(() => expect(saved().completed).toBeUndefined())
  expect(saved().outline.tagIds).toEqual(['spring'])
})

it('restores a completed draft after F5 only when its hash still matches, keeping the started key', async () => {
  const sha = await sha256Hex(content)
  const payload = { action: 'SAVE', aiGenerationId: 'g1', title: outline.title, topicId: 'java', tagIds: ['jwt'], summary: outline.summary, content, coverImageUrl: null }
  restoreOutline({ completed: { generationId: 'g1', content, sha, payload, key: 'key-1' } })
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByText('Đã khôi phục bản nháp hoàn tất và kiểm tra lại toàn vẹn.')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Lưu nháp và mở trình soạn thảo' }))
  await waitFor(() => expect(location).toBe('/author/blogs/art-9/edit'))
  expect(calls().find(c => c.path === '/api/v1/author/articles')!.headers.get('Idempotency-Key')).toBe('key-1')
  cleanup()

  restoreOutline({ completed: { generationId: 'g1', content: content + 'x', sha, payload, key: 'key-1' } })
  renderPage()
  expect(await screen.findByText('Nội dung nhận được không toàn vẹn. Hãy tạo lại.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Lưu nháp và mở trình soạn thảo' })).toBeNull()
  expect(saved().completed).toBeUndefined()
})

it('shows today’s quota as soon as the page opens', async () => {
  quotaReply = { outline: { limit: 10, remaining: 8 }, draft: { limit: 5, remaining: 3 } }
  restoreOutline()
  renderPage()
  expect(await screen.findByText('Còn 8/10 lượt dàn ý')).toBeTruthy()
  expect(screen.getByText('Còn 3/5 lượt viết')).toBeTruthy()
})

it('refreshes a used-up quota when the tab regains focus (new day), unlocking the action', async () => {
  quotaReply = { outline: { limit: 10, remaining: 8 }, draft: { limit: 5, remaining: 0 } }
  restoreOutline()
  renderPage()
  expect(await screen.findByText('Còn 0/5 lượt viết')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Viết bài' }) as HTMLButtonElement).disabled).toBe(true)
  quotaReply = { outline: { limit: 10, remaining: 10 }, draft: { limit: 5, remaining: 5 } }
  act(() => { window.dispatchEvent(new Event('focus')) })
  expect(await screen.findByText('Còn 5/5 lượt viết')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Viết bài' }) as HTMLButtonElement).disabled).toBe(false)
})

it('ignores a quota refresh that answers after an AI call already reported a newer quota', async () => {
  let release: (r: Response) => void = () => {}
  quotaReply = { outline: { limit: 10, remaining: 10 }, draft: { limit: 5, remaining: 5 } }
  fetchMock.mockImplementation((input, init) => new URL(String(input)).pathname.endsWith('/ai/quota')
    ? new Promise<Response>(resolve => { release = resolve }) : backend(input, init))
  const user = userEvent.setup()
  renderPage()
  await user.selectOptions(await screen.findByLabelText(/Chủ đề/), 'java')
  fireEvent.change(screen.getByLabelText(/Ý tưởng/), { target: { value: form.idea } })
  fireEvent.change(screen.getByLabelText(/Đối tượng đọc/), { target: { value: form.targetAudience } })
  await user.click(screen.getByRole('button', { name: 'Tạo dàn ý' }))
  expect(await screen.findByText('Còn 7/10 lượt dàn ý')).toBeTruthy()
  await act(async () => { release(json(quotaReply)) })
  expect(screen.getByText('Còn 7/10 lượt dàn ý')).toBeTruthy()
})
