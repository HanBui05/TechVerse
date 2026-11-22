import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, MessageSquare, MessagesSquare, Plus, RefreshCw, Search, ThumbsUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { toneFor } from '@/lib/utils'
import { EmptyState } from '../../components/EmptyState'
import { Pagination } from '../../components/Pagination'
import { UserAvatar } from '../../components/UserAvatar'
import { fieldLabel, formatDate } from '../Author/AuthorBlogsPage'
import { forumErrorText, forumText } from '../../data/forumI18n'
import { forumFilter, forumSearch, forumService } from '../../services/forumService'
import type { ArticleOption, Page } from '../../types/articles'
import type { ForumListFilter, ForumQuestionSummary } from '../../types/forum'
import type { Language } from '../../types/preferences'

const PAGE_SIZE = 20
const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'

export function ForumListPage({
  language = 'vi',
  authenticated = false,
}: {
  language?: Language
  authenticated?: boolean
}) {
  const t = forumText(language)
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = forumFilter(searchParams, authenticated)
  const [keyword, setKeyword] = useState(filter.keyword)
  const [keywordError, setKeywordError] = useState('')
  const [topics, setTopics] = useState<ArticleOption[]>([])
  const [data, setData] = useState<Page<ForumQuestionSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [run, setRun] = useState(0)

  useEffect(() => {
    setKeyword(filter.keyword)
    setKeywordError('')
  }, [filter.keyword])

  useEffect(() => {
    let live = true
    forumService.options().then(
      res => {
        if (live) setTopics(res)
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    forumService
      .listQuestions({ ...filter, size: PAGE_SIZE })
      .then(res => {
        if (live) {
          setData(res)
          setLoading(false)
        }
      })
      .catch(e => {
        if (live) {
          setError(forumErrorText(e, language, 'general', t('loadError')))
          setLoading(false)
        }
      })
    return () => {
      live = false
    }
  }, [filter.topicId, filter.keyword, filter.solved, filter.mine, filter.page, authenticated, run, language]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<ForumListFilter>) => {
    setSearchParams(forumSearch({ ...filter, ...patch, page: patch.page ?? 0 }, authenticated), { replace: true })
  }

  const submitSearch = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = keyword.trim()
    if (trimmed.length === 1 || trimmed.length > 100) {
      setKeywordError(t('keywordLength'))
      return
    }
    setKeywordError('')
    update({ keyword: trimmed })
  }

  const filtered = Boolean(filter.topicId || filter.keyword || filter.solved || filter.mine)
  const clear = () => {
    setKeyword('')
    setKeywordError('')
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const items = data?.content ?? []

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('heading')}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild className={touch}>
          <Link to="/forum/new">
            <Plus aria-hidden />
            {t('askQuestion')}
          </Link>
        </Button>
      </header>

      <Card className="gap-4 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label={t('heading')} className="flex flex-wrap gap-2">
            {(
              [
                ['', 'filterAll'],
                ['false', 'filterUnsolved'],
                ['true', 'filterSolved'],
              ] as const
            ).map(([val, labelKey]) => (
              <Button
                key={labelKey}
                type="button"
                size="sm"
                variant={filter.solved === val ? 'default' : 'outline'}
                aria-pressed={filter.solved === val}
                className={touch}
                onClick={() => update({ solved: val })}
              >
                {t(labelKey)}
              </Button>
            ))}

            {authenticated && (
              <Button
                type="button"
                size="sm"
                variant={filter.mine ? 'default' : 'outline'}
                aria-pressed={filter.mine}
                className={touch}
                onClick={() => update({ mine: !filter.mine })}
              >
                {t('filterMine')}
              </Button>
            )}
          </div>
        </div>

        <form
          role="search"
          onSubmit={submitSearch}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[220px_minmax(0,1fr)_auto_auto]"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="forum-topic" className={fieldLabel}>{t('topic')}</Label>
            <NativeSelect
              id="forum-topic"
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
            <Label htmlFor="forum-search" className={fieldLabel}>{t('search')}</Label>
            <Input
              id="forum-search"
              type="search"
              value={keyword}
              placeholder={t('searchPlaceholder')}
              aria-invalid={Boolean(keywordError)}
              className={touch}
              onChange={e => {
                setKeyword(e.target.value)
                if (keywordError) setKeywordError('')
                if (e.target.value.trim() === '' && filter.keyword !== '') {
                  update({ keyword: '' })
                }
              }}
            />
            {keywordError && <p role="alert" className="text-xs text-danger">{keywordError}</p>}
          </div>

          <Button type="submit" variant="outline" className={`self-end ${touch}`}>
            <Search aria-hidden />
            {t('search')}
          </Button>

          {filtered && (
            <Button type="button" variant="ghost" className={`self-end ${touch}`} onClick={clear}>
              {t('clearFilters')}
            </Button>
          )}
        </form>
      </Card>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-tone-rose-bg px-4 py-3 text-sm text-danger"
        >
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" className={touch} onClick={() => setRun(r => r + 1)}>
            <RefreshCw aria-hidden />
            {t('retry')}
          </Button>
        </div>
      )}

      {loading && !data ? (
        <div role="status" aria-label={t('loading')} className="flex flex-col gap-3">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : data && items.length === 0 ? (
        <EmptyState
          icon={filtered ? Search : MessagesSquare}
          title={t('emptyQuestions')}
          action={
            filtered ? (
              <Button type="button" variant="outline" className={touch} onClick={clear}>
                {t('clearFilters')}
              </Button>
            ) : (
              <Button asChild className={touch}>
                <Link to="/forum/new">
                  <Plus aria-hidden />
                  {t('askQuestion')}
                </Link>
              </Button>
            )
          }
        />
      ) : (
        data && (
          <>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {items.map(item => (
                <li key={item.id}>
                  <Card className="gap-3 rounded-xl p-5 transition-colors hover:border-foreground/25">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.solved && (
                            <Badge tone="green">
                              <CheckCircle2 aria-hidden className="size-3.5" />
                              {t('solved')}
                            </Badge>
                          )}
                          <Badge tone={toneFor(item.topic.name)}>{item.topic.name}</Badge>
                        </div>

                        <Link
                          to={`/forum/${item.id}`}
                          className="text-base font-bold leading-snug text-foreground no-underline hover:text-primary [overflow-wrap:anywhere] sm:text-lg"
                        >
                          {item.title}
                        </Link>

                        {item.excerpt && (
                          <p className="line-clamp-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                            {item.excerpt}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
                            item.solved
                              ? 'border-tone-green-border bg-tone-green-bg text-tone-green-fg'
                              : 'border-border bg-muted/40'
                          }`}
                        >
                          <MessageSquare aria-hidden className="size-3.5" />
                          {t('answersCount', { n: item.answerCount })}
                        </span>

                        <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5">
                          <ThumbsUp aria-hidden className="size-3.5" />
                          {item.reactionCount}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                        <UserAvatar name={item.author.fullName} url={item.author.avatarUrl} className="size-5 text-[10px]" />
                        {item.author.fullName}
                      </span>
                      <span>· {formatDate(item.createdAt, language)}</span>
                      {item.editedAt && <span>· {t('edited')}</span>}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>

            <Pagination
              language={language}
              page={data.page}
              totalPages={data.totalPages}
              loading={loading}
              onPageChange={page => update({ page })}
            />
          </>
        )
      )}
    </main>
  )
}
