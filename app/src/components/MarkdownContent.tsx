import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

// Giữ layout bảng/code gọn trong bài đọc và không thực thi HTML từ nội dung tác giả.
const components: Components = {
  h1: ({ node, ...props }) => <h2 {...props} />,
  table: ({ node, ...props }) => <div className="markdown-table-scroll" tabIndex={0} role="region" aria-label="Bảng nội dung"><table {...props} /></div>,
  pre: ({ node, children, ...props }) => {
    const code = node?.children.find(child => child.type === 'element' && child.tagName === 'code')
    const classes = code?.type === 'element' ? code.properties.className : []
    const language = Array.isArray(classes) ? String(classes.find(value => String(value).startsWith('language-')) || '').replace('language-', '') : ''
    return <div className="markdown-code-block">
      <div className="markdown-code-header"><span className="markdown-code-dots" aria-hidden="true"><i /><i /><i /></span><span>{language || 'code'}</span></div>
      <pre {...props} tabIndex={0}>{children}</pre>
    </div>
  },
  a: ({ node, href, ...props }) => <a {...props} href={href} target={/^https?:\/\//i.test(href || '') ? '_blank' : undefined} rel="noopener noreferrer" />,
  img: ({ node, ...props }) => <img {...props} loading="lazy" />,
}

// Render Markdown/GFM thành nội dung có ngữ nghĩa; raw HTML bị bỏ qua, URL nguy hiểm bị lọc mặc định.
export function MarkdownContent({ content }: { content: string }) {
  return <div className="markdown-content"><ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: false }]]} components={components}>{content}</ReactMarkdown></div>
}
