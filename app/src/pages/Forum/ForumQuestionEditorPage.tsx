import { useCallback, useContext, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, UNSAFE_DataRouterContext, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, PencilLine, RefreshCw, Send } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownContent } from '../../components/MarkdownContent'
import { fieldLabel } from '../Author/AuthorBlogsPage'
import { forumErrorText, forumText } from '../../data/forumI18n'
import { ApiError } from '../../services/api/client'
import { forumService, validateQuestionForm } from '../../services/forumService'
import type { ArticleOption } from '../../types/articles'
import type { ForumQuestionDetail, ForumQuestionForm } from '../../types/forum'
import type { Language } from '../../types/preferences'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const EMPTY_FORM: ForumQuestionForm = { title: '', topicId: '', content: '' }
const sigOf = (f: ForumQuestionForm) =>
  JSON.stringify({ title: f.title.trim(), topicId: f.topicId.trim(), content: f.content.trim() })

function LeaveGuard({ dirty, language }: { dirty: () => boolean; language: Language }) {
  const t = forumText(language)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty() && currentLocation.pathname !== nextLocation.pathname,
  )
  return (
    <AlertDialog open={blocker.state === 'blocked'}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('unsavedChanges')}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={touch} onClick={() => blocker.reset?.()}>{t('stay')}</AlertDialogCancel>
          <AlertDialogAction className={touch} onClick={() => blocker.proceed?.()}>{t('leave')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function ForumQuestionEditorPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = forumText(language)
  const { id } = useParams()
  const navigate = useNavigate()
  const dataRouter = useContext(UNSAFE_DataRouterContext)

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'notFound' | 'forbidden' | 'error'>(id ? 'loading' : 'ready')
  const [question, setQuestion] = useState<ForumQuestionDetail | null>(null)
  const [form, setForm] = useState<ForumQuestionForm>(EMPTY_FORM)
  const [topics, setTopics] = useState<ArticleOption[]>([])
  const [topicsLoaded, setTopicsLoaded] = useState(false)
  const [topicsError, setTopicsError] = useState('')
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [contentServerError, setContentServerError] = useState('')

  const savedSig = useRef(sigOf(EMPTY_FORM))
  const currentSig = useRef(savedSig.current)
  const allowLeave = useRef(false)

  currentSig.current = sigOf(form)
  const dirtyNow = useCallback(() => !allowLeave.current && currentSig.current !== savedSig.current, [])

  const loadQuestion = useCallback(async (questionId: string) => {
    setLoadState('loading')
    setError('')
    try {
      const detail = await forumService.questionDetail(questionId)
      if (detail.deleted) {
        setLoadState('notFound')
        return
      }
      if (!detail.viewer.canEdit) {
        setLoadState('forbidden')
        return
      }
      const nextForm: ForumQuestionForm = {
        title: detail.title ?? '',
        topicId: detail.topic.id,
        content: detail.content ?? '',
      }
      savedSig.current = currentSig.current = sigOf(nextForm)
      setQuestion(detail)
      setForm(nextForm)
      setLoadState('ready')
    } catch (e) {
      setLoadState(e instanceof ApiError && e.status === 404 ? 'notFound' : 'error')
      setError(forumErrorText(e, language, 'general', t('loadError')))
    }
  }, [language]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (id) void loadQuestion(id)
  }, [id, loadQuestion])

  const loadTopics = useCallback(() => {
    setTopicsError('')
    forumService.options().then(
      list => {
        setTopics(list)
        setTopicsLoaded(true)
      },
      e => {
        setTopicsLoaded(false)
        setTopicsError(forumErrorText(e, language, 'general', t('loadError')))
      },
    )
  }, [language]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadTopics()
  }, [loadTopics])

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

  const problems = tried ? validateQuestionForm(form) : {}
  const contentProblemText = contentServerError || (problems.content ? t(problems.content) : '')
  // An edit keeps its current topic, so a failed topic list only blocks creating.
  const canSubmit = !busy && (Boolean(question) || (topicsLoaded && !topicsError))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    setContentServerError('')
    const errs = validateQuestionForm(form)
    if (Object.keys(errs).length > 0 || !canSubmit) return
    setBusy(true)
    setError('')
    try {
      const saved = id
        ? await forumService.updateQuestion(id, form)
        : await forumService.createQuestion(form)
      allowLeave.current = true
      savedSig.current = currentSig.current
      navigate(`/forum/${saved.id}`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'FORUM_CONTENT_INVALID') {
        setContentServerError(forumErrorText(err, language, 'general', t('loadError')))
      } else {
        setError(forumErrorText(err, language, 'general', t('loadError')))
      }
    } finally {
      setBusy(false)
    }
  }

  if (loadState === 'loading') {
    return (
      <main aria-busy="true" aria-label={t('loading')} className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </main>
    )
  }

  if (loadState === 'forbidden') {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center">
        <p role="alert" className="text-base font-semibold">{t('forbidden')}</p>
        <Button asChild variant="outline" className={touch}>
          <Link to={id ? `/forum/${id}` : '/forum'}>{t('backToQuestion')}</Link>
        </Button>
      </main>
    )
  }

  if (loadState !== 'ready') {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center">
        <p role="alert" className="text-base font-semibold">{loadState === 'notFound' ? t('notFound') : error}</p>
        {loadState === 'error' && id ? (
          <Button className={touch} onClick={() => void loadQuestion(id)}>
            <RefreshCw aria-hidden />
            {t('retry')}
          </Button>
        ) : (
          <Button asChild variant="outline" className={touch}>
            <Link to="/forum">{t('backToList')}</Link>
          </Button>
        )}
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      {dataRouter && <LeaveGuard dirty={dirtyNow} language={language} />}

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className={touch}>
            <Link to={id ? `/forum/${id}` : '/forum'}>
              <ArrowLeft aria-hidden />
              {t('heading')}
            </Link>
          </Button>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {id ? t('editQuestion') : t('askQuestion')}
          </h1>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <form onSubmit={e => void submit(e)} noValidate>
        <fieldset disabled={busy} className="flex flex-col gap-5">
          <Card className="gap-5 rounded-xl p-6">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="forum-title" className={fieldLabel}>{t('titleField')} *</Label>
                <span className="text-xs tabular-nums text-muted-foreground">{form.title.trim().length}/150</span>
              </div>
              <Input
                id="forum-title"
                value={form.title}
                placeholder={t('titlePlaceholder')}
                aria-invalid={Boolean(problems.title)}
                aria-describedby="forum-title-error"
                className={touch}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
              {problems.title && (
                <p id="forum-title-error" role="alert" className="text-xs text-danger">
                  {t(problems.title)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="forum-topic-select" className={fieldLabel}>{t('topic')} *</Label>
              <NativeSelect
                id="forum-topic-select"
                value={form.topicId}
                aria-invalid={Boolean(problems.topicId)}
                aria-describedby="forum-topic-error"
                className={`w-full ${touch}`}
                onChange={e => setForm({ ...form, topicId: e.target.value })}
              >
                <NativeSelectOption value="">{t('chooseTopic')}</NativeSelectOption>
                {topics.map(o => (
                  <NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>
                ))}
                {question && !topics.some(o => o.id === question.topic.id) && (
                  <NativeSelectOption value={question.topic.id}>{question.topic.name}</NativeSelectOption>
                )}
              </NativeSelect>
              {problems.topicId && (
                <p id="forum-topic-error" role="alert" className="text-xs text-danger">
                  {t(problems.topicId)}
                </p>
              )}
              {topicsError && (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-tone-rose-bg px-3 py-2 text-xs text-danger">
                  <span>{topicsError}</span>
                  <Button type="button" size="sm" variant="outline" className={touch} onClick={loadTopics}>
                    <RefreshCw aria-hidden />
                    {t('retry')}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="forum-content" className={fieldLabel}>{t('contentField')} *</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">{form.content.trim().length}/10.000</span>
                  <div className="inline-flex rounded-lg border border-border p-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={tab === 'write' ? 'default' : 'ghost'}
                      aria-pressed={tab === 'write'}
                      className={`h-7 px-2.5 text-xs ${touch}`}
                      onClick={() => setTab('write')}
                    >
                      <PencilLine aria-hidden className="size-3.5" />
                      {t('writeTab')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={tab === 'preview' ? 'default' : 'ghost'}
                      aria-pressed={tab === 'preview'}
                      className={`h-7 px-2.5 text-xs ${touch}`}
                      onClick={() => setTab('preview')}
                    >
                      <Eye aria-hidden className="size-3.5" />
                      {t('previewTab')}
                    </Button>
                  </div>
                </div>
              </div>

              {tab === 'write' ? (
                <Textarea
                  id="forum-content"
                  rows={10}
                  value={form.content}
                  placeholder={t('contentPlaceholder')}
                  aria-invalid={Boolean(contentProblemText)}
                  aria-describedby="forum-content-error"
                  onChange={e => {
                    setForm({ ...form, content: e.target.value })
                    if (contentServerError) setContentServerError('')
                  }}
                />
              ) : (
                <div
                  role="region"
                  aria-label={t('previewTab')}
                  className="min-h-52 rounded-lg border border-border bg-muted/20 p-4"
                >
                  {form.content.trim() ? (
                    <MarkdownContent content={form.content} language={language} imageAllowed={() => false} />
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('previewEmpty')}</p>
                  )}
                </div>
              )}

              {contentProblemText && (
                <p id="forum-content-error" role="alert" className="text-xs text-danger">
                  {contentProblemText}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
              <Button asChild type="button" variant="outline" className={touch}>
                <Link to={id ? `/forum/${id}` : '/forum'}>{t('cancel')}</Link>
              </Button>
              <Button type="submit" className={touch} disabled={!canSubmit}>
                <Send aria-hidden />
                {busy ? t('saving') : id ? t('save') : t('postQuestion')}
              </Button>
            </div>
          </Card>
        </fieldset>
      </form>
    </main>
  )
}
