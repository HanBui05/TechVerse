import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { Breadcrumb, BreadcrumbEllipsis } from './breadcrumb'
import { Dialog, DialogContent, DialogFooter, DialogTitle } from './dialog'
import { Pagination, PaginationEllipsis, PaginationNext, PaginationPrevious } from './pagination'
import { Sheet, SheetContent, SheetTitle } from './sheet'
import { Sidebar, SidebarProvider, SidebarRail, SidebarTrigger } from './sidebar'

// components/ui holds no copy: every visible or accessible label comes from the caller (vi/en).
const english = /Previous|Next|More|Close|Toggle Sidebar|Displays the mobile sidebar|aria-label="(pagination|breadcrumb)"/

afterEach(cleanup)

describe('primitives take their labels from the caller', () => {
  it('Pagination', () => {
    const { container } = render(
      <Pagination aria-label="Phân trang">
        <PaginationPrevious href="#" label="Trang trước" />
        <PaginationEllipsis label="Thêm trang" />
        <PaginationNext href="#" label="Trang sau" />
      </Pagination>,
    )
    expect(screen.getByRole('navigation', { name: 'Phân trang' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Trang trước' }).textContent).toContain('Trang trước')
    expect(screen.getByRole('link', { name: 'Trang sau' })).toBeTruthy()
    expect(container.textContent).toContain('Thêm trang')
    expect(container.innerHTML).not.toMatch(english)
  })

  it('Breadcrumb', () => {
    const { container } = render(<Breadcrumb aria-label="Đường dẫn"><BreadcrumbEllipsis label="Thêm" /></Breadcrumb>)
    expect(screen.getByRole('navigation', { name: 'Đường dẫn' })).toBeTruthy()
    expect(container.innerHTML).not.toMatch(english)
  })

  it('Dialog close buttons use closeLabel and are absent without it', () => {
    const { unmount } = render(
      <Dialog open>
        <DialogContent closeLabel="Đóng" aria-describedby={undefined}>
          <DialogTitle>Tiêu đề</DialogTitle>
          <DialogFooter closeLabel="Hủy" />
        </DialogContent>
      </Dialog>,
    )
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeTruthy()
    expect(document.body.innerHTML).not.toMatch(english)
    unmount()

    render(<Dialog open><DialogContent aria-describedby={undefined}><DialogTitle>Tiêu đề</DialogTitle></DialogContent></Dialog>)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('Sheet close button uses closeLabel', () => {
    render(<Sheet open><SheetContent closeLabel="Đóng" aria-describedby={undefined}><SheetTitle>Menu</SheetTitle></SheetContent></Sheet>)
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeTruthy()
    expect(document.body.innerHTML).not.toMatch(english)
  })

  describe('Sidebar', () => {
    const width = window.innerWidth
    afterEach(() => { window.innerWidth = width })

    it('trigger and rail use the given label', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar mobileTitle="Điều hướng"><SidebarRail label="Thu gọn menu" /></Sidebar>
          <SidebarTrigger label="Mở menu" />
        </SidebarProvider>,
      )
      expect(screen.getByRole('button', { name: 'Mở menu' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Thu gọn menu' })).toBeTruthy()
      expect(container.innerHTML).not.toMatch(english)
    })

    it('mobile sheet is titled by mobileTitle', async () => {
      window.innerWidth = 500
      render(
        <SidebarProvider>
          <Sidebar mobileTitle="Điều hướng"><p>menu</p></Sidebar>
          <SidebarTrigger label="Mở menu" />
        </SidebarProvider>,
      )
      await userEvent.click(screen.getByRole('button', { name: 'Mở menu' }))
      expect(screen.getByRole('dialog', { name: 'Điều hướng' })).toBeTruthy()
      expect(document.body.innerHTML).not.toMatch(english)
    })
  })
})
