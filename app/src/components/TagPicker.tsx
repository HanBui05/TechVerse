import { useId, useState } from 'react'
import { Check, Search, Tag, X } from 'lucide-react'

type Option = { id: string; name: string }
type Props = { options: Option[]; selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean }

// Chuẩn hóa từ khóa để tìm tên thẻ có hoặc không có dấu tiếng Việt.
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi-VN')

// Chọn tối đa 10 thẻ bằng tìm kiếm/checkbox và giữ lựa chọn dưới dạng chip dễ xóa.
export function TagPicker({ options, selected, onChange, disabled = false }: Props) {
  const [query, setQuery] = useState('')
  const id = useId()
  const filtered = options.filter(option => normalize(option.name).includes(normalize(query.trim())))

  // Cập nhật ID thẻ, không để chọn trùng hoặc vượt giới hạn của backend.
  const toggle = (tagId: string) => {
    if (disabled) return
    if (selected.includes(tagId)) onChange(selected.filter(value => value !== tagId))
    else if (selected.length < 10) onChange([...selected, tagId])
  }

  return <div className="tag-picker" role="group" aria-labelledby={`${id}-label`}>
    <div className="tag-picker-heading"><span id={`${id}-label`}>Thẻ <small>(chọn tối đa 10)</small></span><span className="tag-picker-count" aria-live="polite">{selected.length}/10</span></div>
    <div className="tag-picker-box">
      <div className="tag-picker-selected">
        {selected.length ? selected.map(tagId => <span className="tag-picker-chip" key={tagId}><Tag size={12} />{options.find(option => option.id === tagId)?.name || 'Thẻ đã chọn'}<button type="button" disabled={disabled} aria-label={`Bỏ thẻ ${options.find(option => option.id === tagId)?.name || tagId}`} onClick={() => toggle(tagId)}><X size={13} /></button></span>) : <span className="tag-picker-placeholder">Chọn thẻ để người đọc dễ tìm thấy bài viết</span>}
      </div>
      <label className="tag-picker-search"><Search size={16} /><span className="sr-only">Tìm thẻ</span><input type="search" placeholder="Tìm thẻ, ví dụ: Java, Docker..." value={query} disabled={disabled} onChange={event => setQuery(event.target.value)} /></label>
      <div className="tag-picker-options">
        {filtered.map(option => <button type="button" role="checkbox" aria-checked={selected.includes(option.id)} aria-label={option.name} disabled={disabled || (!selected.includes(option.id) && selected.length >= 10)} key={option.id} className={selected.includes(option.id) ? 'is-selected' : ''} onClick={() => toggle(option.id)}><span className="tag-picker-check" aria-hidden="true">{selected.includes(option.id) && <Check size={12} />}</span>{option.name}</button>)}
        {!filtered.length && <p>Không tìm thấy thẻ phù hợp.</p>}
      </div>
    </div>
    <small className="tag-picker-hint">{selected.length >= 10 ? 'Đã đủ 10 thẻ. Bỏ một thẻ để chọn thẻ khác.' : 'Chọn nhiều thẻ bằng cách bấm vào từng mục, không cần giữ Ctrl.'}</small>
  </div>
}
