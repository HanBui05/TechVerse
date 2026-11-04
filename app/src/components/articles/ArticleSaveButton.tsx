import { useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { readerErrorText, readerText } from '../../data/articleI18n'
import { publicArticles } from '../../services/articleService'
import type { Language } from '../../types/preferences'

/**
 * Saved flag of one article (spec 2c): at most one request in flight; clicks only move the optimistic intent, and after each
 * success the latest intent is sent if it differs from the confirmed state. A failure stops the chain and rolls back to the
 * last confirmed state. Task 2d's Undo calls `setSaved` on the same machine.
 */
export function useSavedState(articleId: string, initial: boolean, language: Language, onSavedChange?: (saved: boolean) => void) {
  const confirmed = useRef(initial)
  const desired = useRef(initial)
  const busy = useRef(false)
  const [saved, setShown] = useState(initial)
  const [error, setError] = useState('')

  const pump = async () => {
    if (busy.current) return
    busy.current = true
    try {
      while (desired.current !== confirmed.current) {
        const result = await publicArticles.setSaved(articleId, desired.current)
        confirmed.current = result.saved
        onSavedChange?.(result.saved)
      }
    } catch (e) {
      desired.current = confirmed.current
      setShown(confirmed.current)
      setError(readerErrorText(e, language, readerText(language)('saveError')))
    } finally {
      busy.current = false
    }
  }

  const setSaved = (value: boolean) => {
    desired.current = value
    setShown(value)
    setError('')
    void pump()
  }
  return { saved, error, setSaved, toggle: () => setSaved(!desired.current) }
}

type Props = { articleId: string; saved: boolean; language?: Language; withText?: boolean; className?: string; onSavedChange?: (saved: boolean) => void }

/** Heart toggle with `aria-pressed`; the error shows right under the button. Remount (key) when the article changes. */
export function ArticleSaveButton({ articleId, saved: initial, language = 'vi', withText = false, className, onSavedChange }: Props) {
  const { saved, error, toggle } = useSavedState(articleId, initial, language, onSavedChange)
  return <SaveToggle saved={saved} error={error} onToggle={toggle} language={language} withText={withText} className={className} />
}

type ToggleProps = { saved: boolean; error: string; onToggle: () => void; language?: Language; withText?: boolean; className?: string; autoFocus?: boolean }
/** Presentational heart button + inline error; `/me/saved-articles` drives it from its own `useSavedState`. */
export function SaveToggle({ saved, error, onToggle: toggle, language = 'vi', withText = false, className, autoFocus }: ToggleProps) {
  const t = readerText(language)
  return <span className={cn('inline-flex flex-col items-start gap-1', className)}>
    <Button type="button" variant="outline" size={withText ? 'sm' : 'icon'} aria-pressed={saved} aria-label={t('saveLabel')} title={t('saveLabel')} onClick={toggle} autoFocus={autoFocus}
      className={cn('pointer-coarse:min-h-11 pointer-coarse:min-w-11', saved && 'border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg hover:bg-tone-rose-bg hover:text-tone-rose-fg')}>
      <Heart className={cn(saved && 'fill-current')} aria-hidden />
      {withText && <span>{saved ? t('saved') : t('save')}</span>}
    </Button>
    {error && <span role="alert" className="max-w-56 text-xs text-danger">{error}</span>}
  </span>
}
