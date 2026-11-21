import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link, UNSAFE_DataRouterContext, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Eye, Info, RefreshCw, Save, Send, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { MarkdownContent } from '../../../components/MarkdownContent'
import { fieldLabel } from '../AuthorBlogsPage'
import { interviewLevelTone, interviewStatusTone } from './AuthorInterviewQuestionsPage'
import { interviewErrorText, interviewLevelLabel, interviewStatusLabel, interviewText, isInterviewConflict } from '../../../data/interviewI18n'
import { authorInterviews, interviewActions, interviewFormErrors } from '../../../services/interviewService'
import type { ArticleOption } from '../../../types/articles'
import type { InterviewForm, InterviewLevel, InterviewQuestion } from '../../../types/interview'
import type { Language } from '../../../types/preferences'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const LEVELS: InterviewLevel[] = ['EASY', 'MEDIUM', 'HARD']
const EMPTY_FORM: InterviewForm = { topicId: '', level: 'MEDIUM', question: '', sampleAnswer: '', hint: '' }
type LoadState = 'loading' | 'ready' | 'notFound' | 'error'

const formOf = (q: InterviewQuestion): InterviewForm => ({
  topicId: q.topic.id,
  level: q.level,
  question: q.question,
  sampleAnswer: q.sampleAnswer,
  hint: q.hint ?? '',
})

const sigOf = (f: InterviewForm) => JSON.stringify({
  topicId: f.topicId.trim(),
  level: f.level,
  question: f.question.trim(),
  sampleAnswer: f.sampleAnswer.trim(),
  hint: f.hint.trim(),
})

function LeaveGuard({ dirty, language }: { dirty: () => boolean; language: Language }) {
  const t = interviewText(language)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty() && currentLocation.pathname !== nextLocation.pathname)
  return (
    <AlertDialog open={blocker.state === 'blocked'}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('leave')}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={touch} onClick={() => blocker.reset?.()}>{t('stay')}</AlertDialogCancel>
          <AlertDialogAction className={touch} onClick={() => blocker.proceed?.()}>{t('leaveNow')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const Problem = ({ id, text }: { id: string; text?: string }) => (text ? <p id={id} role="alert" className="text-xs text-danger">{text}</p> : null)

export function InterviewQuestionEditorPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = interviewText(language)
  const { id } = useParams()
  const navigate = useNavigate()
  const dataRouter = useContext(UNSAFE_DataRouterContext)

  const [load, setLoad] = useState<LoadState>(id ? 'loading' : 'ready')
  const [item, setItem] = useState<InterviewQuestion | null>(null)
  const [form, setForm] = useState<InterviewForm>(EMPTY_FORM)
  const [topics, setTopics] = useState<ArticleOption[]>([])
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState<'submit' | 'withdraw' | null>(null)
  const [conflict, setConflict] = useState(false)

  const savedSig = useRef(sigOf(EMPTY_FORM))
  const currentSig = useRef(savedSig.current)
  const version = useRef(0)
  const loadedId = useRef<string | null>(null)
  const inflight = useRef(false)

  currentSig.current = sigOf(form)
  const differs = () => currentSig.current !== savedSig.current
  const dirty = differs()
  const dirtyNow = useCallback(differs, [])

  const apply = useCallback((next: InterviewQuestion) => {
    const nextForm = formOf(next)
    savedSig.current = currentSig.current = sigOf(nextForm)
    version.current = next.version
    loadedId.current = next.id
    setItem(next)
    setForm(nextForm)
  }, [])

  const fetchDetail = useCallback(async (questionId: string) => {
    setLoad('loading')
    setError('')
    try {
      apply(await authorInterviews.detail(questionId))
      setLoad('ready')
    } catch (e) {
      setLoad((e as { status?: number }).status === 404 ? 'notFound' : 'error')
      setError(interviewErrorText(e, language, t('loadError')))
    }
  }, [apply, language]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (id && loadedId.current !== id) void fetchDetail(id)
  }, [id, fetchDetail])

  useEffect(() => {
    authorInterviews.options().then(setTopics, () => {})
  }, [])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyNow()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirtyNow])

  const matrix = item ? interviewActions(item) : null
  const readOnly = Boolean(matrix?.readOnly)
  const problems = tried ? interviewFormErrors(form) : {}

  const write = async (action: () => Promise<unknown>): Promise<boolean> => {
    if (inflight.current) return false
    inflight.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      return true
    } catch (e) {
      if (isInterviewConflict(e)) setConflict(true)
      else setError(interviewErrorText(e, language, t('loadError')))
      return false
    } finally {
      inflight.current = false
      setBusy(false)
    }
  }

  const save = async (): Promise<boolean> => {
    setTried(true)
    const errs = interviewFormErrors(form)
    if (Object.keys(errs).length > 0) return false
    if (!item) {
      return write(async () => {
        const created = await authorInterviews.create(form)
        apply(created)
        setMessage(t('created'))
        navigate(`/author/interview-questions/${created.id}/edit`, { replace: true })
      })
    }
    if (!dirty) return true
    return write(async () => {
      const updated = await authorInterviews.update(item.id, version.current, form)
      apply(updated)
      setMessage(t('saved'))
    })
  }

  const requestSubmit = async () => {
    setTried(true)
    if (Object.keys(interviewFormErrors(form)).length > 0) return
    if (!item || dirty) {
      if (!(await save())) return
    }
    setConfirm('submit')
  }

  const confirmed = async () => {
    const action = confirm
    setConfirm(null)
    const targetId = item?.id ?? loadedId.current
    if (!targetId || !action) return
    await write(async () => {
      const next = await (action === 'submit' ? authorInterviews.submit(targetId) : authorInterviews.withdraw(targetId))
      apply(next)
      setMessage(t(action === 'submit' ? 'submitted' : 'withdrawn'))
    })
  }

  if (load === 'loading') {
    return (
      <main aria-busy="true" aria-label={t('loading')} className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full" />
      </main>
    )
  }

  if (load !== 'ready') {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
        <p role="alert" className="text-base font-semibold">{load === 'notFound' ? t('notFound') : error}</p>
        {load === 'error' ? (
          <Button className={touch} onClick={() => id && void fetchDetail(id)}><RefreshCw aria-hidden />{t('retry')}</Button>
        ) : (
          <Button asChild className={touch}><Link to="/author/interview-questions">{t('toList')}</Link></Button>
        )}
      </main>
    )
  }

  const hasPreview = Boolean(form.question.trim() || form.sampleAnswer.trim() || form.hint.trim())

  return (
    <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      {dataRouter && <LeaveGuard dirty={dirtyNow} language={language} />}

      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 py-3 backdrop-blur">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm" className={touch}>
            <Link to="/author/interview-questions">
              <ArrowLeft aria-hidden />
              {t('back')}
            </Link>
          </Button>
          <h1 className="min-w-0 line-clamp-1 text-xl font-bold [overflow-wrap:anywhere]">
            {item ? item.question : t('newQuestion')}
          </h1>
          {item && <Badge tone={interviewStatusTone(item.status)}>{interviewStatusLabel[item.status][language]}</Badge>}
          {item && <Badge tone={interviewLevelTone(item.level)}>{interviewLevelLabel[item.level][language]}</Badge>}
          {item?.aiAssisted && <Badge tone="purple"><Sparkles aria-hidden />{t('aiUsed')}</Badge>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {readOnly && matrix && matrix.actions.map(action =>
            action === 'delete' ? null : (
              <Button
                key={action}
                variant="outline"
                className={touch}
                disabled={busy}
                onClick={() =>
                  action === 'withdraw'
                    ? setConfirm('withdraw')
                    : void write(async () => {
                        if (action === 'copy') {
                          const copy = await authorInterviews.copy(item!.id)
                          apply(copy)
                          navigate(`/author/interview-questions/${copy.id}/edit`)
                        } else {
                          const next = await authorInterviews.visibility(item!.id, action === 'hide' ? 'HIDE' : 'UNHIDE')
                          apply(next)
                          setMessage(t(action === 'hide' ? 'hiddenMsg' : 'unhiddenMsg'))
                        }
                      })
                }
              >
                {t(action)}
              </Button>
            ),
          )}

          {!readOnly && (
            <Button className={touch} disabled={busy} onClick={() => void save()}>
              <Save aria-hidden />
              {busy ? t('saving') : item ? t('save') : t('create')}
              {dirty && item && <span aria-label={t('unsaved')}>•</span>}
            </Button>
          )}
          {!readOnly && (
            <Button variant="outline" className={touch} disabled={busy} onClick={() => void requestSubmit()}>
              <Send aria-hidden />
              {t('submit')}
            </Button>
          )}
        </div>
      </header>

      {item?.status === 'CHANGES_REQUESTED' && item.moderationNote && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-border bg-tone-amber-bg px-4 py-3 text-sm text-tone-amber-fg">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{t('changesRequested')}: “{item.moderationNote}”</span>
        </p>
      )}
      {readOnly && (
        <div role="status" className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          <p className="flex items-start gap-2">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{item?.status === 'PENDING' ? t('readOnlyPending') : t('readOnly')}</span>
          </p>
          {item?.moderationNote && (item.status === 'HIDDEN' || item.status === 'REMOVED') && (
            <p className="flex items-start gap-2 text-xs text-tone-amber-fg">
              <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span>{t('moderatorNote')}: “{item.moderationNote}”</span>
            </p>
          )}
        </div>
      )}
      {error && <p role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">{message}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
          <Card className="gap-4 rounded-xl p-6">
            <h2 className="text-base font-bold">{t('editorPane')}</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="iq-form-topic" className={fieldLabel}>{t('topic')} *</Label>
                <NativeSelect
                  id="iq-form-topic"
                  className={touch}
                  disabled={readOnly}
                  value={form.topicId}
                  aria-invalid={Boolean(problems.topicId)}
                  aria-describedby="iq-form-topic-error"
                  onChange={e => setForm({ ...form, topicId: e.target.value })}
                >
                  <NativeSelectOption value="">{t('chooseTopic')}</NativeSelectOption>
                  {topics.map(o => <NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}
                  {item && !topics.some(o => o.id === item.topic.id) && (
                    <NativeSelectOption value={item.topic.id}>{item.topic.name}</NativeSelectOption>
                  )}
                </NativeSelect>
                <Problem id="iq-form-topic-error" text={problems.topicId && t(problems.topicId)} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="iq-form-level" className={fieldLabel}>{t('level')} *</Label>
                <NativeSelect
                  id="iq-form-level"
                  className={touch}
                  disabled={readOnly}
                  value={form.level}
                  aria-invalid={Boolean(problems.level)}
                  aria-describedby="iq-form-level-error"
                  onChange={e => setForm({ ...form, level: e.target.value as InterviewLevel })}
                >
                  {LEVELS.map(l => <NativeSelectOption key={l} value={l}>{interviewLevelLabel[l][language]}</NativeSelectOption>)}
                </NativeSelect>
                <Problem id="iq-form-level-error" text={problems.level && t(problems.level)} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="iq-form-question" className={fieldLabel}>{t('questionField')} *</Label>
                <span className="text-xs tabular-nums text-muted-foreground">{form.question.trim().length}/1.000</span>
              </div>
              <Textarea
                id="iq-form-question"
                rows={4}
                disabled={readOnly}
                placeholder={t('questionPlaceholder')}
                value={form.question}
                aria-invalid={Boolean(problems.question)}
                aria-describedby="iq-form-question-error"
                onChange={e => setForm({ ...form, question: e.target.value })}
              />
              <Problem id="iq-form-question-error" text={problems.question && t(problems.question)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="iq-form-answer" className={fieldLabel}>{t('sampleAnswerField')} *</Label>
                <span className="text-xs tabular-nums text-muted-foreground">{form.sampleAnswer.trim().length}/5.000</span>
              </div>
              <Textarea
                id="iq-form-answer"
                rows={8}
                disabled={readOnly}
                placeholder={t('sampleAnswerPlaceholder')}
                value={form.sampleAnswer}
                aria-invalid={Boolean(problems.sampleAnswer)}
                aria-describedby="iq-form-answer-error"
                onChange={e => setForm({ ...form, sampleAnswer: e.target.value })}
              />
              <Problem id="iq-form-answer-error" text={problems.sampleAnswer && t(problems.sampleAnswer)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="iq-form-hint" className={fieldLabel}>{t('hintField')}</Label>
                <span className="text-xs tabular-nums text-muted-foreground">{form.hint.trim().length}/500</span>
              </div>
              <Textarea
                id="iq-form-hint"
                rows={3}
                disabled={readOnly}
                placeholder={t('hintPlaceholder')}
                value={form.hint}
                aria-invalid={Boolean(problems.hint)}
                aria-describedby="iq-form-hint-error"
                onChange={e => setForm({ ...form, hint: e.target.value })}
              />
              <Problem id="iq-form-hint-error" text={problems.hint && t(problems.hint)} />
            </div>
          </Card>
        </fieldset>

        <section aria-label={t('previewPane')} className="flex min-w-0 flex-col gap-6">
          <Card className="gap-4 rounded-xl p-6">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Eye aria-hidden className="size-4 text-muted-foreground" />
              <h2 className="text-base font-bold">{t('previewPane')}</h2>
            </div>

            {!hasPreview ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('previewEmpty')}</p>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <span className={fieldLabel}>{t('questionField')}</span>
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <MarkdownContent content={form.question || '—'} language={language} />
                  </div>
                </div>

                {form.hint.trim() && (
                  <div className="flex flex-col gap-2">
                    <span className={fieldLabel}>{t('hintField')}</span>
                    <div className="rounded-lg border border-border bg-muted/20 p-4">
                      <MarkdownContent content={form.hint} language={language} />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <span className={fieldLabel}>{t('sampleAnswerField')}</span>
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <MarkdownContent content={form.sampleAnswer || '—'} language={language} />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </section>
      </div>

      <AlertDialog open={confirm !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(confirm === 'withdraw' ? 'withdrawTitle' : 'submitTitle')}</AlertDialogTitle>
            {confirm === 'submit' && <AlertDialogDescription>{t('submitText')}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={touch} onClick={() => setConfirm(null)}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction className={touch} onClick={() => void confirmed()}>
              {t(confirm === 'withdraw' ? 'withdraw' : 'submit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={conflict}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('conflictTitle')}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className={touch}
              onClick={() => {
                setConflict(false)
                if (id) void fetchDetail(id)
              }}
            >
              {t('reload')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
