import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { aiAssist, draftBytes, parseSse, sha256Hex } from './aiAssistService'
import { ApiError, setAccessToken } from './api/client'
import type { AiDraftRequest, AiStreamEvent } from '../types/aiAssist'

const fetchMock = vi.fn<typeof fetch>()
const enc = new TextEncoder()
const sse = (chunks: string[], status = 200) => new Response(new ReadableStream({
  start(controller) { for (const c of chunks) controller.enqueue(enc.encode(c)); controller.close() },
}), { status, headers: { 'Content-Type': 'text/event-stream', 'X-AI-Quota-Limit': '5', 'X-AI-Quota-Remaining': '4' } })
const draft: AiDraftRequest = { title: 'Spring Security', topicId: 't1', tagIds: [], idea: 'x'.repeat(20), length: 'MEDIUM', targetAudience: 'Dev', summary: 's'.repeat(50), sections: [] }

beforeEach(() => { setAccessToken('tok'); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => { setAccessToken(null); vi.unstubAllGlobals() })

it('posts the outline with the bearer and reads both quota headers', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 200, message: 'ok', data: { title: 'T' } }), { status: 200, headers: { 'X-AI-Quota-Limit': '10', 'X-AI-Quota-Remaining': '7' } }))
  const result = await aiAssist.outline({ topicId: 't1', tagIds: [], idea: 'i', length: 'SHORT', targetAudience: 'a' })
  expect(result).toEqual({ outline: { title: 'T' }, quota: { limit: 10, remaining: 7 } })
  const [url, init] = fetchMock.mock.calls[0]
  expect(String(url)).toMatch(/\/api\/v1\/author\/ai\/outlines$/)
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tok')
})

it('throws ApiError with code and quota when the outline is refused', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 429, code: 'AI_QUOTA_EXCEEDED', message: 'x' }), { status: 429, headers: { 'X-AI-Quota-Limit': '10', 'X-AI-Quota-Remaining': '0' } }))
  const error = await aiAssist.outline({ topicId: 't1', tagIds: [], idea: 'i', length: 'SHORT', targetAudience: 'a' }).catch(e => e)
  expect(error).toBeInstanceOf(ApiError)
  expect(error.code).toBe('AI_QUOTA_EXCEEDED')
  expect(error.quota).toEqual({ limit: 10, remaining: 0 })
})

it('parses SSE frames whose JSON and separators are split across chunks', () => {
  const events: AiStreamEvent[] = []
  const push = parseSse(e => events.push(e))
  push('event: metadata\ndata: {"generationId":"g1","timeo')
  push('utSeconds":120}\n\nevent: delta\r\ndata: {"text":"## A\\n"}\r\n')
  push('\r\nevent: delta\ndata: {"text":"đ"}\r')
  push('\n\r')
  push('\nevent: delta\ndata: {"text":"z"}\n\n')
  expect(events).toEqual([{ type: 'metadata', generationId: 'g1', timeoutSeconds: 120 }, { type: 'delta', text: '## A\n' }, { type: 'delta', text: 'đ' }, { type: 'delta', text: 'z' }])
})

it('streams typed events over fetch (not EventSource), decoding UTF-8 split inside a character', async () => {
  const bytes = enc.encode('event: delta\ndata: {"text":"Việt"}\n\n')
  const cut = 22 // inside the multi-byte "ệ"
  fetchMock.mockResolvedValue(new Response(new ReadableStream({
    start(c) { c.enqueue(enc.encode('event: metadata\ndata: {"generationId":"g1","timeoutSeconds":90}\n\n')); c.enqueue(bytes.slice(0, cut)); c.enqueue(bytes.slice(cut)); c.close() },
  }), { status: 200, headers: { 'X-AI-Quota-Limit': '5', 'X-AI-Quota-Remaining': '4' } }))
  const events: AiStreamEvent[] = []
  const onOpen = vi.fn()
  await aiAssist.streamDraft(draft, new AbortController().signal, e => events.push(e), onOpen)
  expect(onOpen).toHaveBeenCalledWith({ limit: 5, remaining: 4 })
  expect(events.map(e => e.type)).toEqual(['metadata', 'delta'])
  expect(events[1]).toEqual({ type: 'delta', text: 'Việt' })
  const [url, init] = fetchMock.mock.calls[0]
  expect(String(url)).toMatch(/\/drafts:stream$/)
  expect(init?.method).toBe('POST')
  expect(init?.signal).toBeInstanceOf(AbortSignal)
})

it('throws the preflight error before any event when the stream is refused', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 409, code: 'AI_GENERATION_IN_PROGRESS', message: 'x' }), { status: 409 }))
  const events: AiStreamEvent[] = []
  await expect(aiAssist.streamDraft(draft, new AbortController().signal, e => events.push(e))).rejects.toMatchObject({ code: 'AI_GENERATION_IN_PROGRESS' })
  expect(events).toEqual([])
})

it('stops reading when the AbortController fires', async () => {
  fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))))
  const controller = new AbortController()
  const pending = aiAssist.streamDraft(draft, controller.signal, () => {})
  controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})

it('cancels with DELETE carrying the bearer, keepalive when leaving the page', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 200, message: 'ok', data: { generationId: 'g1', status: 'CANCELLED' } }), { status: 200 }))
  await aiAssist.cancel('g1', true)
  const [url, init] = fetchMock.mock.calls[0]
  expect(String(url)).toMatch(/\/api\/v1\/author\/ai\/generations\/g1$/)
  expect(init?.method).toBe('DELETE')
  expect(init?.keepalive).toBe(true)
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tok')
})

it('hashes UTF-8 with SHA-256 and measures the request body in UTF-8 bytes', async () => {
  expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  expect(draftBytes({ ...draft, idea: 'ệ' })).toBe(enc.encode(JSON.stringify({ ...draft, idea: 'ệ' })).length)
})

it('reports SSE streams that are cut before a terminal event', async () => {
  fetchMock.mockResolvedValue(sse(['event: metadata\ndata: {"generationId":"g1","timeoutSeconds":90}\n\n']))
  const events: AiStreamEvent[] = []
  await aiAssist.streamDraft(draft, new AbortController().signal, e => events.push(e))
  expect(events.at(-1)?.type).toBe('metadata')
})

it('reads today’s quota for both kinds without reserving', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 200, message: 'ok', data: { outline: { limit: 10, remaining: 7 }, draft: { limit: 5, remaining: 5 } } }), { status: 200 }))
  expect(await aiAssist.quota()).toEqual({ outline: { limit: 10, remaining: 7 }, draft: { limit: 5, remaining: 5 } })
  const [url, init] = fetchMock.mock.calls[0]
  expect(String(url)).toMatch(/\/api\/v1\/author\/ai\/quota$/)
  expect(init?.method ?? 'GET').toBe('GET')
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tok')
})
