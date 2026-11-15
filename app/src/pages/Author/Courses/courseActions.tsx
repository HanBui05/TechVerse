import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { statusTone } from '@/lib/utils'
import { courseErrorText, courseText } from '../../../data/courseI18n'
import { publicationLabel, workflowLabel } from '../../../data/articleI18n'
import { authorActions } from '../../../services/articleService'
import { authorCourses } from '../../../services/courseService'
import { ArticleHistorySheet } from '../AuthorBlogsPage'
import type { ArticleStatus } from '../../../types/articles'
import type { AuthorCourse, CourseAction } from '../../../types/courses'
import type { Language } from '../../../types/preferences'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const DANGER: CourseAction[] = ['deleteHard', 'deleteSoft', 'discard']
type Target = ArticleStatus & { id: string; title: string }

/** Publication and workflow are separate axes (as for articles); “unpublished changes” only once something is live. */
export function CourseStatusBadges({ course, language }: { course: Target & { hasUnpublishedChanges: boolean }; language: Language }) {
  const t = courseText(language)
  const { workflowStatus: wf, publicationStatus: pub } = course
  return <ul aria-label={t('statusList')} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
    <li><Badge tone={statusTone(pub)}>{publicationLabel[pub][language]}</Badge></li>
    <li><Badge tone={statusTone(wf)}>{workflowLabel[wf][language]}</Badge></li>
    {course.hasUnpublishedChanges && pub !== 'UNPUBLISHED' && wf !== 'PUBLISHED' && <li><Badge tone="amber"><span aria-hidden>●</span>{t('unpublishedChanges')}</Badge></li>}
  </ul>
}

/** Confirm dialogs + history sheet shared by workspace rows and the editor. `onDone(action, null)` means the course was deleted. */
export function useCourseActions(language: Language, onDone: (action: CourseAction, updated: AuthorCourse | null) => void) {
  const t = courseText(language)
  const [pending, setPending] = useState<{ action: CourseAction; course: Target } | null>(null)
  const [history, setHistory] = useState<Target | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ask = (action: CourseAction, course: Target) => { setError(''); if (action === 'history') setHistory(course); else setPending({ action, course }) }
  const run = async () => {
    if (!pending) return
    const { action, course } = pending
    setPending(null); setBusy(true); setError('')
    try {
      const id = course.id
      const updated = action === 'withdraw' ? await authorCourses.withdraw(id)
        : action === 'discard' ? await authorCourses.discard(id)
          : action === 'hide' || action === 'unhide' ? await authorCourses.publication(id, action === 'hide' ? 'HIDE' : 'UNHIDE')
            : (await authorCourses.remove(id), null)
      onDone(action, updated)
    } catch (e) { setError(courseErrorText(e, language, t('loadError'))) }
    finally { setBusy(false) }
  }
  const elements = <>
    <AlertDialog open={pending !== null} onOpenChange={open => { if (!open) setPending(null) }}>
      {pending && <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(pending.action as 'withdraw')}</AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]"><strong className="text-foreground">{pending.course.title}</strong> — {t(`${pending.action}Text` as 'withdrawText')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction variant={DANGER.includes(pending.action) ? 'destructive' : 'default'} onClick={() => void run()}>{t(pending.action as 'withdraw')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
    <ArticleHistorySheet target={history} language={language} title={t('historyTitle')} fetchPage={authorCourses.history} onClose={() => setHistory(null)} />
  </>
  return { ask, elements, error, busy }
}

/** The `⋯` menu: exactly the backend-accepted actions for this state (same matrix as articles). */
export function CourseActionMenu({ course, language, onAsk, disabled }: { course: Target; language: Language; onAsk: (action: CourseAction, course: Target) => void; disabled?: boolean }) {
  const t = courseText(language)
  const [open, setOpen] = useState(false)
  const item = `flex min-h-9 w-full items-center rounded-md border-0 bg-transparent px-3 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted ${touch}`
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="outline" size="icon" disabled={disabled} aria-label={t('more', { title: course.title })} className={touch}><MoreHorizontal /></Button></PopoverTrigger>
    <PopoverContent align="end" className="w-56 p-1">
      <div role="menu" aria-label={t('moreShort')} className="flex flex-col">
        {authorActions(course).menu.map(action => action === 'viewLive'
          ? <Link key={action} role="menuitem" to={`/courses/${course.id}`} target="_blank" rel="noopener" className={item}>{t('viewLive')}</Link>
          : <button key={action} type="button" role="menuitem" className={`${item} ${DANGER.includes(action) ? 'text-danger' : ''}`} onClick={() => { setOpen(false); onAsk(action, course) }}>{t(action as 'withdraw')}</button>)}
      </div>
    </PopoverContent>
  </Popover>
}
