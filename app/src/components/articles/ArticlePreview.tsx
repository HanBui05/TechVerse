import { Badge } from '@/components/ui/badge'
import { toneFor } from '@/lib/utils'
import { MarkdownContent } from '../MarkdownContent'

type Props = {
  title: string; summary: string; topic?: string; tags: string[]; coverUrl: string | null; content: string
  imageAllowed: (src: string) => boolean; imagePlaceholder: string; untitled: string
}

/** Reader-detail composition for the editor. No reading time: only the backend computes it, at APPROVE. */
export function ArticlePreview({ title, summary, topic, tags, coverUrl, content, imageAllowed, imagePlaceholder, untitled }: Props) {
  return <article className="flex flex-col gap-4">
    {coverUrl && imageAllowed(coverUrl) && <img src={coverUrl} alt="" className="aspect-video w-full rounded-lg border border-border object-cover" />}
    {topic && <Badge tone={toneFor(topic)} className="max-w-full whitespace-normal">{topic}</Badge>}
    <h1 className="text-3xl leading-tight font-bold [overflow-wrap:anywhere]">{title.trim() || untitled}</h1>
    {summary.trim() && <p className="border-l-4 border-primary pl-4 text-base text-muted-foreground [overflow-wrap:anywhere]">{summary}</p>}
    {tags.length > 0 && <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">{tags.map(tag => <li key={tag} className="max-w-full"><Badge tone={toneFor(tag)} className="max-w-full whitespace-normal [overflow-wrap:anywhere]">#{tag}</Badge></li>)}</ul>}
    <MarkdownContent content={content} imageAllowed={imageAllowed} imagePlaceholder={imagePlaceholder} />
  </article>
}
