import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAccessToken } from './api/client'
import { authorActions, authorArticles, changedFields, countImages, imageSources, isManagedImage, removeImage, replaceImage, resolveIssue } from './articleService'
import type { AuthorArticle, ImageIssue } from '../types/articles'

// JSON exactly as ArticleResponse/ArticleSummaryResponse/PageResponse serialize it (Task 1a–1c).
const version = { id: 'v-1', versionNumber: 3, title: 'Live', summary: 'S', content: '# Live', coverImageUrl: null, topic: { id: 'java', name: 'Java', active: true }, tags: [], approvedBy: 'mod-1', approvedAt: '2026-11-03T10:00:00Z', contentFingerprint: 'a'.repeat(64), readingMinutes: 2 }
const issue: ImageIssue = { type: 'LOCAL_FILE', alt: 'sơ đồ', source: './img/a.png', occurrence: 1, line: 3, column: 1, filename: 'a.png' }
export const articleFixture: AuthorArticle = {
  id: 'art-1', authorId: 'author-1', title: 'Draft', summary: 'Sum', content: 'Intro\n\n![sơ đồ](./img/a.png)', coverImageUrl: null,
  topic: { id: 'java', name: 'Java', active: true }, tags: [{ id: 'spring', name: 'Spring', active: true }],
  workflowStatus: 'DRAFT', publicationStatus: 'PUBLISHED', hasUnpublishedChanges: true, publishedVersion: version, imageIssues: [issue],
  moderationNote: null, reviewedBy: null, reviewedAt: null, publishedAt: '2026-11-01T10:00:00Z', createdAt: '2026-11-01T09:00:00Z', createdBy: 'author-1', updatedAt: '2026-11-04T10:42:00Z', updatedBy: 'author-1',
}
const page = { content: [{ id: 'art-1', title: 'Draft', summary: 'Sum', coverImageUrl: null, topic: { id: 'java', name: 'Java', active: true }, workflowStatus: 'DRAFT', publicationStatus: 'PUBLISHED', hasUnpublishedChanges: true, publishedAt: null, createdAt: '2026-11-01T09:00:00Z', updatedAt: '2026-11-04T10:42:00Z' }], page: 0, size: 20, totalElements: 1, totalPages: 1, hasNext: false }

const fetchMock = vi.fn<typeof fetch>()
const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ status, message: 'OK', data }), { status })
const call = (i = 0) => ({ url: new URL(String(fetchMock.mock.calls[i][0])), init: fetchMock.mock.calls[i][1]! })

beforeEach(() => { setAccessToken('t'); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => { setAccessToken(null); vi.unstubAllGlobals() })

describe('authorArticles API', () => {
  it('lists with separate workflow/publication filters and returns the page envelope', async () => {
    fetchMock.mockResolvedValue(ok(page))
    const result = await authorArticles.list({ page: 1, size: 20, keyword: 'java', workflowStatus: 'PENDING', publicationStatus: 'HIDDEN', topicId: '', sortBy: 'CREATED_AT', direction: 'DESC' })
    const { url } = call()
    expect(url.pathname).toBe('/api/v1/author/articles')
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '1', size: '20', keyword: 'java', workflowStatus: 'PENDING', publicationStatus: 'HIDDEN', sortBy: 'CREATED_AT', direction: 'DESC' })
    expect(result.totalElements).toBe(1)
    expect(result.content[0].publicationStatus).toBe('PUBLISHED')
  })

  it('creates with an Idempotency-Key and patches with only the given fields', async () => {
    fetchMock.mockResolvedValue(ok(articleFixture, 201))
    const created = await authorArticles.create({ action: 'SAVE', title: 'Draft', topicId: 'java' }, 'key-1')
    expect(created.imageIssues[0].occurrence).toBe(1)
    expect(new Headers(call().init.headers).get('Idempotency-Key')).toBe('key-1')
    expect(call().init.method).toBe('POST')
    await authorArticles.update('art-1', { action: 'SUBMIT', summary: 'x' })
    expect(call(1).url.pathname).toBe('/api/v1/author/articles/art-1')
    expect(call(1).init.method).toBe('PATCH')
    expect(JSON.parse(String(call(1).init.body))).toEqual({ action: 'SUBMIT', summary: 'x' })
  })

  it('maps lifecycle actions to their endpoints', async () => {
    fetchMock.mockImplementation(async () => ok(articleFixture))
    await authorArticles.withdraw('a')
    await authorArticles.discard('a')
    await authorArticles.publication('a', 'UNHIDE')
    await authorArticles.remove('a')
    await authorArticles.history('a', 2)
    expect(fetchMock.mock.calls.map((_, i) => `${call(i).init.method || 'GET'} ${call(i).url.pathname}${call(i).url.search}`)).toEqual([
      'POST /api/v1/author/articles/a/withdraw',
      'POST /api/v1/author/articles/a/discard',
      'PATCH /api/v1/author/articles/a/publication',
      'DELETE /api/v1/author/articles/a',
      'GET /api/v1/author/articles/a/history?page=2&size=10',
    ])
    expect(JSON.parse(String(call(2).init.body))).toEqual({ action: 'UNHIDE' })
  })

  it('uploads images as multipart with a reusable Upload-Key', async () => {
    fetchMock.mockResolvedValue(ok({ url: 'https://res.cloudinary.com/x/image/upload/v1/f/author-1/art-1/k.png', publicId: 'p', width: 1, height: 1, uploadKey: 'u-1' }))
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const uploaded = await authorArticles.uploadImage('art-1', file, 'u-1')
    expect(uploaded.url).toMatch(/k\.png$/)
    expect(call().url.pathname).toBe('/api/v1/author/articles/art-1/images')
    expect(new Headers(call().init.headers).get('Upload-Key')).toBe('u-1')
    expect(call().init.body).toBeInstanceOf(FormData)
  })
})

describe('authorActions (action matrix)', () => {
  const actions = (workflowStatus: AuthorArticle['workflowStatus'], publicationStatus: AuthorArticle['publicationStatus']) => authorActions({ workflowStatus, publicationStatus })
  it.each([
    ['DRAFT', 'UNPUBLISHED', 'edit', ['deleteHard', 'history']],
    ['CHANGES_REQUESTED', 'UNPUBLISHED', 'edit', ['deleteHard', 'history']],
    ['PENDING', 'UNPUBLISHED', 'view', ['withdraw', 'history']],
    ['PUBLISHED', 'PUBLISHED', 'edit', ['viewLive', 'hide', 'deleteSoft', 'history']],
    ['DRAFT', 'PUBLISHED', 'edit', ['viewLive', 'discard', 'hide', 'deleteSoft', 'history']],
    ['PENDING', 'PUBLISHED', 'view', ['viewLive', 'withdraw', 'hide', 'deleteSoft', 'history']],
    ['DRAFT', 'AUTHOR_HIDDEN', 'edit', ['discard', 'unhide', 'deleteSoft', 'history']],
    ['PUBLISHED', 'HIDDEN', 'edit', ['deleteSoft', 'history']],
    ['PENDING', 'REMOVED', 'view', ['history']],
  ] as const)('%s + %s → %s %j', (workflow, publication, primary, menu) => {
    expect(actions(workflow, publication)).toEqual({ primary, menu, readOnly: primary === 'view' })
  })
})

describe('Markdown image helpers', () => {
  const content = 'a ![x](./a.png) b\n![y](<./a.png> "t")\n```\n![z](./a.png)\n```\n![w](https://x/b.jpg)'
  it('replaces only the occurrence on the reported line and keeps alt/title', () => {
    expect(replaceImage(content, { ...issue, source: './a.png', occurrence: 2, line: 2 }, 'https://cdn/new.png'))
      .toBe('a ![x](./a.png) b\n![y](https://cdn/new.png "t")\n```\n![z](./a.png)\n```\n![w](https://x/b.jpg)')
  })
  it('refuses a stale target instead of replacing the wrong image', () => {
    expect(replaceImage(content, { ...issue, source: './a.png', occurrence: 2, line: 6 }, 'u')).toBeNull()
    expect(replaceImage(content, { ...issue, source: './gone.png', occurrence: 1, line: 1 }, 'u')).toBeNull()
  })
  it('removes the whole image markup', () => {
    expect(removeImage(content, { ...issue, source: 'https://x/b.jpg', occurrence: 1, line: 6 })).toBe('a ![x](./a.png) b\n![y](<./a.png> "t")\n```\n![z](./a.png)\n```\n')
  })
  it('ignores image-like text inside code, like the backend parser', () => {
    expect(countImages(content)).toBe(3)
    expect(replaceImage('```\n![z](./a.png)\n```\n`![i](./a.png)` ![q](./a.png)', { ...issue, source: './a.png', occurrence: 1, line: 4 }, 'u'))
      .toBe('```\n![z](./a.png)\n```\n`![i](./a.png)` ![q](u)')
  })
  it('recognises only this article’s managed Cloudinary assets', () => {
    expect(isManagedImage('https://res.cloudinary.com/c/image/upload/v1/articles/author-1/art-1/k.png', 'author-1', 'art-1')).toBe(true)
    expect(isManagedImage('https://res.cloudinary.com/c/image/upload/v1/articles/other/art-1/k.png', 'author-1', 'art-1')).toBe(false)
    expect(isManagedImage('https://evil.example/author-1/art-1/k.png', 'author-1', 'art-1')).toBe(false)
    expect(isManagedImage('./a.png', 'author-1', undefined)).toBe(false)
  })
  it('mirrors the backend URL shape: no query/port, versioned upload path, .png directly under the article folder', () => {
    const ok = 'https://res.cloudinary.com/c/image/upload/v1/articles/author-1/art-1/k.png'
    expect(isManagedImage(`${ok}?x=1`, 'author-1', 'art-1')).toBe(false)
    expect(isManagedImage('https://res.cloudinary.com:8443/c/image/upload/v1/articles/author-1/art-1/k.png', 'author-1', 'art-1')).toBe(false)
    expect(isManagedImage('https://res.cloudinary.com/c/image/fetch/v1/articles/author-1/art-1/k.png', 'author-1', 'art-1')).toBe(false)
    expect(isManagedImage('https://res.cloudinary.com/c/image/upload/v1/articles/author-1/art-1/k.jpg', 'author-1', 'art-1')).toBe(false)
    expect(isManagedImage('https://res.cloudinary.com/c/image/upload/v1/author-1/art-1/x/y/k.png', 'author-1', 'art-1')).toBe(false)
  })
  it('lists image sources in document order, ignoring code', () => {
    expect(imageSources('![a](x.png) `![b](y.png)` ![c](<z.png> "t")')).toEqual(['x.png', 'z.png'])
  })
})

it('resolving an issue shifts later occurrences of the same source only', () => {
  const a1 = { ...issue, source: 'a', occurrence: 1 }, a2 = { ...issue, source: 'a', occurrence: 2 }, b1 = { ...issue, source: 'b', occurrence: 1 }
  expect(resolveIssue([a1, a2, b1], a1)).toEqual([{ ...a2, occurrence: 1 }, b1])
})

describe('changedFields', () => {
  it('returns only fields that differ from the saved article, tags compared as a set', () => {
    const form = { title: 'Draft', topicId: 'java', tagIds: ['spring'], summary: 'New', content: articleFixture.content ?? '', coverImageUrl: null }
    expect(changedFields(form, articleFixture)).toEqual({ summary: 'New' })
    expect(changedFields({ ...form, summary: 'Sum', tagIds: [] }, articleFixture)).toEqual({ tagIds: [] })
    expect(changedFields(form, null)).toEqual(form)
  })
})
