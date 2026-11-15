import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CourseAiSheet, aiSessionKey } from './CourseAiSheet'
import { setAccessToken } from '../../../services/api/client'
import { sha256Hex } from '../../../services/aiAssistService'

const enc = new TextEncoder()
const outline = {
  title: 'Cài đặt JDK trên Windows', summary: 'Bài học hướng dẫn cài đặt JDK, cấu hình biến môi trường và kiểm tra phiên bản Java trên Windows.', topicId: 'java', tagIds: [], suggestedTagIds: [],
  sections: [{ heading: 'Tải JDK về máy', subsections: [] }, { heading: 'Cấu hình JAVA_HOME', subsections: [] }, { heading: 'Kiểm tra phiên bản', subsections: [] }],
}
const form = { title: '', idea: 'Hướng dẫn cài JDK cho người mới bắt đầu học Java.', length: 'MEDIUM', targetAudience: 'Sinh viên năm nhất' }
const content = '## Tải JDK về máy\nNội dung.\n## Cấu hình JAVA_HOME\nThêm.\n'
const json = (data: unknown, status = 200, headers: Record<string, string> = {}, code?: string) => new Response(JSON.stringify({ status, message: 'English', code, data }), { status, headers })
const frame = (event: string, data: object) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
const fetchMock = vi.fn<typeof fetch>()
let plan: { frames: string[]; hang?: boolean }
const calls = () => fetchMock.mock.calls.map(([url, init]) => ({ path: new URL(String(url)).pathname, method: init?.method || 'GET', body: init?.body ? String(init.body) : '' }))

async function backend(input: RequestInfo | URL, init?: RequestInit) {
  const path = new URL(String(input)).pathname
  if (path.endsWith('/ai/quota')) return json({ outline: { limit: 10, remaining: 9 }, draft: { limit: 5, remaining: 5 } })
  if (path.endsWith('/ai/outlines')) return json(outline, 200, { 'X-AI-Quota-Limit': '10', 'X-AI-Quota-Remaining': '8' })
  if (path.includes('/ai/generations/')) return json({ generationId: 'g1', status: 'CANCELLED' })
  if (path.endsWith('/drafts:stream')) {
    const current = plan
    return new Response(new ReadableStream({
      start(controller) {
        for (const f of current.frames) controller.enqueue(enc.encode(f))
        if (current.hang) init?.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')))
        else controller.close()
      },
    }), { status: 200, headers: { 'X-AI-Quota-Limit': '5', 'X-AI-Quota-Remaining': '4' } })
  }
  return json(null, 404)
}

const key = aiSessionKey('c1', 'l1')
const onClose = vi.fn(), onUse = vi.fn()
const props = { language: 'vi' as const, open: true, courseId: 'c1', lessonKey: 'l1', title: '', summary: '', onClose, onUse }
const renderSheet = (over: object = {}) => render(<CourseAiSheet {...props} {...over} />)
const seed = (over: object = {}) => sessionStorage.setItem(key, JSON.stringify({ form, outline, ...over }))
const completed = async (text = content) => ({ generationId: 'g1', content: text, sha: await sha256Hex(text) })

beforeEach(() => {
  sessionStorage.clear(); setAccessToken('tok'); onClose.mockReset(); onUse.mockReset(); plan = { frames: [] }
  fetchMock.mockReset().mockImplementation(backend); vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

it('asks for a LESSON outline with courseId only (no topic/tags), prefilling the idea from the lesson summary and showing quota', async () => {
  const user = userEvent.setup()
  renderSheet({ title: 'Cài JDK', summary: 'Hướng dẫn cài đặt JDK trên Windows cho người mới học.' })
  expect((screen.getByLabelText(/^Ý tưởng/) as HTMLTextAreaElement).value).toBe('Hướng dẫn cài đặt JDK trên Windows cho người mới học.')
  expect(screen.getByText('Dùng chủ đề và thẻ của khóa học.')).toBeTruthy()
  expect(screen.queryByLabelText(/Chủ đề/)).toBeNull()
  fireEvent.change(screen.getByLabelText(/Đối tượng đọc/), { target: { value: 'Sinh viên' } })
  await user.click(screen.getByRole('button', { name: 'Tạo dàn ý' }))
  expect(await screen.findByDisplayValue(outline.title)).toBeTruthy()
  expect(JSON.parse(calls().find(c => c.path.endsWith('/ai/outlines'))!.body)).toEqual({ targetType: 'LESSON', courseId: 'c1', title: 'Cài JDK', idea: 'Hướng dẫn cài đặt JDK trên Windows cho người mới học.', length: 'MEDIUM', targetAudience: 'Sinh viên' })
  await screen.findByText('Còn 8/10 lượt dàn ý')
  await waitFor(() => expect(JSON.parse(sessionStorage.getItem(key)!)).toMatchObject({ outline: { title: outline.title } }))
})

it('restores the outline per lesson key after a reload, and a different lesson starts empty', async () => {
  seed()
  const view = renderSheet()
  expect(await screen.findByDisplayValue(outline.title)).toBeTruthy()
  view.unmount()
  renderSheet({ lessonKey: 'l2' })
  expect(screen.queryByDisplayValue(outline.title)).toBeNull()
})

it('streams a draft, verifies the SHA-256 and hands title/summary/content/generationId to the lesson', async () => {
  const user = userEvent.setup()
  seed()
  const sha = await sha256Hex(content)
  plan = { frames: [frame('metadata', { generationId: 'g1', timeoutSeconds: 120 }), frame('delta', { text: content }), frame('completed', { generationId: 'g1', validated: true, contentBytes: 10, contentSha256: sha, quotaRemaining: 4 })] }
  renderSheet()
  await user.click(await screen.findByRole('button', { name: 'Viết bài' }))
  await user.click(await screen.findByRole('button', { name: 'Dùng bản nháp này cho bài học' }))
  expect(JSON.parse(calls().find(c => c.path.endsWith('/drafts:stream'))!.body)).toMatchObject({ targetType: 'LESSON', courseId: 'c1', title: outline.title })
  expect(JSON.parse(calls().find(c => c.path.endsWith('/drafts:stream'))!.body)).not.toHaveProperty('topicId')
  expect(onUse).toHaveBeenCalledWith({ title: outline.title, summary: outline.summary, content, generationId: 'g1' })
})

it('rejects a stream whose hash does not match, never offering the draft', async () => {
  const user = userEvent.setup()
  seed()
  plan = { frames: [frame('metadata', { generationId: 'g1', timeoutSeconds: 120 }), frame('delta', { text: content }), frame('completed', { generationId: 'g1', validated: true, contentBytes: 10, contentSha256: 'bad', quotaRemaining: 4 })] }
  renderSheet()
  await user.click(await screen.findByRole('button', { name: 'Viết bài' }))
  expect((await screen.findByRole('alert')).textContent).toContain('không toàn vẹn')
  expect(screen.queryByRole('button', { name: 'Dùng bản nháp này cho bài học' })).toBeNull()
})

it('Dừng aborts the stream and cancels the generation; closing the Sheet mid-stream is a Stop too', async () => {
  const user = userEvent.setup()
  seed()
  plan = { frames: [frame('metadata', { generationId: 'g1', timeoutSeconds: 120 }), frame('delta', { text: '## Tải JDK về máy\nJDK là' })], hang: true }
  const view = renderSheet()
  await user.click(await screen.findByRole('button', { name: 'Viết bài' }))
  await user.click(await screen.findByRole('button', { name: 'Dừng' }))
  expect(await screen.findByText(/Đã dừng/)).toBeTruthy()
  expect(calls().some(c => c.method === 'DELETE' && c.path.endsWith('/ai/generations/g1'))).toBe(true)
  expect(screen.queryByRole('button', { name: 'Dùng bản nháp này cho bài học' })).toBeNull()
  view.unmount()
  fetchMock.mockClear()
  seed()
  renderSheet()
  await user.click(await screen.findByRole('button', { name: 'Viết bài' }))
  await screen.findByRole('button', { name: 'Dừng' })
  await user.click(screen.getByRole('button', { name: 'Đóng' }))
  expect(onClose).toHaveBeenCalled()
  await waitFor(() => expect(calls().some(c => c.method === 'DELETE')).toBe(true))
})

it('trusts a restored completed draft only after recomputing its hash', async () => {
  const user = userEvent.setup()
  seed({ completed: await completed() })
  renderSheet()
  await user.click(await screen.findByRole('button', { name: 'Dùng bản nháp này cho bài học' }))
  expect(onUse).toHaveBeenCalledTimes(1)
  cleanup(); onUse.mockReset()
  seed({ completed: { ...(await completed()), content: 'đã bị sửa' } })
  renderSheet()
  expect((await screen.findByRole('alert')).textContent).toContain('không toàn vẹn')
  expect(screen.queryByRole('button', { name: 'Dùng bản nháp này cho bài học' })).toBeNull()
})
