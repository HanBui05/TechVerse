import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MarkdownContent, slugify, uniqueSlug } from './MarkdownContent'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('heading slugs', () => {
  it('strips Vietnamese marks, maps đ, lowercases and joins the rest with single dashes', () => {
    expect(slugify('Đặt vấn đề: Tại sao?')).toBe('dat-van-de-tai-sao')
    expect(slugify('  Spring Boot 3.x — cài đặt  ')).toBe('spring-boot-3-x-cai-dat')
    expect(slugify('Ưu điểm & Nhược điểm')).toBe('uu-diem-nhuoc-diem')
  })

  it('uses “section” for an empty slug and numbers duplicates in document order', () => {
    expect(slugify('!!! ???')).toBe('section')
    const seen = new Map<string, number>()
    expect(['Mở đầu', 'Mo dau', 'Mở đầu', '***'].map(text => uniqueSlug(slugify(text), seen))).toEqual(['mo-dau', 'mo-dau-2', 'mo-dau-3', 'section'])
    // a heading that already ends in a number must not collide with a generated suffix
    const other = new Map<string, number>()
    expect(['Foo', 'Foo 2', 'Foo', 'Foo 3', 'Foo'].map(text => uniqueSlug(slugify(text), other))).toEqual(['foo', 'foo-2', 'foo-3', 'foo-3-2', 'foo-4'])
  })

  // Codex round 2: restarting the suffix scan per duplicate was quadratic and could freeze the reader on a 1 MiB article.
  it('stays linear for thousands of identical headings', () => {
    const seen = new Map<string, number>()
    const start = performance.now()
    const ids = Array.from({ length: 20000 }, () => uniqueSlug('a', seen))
    expect(performance.now() - start).toBeLessThan(500)
    expect(new Set(ids).size).toBe(20000)
    expect(ids.at(-1)).toBe('a-20000')
  })
})

describe('MarkdownContent', () => {
  const content = '# Tiêu đề\n\n## Mở đầu\n\n### Cài đặt\n\n## Mở đầu\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```java\nint count = 1;\n```\n\n![Sơ đồ](https://res.cloudinary.com/demo/a.png)\n\n<script>alert(1)</script>\n\n[x](javascript:alert%281%29)'

  it('gives H2/H3 the same unique slugs as the TOC and renders GFM safely', () => {
    const { container } = render(<MarkdownContent content={content} anchors />)
    expect([...container.querySelectorAll('h2[id], h3[id]')].map(h => h.id)).toEqual(['tieu-de', 'mo-dau', 'cai-dat', 'mo-dau-2'])
    expect(screen.getByRole('region', { name: 'Bảng nội dung' }).querySelector('table')).not.toBeNull()
    expect(container.querySelector('pre code.language-java .hljs-number')?.textContent).toBe('1')
    expect(screen.getByText('java')).not.toBeNull()
    expect(screen.getByRole('img', { name: 'Sơ đồ' }).getAttribute('loading')).toBe('lazy')
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByText('x').closest('a')?.getAttribute('href') || '').not.toMatch(/^javascript:/)
  })

  it('copies the code and the heading link (current URL + #slug), and reports a clipboard failure in place', async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'))
    const user = userEvent.setup() // installs its own clipboard stub, so replace it afterwards
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<MarkdownContent content={content} anchors />)
    await user.click(screen.getByRole('button', { name: 'Sao chép mã' }))
    expect(writeText).toHaveBeenLastCalledWith('int count = 1;\n')
    await user.click(screen.getByRole('button', { name: 'Sao chép liên kết tới mục Cài đặt' }))
    expect(writeText).toHaveBeenLastCalledWith(`${window.location.href.split('#')[0]}#cai-dat`)
    expect(await screen.findAllByText('Đã sao chép')).toHaveLength(2) // code + heading, each next to its own button
    await user.click(screen.getAllByRole('button', { name: 'Sao chép liên kết tới mục Mở đầu' })[1])
    expect(await screen.findByText('Không sao chép được')).not.toBeNull()
  })

  it('adds no anchors or ids outside the reader (editor preview, moderator compare)', () => {
    const { container } = render(<MarkdownContent content={content} />)
    expect(container.querySelector('h2[id]')).toBeNull()
    expect(screen.queryByRole('button', { name: /Sao chép liên kết/ })).toBeNull()
  })
})
