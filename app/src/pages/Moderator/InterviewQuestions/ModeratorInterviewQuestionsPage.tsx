import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Inbox, RefreshCw, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { toneFor } from '@/lib/utils'
import { AdminPagination } from '../../Admin/AdminPagination'
import { EmptyState } from '../../../components/EmptyState'
import { UserAvatar } from '../../../components/UserAvatar'
import { fieldLabel, formatDate } from '../../Author/AuthorBlogsPage'
import { interviewLevelTone, interviewStatusTone } from '../../Author/InterviewQuestions/AuthorInterviewQuestionsPage'
import {
  MODERATOR_INTERVIEW_STATUSES,
  interviewErrorText,
  interviewLevelLabel,
  interviewStatusLabel,
  moderatorInterviewText,
  type ModeratorInterviewStatusFilter,
} from '../../../data/interviewI18n'
import { moderatorInterviews } from '../../../services/interviewService'
import type { ArticleOption, Page } from '../../../types/articles'
import type { InterviewLevel, ModeratorInterviewQuestion } from '../../../types/interview'
import type { Language } from '../../../types/preferences'

const PAGE_SIZE = 12
const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const LEVELS: InterviewLevel[] = ['EASY', 'MEDIUM', 'HARD']

export function ModeratorInterviewQuestionsPage({ language = 'vi' }: { language?: Language }) {
  const t = moderatorInterviewText(language)
  const [status, setStatus] = useState<ModeratorInterviewStatusFilter>('PENDING')
  const [level, setLevel] = useState<InterviewLevel | ''>('')
  const [topicId, setTopicId] = useState('')
  const [topics, setTopics] = useState<ArticleOption[]>([])
  const [search, setSearch] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Page<ModeratorInterviewQuestion> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    moderatorInterviews.options().then(setTopics).catch(() => {})
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => {
      setKeyword(search.trim())
      setPage(0)
    }, 300)
    return () => window.clearTimeout(id)
  }, [search])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    moderatorInterviews
      .list({ status, level, topicId: topicId || undefined, keyword: keyword || undefined, page, size: PAGE_SIZE })
      .then(result => {
        if (active) setData(result)
      })
      .catch(e => {
        if (active) setError(interviewErrorText(e, language, t('loadError')))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [status, level, topicId, keyword, page, reloadTick, language]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = data?.content ?? []
  const filtered = status !== 'PENDING' || level !== '' || topicId !== '' || keyword !== ''
  const clear = () => {
    setStatus('PENDING')
    setLevel('')
    setTopicId('')
    setSearch('')
    setKeyword('')
    setPage(0)
  }

  return (
    <main className="tw-page mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-1.5 border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('heading')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card className="gap-4 rounded-xl p-5">
        <div role="group" aria-label={t('status')} className="flex flex-wrap gap-2">
          {MODERATOR_INTERVIEW_STATUSES.map(s => (
            <Button
              key={s}
              variant={status === s ? 'default' : 'outline'}
              size="sm"
              aria-pressed={status === s}
              className={touch}
              onClick={() => {
                setStatus(s)
                setPage(0)
              }}
            >
              {interviewStatusLabel[s][language]}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[180px_220px_minmax(0,1fr)_auto]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mod-iq-level" className={fieldLabel}>{t('level')}</Label>
            <NativeSelect
              id="mod-iq-level"
              value={level}
              className={`w-full ${touch}`}
              onChange={e => {
                setLevel(e.target.value as InterviewLevel | '')
                setPage(0)
              }}
            >
              <NativeSelectOption value="">{t('allLevels')}</NativeSelectOption>
              {LEVELS.map(l => (
                <NativeSelectOption key={l} value={l}>{interviewLevelLabel[l][language]}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mod-iq-topic" className={fieldLabel}>{t('topic')}</Label>
            <NativeSelect
              id="mod-iq-topic"
              value={topicId}
              className={`w-full ${touch}`}
              onChange={e => {
                setTopicId(e.target.value)
                setPage(0)
              }}
            >
              <NativeSelectOption value="">{t('allTopics')}</NativeSelectOption>
              {topics.map(topic => (
                <NativeSelectOption key={topic.id} value={topic.id}>{topic.name}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mod-iq-search" className={fieldLabel}>{t('search')}</Label>
            <Input
              id="mod-iq-search"
              type="search"
              value={search}
              placeholder={t('searchPlaceholder')}
              className={touch}
              onChange={e => setSearch(e.target.value)}
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
          <Button size="sm" variant="outline" className={touch} onClick={() => setReloadTick(x => x + 1)}>
            <RefreshCw aria-hidden />
            {t('retry')}
          </Button>
        </div>
      )}

      <Card className="gap-0 overflow-hidden rounded-xl py-0">
        {loading && !data ? (
          <div aria-busy="true" aria-label={t('loading')} className="flex flex-col divide-y divide-border">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex flex-col gap-2 px-6 py-4">
                <Skeleton className="h-4 w-72 max-w-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            ))}
          </div>
        ) : error && !data ? null : !items.length ? (
          <EmptyState
            className="m-6"
            icon={Inbox}
            title={t('empty')}
            description={t('emptyHint')}
            action={filtered ? <Button variant="outline" className={touch} onClick={clear}>{t('clearFilters')}</Button> : undefined}
          />
        ) : (
          <ul className={`m-0 flex list-none flex-col divide-y divide-border p-0 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {items.map(({ question: q, author, authorEligible }) => (
              <li key={q.id} className="flex flex-col gap-2 px-6 py-4 transition-colors hover:bg-muted/50">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/moderator/interview-questions/${q.id}`}
                    className={`line-clamp-2 font-semibold text-foreground no-underline hover:underline [overflow-wrap:anywhere] ${touch}`}
                  >
                    {q.question}
                  </Link>
                  <Badge tone={interviewStatusTone(q.status)}>{interviewStatusLabel[q.status][language]}</Badge>
                  <Badge tone={interviewLevelTone(q.level)}>{interviewLevelLabel[q.level][language]}</Badge>
                  <Badge tone={toneFor(q.topic.name)}>{q.topic.name}</Badge>
                  {q.aiAssisted && <Badge tone="purple"><Sparkles aria-hidden />{t('aiUsed')}</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <UserAvatar name={author.fullName} url={author.avatarUrl} className="size-5 text-[10px]" />
                    {author.fullName}
                  </span>
                  {!authorEligible && (
                    <span className="inline-flex items-center gap-1 font-medium text-tone-rose-fg">
                      <AlertTriangle aria-hidden className="size-3.5" />
                      {t('ineligible')}
                    </span>
                  )}
                  <span>· {t('updated')} {formatDate(q.updatedAt, language)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!!data?.totalElements && (
          <div className="border-t border-border px-6 py-4">
            <AdminPagination language={language} page={page} size={PAGE_SIZE} total={data.totalElements} loading={loading} onPageChange={setPage} />
          </div>
        )}
      </Card>
    </main>
  )
}
