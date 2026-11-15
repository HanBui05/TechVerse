import { useState } from 'react'
import { AlignLeft, ArrowDown, ArrowUp, MoreHorizontal, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { courseText } from '../../../data/courseI18n'
import type { AuthorCourse } from '../../../types/courses'
import type { Language } from '../../../types/preferences'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
export type Selection = { kind: 'course' } | { kind: 'newChapter' } | { kind: 'chapter'; id: string } | { kind: 'lesson'; id: string } | { kind: 'newLesson'; chapterId: string }
export const sameSelection = (a: Selection, b: Selection) => a.kind === b.kind && ('id' in a ? a.id === (b as { id: string }).id : 'chapterId' in a ? a.chapterId === (b as { chapterId: string }).chapterId : true)

type Props = {
  language: Language; course: AuthorCourse; selected: Selection; locked: boolean
  onSelect: (selection: Selection) => void
  onMove: (kind: 'chapter' | 'lesson', id: string, direction: -1 | 1) => void
  onDelete: (kind: 'chapter' | 'lesson', id: string, name: string) => void
}

function ItemMenu({ label, items, disabled }: { label: string; disabled: boolean; items: { key: string; label: string; icon: typeof Pencil; run: () => void; danger?: boolean; off?: boolean }[] }) {
  const [open, setOpen] = useState(false)
  const item = `flex min-h-9 w-full items-center gap-2 rounded-md border-0 bg-transparent px-3 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted disabled:opacity-50 ${touch}`
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="ghost" size="icon" disabled={disabled} aria-label={label} className={`size-8 shrink-0 ${touch}`}><MoreHorizontal /></Button></PopoverTrigger>
    <PopoverContent align="end" className="w-44 p-1">
      <div role="menu" aria-label={label} className="flex flex-col">
        {items.map(({ key, label: text, icon: Icon, run, danger, off }) => <button key={key} type="button" role="menuitem" disabled={off} className={`${item} ${danger ? 'text-danger' : ''}`} onClick={() => { setOpen(false); run() }}><Icon aria-hidden className="size-4" />{text}</button>)}
      </div>
    </PopoverContent>
  </Popover>
}

/** Curriculum tree: select an item, reorder with Up/Down (keyboard friendly, no drag), add and delete. `locked` freezes it while a write is in flight. */
export function CourseTree({ language, course, selected, locked, onSelect, onMove, onDelete }: Props) {
  const t = courseText(language)
  const live = course.publishedVersion
  const liveChapters = new Set(live?.chapters.map(c => c.id))
  const liveLessons = new Set(live?.chapters.flatMap(c => c.lessons.map(l => l.id)))
  const lessons = course.chapters.reduce((n, c) => n + c.lessons.length, 0)
  const row = (active: boolean) => `flex min-w-0 flex-1 items-center gap-2 rounded-md border-0 px-2 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${touch} ${active ? 'bg-tone-blue-bg font-semibold text-accent-text' : 'bg-transparent hover:bg-muted'}`
  return <nav aria-label={t('structure')} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3">
    <button type="button" aria-current={selected.kind === 'course' ? 'true' : undefined} className={`${row(selected.kind === 'course')} w-full flex-none`} onClick={() => onSelect({ kind: 'course' })}>{t('courseInfo')}</button>
    <ul className="m-0 flex list-none flex-col gap-3 border-t border-border p-0 pt-3">
      {course.chapters.map((chapter, ci) => <li key={chapter.id} className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <button type="button" aria-current={selected.kind === 'chapter' && selected.id === chapter.id ? 'true' : undefined} className={row(selected.kind === 'chapter' && selected.id === chapter.id)} onClick={() => onSelect({ kind: 'chapter', id: chapter.id })}>
            <span className="min-w-0 [overflow-wrap:anywhere]"><span className="mr-1 text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">{t('chapterN', { n: ci + 1 })}</span>{chapter.title}</span>
            {live && !liveChapters.has(chapter.id) && <Badge tone="amber">{t('newBadge')}</Badge>}
          </button>
          <ItemMenu label={t('itemMenu', { name: chapter.title })} disabled={locked} items={[
            { key: 'rename', label: t('rename'), icon: Pencil, run: () => onSelect({ kind: 'chapter', id: chapter.id }) },
            { key: 'up', label: t('up'), icon: ArrowUp, run: () => onMove('chapter', chapter.id, -1), off: ci === 0 },
            { key: 'down', label: t('down'), icon: ArrowDown, run: () => onMove('chapter', chapter.id, 1), off: ci === course.chapters.length - 1 },
            { key: 'delete', label: t('remove'), icon: Trash2, run: () => onDelete('chapter', chapter.id, chapter.title), danger: true },
          ]} />
        </div>
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0 pl-4">
          {chapter.lessons.map((lesson, li) => {
            const active = selected.kind === 'lesson' && selected.id === lesson.id
            return <li key={lesson.id} className="flex items-center gap-1">
              <button type="button" aria-current={active ? 'true' : undefined} className={row(active)} onClick={() => onSelect({ kind: 'lesson', id: lesson.id })}>
                {lesson.hasVideo ? <Play aria-hidden className="size-3.5 shrink-0" /> : <AlignLeft aria-hidden className="size-3.5 shrink-0" />}
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{lesson.title}</span>
                {lesson.preview && <Badge tone="green">{t('previewBadge')}</Badge>}
                {lesson.aiAssisted && <Badge tone="blue"><span aria-hidden>✦</span>{t('aiBadge')}</Badge>}
                {live && !liveLessons.has(lesson.id) && <Badge tone="amber">{t('newBadge')}</Badge>}
              </button>
              <ItemMenu label={t('itemMenu', { name: lesson.title })} disabled={locked} items={[
                { key: 'up', label: t('up'), icon: ArrowUp, run: () => onMove('lesson', lesson.id, -1), off: li === 0 },
                { key: 'down', label: t('down'), icon: ArrowDown, run: () => onMove('lesson', lesson.id, 1), off: li === chapter.lessons.length - 1 },
                { key: 'delete', label: t('remove'), icon: Trash2, run: () => onDelete('lesson', lesson.id, lesson.title), danger: true },
              ]} />
            </li>
          })}
          <li><Button variant="ghost" size="sm" className={`justify-start ${touch}`} disabled={locked} onClick={() => onSelect({ kind: 'newLesson', chapterId: chapter.id })}><Plus />{t('addLesson')}</Button></li>
        </ul>
      </li>)}
    </ul>
    <Button variant="outline" size="sm" className={`self-start ${touch}`} disabled={locked} onClick={() => onSelect({ kind: 'newChapter' })}><Plus />{t('addChapter')}</Button>
    <p className="text-xs text-muted-foreground">{t('counts', { c: course.chapters.length, l: lessons })}</p>
  </nav>
}
