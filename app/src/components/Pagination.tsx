import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Language } from '../types/preferences'
import { Button } from '@/components/ui/button'
import { Pagination as Nav, PaginationContent, PaginationEllipsis, PaginationItem } from '@/components/ui/pagination'
import { pageItems } from '../pages/Admin/AdminPagination'

type Props = { language?: Language; page: number; totalPages: number; loading?: boolean; onPageChange: (page: number) => void }

const touch = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'

// Reader pagination ‹ 1 2 3 … 7 ›: zero-based API index, every page locked while a request is in flight; nothing for one page.
export function Pagination({ page, totalPages, loading = false, onPageChange, language = 'vi' }: Props) {
  if (totalPages <= 1) return null
  const vi = language === 'vi'
  const go = (target: number) => { if (!loading && target !== page && target >= 0 && target < totalPages) onPageChange(target) }
  return <Nav aria-label={vi ? 'Phân trang' : 'Pagination'} aria-busy={loading}>
    <PaginationContent>
      <PaginationItem><Button variant="ghost" size="icon" className={touch} aria-label={vi ? 'Trang trước' : 'Previous page'} disabled={page <= 0 || loading} onClick={() => go(page - 1)}><ChevronLeft /></Button></PaginationItem>
      {pageItems(page, totalPages).map((item, i) => <PaginationItem key={item === 'gap' ? `gap-${i}` : item}>
        {item === 'gap'
          ? <PaginationEllipsis label={vi ? 'Các trang khác' : 'More pages'} />
          : <Button variant={item === page ? 'default' : 'ghost'} size="icon" className={touch} aria-label={`${vi ? 'Trang' : 'Page'} ${item + 1}`} aria-current={item === page ? 'page' : undefined} aria-disabled={loading || undefined} onClick={() => go(item)}>{item + 1}</Button>}
      </PaginationItem>)}
      <PaginationItem><Button variant="ghost" size="icon" className={touch} aria-label={vi ? 'Trang sau' : 'Next page'} disabled={page >= totalPages - 1 || loading} onClick={() => go(page + 1)}><ChevronRight /></Button></PaginationItem>
    </PaginationContent>
  </Nav>
}
