import type { Language } from '../types/preferences'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = { language?: Language; page: number; hasNext: boolean; loading?: boolean; onPageChange: (page: number) => void }

// Phân trang dùng chung: giữ index API từ 0 và khóa nút khi tải hoặc đã chạm biên.
export function Pagination({ page, hasNext, loading = false, onPageChange, language = 'vi' }: Props) {
  const vi = language === 'vi'
  return <nav className="pagination" aria-label={vi ? 'Phân trang' : 'Pagination'} aria-busy={loading}>
    <button type="button" className="pagination-button" aria-label={vi ? 'Trang trước' : 'Previous page'} disabled={page <= 0 || loading} onClick={() => onPageChange(page - 1)}><ChevronLeft size={17} aria-hidden="true" /><span>{vi ? 'Trước' : 'Previous'}</span></button>
    <span className="pagination-current" aria-live="polite" aria-atomic="true">{vi ? 'Trang' : 'Page'} <strong>{page + 1}</strong></span>
    <button type="button" className="pagination-button" aria-label={vi ? 'Trang sau' : 'Next page'} disabled={!hasNext || loading} onClick={() => onPageChange(page + 1)}><span>{vi ? 'Tiếp' : 'Next'}</span><ChevronRight size={17} aria-hidden="true" /></button>
  </nav>
}
