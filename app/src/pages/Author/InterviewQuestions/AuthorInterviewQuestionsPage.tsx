import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Eye, MessageSquareQuote, PencilLine, Plus, RefreshCw, Search, Sparkles } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { AdminPagination } from '../../Admin/AdminPagination'
import { EmptyState } from '../../../components/EmptyState'
import { fieldLabel, formatDate } from '../AuthorBlogsPage'
import { interviewErrorText, interviewLevelLabel, interviewStatusLabel, interviewText } from '../../../data/interviewI18n'
import { aiAssist } from '../../../services/aiAssistService'
import { authorInterviews, interviewActions, interviewAiDraftErrors } from '../../../services/interviewService'
import type { AiQuota } from '../../../types/aiAssist'
import type { ArticleOption, Page } from '../../../types/articles'
import type { InterviewAiDraftRequest, InterviewAiDraftsResponse, InterviewAuthorAction, InterviewLevel, InterviewQuestion, InterviewStatus } from '../../../types/interview'
import type { Language } from '../../../types/preferences'

const SIZE = 20
const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const STATUSES: InterviewStatus[] = ['DRAFT', 'PENDING', 'PUBLISHED', 'CHANGES_REQUESTED', 'AUTHOR_HIDDEN', 'HIDDEN', 'REMOVED']
const LEVELS: InterviewLevel[] = ['EASY', 'MEDIUM', 'HARD']
const COUNTS = [1, 2, 3, 4, 5]

export function interviewStatusTone(status: InterviewStatus): BadgeTone {
  if (status === 'PUBLISHED') return 'green'
  if (status === 'PENDING') return 'amber'
  if (status === 'CHANGES_REQUESTED') return 'rose'
  if (status === 'AUTHOR_HIDDEN') return 'purple'
  return 'slate'
}

export function interviewLevelTone(level: InterviewLevel): BadgeTone {
  if (level === 'EASY') return 'green'
  if (level === 'MEDIUM') return 'amber'
  return 'rose'
}

const quotaOfError = (e: unknown) => (e as { quota?: AiQuota | null })?.quota ?? null

function AiDraftDialog({
  language,
  topics,
  onClose,
  onCreated,
}: {
  language: Language
  topics: ArticleOption[]
  onClose: () => void
  onCreated: (drafts: InterviewAiDraftsResponse) => void
}) {
  const t = interviewText(language)
  const [form, setForm] = useState<InterviewAiDraftRequest>({
    topicId: topics[0]?.id ?? '',
    level: 'MEDIUM',
    instruction: '',
    sourceText: '',
    count: 3,
  })
  const [quota, setQuota] = useState<AiQuota | null>(null)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void aiAssist.quota().then(q => setQuota(q.interviewDraft ?? null), () => {})
  }, [])

  useEffect(() => {
    if (!form.topicId && topics.length > 0) setForm(old => (old.topicId ? old : { ...old, topicId: topics[0].id }))
  }, [topics, form.topicId])

  const liveErrors = interviewAiDraftErrors(form)
  const shownErrors = {
    topicId: tried && liveErrors.topicId ? t(liveErrors.topicId) : '',
    level: tried && liveErrors.level ? t(liveErrors.level) : '',
    instruction: (tried || (form.instruction?.length ?? 0) > 500) && liveErrors.instruction ? t(liveErrors.instruction) : '',
    sourceText: (tried || (form.sourceText?.length ?? 0) > 8000) && liveErrors.sourceText ? t(liveErrors.sourceText) : '',
    count: tried && liveErrors.count ? t(liveErrors.count) : '',
  }
  const out = quota !== null && quota.remaining <= 0

  const submit = async () => {
    setTried(true)
    if (busy || out || Object.keys(liveErrors).length > 0) return
    setBusy(true)
    setError('')
    try {
      const { drafts, quota: nextQuota } = await authorInterviews.generateAiDrafts(form)
      if (nextQuota) setQuota(nextQuota)
      onCreated(drafts)
    } catch (e) {
      const q = quotaOfError(e)
      if (q) setQuota(q)
      setError(interviewErrorText(e, language, t('loadError')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles aria-hidden className="size-4 text-primary" />
            {t('aiDialogTitle')}
          </DialogTitle>
          <DialogDescription>{t('aiDialogSubtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4" aria-busy={busy}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5 sm:col-span-1">
              <Label htmlFor="ai-iq-topic" className={fieldLabel}>{t('topic')} *</Label>
              <NativeSelect
                id="ai-iq-topic"
                className={touch}
                disabled={busy}
                value={form.topicId}
                aria-invalid={Boolean(shownErrors.topicId)}
                onChange={e => setForm({ ...form, topicId: e.target.value })}
              >
                <NativeSelectOption value="">{t('chooseTopic')}</NativeSelectOption>
                {topics.map(o => <NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}
              </NativeSelect>
              {shownErrors.topicId && <p role="alert" className="text-xs text-danger">{shownErrors.topicId}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-iq-level" className={fieldLabel}>{t('level')} *</Label>
              <NativeSelect
                id="ai-iq-level"
                className={touch}
                disabled={busy}
                value={form.level}
                onChange={e => setForm({ ...form, level: e.target.value as InterviewLevel })}
              >
                {LEVELS.map(l => <NativeSelectOption key={l} value={l}>{interviewLevelLabel[l][language]}</NativeSelectOption>)}
              </NativeSelect>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-iq-count" className={fieldLabel}>{t('count')}</Label>
              <NativeSelect
                id="ai-iq-count"
                className={touch}
                disabled={busy}
                value={form.count}
                onChange={e => setForm({ ...form, count: Number(e.target.value) })}
              >
                {COUNTS.map(n => <NativeSelectOption key={n} value={n}>{n}</NativeSelectOption>)}
              </NativeSelect>
              {shownErrors.count && <p role="alert" className="text-xs text-danger">{shownErrors.count}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="ai-iq-instruction" className={fieldLabel}>{t('instruction')}</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{(form.instruction ?? '').length}/500</span>
            </div>
            <Textarea
              id="ai-iq-instruction"
              rows={2}
              disabled={busy}
              placeholder={t('instructionPlaceholder')}
              value={form.instruction ?? ''}
              aria-invalid={Boolean(shownErrors.instruction)}
              onChange={e => setForm({ ...form, instruction: e.target.value })}
            />
            {shownErrors.instruction && <p role="alert" className="text-xs text-danger">{shownErrors.instruction}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="ai-iq-source" className={fieldLabel}>{t('sourceText')}</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{(form.sourceText ?? '').length}/8.000</span>
            </div>
            <Textarea
              id="ai-iq-source"
              rows={4}
              disabled={busy}
              placeholder={t('sourcePlaceholder')}
              value={form.sourceText ?? ''}
              aria-invalid={Boolean(shownErrors.sourceText)}
              onChange={e => setForm({ ...form, sourceText: e.target.value })}
            />
            {shownErrors.sourceText && <p role="alert" className="text-xs text-danger">{shownErrors.sourceText}</p>}
          </div>

          {quota && (
            <p className="text-xs text-muted-foreground">
              {out ? t('quotaOut') : t('quotaLeft', { remaining: quota.remaining, limit: quota.limit ?? '∞' })}
            </p>
          )}

          {error && <p role="alert" className="rounded-lg border border-border bg-tone-rose-bg px-3 py-2 text-sm text-danger">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className={touch} disabled={busy} onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="button" className={touch} disabled={busy || out} onClick={() => void submit()}>
            <Sparkles aria-hidden className={busy ? 'motion-safe:animate-pulse' : undefined} />
            {busy ? t('generatingAi') : t('generateAi')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AuthorInterviewQuestionsPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = interviewText(language)
  const navigate = useNavigate()
  const [topics, setTopics] = useState<ArticleOption[]>([])
  const [status, setStatus] = useState<InterviewStatus | ''>('')
  const [level, setLevel] = useState<InterviewLevel | ''>('')
  const [topicId, setTopicId] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Page<InterviewQuestion> | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [ask, setAsk] = useState<{ action: 'delete' | 'withdraw'; item: InterviewQuestion } | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(() => new Set())
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    authorInterviews.options().then(setTopics, () => {})
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setKeyword(searchInput.trim())
      setPage(0)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await authorInterviews.list({ status, level, topicId, keyword, page, size: SIZE }))
    } catch (e) {
      setError(interviewErrorText(e, language, t('loadError')))
    } finally {
      setLoading(false)
    }
  }, [status, level, topicId, keyword, page, language, reloadTick]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load()
  }, [load])

  const run = async (action: InterviewAuthorAction, item: InterviewQuestion) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (action === 'delete') await authorInterviews.remove(item.id)
      else if (action === 'withdraw') await authorInterviews.withdraw(item.id)
      else if (action === 'copy') await authorInterviews.copy(item.id)
      else await authorInterviews.visibility(item.id, action === 'hide' ? 'HIDE' : 'UNHIDE')
      setAsk(null)
      setMessage(
        t(
          action === 'delete'
            ? 'deleted'
            : action === 'copy'
              ? 'copied'
              : action === 'withdraw'
                ? 'withdrawn'
                : action === 'hide'
                  ? 'hiddenMsg'
                  : 'unhiddenMsg',
        ),
      )
      await load()
    } catch (e) {
      setAsk(null)
      setError(interviewErrorText(e, language, t('loadError')))
    } finally {
      setBusy(false)
    }
  }

  const clear = () => {
    setStatus('')
    setLevel('')
    setTopicId('')
    setSearchInput('')
    setKeyword('')
    setPage(0)
  }

  const filtered = Boolean(status || level || topicId || keyword)
  const items = data?.content ?? []

  return (
    <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('heading')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className={touch} onClick={() => setAiOpen(true)}>
            <Sparkles aria-hidden />
            {t('generateAi')}
          </Button>
          <Button asChild className={touch}>
            <Link to="/author/interview-questions/new">
              <Plus aria-hidden />
              {t('newQuestion')}
            </Link>
          </Button>
        </div>
      </header>

      <Card className="gap-4 rounded-xl p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[180px_160px_200px_minmax(0,1fr)_auto]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="iq-status" className={fieldLabel}>{t('status')}</Label>
            <NativeSelect
              id="iq-status"
              className={touch}
              value={status}
              onChange={e => { setStatus(e.target.value as InterviewStatus | ''); setPage(0) }}
            >
              <NativeSelectOption value="">{t('allStatuses')}</NativeSelectOption>
              {STATUSES.map(s => <NativeSelectOption key={s} value={s}>{interviewStatusLabel[s][language]}</NativeSelectOption>)}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="iq-level" className={fieldLabel}>{t('level')}</Label>
            <NativeSelect
              id="iq-level"
              className={touch}
              value={level}
              onChange={e => { setLevel(e.target.value as InterviewLevel | ''); setPage(0) }}
            >
              <NativeSelectOption value="">{t('allLevels')}</NativeSelectOption>
              {LEVELS.map(l => <NativeSelectOption key={l} value={l}>{interviewLevelLabel[l][language]}</NativeSelectOption>)}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="iq-topic" className={fieldLabel}>{t('topic')}</Label>
            <NativeSelect
              id="iq-topic"
              className={touch}
              value={topicId}
              onChange={e => { setTopicId(e.target.value); setPage(0) }}
            >
              <NativeSelectOption value="">{t('allTopics')}</NativeSelectOption>
              {topics.map(o => <NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="iq-search" className={fieldLabel}>{t('search')}</Label>
            <Input
              id="iq-search"
              type="search"
              className={touch}
              placeholder={t('searchPlaceholder')}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>

          {filtered && (
            <Button variant="ghost" className={`self-end ${touch}`} onClick={clear}>
              {t('clearFilters')}
            </Button>
          )}
        </div>
      </Card>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
          <span>{error}</span>
          <Button size="sm" variant="outline" className={touch} onClick={() => void load()}>
            <RefreshCw aria-hidden />
            {t('retry')}
          </Button>
        </div>
      )}
      {message && (
        <p role="status" className="rounded-lg border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg">
          {message}
        </p>
      )}

      <Card className="gap-0 overflow-hidden rounded-xl py-0">
        <h2 className="border-b border-border px-6 py-4 text-base font-bold">{t('list')}</h2>
        {loading && !data ? (
          <div aria-busy="true" aria-label={t('loading')} className="flex flex-col divide-y divide-border">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex flex-col gap-2 px-6 py-4">
                <Skeleton className="h-4 w-72 max-w-full" />
                <Skeleton className="h-3 w-44" />
              </div>
            ))}
          </div>
        ) : error && !data ? null : !items.length ? (
          filtered ? (
            <EmptyState
              className="m-6"
              icon={Search}
              title={t('noMatch')}
              action={<Button variant="outline" className={touch} onClick={clear}>{t('clearFilters')}</Button>}
            />
          ) : (
            <EmptyState
              className="m-6"
              icon={MessageSquareQuote}
              title={t('emptyTitle')}
              action={<Button asChild className={touch}><Link to="/author/interview-questions/new"><Plus aria-hidden />{t('newQuestion')}</Link></Button>}
            />
          )
        ) : (
          <ul className={`m-0 flex list-none flex-col divide-y divide-border p-0 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {items.map(item => {
              const { primary, actions } = interviewActions(item)
              const highlighted = highlightedIds.has(item.id)
              return (
                <li
                  key={item.id}
                  data-highlighted={highlighted ? 'true' : undefined}
                  onClick={e => {
                    if (!(e.target as Element).closest('a,button')) navigate(`/author/interview-questions/${item.id}/edit`)
                  }}
                  className={`flex cursor-pointer flex-col gap-3 px-6 py-4 transition-colors hover:bg-muted/50 ${highlighted ? 'bg-primary/5 ring-1 ring-inset ring-primary/30' : ''}`}
                >
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="line-clamp-2 font-semibold [overflow-wrap:anywhere]">{item.question}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <Badge tone={interviewStatusTone(item.status)}>{interviewStatusLabel[item.status][language]}</Badge>
                      <Badge tone={interviewLevelTone(item.level)}>{interviewLevelLabel[item.level][language]}</Badge>
                      <Badge variant="outline">{item.topic.name}</Badge>
                      <span>{t('updated', { date: formatDate(item.updatedAt, language) })}</span>
                      {item.aiAssisted && <Badge tone="purple"><Sparkles aria-hidden />{t('aiUsed')}</Badge>}
                      {highlighted && <Badge tone="purple">{t('newDraftBadge')}</Badge>}
                    </span>
                    {item.moderationNote && (item.status === 'CHANGES_REQUESTED' || item.status === 'HIDDEN' || item.status === 'REMOVED') && (
                      <span className="flex items-start gap-1.5 text-xs text-tone-amber-fg">
                        <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                        <span>{t('moderatorNote')}: “{item.moderationNote}”</span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant={primary === 'edit' ? 'default' : 'outline'} className={touch}>
                      <Link to={`/author/interview-questions/${item.id}/edit`} aria-label={`${t(primary)} ${item.question}`}>
                        {primary === 'edit' ? <PencilLine aria-hidden /> : <Eye aria-hidden />}
                        {t(primary)}
                      </Link>
                    </Button>
                    {actions.map(action => (
                      <Button
                        key={action}
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        className={touch}
                        aria-label={`${t(action)} ${item.question}`}
                        onClick={() => (action === 'delete' || action === 'withdraw' ? setAsk({ action, item }) : void run(action, item))}
                      >
                        {t(action)}
                      </Button>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {!!data?.totalElements && (
          <div className="border-t border-border px-6 py-4">
            <AdminPagination language={language} page={page} size={SIZE} total={data.totalElements} loading={loading} onPageChange={setPage} />
          </div>
        )}
      </Card>

      {aiOpen && (
        <AiDraftDialog
          language={language}
          topics={topics}
          onClose={() => setAiOpen(false)}
          onCreated={drafts => {
            setAiOpen(false)
            setHighlightedIds(new Set(drafts.questions.map(q => q.id)))
            setMessage(t('aiDraftResult', { n: drafts.questions.length, count: drafts.requested }))
            setStatus('')
            setLevel('')
            setTopicId('')
            setSearchInput('')
            setKeyword('')
            setPage(0)
            // One reload with the cleared filters, even when they were already clear.
            setReloadTick(x => x + 1)
          }}
        />
      )}

      <AlertDialog open={ask !== null} onOpenChange={open => { if (!open && !busy) setAsk(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ask && t(ask.action === 'delete' ? 'deleteTitle' : 'withdrawTitle')}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} className={touch}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className={touch}
              onClick={e => {
                e.preventDefault()
                if (ask) void run(ask.action, ask.item)
              }}
            >
              {ask && t(ask.action)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
