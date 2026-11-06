import { ApiError, readEnvelope, request, requestRaw } from './api/client'
import type { AiDraftRequest, AiOutline, AiOutlineRequest, AiQuota, AiSection, AiStreamEvent } from '../types/aiAssist'

const base = '/api/v1/author/ai'
const EVENTS = new Set(['metadata', 'delta', 'completed', 'cancelled', 'error'])
export const MAX_DRAFT_BYTES = 16 * 1024

/** `X-AI-Quota-*` after the current call reserved its slot; null when the response carries none. */
export function quotaOf(headers: Headers): AiQuota | null {
  const remaining = headers.get('X-AI-Quota-Remaining')
  if (remaining === null) return null
  const limit = headers.get('X-AI-Quota-Limit')
  return { limit: limit === null ? null : Number(limit), remaining: Number(remaining) }
}

// Refusals carry the quota too (e.g. AI_QUOTA_EXCEEDED), so the page can show 0/limit.
async function unwrap<T>(response: Response): Promise<T> {
  try { return await readEnvelope<T>(response) }
  catch (e) { if (e instanceof ApiError) Object.assign(e, { quota: quotaOf(response.headers) }); throw e }
}

/** Incremental SSE parser: frames may split anywhere, lines end in \n or \r\n; one `event:` + one JSON `data:` per frame. */
export function parseSse(onEvent: (event: AiStreamEvent) => void) {
  let buffer = ''
  return (chunk: string) => {
    buffer = (buffer + chunk).replace(/\r\n/g, '\n') // after joining: a \r\n may straddle two chunks
    let end: number
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      let type = '', data = ''
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) type = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trimStart()
      }
      if (EVENTS.has(type) && data) onEvent({ type, ...JSON.parse(data) } as AiStreamEvent)
    }
  }
}

export async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** The editable outline; `tagIds` is the final selection (Author's tags plus the suggestions switched on). */
export type OutlineDraft = { title: string; summary: string; tagIds: string[]; suggestedTagIds: string[]; sections: AiSection[] }
export type OutlineErrorKey = 'titleLength' | 'summaryLength' | 'sectionCount' | 'headingLength' | 'headingDuplicate'

/** Client copy of AiDraftRequest validation; keys are `title`, `summary`, `sections`, `h-<i>` (H2) and `h-<i>-<j>` (H3). */
export function outlineErrors(outline: OutlineDraft) {
  const errors: Record<string, OutlineErrorKey> = {}
  const fits = (text: string, min: number, max: number) => { const n = text.trim().length; return n >= min && n <= max }
  if (!fits(outline.title, 5, 255)) errors.title = 'titleLength'
  if (!fits(outline.summary, 50, 500)) errors.summary = 'summaryLength'
  if (outline.sections.length < 3 || outline.sections.length > 8) errors.sections = 'sectionCount'
  const seen = new Set<string>()
  outline.sections.forEach((section, i) => {
    for (const [key, text] of [[`h-${i}`, section.heading], ...section.subsections.map((sub, j) => [`h-${i}-${j}`, sub])]) {
      const normalized = text.trim().toLowerCase()
      if (!fits(text, 5, 120)) errors[key] = 'headingLength'
      else if (seen.has(normalized)) errors[key] = 'headingDuplicate'
      seen.add(normalized)
    }
  })
  return errors
}

export const draftBytes =(body: AiDraftRequest) => new TextEncoder().encode(JSON.stringify(body)).length

export const aiAssist = {
  /** Today's allowance per kind; reserves nothing. */
  quota: () => request<{ outline: AiQuota; draft: AiQuota }>(`${base}/quota`),
  outline: async (body: AiOutlineRequest) => {
    const response = await requestRaw(`${base}/outlines`, { method: 'POST', body: JSON.stringify(body) })
    return { outline: await unwrap<AiOutline>(response), quota: quotaOf(response.headers) }
  },
  /** Uses fetch (POST + bearer), not EventSource. `onOpen` gets the preflight quota; resolves when the body ends — the caller checks for a terminal event. */
  streamDraft: async (body: AiDraftRequest, signal: AbortSignal, onEvent: (event: AiStreamEvent) => void, onOpen?: (quota: AiQuota | null) => void) => {
    const response = await requestRaw(`${base}/drafts:stream`, { method: 'POST', body: JSON.stringify(body), signal })
    if (!response.ok || !response.body) await unwrap(response)
    onOpen?.(quotaOf(response.headers))
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader()
    const push = parseSse(onEvent)
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      push(value)
    }
  },
  /** Best-effort; `keepalive` lets the DELETE outlive a closing tab (pagehide). */
  cancel: (generationId: string, keepalive = false) =>
    requestRaw(`${base}/generations/${generationId}`, { method: 'DELETE', keepalive }).then(r => unwrap<{ generationId: string; status: string }>(r)),
}
