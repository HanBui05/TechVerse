import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Bookmark, CheckCircle2, Eye, EyeOff, Lightbulb, Lock, RefreshCw, Sparkles } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownContent } from '../../components/MarkdownContent'
import { interviewLevelTone } from '../Author/InterviewQuestions/AuthorInterviewQuestionsPage'
import { fieldLabel } from '../Author/AuthorBlogsPage'
import {
  interviewLevelLabel,
  interviewVerdictLabel,
  learnerInterviewErrorKind,
  learnerInterviewErrorText,
  learnerInterviewText,
} from '../../data/interviewI18n'
import { publicInterviews, validateFeedbackAnswer } from '../../services/interviewService'
import type { AiQuota } from '../../types/aiAssist'
import type { InterviewAnswerResponse, InterviewFeedback, InterviewVerdict, PublishedInterviewQuestion } from '../../types/interview'
import type { Language } from '../../types/preferences'

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'

const VERDICT_TONE: Record<InterviewVerdict, BadgeTone> = {
  GOOD: 'green',
  PARTIAL: 'amber',
  OFF_TRACK: 'rose',
}

const quotaOfError = (e: unknown) => (e as { quota?: AiQuota | null })?.quota ?? null

export function InterviewDetailPage({ language = 'vi', authenticated = false }: { language?: Language; authenticated?: boolean }) {
  const { id = '' } = useParams()
  const t = learnerInterviewText(language)
  const navigate = useNavigate()

  const [item, setItem] = useState<PublishedInterviewQuestion | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'error'>('loading')
  const [error, setError] = useState('')
  const [run, setRun] = useState(0)

  // Viewer mark state (optimistic with rollback)
  const [reviewed, setReviewed] = useState(false)
  const [saved, setSaved] = useState(false)
  const [markError, setMarkError] = useState('')
  const reviewedConfirmed = useRef(false)
  const savedConfirmed = useRef(false)

  // Lazy /answer state (fetched once on first click of either Show hint or Show sample answer)
  const [answerData, setAnswerData] = useState<InterviewAnswerResponse | null>(null)
  const [answerLoading, setAnswerLoading] = useState(false)
  const [answerError, setAnswerError] = useState('')
  const [hintOpen, setHintOpen] = useState(false)
  const [sampleOpen, setSampleOpen] = useState(false)
  const pendingReveal = useRef<'hint' | 'sample'>('sample')

  // Practice & AI feedback state
  const [userAnswer, setUserAnswer] = useState('')
  const [answerValidationError, setAnswerValidationError] = useState('')
  const [quota, setQuota] = useState<AiQuota | null>(null)
  const [feedbackBusy, setFeedbackBusy] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')
  const [feedbackRetryable, setFeedbackRetryable] = useState(false)
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null)

  useEffect(() => {
    let live = true
    setState('loading')
    setError('')
    setAnswerData(null)
    setAnswerError('')
    setHintOpen(false)
    setSampleOpen(false)
    setFeedback(null)
    setFeedbackError('')
    publicInterviews
      .detail(id)
      .then(result => {
        if (!live) return
        setItem(result)
        const initReviewed = result.viewer?.reviewed ?? false
        const initSaved = result.viewer?.saved ?? false
        setReviewed(initReviewed)
        setSaved(initSaved)
        reviewedConfirmed.current = initReviewed
        savedConfirmed.current = initSaved
        setState('ready')
      })
      .catch(e => {
        if (!live) return
        setState(learnerInterviewErrorKind(e) === 'gone' ? 'gone' : 'error')
        setError(learnerInterviewErrorText(e, language, t('loadError')))
      })
    return () => {
      live = false
    }
  }, [id, run, language, authenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authenticated) return
    let live = true
    publicInterviews
      .feedbackQuota()
      .then(q => {
        if (live) setQuota(q)
      })
      .catch(() => {
        // Temporary 503 on quota fetch: hide remaining count and leave button enabled
        if (live) setQuota(null)
      })
    return () => {
      live = false
    }
  }, [authenticated, id])

  const fetchAnswerIfNeeded = async (target: 'hint' | 'sample') => {
    pendingReveal.current = target
    if (answerData) {
      if (target === 'hint') setHintOpen(v => !v)
      else setSampleOpen(v => !v)
      return
    }
    if (answerLoading || !item) return
    setAnswerLoading(true)
    setAnswerError('')
    try {
      const loaded = await publicInterviews.answer(item.id)
      setAnswerData(loaded)
      if (target === 'hint') setHintOpen(true)
      else setSampleOpen(true)
    } catch (e) {
      if (learnerInterviewErrorKind(e) === 'login') {
        navigate('/login', { state: { returnTo: `/interview/${item.id}` } })
        return
      }
      if (learnerInterviewErrorKind(e) === 'gone') {
        setState('gone')
        return
      }
      setAnswerError(learnerInterviewErrorText(e, language, t('loadError')))
    } finally {
      setAnswerLoading(false)
    }
  }

  const toggleReviewed = async () => {
    if (!item) return
    const next = !reviewed
    setReviewed(next)
    setMarkError('')
    try {
      const res = await publicInterviews.mark(item.id, { reviewed: next })
      reviewedConfirmed.current = res.reviewed
      setReviewed(res.reviewed)
    } catch (e) {
      setReviewed(reviewedConfirmed.current)
      setMarkError(learnerInterviewErrorText(e, language, t('loadError')))
    }
  }

  const toggleSaved = async () => {
    if (!item) return
    const next = !saved
    setSaved(next)
    setMarkError('')
    try {
      const res = await publicInterviews.mark(item.id, { saved: next })
      savedConfirmed.current = res.saved
      setSaved(res.saved)
    } catch (e) {
      setSaved(savedConfirmed.current)
      setMarkError(learnerInterviewErrorText(e, language, t('loadError')))
    }
  }

  const quotaOut = quota !== null && quota.remaining <= 0

  const submitFeedback = async () => {
    if (!item || feedbackBusy || quotaOut) return
    const errKey = validateFeedbackAnswer(userAnswer)
    if (errKey) {
      setAnswerValidationError(t(errKey))
      return
    }
    setAnswerValidationError('')
    setFeedbackBusy(true)
    setFeedbackError('')
    setFeedbackRetryable(false)
    try {
      const { feedback: res, quota: nextQuota } = await publicInterviews.feedback(item.id, userAnswer)
      if (nextQuota) setQuota(nextQuota)
      setFeedback(res)
    } catch (e) {
      const errQuota = quotaOfError(e)
      if (errQuota) setQuota(errQuota)
      const kind = learnerInterviewErrorKind(e)
      if (kind === 'login') {
        navigate('/login', { state: { returnTo: `/interview/${item.id}` } })
        return
      }
      if (kind === 'gone') {
        setState('gone')
        return
      }
      if (kind === 'quota') {
        setQuota(old => ({ limit: old?.limit ?? null, remaining: 0 }))
      }
      setFeedbackError(learnerInterviewErrorText(e, language, t('loadError')))
      setFeedbackRetryable(kind === 'retry' || kind === 'busy')
    } finally {
      setFeedbackBusy(false)
    }
  }

  const frame = (body: ReactNode) => (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 pb-20 sm:px-6 lg:px-8">{body}</main>
  )

  if (state === 'loading') {
    return frame(
      <div role="status" aria-label={t('loading')} className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>,
    )
  }

  if (state === 'gone') {
    return frame(
      <div role="status" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <p className="text-base font-bold">{t('gone')}</p>
        <Button asChild variant="outline" className={touch}>
          <Link to="/interview">{t('toList')}</Link>
        </Button>
      </div>,
    )
  }

  if (state === 'error' || !item) {
    return frame(
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
        <span>{error}</span>
        <Button type="button" variant="outline" size="sm" className={touch} onClick={() => setRun(r => r + 1)}>
          <RefreshCw aria-hidden />
          {t('retry')}
        </Button>
      </div>,
    )
  }

  return frame(
    <>
      <Link
        to="/interview"
        className="inline-flex items-center gap-1 self-start pointer-coarse:min-h-11 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        ‹ {t('back')}
      </Link>

      <Card className="gap-5 rounded-xl p-6 sm:p-8">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={interviewLevelTone(item.level)}>{interviewLevelLabel[item.level][language]}</Badge>
            <Badge tone="slate">{item.topic.name}</Badge>
            {authenticated && reviewed && (
              <Badge tone="green">
                <CheckCircle2 aria-hidden className="size-3.5" />
                {t('reviewed')}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">· {t('by', { name: item.author.fullName })}</span>
          </div>
          <h1 className="sr-only">{t('heading')}</h1>
        </header>

        <div className="text-base leading-relaxed [overflow-wrap:anywhere]">
          <MarkdownContent content={item.question} language={language} />
        </div>

        {!authenticated ? (
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock aria-hidden className="size-4 shrink-0 text-foreground" />
              <span>{t('guestPrompt')}</span>
            </p>
            <Button
              type="button"
              className={touch}
              onClick={() => navigate('/login', { state: { returnTo: `/interview/${item.id}` } })}
            >
              {t('signIn')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-2">
              {item.hasHint && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={touch}
                  disabled={answerLoading}
                  aria-expanded={hintOpen}
                  onClick={() => void fetchAnswerIfNeeded('hint')}
                >
                  <Lightbulb aria-hidden />
                  {hintOpen ? t('hideHint') : t('showHint')}
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className={touch}
                disabled={answerLoading}
                aria-expanded={sampleOpen}
                onClick={() => void fetchAnswerIfNeeded('sample')}
              >
                {sampleOpen ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                {sampleOpen ? t('hideSampleAnswer') : t('showSampleAnswer')}
              </Button>

              <Button
                type="button"
                variant={reviewed ? 'default' : 'outline'}
                size="sm"
                className={touch}
                aria-pressed={reviewed}
                onClick={() => void toggleReviewed()}
              >
                <CheckCircle2 aria-hidden />
                {reviewed ? t('reviewed') : t('markReviewed')}
              </Button>

              <Button
                type="button"
                variant={saved ? 'default' : 'outline'}
                size="sm"
                className={touch}
                aria-pressed={saved}
                onClick={() => void toggleSaved()}
              >
                <Bookmark aria-hidden className={saved ? 'fill-current' : undefined} />
                {saved ? t('saved') : t('save')}
              </Button>
            </div>

            {markError && (
              <p role="alert" className="text-xs text-danger">{markError}</p>
            )}

            {answerError && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
                <span>{answerError}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={touch}
                  onClick={() => void fetchAnswerIfNeeded(pendingReveal.current)}
                >
                  <RefreshCw aria-hidden />
                  {t('retry')}
                </Button>
              </div>
            )}

            {hintOpen && answerData?.hint && (
              <section aria-label={t('hintHeading')} className="flex flex-col gap-2 rounded-xl border border-tone-amber-border/60 bg-tone-amber-bg/30 p-4">
                <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-tone-amber-fg">
                  <Lightbulb aria-hidden className="size-3.5" />
                  {t('hintHeading')}
                </h2>
                <MarkdownContent content={answerData.hint} language={language} />
              </section>
            )}

            {sampleOpen && answerData && (
              <section aria-label={t('sampleAnswerHeading')} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('sampleAnswerHeading')}
                </h2>
                <MarkdownContent content={answerData.sampleAnswer} language={language} />
              </section>
            )}
          </div>
        )}
      </Card>

      {authenticated && (
        <Card className="gap-5 rounded-xl border-primary/30 p-6 sm:p-8">
          <div className="flex flex-col gap-1.5">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Sparkles aria-hidden className="size-5 text-primary" />
              {t('practiceHeading')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('practiceHelper')}</p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="iv-practice-answer" className={fieldLabel}>{t('answerLabel')}</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{userAnswer.trim().length}/4.000</span>
            </div>
            <Textarea
              id="iv-practice-answer"
              rows={6}
              disabled={feedbackBusy}
              placeholder={t('answerPlaceholder')}
              value={userAnswer}
              aria-invalid={Boolean(answerValidationError)}
              onChange={e => {
                setUserAnswer(e.target.value)
                if (answerValidationError) setAnswerValidationError('')
              }}
            />
            {answerValidationError && (
              <p role="alert" className="text-xs text-danger">{answerValidationError}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {quota !== null && (
                <p className="text-xs text-muted-foreground">
                  {quotaOut ? t('quotaOut') : t('quotaLeft', { remaining: quota.remaining, limit: quota.limit ?? '—' })}
                </p>
              )}
            </div>

            <Button
              type="button"
              className={touch}
              disabled={feedbackBusy || quotaOut}
              onClick={() => void submitFeedback()}
            >
              <Sparkles aria-hidden className={feedbackBusy ? 'motion-safe:animate-pulse' : undefined} />
              {feedbackBusy ? t('reviewing') : t('getFeedback')}
            </Button>
          </div>

          {feedbackError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
              <span>{feedbackError}</span>
              {feedbackRetryable && (
                <Button type="button" size="sm" variant="outline" className={touch} onClick={() => void submitFeedback()}>
                  <RefreshCw aria-hidden />
                  {t('retry')}
                </Button>
              )}
            </div>
          )}

          {feedback && (
            <section aria-label={interviewVerdictLabel[feedback.verdict][language]} className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-5">
              <div className="flex items-center gap-2">
                <Badge tone={VERDICT_TONE[feedback.verdict]} className="text-xs font-semibold">
                  {interviewVerdictLabel[feedback.verdict][language]}
                </Badge>
              </div>

              {feedback.strengths.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-bold text-tone-green-fg">{t('strengths')}</h3>
                  <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm">
                    {feedback.strengths.map((point, idx) => (
                      <li key={idx} className="[overflow-wrap:anywhere]">{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {feedback.missing.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-bold text-tone-amber-fg">{t('missing')}</h3>
                  <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm">
                    {feedback.missing.map((point, idx) => (
                      <li key={idx} className="[overflow-wrap:anywhere]">{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-bold">{t('advice')}</h3>
                <p className="text-sm leading-relaxed [overflow-wrap:anywhere]">{feedback.advice}</p>
              </div>

              <p className="flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
                <span>{t('aiDisclaimer')}</span>
              </p>
            </section>
          )}
        </Card>
      )}
    </>,
  )
}
