import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Language } from '../../types/preferences'
import { Button } from '@/components/ui/button'
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from '@/components/ui/pagination'

type Props = { language: Language; page: number; size: number; total: number; loading?: boolean; onPageChange: (page: number) => void }

// Zero-based pages to show: first, last, current ±1; a 'gap' stands for two or more hidden pages (one hidden page is shown instead).
export function pageItems(current: number, totalPages: number): (number | 'gap')[] {
  const keep = [...new Set([0, current - 1, current, current + 1, totalPages - 1])].filter(p => p >= 0 && p < totalPages).sort((a, b) => a - b)
  const items: (number | 'gap')[] = []
  keep.forEach((p, i) => {
    const prev = keep[i - 1]
    if (prev !== undefined && p - prev === 2) items.push(prev + 1)
    else if (prev !== undefined && p - prev > 2) items.push('gap')
    items.push(p)
  })
  return items
}

// Admin list pagination: "Showing a–b of n" plus numbered pages (below lg, where the sidebar leaves little room: arrows around "current / total").
export function AdminPagination({ language, page, size, total, loading = false, onPageChange }: Props) {
  if (total <= 0) return null
  const vi = language === 'vi'
  const totalPages = Math.ceil(total / size)
  const from = page * size + 1, to = Math.min(total, (page + 1) * size)
  const nav = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'
  return <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
    <p className="text-sm text-muted-foreground">{vi ? `Hiển thị ${from}–${to} trong ${total}` : `Showing ${from}–${to} of ${total}`}</p>
    <Pagination aria-label={vi ? 'Phân trang' : 'Pagination'} className="mx-0 w-auto">
      <PaginationContent>
        <PaginationItem><Button variant="ghost" size="icon" className={nav} aria-label={vi ? 'Trang trước' : 'Previous page'} disabled={page <= 0 || loading} onClick={() => onPageChange(page - 1)}><ChevronLeft /></Button></PaginationItem>
        <PaginationItem className="px-2 text-sm font-semibold tabular-nums lg:hidden">{page + 1} / {totalPages}</PaginationItem>
        {pageItems(page, totalPages).map((item, i) => <PaginationItem key={item === 'gap' ? `gap-${i}` : item} className="max-lg:hidden">
          {item === 'gap'
            ? <PaginationEllipsis label={vi ? 'Các trang khác' : 'More pages'} />
            : <Button variant={item === page ? 'default' : 'ghost'} size="icon" className={nav} aria-label={`${vi ? 'Trang' : 'Page'} ${item + 1}`} aria-current={item === page ? 'page' : undefined} disabled={loading && item !== page} onClick={() => item !== page && onPageChange(item)}>{item + 1}</Button>}
        </PaginationItem>)}
        <PaginationItem><Button variant="ghost" size="icon" className={nav} aria-label={vi ? 'Trang sau' : 'Next page'} disabled={page >= totalPages - 1 || loading} onClick={() => onPageChange(page + 1)}><ChevronRight /></Button></PaginationItem>
      </PaginationContent>
    </Pagination>
  </div>
}
