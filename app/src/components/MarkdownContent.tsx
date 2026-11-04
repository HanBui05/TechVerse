import { useEffect, useMemo, useState, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy, Link2 } from 'lucide-react'
import { cn } from 'cn'
import { readerText } from '../data/articleI18n'
import type { Language } from '../types/preferences'

/** Heading anchor slug (spec 2c): NFD without combining marks, đ→d, lowercase, other runs → one dash, empty → `section`. */
export function slugify(text: string) {
  const slug = text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'section'
}

/**
 * Duplicates in document order get `-2`, `-3`, skipping ids already issued (“Foo 2” is `foo-2`); `seen` spans one document.
 * Keys are issued ids; values are the next suffix to try for that base, so the scan never restarts (linear, not quadratic).
 */
export function uniqueSlug(slug: string, seen: Map<string, number>) {
  if (!seen.has(slug)) { seen.set(slug, 2); return slug }
  let n = seen.get(slug)!
  while (seen.has(`${slug}-${n}`)) n++
  const id = `${slug}-${n}`
  seen.set(slug, n + 1)
  seen.set(id, 2)
  return id
}

type HastNode = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: HastNode[] }
const textOf = (node: HastNode): string => node.type === 'text' ? node.value ?? '' : (node.children ?? []).map(textOf).join('')

// `#` renders as h2, so h1–h3 all get ids; the reader TOC reads these ids back from the DOM, so anchor and TOC always agree.
const headingIds = () => (tree: HastNode) => {
  const seen = new Map<string, number>()
  const walk = (node: HastNode) => {
    if (node.type === 'element' && /^h[1-3]$/.test(node.tagName ?? '')) node.properties = { ...node.properties, id: uniqueSlug(slugify(textOf(node)), seen) }
    else node.children?.forEach(walk)
  }
  walk(tree)
}

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'

/** Clipboard button with an in-place “copied / could not copy” status (clipboard may be missing or denied). */
export function CopyButton({ text, label, language = 'vi', children, className }: { text: () => string; label: string; language?: Language; children?: ReactNode; className?: string }) {
  const t = readerText(language)
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), 2000)
    return () => clearTimeout(timer)
  }, [state])
  const copy = async () => {
    try { await navigator.clipboard.writeText(text()); setState('done') } catch { setState('failed') }
  }
  return <span className="inline-flex items-center gap-1.5">
    <button type="button" aria-label={label} title={label} onClick={copy}
      className={cn('inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring', touch, className)}>
      {state === 'done' ? <Check className="size-3.5" aria-hidden /> : children ?? <Copy className="size-3.5" aria-hidden />}
    </button>
    <span aria-live="polite" className={cn('text-xs', state === 'failed' ? 'text-danger' : 'text-muted-foreground')}>{state === 'done' ? t('copied') : state === 'failed' ? t('copyFailed') : ''}</span>
  </span>
}

// Reader typography on the wrapper; hljs token colors come from the code-* tokens.
const PROSE = cn(
  'min-w-0 text-[15px] leading-[1.9] text-foreground [overflow-wrap:anywhere] [&>:first-child]:mt-0 [&>:last-child]:mb-0',
  '[&_p]:mb-[18px] [&_strong]:font-bold [&_hr]:my-8 [&_hr]:border-border',
  '[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6.5 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6.5 [&_li]:my-1 [&_li]:pl-1 [&_li]:marker:text-accent-text [&_.task-list-item]:list-none',
  '[&_blockquote]:my-6 [&_blockquote]:rounded-r-[10px] [&_blockquote]:border-l-3 [&_blockquote]:border-accent-text [&_blockquote]:bg-accent-text/6 [&_blockquote]:px-5 [&_blockquote]:py-4 [&_blockquote]:text-muted-foreground [&_blockquote>:last-child]:mb-0',
  '[&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-3',
  '[&_img]:mx-auto [&_img]:my-5 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-border',
  '[&_:not(pre)>code]:rounded-[5px] [&_:not(pre)>code]:border [&_:not(pre)>code]:border-accent-text/15 [&_:not(pre)>code]:bg-accent-text/10 [&_:not(pre)>code]:px-1.25 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[.86em] [&_:not(pre)>code]:text-accent-text',
  '[&_table]:min-w-full [&_table]:border-collapse [&_table]:text-[13px] [&_table]:leading-[1.7] [&_th]:bg-secondary [&_th]:font-bold [&_th,&_td]:min-w-30 [&_th,&_td]:border-r [&_th,&_td]:border-b [&_th,&_td]:border-border [&_th,&_td]:px-4 [&_th,&_td]:py-3 [&_th,&_td]:text-left [&_th:last-child,&_td:last-child]:border-r-0 [&_tr:last-child_td]:border-b-0',
  '[&_.hljs-keyword,&_.hljs-selector-tag,&_.hljs-literal,&_.hljs-type]:text-code-keyword [&_.hljs-string,&_.hljs-attr,&_.hljs-template-tag]:text-code-string [&_.hljs-title,&_.hljs-built\\_in]:text-code-title',
  '[&_.hljs-number,&_.hljs-symbol,&_.hljs-attribute]:text-code-number [&_.hljs-comment,&_.hljs-quote]:text-code-comment [&_.hljs-comment,&_.hljs-quote]:italic [&_.hljs-meta,&_.hljs-variable]:text-code-meta [&_.hljs-tag,&_.hljs-name]:text-code-tag',
)
const HEADING = 'scroll-mt-20 font-bold leading-[1.4] tracking-[-.4px] text-foreground mt-8 mb-3.5'
const HEADING_SIZE = { 1: 'border-b border-border pb-3 text-2xl', 2: 'border-b border-border pb-3 text-2xl', 3: 'text-xl', 4: 'text-[17px]' } as const

type Props = { content: string; imageAllowed?: (src: string) => boolean; imagePlaceholder?: string; anchors?: boolean; language?: Language }

// Render Markdown/GFM thành nội dung có ngữ nghĩa; raw HTML bị bỏ qua, URL nguy hiểm bị lọc mặc định.
// `imageAllowed` (editor preview): ảnh bị từ chối thành placeholder, trình duyệt không request URL đó.
// `anchors` (reader): H2/H3 có id slug + nút sao chép liên kết tới mục.
export function MarkdownContent({ content, imageAllowed, imagePlaceholder = '', anchors = false, language = 'vi' }: Props) {
  // Stable component types: a parent re-render (TOC highlight on scroll) must not remount the content and reset copy status.
  const components = useMemo(() => markdownComponents({ imageAllowed, imagePlaceholder, anchors, language }), [imageAllowed, imagePlaceholder, anchors, language])
  return <div className={PROSE}><ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} rehypePlugins={anchors ? [headingIds, [rehypeHighlight, { detect: false }]] : [[rehypeHighlight, { detect: false }]]} components={components}>{content}</ReactMarkdown></div>
}

function markdownComponents({ imageAllowed, imagePlaceholder = '', anchors, language = 'vi' }: Omit<Props, 'content'>): Components {
  const t = readerText(language)
  const heading = (level: 1 | 2 | 3 | 4) => ({ node, id, children, ...props }: { node?: HastNode; id?: string; children?: ReactNode }) => {
    const Tag = level === 4 ? 'h4' : level === 3 ? 'h3' : 'h2'
    const title = node ? textOf(node) : ''
    return <Tag {...props} id={id} className={cn(HEADING, HEADING_SIZE[level], 'group flex flex-wrap items-center gap-x-2')}>
      <span>{children}</span>
      {anchors && id && <CopyButton language={language} label={t('copyHeading', { title })} text={() => `${window.location.href.split('#')[0]}#${id}`}><Link2 className="size-4" aria-hidden /></CopyButton>}
    </Tag>
  }
  return {
    h1: heading(1), h2: heading(2), h3: heading(3), h4: heading(4),
    table: ({ node, ...props }) => <div className="my-6 max-w-full overflow-x-auto rounded-xl border border-border" tabIndex={0} role="region" aria-label={t('table')}><table {...props} /></div>,
    pre: ({ node, children, ...props }) => {
      const code = node?.children.find(child => child.type === 'element' && child.tagName === 'code')
      const classes = code?.type === 'element' ? code.properties.className : []
      const label = Array.isArray(classes) ? String(classes.find(value => String(value).startsWith('language-')) || '').replace('language-', '') : ''
      return <div className="my-6 overflow-hidden rounded-xl border border-code-border bg-code-bg text-code-text">
        <div className="flex items-center justify-between border-b border-code-border bg-code-header py-1 pr-2 pl-4 font-mono text-[10px] tracking-[1px] text-code-comment uppercase">
          <span>{label || t('code')}</span>
          <CopyButton language={language} label={t('copyCode')} className="text-code-comment hover:bg-code-bg hover:text-code-text" text={() => code ? textOf(code as HastNode) : ''} />
        </div>
        <pre {...props} tabIndex={0} className="m-0 overflow-x-auto p-5 whitespace-pre [&>code]:font-mono [&>code]:text-xs [&>code]:leading-[1.85] [&>code]:[tab-size:4]">{children}</pre>
      </div>
    },
    a: ({ node, href, ...props }) => <a {...props} href={href} target={/^https?:\/\//i.test(href || '') ? '_blank' : undefined} rel="noopener noreferrer" />,
    img: ({ node, src, alt, ...props }) => !imageAllowed || (typeof src === 'string' && imageAllowed(src))
      ? <img {...props} src={src} alt={alt} loading="lazy" />
      : <span role="img" aria-label={alt || imagePlaceholder} className="my-4 flex min-h-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted p-4 text-center text-sm text-muted-foreground"><span>{imagePlaceholder}</span>{alt && <span className="text-xs">{alt}</span>}</span>,
  }
}
