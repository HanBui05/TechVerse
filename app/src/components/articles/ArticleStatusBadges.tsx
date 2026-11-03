import { Badge } from '@/components/ui/badge'
import { statusTone } from '@/lib/utils'
import { articleText, publicationLabel, workflowLabel } from '../../data/articleI18n'
import type { ArticleStatus } from '../../types/articles'
import type { Language } from '../../types/preferences'

type Props = { article: ArticleStatus & { hasUnpublishedChanges: boolean }; language: Language; className?: string }

/** Publication (what readers see) and workflow (the working copy) are separate axes, so they get separate badges. */
export function ArticleStatusBadges({ article, language, className }: Props) {
  const t = articleText(language)
  const { workflowStatus: wf, publicationStatus: pub } = article
  return <ul aria-label={t('statusList')} className={`m-0 flex list-none flex-wrap gap-1.5 p-0 ${className ?? ''}`}>
    <li><Badge tone={statusTone(pub)}>{publicationLabel[pub][language]}</Badge></li>
    <li><Badge tone={statusTone(wf)}>{workflowLabel[wf][language]}</Badge></li>
    {article.hasUnpublishedChanges && pub !== 'UNPUBLISHED' && wf !== 'PUBLISHED' && <li><Badge tone="amber"><span aria-hidden>●</span>{t('unpublishedChanges')}</Badge></li>}
  </ul>
}
