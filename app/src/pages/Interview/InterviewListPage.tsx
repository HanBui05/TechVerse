import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Lightbulb, MessageSquareQuote, RefreshCw, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminPagination } from '../Admin/AdminPagination'
import { SaveToggle } from '../../components/articles/ArticleSaveButton'
import { EmptyState } from '../../components/EmptyState'
import { interviewLevelTone } from '../Author/InterviewQuestions/AuthorInterviewQuestionsPage'
import { fieldLabel } from '../Author/AuthorBlogsPage'
import {
  interviewLevelLabel,
  learnerInterviewErrorText,
  learnerInterviewText,
} from '../../data/interviewI18n'
import { interviewFilter, interviewSearch, publicInterviews } from '../../services/interviewService'
import type { ArticleOption, Page } from '../../types/articles'
import type { InterviewFilter, InterviewLevel, InterviewMarkFilter, PublishedInterviewQuestion } from '../../types/interview'
import type { Language } from '../../types/preferences'

const PAGE_SIZE = 12
const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const LEVELS: InterviewLevel[] = ['EASY', 'MEDIUM', 'HARD']
const MARKS: { value: InterviewMarkFilter | ''; key: 'filterAll' | 'filterSaved' | 'filterReviewed' }[] = [
  { value: '', key: 'filterAll' },
  { value: 'SAVED', key: 'filterSaved' },
  { value: 'REVIEWED', key: 'filterReviewed' },
]

function InterviewCardSaveButton({
  questionId,
  initial,
  language,
  onSavedChange,
}: {
  questionId: string
  initial: boolean
  language: Language
  onSavedChange?: (saved: boolean) => void
}) {
  const t = learnerInterviewText(language)
  const confirmed = useRef(initial)
  const desired = useRef(initial)
  const busy = useRef(false)
  const [saved, setShown] = useState(initial)
  const [error, setError] = useState('')

  useEffect(() => {
    confirmed.current = initial
    desired.current = initial
    setShown(initial)
  }, [initial])

  const pump = async () => {
    if (busy.current) return
    busy.current = true
    try {
      while (desired.current !== confirmed.current) {
        const result = await publicInterviews.mark(questionId, { saved: desired.current })
        confirmed.current = result.saved
        onSavedChange?.(result.saved)
      }
    } catch (e) {
      desired.current = confirmed.current
      setShown(confirmed.current)
      setError(learnerInterviewErrorText(e, language, t('loadError')))
    } finally {
      busy.current = false
    }
  }

  const toggle = () => {
    const next = !desired.current
    desired.current = next
    setShown(next)
    setError('')
    void pump()
  }

  return <SaveToggle saved={saved} error={error} onToggle={toggle} language={language} />
}

export function InterviewListPage({ language = 'vi', authenticated = false }: { language?: Language; authenticated?: boolean }) {
  const t = learnerInterviewText(language)
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = interviewFilter(searchParams, authenticated)
  const [keyword, setKeyword] = useState(filter.keyword)
  const [topics, setTopics] = useState<ArticleOption[]>([])
  const [data, setData] = useState<Page<PublishedInterviewQuestion> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [run, setRun] = useState(0)

  useEffect(() => {
    setKeyword(filter.keyword)
  }, [filter.keyword])

  useEffect(() => {
    let live = true
    publicInterviews.options().then(result => {
      if (live) setTopics(result)
    }, () => {})
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    publicInterviews
      .list({ ...filter, size: PAGE_SIZE })
      .then(result => {
        if (live) {
          setData(result)
          setLoading(false)
        }
      })
      .catch(e => {
        if (live) {
          setError(learnerInterviewErrorText(e, language, t('loadError')))
          setLoading(false)
        }
      })
    return () => {
      live = false
    }
  }, [filter.topicId, filter.level, filter.mark, filter.keyword, filter.page, authenticated, run, language]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<InterviewFilter>) => {
    setSearchParams(interviewSearch({ ...filter, ...patch, page: patch.page ?? 0 }, authenticated), { replace: true })
  }

  useEffect(() => {
    if (keyword.trim() === filter.keyword) return
    const timer = window.setTimeout(() => update({ keyword }), 250)
    return () => window.clearTimeout(timer)
  }, [keyword]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = Boolean(filter.topicId || filter.level || filter.mark || filter.keyword)
  const clear = () => {
    setKeyword('')
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  return (
    <main className="tw-page mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-1.5 border-b border-border pb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('heading')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card className="gap-4 rounded-xl p-5">
        {authenticated && (
          <div role="group" aria-label={t('markFilter')} className="flex flex-wrap gap-2">
            {MARKS.map(m => (
              <Button
                key={m.key}
                type="button"
                size="sm"
                variant={filter.mark === m.value ? 'default' : 'outline'}
                aria-pressed={filter.mark === m.value}
                className={touch}
                onClick={() => update({ mark: m.value })}
              >
                {t(m.key)}
              </Button>
            ))}
          </div>
        )}

        <form
          role="search"
          aria-label={t('heading')}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[200px_180px_minmax(0,1fr)_auto]"
          onSubmit={e => {
            e.preventDefault()
            update({ keyword })
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="iv-topic" className={fieldLabel}>{t('topic')}</Label>
            <NativeSelect
              id="iv-topic"
              value={filter.topicId}
              className={`w-full ${touch}`}
              onChange={e => update({ topicId: e.target.value })}
            >
              <NativeSelectOption value="">{t('allTopics')}</NativeSelectOption>
              {topics.map(o => (
                <NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="iv-level" className={fieldLabel}>{t('level')}</Label>
            <NativeSelect
              id="iv-level"
              value={filter.level}
              className={`w-full ${touch}`}
              onChange={e => update({ level: e.target.value as InterviewFilter['level'] })}
            >
              <NativeSelectOption value="">{t('allLevels')}</NativeSelectOption>
              {LEVELS.map(l => (
                <NativeSelectOption key={l} value={l}>{interviewLevelLabel[l][language]}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="iv-search" className={fieldLabel}>{t('search')}</Label>
            <Input
              id="iv-search"
              type="search"
              value={keyword}
              placeholder={t('searchPlaceholder')}
              className={touch}
              onChange={e => setKeyword(e.target.value)}
            />
          </div>

          {filtered && (
            <Button type="button" variant="outline" className={`self-end ${touch}`} onClick={clear}>
              {t('clearFilters')}
            </Button>
          )}
        </form>
      </Card>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" className={touch} onClick={() => setRun(r => r + 1)}>
            <RefreshCw aria-hidden />
            {t('retry')}
          </Button>
        </div>
      )}

      {loading && !data ? (
        <div role="status" aria-label={t('loading')} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : data && data.content.length === 0 ? (
        <EmptyState
          icon={filtered ? Search : MessageSquareQuote}
          title={t(filtered ? 'noMatch' : 'empty')}
          action={
            filtered ? (
              <Button type="button" variant="outline" className={touch} onClick={clear}>
                {t('clearFilters')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        data && (
          <>
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {data.content.map(item => (
                <li key={item.id} className="flex">
                  <Card className="flex h-full w-full flex-col justify-between gap-4 rounded-xl p-5 transition-colors hover:border-foreground/25">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={interviewLevelTone(item.level)}>{interviewLevelLabel[item.level][language]}</Badge>
                          <Badge tone="slate">{item.topic.name}</Badge>
                          {item.hasHint && (
                            <Badge variant="outline">
                              <Lightbulb aria-hidden className="size-3" />
                              {t('hasHintBadge')}
                            </Badge>
                          )}
                          {authenticated && item.viewer?.reviewed && (
                            <Badge tone="green">
                              <CheckCircle2 aria-hidden className="size-3" />
                              {t('reviewed')}
                            </Badge>
                          )}
                        </div>
                        {authenticated && (
                          <InterviewCardSaveButton
                            questionId={item.id}
                            initial={item.viewer?.saved ?? false}
                            language={language}
                          />
                        )}
                      </div>

                      <Link
                        to={`/interview/${item.id}`}
                        className="group flex flex-col gap-2 text-foreground no-underline focus-visible:outline-none"
                      >
                        <h2 className="line-clamp-3 text-base font-bold leading-snug group-hover:text-primary [overflow-wrap:anywhere]">
                          {item.question}
                        </h2>
                      </Link>
                    </div>

                    <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                      {t('by', { name: item.author.fullName })}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
            <AdminPagination
              language={language}
              page={data.page}
              size={data.size}
              total={data.totalElements}
              loading={loading}
              onPageChange={page => update({ page })}
            />
          </>
        )
      )}
    </main>
  )
}
