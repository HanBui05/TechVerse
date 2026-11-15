import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, ChevronDown, ChevronLeft, Lock, Menu, Moon, PanelLeftClose, PlayCircle, Search, FileText, X, LayoutList } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { courseErrorText, readerCourseText, type ReaderCourseText } from '../../data/courseI18n'
import { ApiError } from '../../services/api/client'
import { lessonAccess, publicCourses } from '../../services/courseService'
import { touch } from './courseParts'
import type { CourseLearning, PublicChapter, Viewer } from '../../types/courses'
import type { Language } from '../../types/preferences'

const TREE_KEY = 'techverse-course-tree'

export type FrameActions = {
  /** Start the course (idempotent), then open `lessonId` or the backend's continue lesson. */
  start: (lessonId?: string) => Promise<void>
  /** Guest: ask to sign in, returning to `returnTo` afterwards. */
  askLogin: (returnTo: string) => void
  starting: boolean
  startError: string
}

type Props = {
  language: Language; authenticated: boolean; courseId: string; title: string; chapters: PublicChapter[]; viewer: Viewer; learning: CourseLearning | null
  /** Lesson on screen; undefined on the overview. */
  currentLessonId?: string
  children: (actions: FrameActions) => ReactNode
}

type TreeProps = { t: ReaderCourseText; courseId: string; chapters: PublicChapter[]; viewer: Viewer; learning: CourseLearning | null; authenticated: boolean; currentLessonId?: string; actions: FrameActions; onNavigate?: () => void; autoFocusSearch?: boolean }

function Curriculum({ t, courseId, chapters, viewer, learning, authenticated, currentLessonId, actions, onNavigate, autoFocusSearch }: TreeProps) {
  const [query, setQuery] = useState('')
  const initial = chapters.find(chapter => chapter.lessons.some(lesson => lesson.id === currentLessonId))?.id ?? chapters[0]?.id
  const [open, setOpen] = useState<Set<string>>(() => new Set(initial ? [initial] : []))
  const done = useMemo(() => new Set(learning?.completedLessonIds), [learning])
  const needle = query.trim().toLowerCase()
  const shown = chapters.map(chapter => ({ chapter, lessons: needle ? chapter.lessons.filter(lesson => lesson.title.toLowerCase().includes(needle)) : chapter.lessons })).filter(entry => !needle || entry.lessons.length)
  const toggle = (id: string) => setOpen(prev => { const next = new Set(prev); if (!next.delete(id)) next.add(id); return next })
  const pick = (lessonId: string, mode: ReturnType<typeof lessonAccess>) => {
    onNavigate?.()
    if (mode === 'login') actions.askLogin(`/courses/${courseId}/lessons/${lessonId}`)
    else if (mode === 'start') void actions.start(lessonId)
  }
  const row = 'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring'
  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <div className="relative">
      <Label htmlFor={`lesson-search-${autoFocusSearch ? 'sheet' : 'tree'}`} className="sr-only">{t('searchLessonsLabel')}</Label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-accent-text" aria-hidden />
      <Input id={`lesson-search-${autoFocusSearch ? 'sheet' : 'tree'}`} type="search" autoFocus={autoFocusSearch} value={query} onChange={e => setQuery(e.target.value)} placeholder={t('searchLessons')}
        className={cn('h-9 rounded-xl bg-muted/50 pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden', touch)} />
      {query && <button type="button" aria-label={t('clearSearch')} onClick={() => setQuery('')} className={cn('absolute top-1/2 right-1 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted', touch)}><X className="size-4" aria-hidden /></button>}
    </div>
    <nav aria-label={t('content')} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      <Link to={`/courses/${courseId}`} onClick={onNavigate} aria-current={currentLessonId ? undefined : 'page'}
        className={cn(row, touch, 'font-semibold hover:bg-muted aria-[current=page]:bg-tone-blue-bg aria-[current=page]:text-accent-text')}><LayoutList className="size-4 shrink-0" aria-hidden />{t('overview')}</Link>
      {needle && !shown.length && <p role="status" className="px-2 py-3 text-sm text-muted-foreground">{t('noLessonMatch')}</p>}
      {shown.map(({ chapter, lessons }) => {
        const expanded = Boolean(needle) || open.has(chapter.id)
        const stat = learning?.chapters.find(item => item.chapterId === chapter.id)
        const panel = `chapter-${chapter.id}`
        return <section key={chapter.id} className="border-t border-border pt-1">
          <button type="button" aria-expanded={expanded} aria-controls={panel} onClick={() => toggle(chapter.id)} className={cn(row, touch, 'items-start font-semibold hover:bg-muted')}>
            <span className="flex min-w-0 flex-1 flex-col"><span>{chapters.indexOf(chapter) + 1}. {chapter.title}</span>
              {stat && <span className="text-xs font-normal text-muted-foreground">{t('chapterProgress', { x: stat.completed, y: stat.total })}</span>}</span>
            <ChevronDown className={cn('mt-0.5 size-4 shrink-0 transition-transform motion-reduce:transition-none', expanded && 'rotate-180')} aria-hidden />
          </button>
          {expanded && <ul id={panel} className="flex flex-col gap-0.5 pb-1">{lessons.map(lesson => {
            const mode = lessonAccess(lesson, viewer, authenticated)
            const current = lesson.id === currentLessonId
            const completed = done.has(lesson.id)
            const icon = completed ? <Check className="size-4 shrink-0 text-success" aria-label={t('done')} /> : mode === 'open' ? <span className="size-4 shrink-0 rounded-full border border-muted-foreground" aria-hidden /> : <Lock className="size-4 shrink-0 text-muted-foreground" aria-label={t('lockedLesson')} />
            const body = <>{icon}<span className="min-w-0 flex-1">{chapter.lessons.indexOf(lesson) + 1}. {lesson.title}</span>
              {lesson.hasVideo && <PlayCircle className="size-4 shrink-0 text-muted-foreground" aria-label={t('hasVideo')} />}
              {lesson.preview && !viewer.enrolled && <Badge tone="sky" className="shrink-0">{t('preview')}</Badge>}</>
            const cls = cn(row, touch, 'pl-4 hover:bg-muted', current && 'bg-tone-blue-bg font-semibold text-accent-text', mode === 'locked' && 'cursor-not-allowed opacity-70')
            return <li key={lesson.id}>{mode === 'open'
              ? <Link to={`/courses/${courseId}/lessons/${lesson.id}`} onClick={onNavigate} aria-current={current ? 'page' : undefined} className={cls}>{body}</Link>
              : <button type="button" aria-disabled={mode === 'locked'} onClick={() => mode !== 'locked' && pick(lesson.id, mode)} className={cls}>{body}</button>}</li>
          })}</ul>}
        </section>
      })}
    </nav>
    {!viewer.enrolled && !viewer.canStart && <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{t('ownerNote')}</p>}
  </div>
}

/**
 * Learning frame (wireframe 2c-2/2c-5): own top bar instead of the app Sidebar, curriculum column on lg+ and a left Sheet below.
 * The start/login rules for clicking a locked lesson live here so overview and lesson page share one behaviour.
 */
export function CourseFrame({ language, authenticated, courseId, title, chapters, viewer, learning, currentLessonId, children }: Props) {
  const t = readerCourseText(language)
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(TREE_KEY) === 'collapsed')
  const [sheet, setSheet] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const [loginFor, setLoginFor] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')

  const actions: FrameActions = {
    starting, startError,
    askLogin: setLoginFor,
    start: async lessonId => {
      if (starting) return
      setStarting(true); setStartError('')
      try {
        const result = await publicCourses.start(courseId)
        const target = lessonId ?? result.continueLesson?.id
        if (target) navigate(`/courses/${courseId}/lessons/${target}`)
      } catch (e) {
        setStartError(e instanceof ApiError && e.code === 'ACCESS_DENIED' ? t('startFailed') : courseErrorText(e, language, t('startFailed')))
      } finally { setStarting(false) }
    },
  }
  const setTree = (value: boolean) => { localStorage.setItem(TREE_KEY, value ? 'collapsed' : 'expanded'); setCollapsed(value) }
  const toggleTree = () => (window.matchMedia('(min-width: 1024px)').matches ? setTree(!collapsed) : setSheet(true))
  const progress = viewer.enrolled ? learning?.progress : null
  const tree = (extra: Partial<TreeProps> = {}) => <Curriculum t={t} courseId={courseId} chapters={chapters} viewer={viewer} learning={learning} authenticated={authenticated} currentLessonId={currentLessonId} actions={actions} {...extra} />

  return <div className="flex min-h-svh flex-col">
    <a href="#lesson-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2">{t('skip')}</a>
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4">
      <Button asChild variant="ghost" size="sm" className={touch}><Link to="/courses"><ChevronLeft aria-hidden /><span className="max-sm:sr-only">{t('back')}</span></Link></Button>
      <Button ref={menuButton} type="button" variant="ghost" size="icon" className={touch} aria-label={t('showTree')} aria-expanded={sheet || !collapsed} onClick={toggleTree}><Menu aria-hidden /></Button>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</p>
      {progress && <Badge tone="green" className="shrink-0 font-semibold"><Check aria-hidden />{t('progress', { x: progress.completed, y: progress.total, p: progress.percent })}</Badge>}
      <Button asChild variant="ghost" size="icon" className={touch}><Link to="/settings/theme" aria-label={language === 'vi' ? 'Cài đặt giao diện' : 'Theme settings'}><Moon aria-hidden /></Link></Button>
    </header>
    <div className="flex min-h-0 flex-1">
      {!collapsed && <aside aria-label={t('content')} className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-80 shrink-0 flex-col gap-3 border-r border-border p-3 lg:flex">
        {tree()}
        <Button type="button" variant="ghost" size="sm" className={cn('self-start', touch)} onClick={() => setTree(true)}><PanelLeftClose aria-hidden />{t('hideTree')}</Button>
      </aside>}
      <div className="min-w-0 flex-1">{children(actions)}</div>
    </div>

    <Sheet open={sheet} onOpenChange={setSheet}>
      <SheetContent side="left" closeLabel={t('closeTree')} className="w-[85%] gap-3 p-3 lg:hidden" onCloseAutoFocus={event => { event.preventDefault(); menuButton.current?.focus() }}>
        <SheetHeader className="p-0"><SheetTitle className="flex items-center gap-2 text-base"><FileText className="size-4" aria-hidden />{t('treeSheet')}</SheetTitle>
          <SheetDescription>{progress ? t('progress', { x: progress.completed, y: progress.total, p: progress.percent }) : title}</SheetDescription></SheetHeader>
        {tree({ onNavigate: () => setSheet(false), autoFocusSearch: true })}
      </SheetContent>
    </Sheet>

    <Dialog open={loginFor !== null} onOpenChange={open => { if (!open) setLoginFor(null) }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('loginTitle')}</DialogTitle><DialogDescription>{t('loginText')}</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" className={touch} onClick={() => setLoginFor(null)}>{t('cancel')}</Button>
          <Button type="button" className={touch} onClick={() => navigate('/login', { state: { returnTo: loginFor } })}>{t('login')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
