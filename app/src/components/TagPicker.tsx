import { useId, useState } from 'react'
import { Check, Search, Tag, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toneFor } from '@/lib/utils'
import type { Language } from '../types/preferences'

type Option = { id: string; name: string }
type Props = { options: Option[]; selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean; language?: Language }

const copy = {
  vi: { label: 'Thẻ', search: 'Tìm thẻ', placeholder: 'Tìm thẻ, ví dụ: Java, Docker...', none: 'Chưa chọn thẻ', remove: 'Bỏ thẻ', fallback: 'Thẻ đã chọn', empty: 'Không tìm thấy thẻ phù hợp.', full: 'Đã đủ 10 thẻ. Bỏ một thẻ để chọn thẻ khác.', options: 'Danh sách thẻ' },
  en: { label: 'Tags', search: 'Search tags', placeholder: 'Search tags, e.g. Java, Docker...', none: 'No tags selected', remove: 'Remove tag', fallback: 'Selected tag', empty: 'No matching tags.', full: '10 tags selected. Remove one to pick another.', options: 'Tag list' },
}

// Chuẩn hóa từ khóa để tìm tên thẻ có hoặc không có dấu tiếng Việt.
const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi-VN')

// Chọn tối đa 10 thẻ bằng tìm kiếm/checkbox và giữ lựa chọn dưới dạng chip dễ xóa.
export function TagPicker({ options, selected, onChange, disabled = false, language = 'vi' }: Props) {
  const t = copy[language]
  const [query, setQuery] = useState('')
  const id = useId()
  const filtered = options.filter(option => normalize(option.name).includes(normalize(query.trim())))
  const name = (tagId: string) => options.find(option => option.id === tagId)?.name || t.fallback

  // Cập nhật ID thẻ, không để chọn trùng hoặc vượt giới hạn của backend.
  const toggle = (tagId: string) => {
    if (disabled) return
    if (selected.includes(tagId)) onChange(selected.filter(value => value !== tagId))
    else if (selected.length < 10) onChange([...selected, tagId])
  }

  return <div role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-2">
      <span id={`${id}-label`} className="text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">{t.label}</span>
      <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">{selected.length}/10</span>
    </div>
    <div className="flex flex-wrap gap-1.5">
      {selected.length ? selected.map(tagId => <Badge key={tagId} tone={toneFor(name(tagId))} className="max-w-full shrink gap-1 whitespace-normal pr-0.5 [overflow-wrap:anywhere]">
        <Tag aria-hidden />{name(tagId)}
        <button type="button" disabled={disabled} aria-label={`${t.remove} ${name(tagId)}`} onClick={() => toggle(tagId)} className="inline-flex size-5 items-center justify-center rounded-full border-0 bg-transparent text-current outline-none hover:bg-background/40 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:min-w-11"><X aria-hidden /></button>
      </Badge>) : <span className="text-sm text-muted-foreground">{t.none}</span>}
    </div>
    <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" aria-label={t.search} placeholder={t.placeholder} value={query} disabled={disabled} onChange={event => setQuery(event.target.value)} className="pl-9 pointer-coarse:min-h-11" />
    </div>
    <div role="region" aria-label={t.options} tabIndex={0} className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto overscroll-contain rounded-md outline-none [scrollbar-width:thin] focus-visible:ring-2 focus-visible:ring-ring">
      {filtered.map(option => {
        const on = selected.includes(option.id)
        return <button type="button" role="checkbox" aria-checked={on} aria-label={option.name} key={option.id} disabled={disabled || (!on && selected.length >= 10)} onClick={() => toggle(option.id)}
          className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 pointer-coarse:min-h-11 ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted'}`}>
          {on && <Check aria-hidden className="size-3" />}{option.name}
        </button>
      })}
      {!filtered.length && <p className="text-sm text-muted-foreground">{t.empty}</p>}
    </div>
    {selected.length >= 10 && <small className="text-xs text-muted-foreground">{t.full}</small>}
  </div>
}
