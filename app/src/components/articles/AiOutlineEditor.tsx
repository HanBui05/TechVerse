import { useEffect, useId, useRef } from 'react'
import { ArrowDown, ArrowUp, Check, Plus, Tag, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toneFor } from '@/lib/utils'
import { aiText } from '../../data/aiAssistI18n'
import { outlineErrors, type OutlineDraft } from '../../services/aiAssistService'
import type { ArticleOption } from '../../types/articles'
import type { Language } from '../../types/preferences'

type Props = { value: OutlineDraft; tags: ArticleOption[]; onChange: (next: OutlineDraft) => void; showErrors: boolean; disabled?: boolean; language: Language }

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
const label = 'text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground'
const MAX_TAGS = 10
const move = <T,>(list: T[], from: number, to: number) => { const next = [...list]; next.splice(to, 0, next.splice(from, 1)[0]); return next }

/** Outline step: title/summary, suggested tags (≤10 total), H2/H3 add/delete and keyboard-only ↑/↓ reorder (no drag). */
export function AiOutlineEditor({ value, tags, onChange, showErrors, disabled = false, language }: Props) {
  const t = aiText(language)
  const uid = useId()
  const root = useRef<HTMLDivElement>(null)
  const refocus = useRef<{ key: string; dir: 'up' | 'down' } | null>(null)
  const errors = showErrors ? outlineErrors(value) : {}
  const name = (id: string) => tags.find(tag => tag.id === id)?.name
  const suggestions = value.suggestedTagIds.filter(id => name(id))
  const full = value.tagIds.length >= MAX_TAGS

  // After a reorder keep focus on the pressed arrow of the moved item; at an edge that arrow is disabled, so take the other one.
  useEffect(() => {
    const target = refocus.current
    if (!target) return
    refocus.current = null
    const find = (dir: string) => root.current?.querySelector<HTMLButtonElement>(`[data-move="${dir}-${target.key}"]`)
    const button = find(target.dir)
    ;(button && !button.disabled ? button : find(target.dir === 'up' ? 'down' : 'up'))?.focus()
  })

  const set = (patch: Partial<OutlineDraft>) => onChange({ ...value, ...patch })
  const setSections = (sections: OutlineDraft['sections']) => set({ sections })
  const toggleTag = (id: string) => set({ tagIds: value.tagIds.includes(id) ? value.tagIds.filter(tag => tag !== id) : full ? value.tagIds : [...value.tagIds, id] })
  const described = (key: string) => errors[key] ? { 'aria-invalid': true, 'aria-describedby': `${uid}-${key}-error` } : {}
  const error = (key: string) => errors[key] && <p id={`${uid}-${key}-error`} className="text-xs text-danger">{t(errors[key])}</p>

  const arrows = (key: string, itemName: string, index: number, count: number, onMove: (to: number) => void, onRemove: () => void) => <div className="flex shrink-0 gap-1">
    <Button type="button" size="icon" variant="outline" className={touch} data-move={`up-${key}`} disabled={disabled || index === 0} aria-label={t('moveUp', { name: itemName })}
      onClick={() => { refocus.current = { key: key.replace(/\d+$/, String(index - 1)), dir: 'up' }; onMove(index - 1) }}><ArrowUp /></Button>
    <Button type="button" size="icon" variant="outline" className={touch} data-move={`down-${key}`} disabled={disabled || index === count - 1} aria-label={t('moveDown', { name: itemName })}
      onClick={() => { refocus.current = { key: key.replace(/\d+$/, String(index + 1)), dir: 'down' }; onMove(index + 1) }}><ArrowDown /></Button>
    <Button type="button" size="icon" variant="ghost" className={`text-danger ${touch}`} disabled={disabled} aria-label={t('remove', { name: itemName })} onClick={onRemove}><Trash2 /></Button>
  </div>

  return <div ref={root} className="flex flex-col gap-4">
    <div className="flex flex-col gap-2">
      <div className="flex justify-between gap-2"><Label htmlFor={`${uid}-title`} className={label}>{t('outlineTitle')} *</Label><span className="text-xs tabular-nums text-muted-foreground">{value.title.length}/255</span></div>
      <Input id={`${uid}-title`} value={value.title} maxLength={255} readOnly={disabled} className={touch} onChange={e => set({ title: e.target.value })} {...described('title')} />
      {error('title')}
    </div>
    <div className="flex flex-col gap-2">
      <div className="flex justify-between gap-2"><Label htmlFor={`${uid}-summary`} className={label}>{t('summary')} *</Label><span className="text-xs tabular-nums text-muted-foreground">{value.summary.length}/500</span></div>
      <Textarea id={`${uid}-summary`} rows={3} maxLength={500} readOnly={disabled} value={value.summary} onChange={e => set({ summary: e.target.value })} {...described('summary')} />
      {error('summary')}
    </div>

    <div role="group" aria-labelledby={`${uid}-tags`} className="flex flex-col gap-2">
      <span id={`${uid}-tags`} className={label}>{t('tags')} ({value.tagIds.length}/{MAX_TAGS})</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.tagIds.filter(id => !suggestions.includes(id)).map(id => <Badge key={id} tone={toneFor(name(id) ?? id)} className="max-w-full gap-1 whitespace-normal pr-0.5 [overflow-wrap:anywhere]">
          <Tag aria-hidden />{name(id) ?? id}
          <button type="button" disabled={disabled} aria-label={t('removeTag', { name: name(id) ?? id })} onClick={() => toggleTag(id)} className={`inline-flex size-5 items-center justify-center rounded-full border-0 bg-transparent text-current outline-none hover:bg-background/40 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${touch}`}><X aria-hidden /></button>
        </Badge>)}
        {suggestions.length > 0 && <span className={`${label} ml-1`}>{t('suggested')}</span>}
        {suggestions.map(id => {
          const on = value.tagIds.includes(id)
          return <button type="button" role="checkbox" aria-checked={on} aria-label={name(id)} key={id} disabled={disabled || (!on && full)} onClick={() => toggleTag(id)}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${touch} ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted'}`}>
            {on ? <Check aria-hidden className="size-3" /> : <Plus aria-hidden className="size-3" />}{name(id)}
          </button>
        })}
      </div>
      {full && suggestions.length > 0 && <small className="text-xs text-muted-foreground">{t('tagsFull')}</small>}
    </div>

    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {value.sections.map((section, i) => {
        const sectionName = t('section', { n: i + 1 })
        const updateSection = (patch: Partial<typeof section>) => setSections(value.sections.map((s, k) => k === i ? { ...s, ...patch } : s))
        return <li key={i} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">{sectionName}</span>
            {arrows(`h-${i}`, sectionName, i, value.sections.length, to => setSections(move(value.sections, i, to)), () => setSections(value.sections.filter((_, k) => k !== i)))}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${uid}-h-${i}`} className="sr-only">{t('heading', { n: i + 1 })}</Label>
            <Input id={`${uid}-h-${i}`} value={section.heading} maxLength={120} readOnly={disabled} placeholder="H2" className={touch} onChange={e => updateSection({ heading: e.target.value })} {...described(`h-${i}`)} />
            {error(`h-${i}`)}
          </div>
          {section.subsections.map((sub, j) => {
            const subName = t('sub', { n: i + 1, m: j + 1 })
            return <div key={j} className="flex flex-col gap-1 sm:pl-6">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor={`${uid}-h-${i}-${j}`} className="sr-only">{subName}</Label>
                <Input id={`${uid}-h-${i}-${j}`} value={sub} maxLength={120} readOnly={disabled} placeholder="H3" className={`min-w-0 flex-1 basis-48 ${touch}`} onChange={e => updateSection({ subsections: section.subsections.map((s, k) => k === j ? e.target.value : s) })} {...described(`h-${i}-${j}`)} />
                {arrows(`h-${i}-${j}`, subName, j, section.subsections.length, to => updateSection({ subsections: move(section.subsections, j, to) }), () => updateSection({ subsections: section.subsections.filter((_, k) => k !== j) }))}
              </div>
              {error(`h-${i}-${j}`)}
            </div>
          })}
          <Button type="button" size="sm" variant="ghost" className={`self-start ${touch}`} disabled={disabled || section.subsections.length >= 4} onClick={() => updateSection({ subsections: [...section.subsections, ''] })}><Plus />{t('addSub')}</Button>
        </li>
      })}
    </ol>
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" size="sm" variant="outline" className={touch} disabled={disabled || value.sections.length >= 8} onClick={() => setSections([...value.sections, { heading: '', subsections: [] }])}><Plus />{t('addSection')}</Button>
      <span className="text-xs tabular-nums text-muted-foreground">{value.sections.length}/8</span>
      {error('sections')}
    </div>
  </div>
}
