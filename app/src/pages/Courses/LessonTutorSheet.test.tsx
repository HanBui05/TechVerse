import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LessonTutor } from './LessonTutorSheet'
import { setAccessToken } from '../../services/api/client'
import { json } from './fixtures'

type Frame = [string, object]
const frames = (list: Frame[]) => list.map(([type, data]) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`).join('')
const meta: Frame = ['metadata', { generationId: 'g', timeoutSeconds: 60, contextTruncated: false }]
const answer = (text: string, remaining = 19): Frame[] => [meta, ['delta', { text }], ['completed', { generationId: 'g', validated: true, contentBytes: 1, contentSha256: 'x', quotaRemaining: remaining }]]

/** `hold` keeps the body open (until aborted) so the test can act mid-stream. */
function reply(list: Frame[], { hold = false, headers = { 'X-AI-Quota-Limit': '20', 'X-AI-Quota-Remaining': '19' } } = {}) {
  return (signal?: AbortSignal | null) => new Response(new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(frames(list)))
      if (!hold) c.close()
      else signal?.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError')))
    },
  }), { status: 200, headers })
}

let quota = { limit: 20, remaining: 20 }
let replies: ReturnType<typeof reply>[] = []
let fetchMock: ReturnType<typeof vi.fn>
const posts = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/tutor:stream'))
const body = (i: number) => JSON.parse(String(posts()[i][1].body))
const quotaCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/me/ai-tutor/quota')).length

beforeEach(() => {
  setAccessToken('t'); quota = { limit: 20, remaining: 20 }; replies = []
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => String(input).endsWith('/tutor:stream') ? replies.shift()!(init?.signal) : json(quota))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); setAccessToken(null); vi.unstubAllGlobals() })

const user = userEvent.setup()
const renderTutor = (props: Partial<Parameters<typeof LessonTutor>[0]> = {}) => render(<MemoryRouter><LessonTutor courseId="c1" lessonId="l1" language="vi" authenticated hasText askLogin={() => {}} {...props} /></MemoryRouter>)
async function open() {
  await user.click(screen.getByRole('button', { name: 'Hỏi AI về bài này' }))
  await screen.findByText('Còn 20/20 câu hôm nay').catch(() => {})
  return screen.getByRole('textbox', { name: 'Câu hỏi' }) as HTMLTextAreaElement
}
async function ask(text: string) {
  const box = screen.getByRole('textbox', { name: 'Câu hỏi' })
  fireEvent.change(box, { target: { value: text } })
  await user.click(screen.getByRole('button', { name: 'Gửi' }))
}

it('streams the answer, then shows the quota the server reported and the long-lesson notice', async () => {
  replies.push(reply([['metadata', { generationId: 'g', timeoutSeconds: 60, contextTruncated: true }], ['delta', { text: 'Xin ' }], ['delta', { text: 'chào' }], ['completed', { generationId: 'g', validated: true, contentBytes: 1, contentSha256: 'x', quotaRemaining: 18 }]]))
  renderTutor()
  const box = await open()
  expect(screen.getByText('Hỏi bất cứ điều gì bạn chưa hiểu trong bài.')).toBeTruthy()
  await ask('Biến là gì?')
  expect(await screen.findByText('Xin chào')).toBeTruthy()
  expect(await screen.findByText('Còn 18/20 câu hôm nay')).toBeTruthy()
  expect(screen.getByText('Bài học dài nên AI chỉ đọc phần đầu.')).toBeTruthy()
  expect(screen.getByText('Biến là gì?')).toBeTruthy()
  expect(body(0)).toEqual({ question: 'Biến là gì?', history: [] })
  expect(box.value).toBe('')
  expect(String(posts()[0][0])).toContain('/api/v1/courses/c1/lessons/l1/tutor:stream')
})

it('validates 0/500/501 characters on the client without calling the API', async () => {
  replies.push(reply(answer('ok')))
  renderTutor()
  await open()
  await ask('   ')
  expect((await screen.findByRole('alert')).textContent).toBe('Hãy nhập câu hỏi (tối đa 500 ký tự).')
  expect(posts()).toHaveLength(0)
  fireEvent.change(screen.getByRole('textbox', { name: 'Câu hỏi' }), { target: { value: 'a'.repeat(501) } })
  expect(screen.getByText('501/500')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Gửi' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByRole('textbox', { name: 'Câu hỏi' }), { target: { value: 'a'.repeat(500) } })
  await user.click(screen.getByRole('button', { name: 'Gửi' }))
  await waitFor(() => expect(posts()).toHaveLength(1))
  expect(body(0).question).toHaveLength(500)
})

it('stops a running answer: keeps what arrived, shows no error and reads the quota again', async () => {
  replies.push(reply([meta, ['delta', { text: 'Đang trả' }]], { hold: true }))
  renderTutor()
  await open()
  const before = quotaCalls()
  await ask('Hỏi')
  expect(await screen.findByText('Đang trả')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Gửi' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Dừng' }))
  await screen.findByRole('button', { name: 'Gửi' })
  expect(screen.getByText('Đang trả')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
  await waitFor(() => expect(quotaCalls()).toBe(before + 1))
  replies.push(reply(answer('Tiếp')))
  await ask('Giải thích thêm')
  await screen.findByText('Tiếp')
  expect(body(1).history).toEqual([{ role: 'USER', content: 'Hỏi' }, { role: 'ASSISTANT', content: 'Đang trả' }])
})

it('keeps the part received before an error and retries the same question in place', async () => {
  replies.push(reply([meta, ['delta', { text: 'Một phần' }], ['error', { generationId: 'g', code: 'AI_TIMEOUT', message: 'English', retryable: true, quotaRemaining: 19 }]]))
  replies.push(reply(answer('Đầy đủ', 18)))
  renderTutor()
  await open()
  await ask('Hỏi lại')
  expect((await screen.findByRole('alert')).textContent).toContain('AI phản hồi quá lâu. Hãy thử lại.')
  expect(screen.getByText('Một phần')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Đầy đủ')).toBeTruthy()
  expect(screen.queryByText('Một phần')).toBeNull()
  expect(screen.getAllByText('Hỏi lại')).toHaveLength(1)
  expect(body(1)).toEqual({ question: 'Hỏi lại', history: [] })
  expect(screen.queryByRole('alert')).toBeNull()
})

it('locks the input once the allowance is used up', async () => {
  quota = { limit: 20, remaining: 0 }
  renderTutor()
  await user.click(screen.getByRole('button', { name: 'Hỏi AI về bài này' }))
  expect(await screen.findByText('Bạn đã dùng hết lượt hỏi AI hôm nay.')).toBeTruthy()
  expect((screen.getByRole('textbox', { name: 'Câu hỏi' }) as HTMLTextAreaElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Gửi' }) as HTMLButtonElement).disabled).toBe(true)
})

it('sends only the six latest messages, each cut to the server limit of 2000 characters', async () => {
  const long = 'x'.repeat(2500)
  for (const text of [long, 'A2', 'A3', 'A4', 'A5']) replies.push(reply(answer(text)))
  renderTutor()
  await open()
  for (const n of [1, 2, 3, 4, 5]) { await ask(`Q${n}`); await screen.findByText(n === 1 ? long : `A${n}`); await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi' })).toBeTruthy()) }
  expect(body(1).history).toEqual([{ role: 'USER', content: 'Q1' }, { role: 'ASSISTANT', content: 'x'.repeat(2000) }])
  expect(body(4).history).toEqual([['Q2', 'A2'], ['Q3', 'A3'], ['Q4', 'A4']].flatMap(([q, a]) => [{ role: 'USER', content: q }, { role: 'ASSISTANT', content: a }]))
})
