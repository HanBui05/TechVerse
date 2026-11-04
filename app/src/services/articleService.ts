import { request } from './api/client'
import type { ArticleFields, ArticleOption, ArticleStatus, ArticleWrite, AuthorAction, AuthorArticle, AuthorArticleFilter, AuthorArticleSummary, CompareField, HistoryEntry, ImageIssue, ModeratorAction, ModeratorArticleDetail, ModeratorArticleFilter, ModeratorArticleSummary, Page, PublicArticleDetail, PublicArticleSummary, ReaderFilter } from '../types/articles'

const base = '/api/v1/author/articles'
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })
const multipart = (file: File, headers: HeadersInit = {}): RequestInit => { const body = new FormData(); body.append('file', file); return { method: 'POST', headers, body } }

const query = (filter: object) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) if (value !== '' && value !== undefined) params.set(key, String(value))
  return params
}

export const authorArticles = {
  list: (filter: AuthorArticleFilter) => request<Page<AuthorArticleSummary>>(`${base}?${query(filter)}`),
  options: () => request<{ topics: Page<ArticleOption>; tags: Page<ArticleOption> }>(`${base}/options?topicSize=100&tagSize=100`),
  detail: (id: string) => request<AuthorArticle>(`${base}/${id}`),
  create: (body: ArticleWrite, idempotencyKey: string) => request<AuthorArticle>(base, { ...json('POST', body), headers: { 'Idempotency-Key': idempotencyKey } }),
  update: (id: string, body: ArticleWrite) => request<AuthorArticle>(`${base}/${id}`, json('PATCH', body)),
  withdraw: (id: string) => request<AuthorArticle>(`${base}/${id}/withdraw`, { method: 'POST' }),
  discard: (id: string) => request<AuthorArticle>(`${base}/${id}/discard`, { method: 'POST' }),
  publication: (id: string, action: 'HIDE' | 'UNHIDE') => request<AuthorArticle>(`${base}/${id}/publication`, json('PATCH', { action })),
  remove: (id: string) => request<void>(`${base}/${id}`, { method: 'DELETE' }),
  history: (id: string, page: number) => request<Page<HistoryEntry>>(`${base}/${id}/history?page=${page}&size=10`),
  importFile: (file: File) => request<{ filename: string; content: string; imageIssues: ImageIssue[] }>(`${base}/import`, multipart(file)),
  uploadImage: (id: string, file: File, uploadKey: string) => request<{ url: string }>(`${base}/${id}/images`, multipart(file, { 'Upload-Key': uploadKey })),
}

const moderatorBase = '/api/v1/moderator/articles'
const note = (text: string) => text.trim() || null

export const moderatorArticles = {
  list: (filter: ModeratorArticleFilter) => request<Page<ModeratorArticleSummary>>(`${moderatorBase}?${query(filter)}`),
  // shortcut: reader options only list topics/tags of visible articles (no moderator options endpoint; user decision 2026-11-04).
  options: () => request<{ topics: Page<ArticleOption>; tags: Page<ArticleOption> }>('/api/v1/articles/options?topicSize=100&tagSize=100'),
  detail: (id: string) => request<ModeratorArticleDetail>(`${moderatorBase}/${id}`),
  review: (id: string, decision: 'APPROVE' | 'REQUEST_CHANGES', reviewToken: string, text: string) =>
    request<ModeratorArticleDetail>(`${moderatorBase}/${id}/review`, json('PATCH', { decision, reviewToken, moderationNote: note(text) })),
  publication: (id: string, action: 'HIDE' | 'RESTORE' | 'REMOVE', reviewToken: string, text: string) =>
    request<ModeratorArticleDetail>(`${moderatorBase}/${id}/publication`, json('PATCH', { action, reviewToken, moderationNote: note(text) })),
  history: (id: string, page: number) => request<Page<HistoryEntry>>(`${moderatorBase}/${id}/history?page=${page}&size=10`),
}

/** Moderator actions the backend accepts in this state (wireframe 2b-2); terminal states have none. */
export function moderatorActions({ workflowStatus: wf, publicationStatus: pub }: ArticleStatus): ModeratorAction[] {
  if (pub === 'REMOVED' || pub === 'AUTHOR_DELETED') return []
  const actions: ModeratorAction[] = wf === 'PENDING' ? ['REQUEST_CHANGES', 'APPROVE'] : []
  if (pub === 'PUBLISHED' || pub === 'AUTHOR_HIDDEN') actions.push('HIDE', 'REMOVE')
  if (pub === 'HIDDEN') actions.push('RESTORE', 'REMOVE')
  return actions
}

/** Fields of the working copy that differ from the live snapshot (string/ID compare, tags as a set); none without a snapshot. */
export function changedFromLive(article: AuthorArticle): CompareField[] {
  const live = article.publishedVersion
  if (!live) return []
  const tags = (list: ArticleOption[]) => list.map(tag => tag.id).sort().join()
  const changed: [CompareField, boolean][] = [
    ['title', article.title !== live.title], ['summary', (article.summary ?? '') !== (live.summary ?? '')], ['cover', article.coverImageUrl !== live.coverImageUrl],
    ['topic', article.topic.id !== live.topic.id], ['tags', tags(article.tags) !== tags(live.tags)], ['content', (article.content ?? '') !== live.content],
  ]
  return changed.filter(([, differs]) => differs).map(([field]) => field)
}

/**
 * Note of a REQUEST_CHANGES made after the latest APPROVE. APPROVE stamps reviewedAt and the new version's approvedAt with the
 * same instant, so a later reviewedAt means the last review returned the article; withdraw/resubmit keep the note.
 */
export function lastReturnNote(article: AuthorArticle) {
  if (!article.moderationNote || !article.reviewedAt) return null
  const approvedAt = article.publishedVersion?.approvedAt
  return !approvedAt || Date.parse(article.reviewedAt) > Date.parse(approvedAt) ? article.moderationNote : null
}

/** Author action matrix (plans/article-flow.wireframe.md): only actions the backend accepts in this state. */
export function authorActions({ workflowStatus: wf, publicationStatus: pub }: ArticleStatus): { primary: 'edit' | 'view'; menu: AuthorAction[]; readOnly: boolean } {
  if (pub === 'REMOVED' || pub === 'AUTHOR_DELETED') return { primary: 'view', menu: ['history'], readOnly: true }
  const published = pub !== 'UNPUBLISHED'
  const editable = wf === 'DRAFT' || wf === 'CHANGES_REQUESTED'
  const menu: AuthorAction[] = []
  if (pub === 'PUBLISHED') menu.push('viewLive')
  if (wf === 'PENDING') menu.push('withdraw')
  if (published && editable) menu.push('discard')
  if (pub === 'PUBLISHED') menu.push('hide')
  if (pub === 'AUTHOR_HIDDEN') menu.push('unhide')
  if (published) menu.push('deleteSoft')
  else if (editable) menu.push('deleteHard')
  menu.push('history')
  return { primary: wf === 'PENDING' ? 'view' : 'edit', menu, readOnly: wf === 'PENDING' }
}

/** Fields of the form that differ from the saved article (PATCH sends only these); tags compare as a set. */
export function changedFields(form: ArticleFields, saved: AuthorArticle | null): Partial<ArticleFields> {
  if (!saved) return form
  const savedTags = saved.tags.map(tag => tag.id)
  const diff: Partial<ArticleFields> = {}
  if (form.title !== saved.title) diff.title = form.title
  if (form.topicId !== saved.topic.id) diff.topicId = form.topicId
  if (form.tagIds.length !== savedTags.length || form.tagIds.some(id => !savedTags.includes(id))) diff.tagIds = form.tagIds
  if (form.summary !== (saved.summary ?? '')) diff.summary = form.summary
  if (form.content !== (saved.content ?? '')) diff.content = form.content
  if (form.coverImageUrl !== saved.coverImageUrl) diff.coverImageUrl = form.coverImageUrl
  return diff
}

/**
 * URL shape of ArticleImageService.publicId: https://res.cloudinary.com/<cloud>/image/upload/v<n>/<folder>/<author>/<article>/<id>.png,
 * no port/query/fragment/userinfo. Cloud name and folder are server config, so callers also require a trusted source (see editor).
 */
export function isManagedImage(url: string, authorId: string | undefined, articleId: string | undefined) {
  if (!authorId || !articleId) return false
  const match = /^https:\/\/res\.cloudinary\.com\/[^/?#:@]+\/image\/upload\/v\d+\/([A-Za-z0-9_/-]+)\.png$/.exec(url)
  return Boolean(match && match[1].endsWith(`/${authorId}/${articleId}/${match[1].split('/').pop()}`))
}

/** Image destinations in document order (code ignored, like the backend parser). */
export const imageSources = (content: string) => images(content).map(image => image.source)

const blank = (text: string) => text.replace(/[^\n]/g, ' ')
const IMAGE = /!\[((?:\\.|[^\]\\\n])*)\]\(\s*(?:<([^>\n]*)>|([^\s)]+))((?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?)\s*\)/g

// Image markup in document order. Code is blanked first (same length) so, like the backend parser, image-like text in code is ignored.
function images(content: string) {
  const masked = content
    .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*$|$(?![\s\S]))/gm, blank)
    .replace(/`[^`\n]*`/g, blank)
  return [...masked.matchAll(IMAGE)].map(m => ({
    start: m.index, end: m.index + m[0].length, alt: content.slice(m.index + 2, m.index + 2 + m[1].length), source: m[2] ?? m[3],
    title: m[4], line: content.slice(0, m.index).split('\n').length,
  }))
}

// The issue's n-th image with that source, only if it still sits on the reported line; otherwise the issue is stale.
function locate(content: string, issue: ImageIssue) {
  const match = images(content).filter(image => image.source === issue.source)[issue.occurrence - 1]
  return match && match.line === issue.line ? match : null
}

export function replaceImage(content: string, issue: ImageIssue, url: string) {
  const m = locate(content, issue)
  return m ? `${content.slice(0, m.start)}![${m.alt}](${url}${m.title})${content.slice(m.end)}` : null
}

export function removeImage(content: string, issue: ImageIssue) {
  const m = locate(content, issue)
  return m ? content.slice(0, m.start) + content.slice(m.end) : null
}

export const countImages = (content: string) => images(content).length

/** Drop a resolved issue; later issues with the same source move up one occurrence (the resolved image no longer has it). */
export const resolveIssue = (issues: ImageIssue[], done: ImageIssue) => issues
  .filter(issue => issue.source !== done.source || issue.occurrence !== done.occurrence)
  .map(issue => issue.source === done.source && issue.occurrence > done.occurrence ? { ...issue, occurrence: issue.occurrence - 1 } : issue)

const publicBase = '/api/v1/articles'
export const READER_PAGE_SIZE = 9

export const publicArticles = {
  list: (filter: ReaderFilter) => request<Page<PublicArticleSummary>>(`${publicBase}?${query({ ...filter, size: READER_PAGE_SIZE })}`),
  options: () => request<{ topics: Page<ArticleOption>; tags: Page<ArticleOption> }>(`${publicBase}/options?topicSize=100&tagSize=100`),
  detail: (id: string) => request<PublicArticleDetail>(`${publicBase}/${encodeURIComponent(id)}`),
  setSaved: (id: string, saved: boolean) => request<{ saved: boolean }>(`${publicBase}/${encodeURIComponent(id)}/saved`, { method: saved ? 'PUT' : 'DELETE' }),
}

/** `/blogs` query → filter; unknown sort and malformed page fall back to the defaults. */
export function readerFilter(params: URLSearchParams): ReaderFilter {
  const page = Number(params.get('page'))
  return {
    keyword: (params.get('keyword') ?? '').trim(), topicId: params.get('topicId') ?? '', tagId: params.get('tagId') ?? '',
    sort: params.get('sort') === 'OLDEST' ? 'OLDEST' : 'NEWEST', page: Number.isInteger(page) && page > 0 ? page : 0,
  }
}

/** Filter → `/blogs` query without empty or default params (NEWEST, page 0). */
export function readerSearch({ keyword, topicId, tagId, sort, page }: ReaderFilter) {
  const params = new URLSearchParams()
  if (keyword.trim()) params.set('keyword', keyword.trim())
  if (topicId) params.set('topicId', topicId)
  if (tagId) params.set('tagId', tagId)
  if (sort !== 'NEWEST') params.set('sort', sort)
  if (page > 0) params.set('page', String(page))
  return params
}

/** “Back to list” target: the `/blogs` list URL carried in router state, else `/blogs` (direct visit or foreign state). */
export function readerBackTarget(state: unknown) {
  const from = (state as { from?: unknown } | null)?.from
  return typeof from === 'string' && /^\/blogs(\?|$)/.test(from) ? from : '/blogs'
}
