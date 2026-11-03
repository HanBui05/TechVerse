import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminPagination, pageItems } from './AdminPagination'

afterEach(cleanup)

describe('pageItems', () => {
  it('lists every page when there are few', () => {
    expect(pageItems(0, 1)).toEqual([0])
    expect(pageItems(2, 5)).toEqual([0, 1, 2, 3, 4])
  })
  it('keeps first, last and the neighbours of the current page, with gaps between', () => {
    expect(pageItems(0, 10)).toEqual([0, 1, 'gap', 9])
    expect(pageItems(5, 10)).toEqual([0, 'gap', 4, 5, 6, 'gap', 9])
    expect(pageItems(9, 10)).toEqual([0, 'gap', 8, 9])
    expect(pageItems(2, 10)).toEqual([0, 1, 2, 3, 'gap', 9])
  })
})

describe('AdminPagination', () => {
  it('summarises the visible range and jumps to a numbered page', async () => {
    const onPageChange = vi.fn()
    render(<AdminPagination language="vi" page={0} size={12} total={30} onPageChange={onPageChange} />)
    expect(screen.getByText('Hiển thị 1–12 trong 30')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Trang 1' }).getAttribute('aria-current')).toBe('page')
    expect((screen.getByRole('button', { name: 'Trang trước' }) as HTMLButtonElement).disabled).toBe(true)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Trang 3' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('shows the last partial range in English and disables next on the last page', () => {
    render(<AdminPagination language="en" page={2} size={12} total={30} onPageChange={() => {}} />)
    expect(screen.getByText('Showing 25–30 of 30')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled).toBe(true)
  })

  // Narrow screens get a compact "current / total" between the arrows; numbered buttons are for sm and up.
  it('offers a compact page indicator for narrow screens', () => {
    render(<AdminPagination language="vi" page={4} size={12} total={120} onPageChange={() => {}} />)
    expect(screen.getByText('5 / 10')).toBeTruthy()
  })

  it('renders nothing when the list is empty', () => {
    const { container } = render(<AdminPagination language="vi" page={0} size={12} total={0} onPageChange={() => {}} />)
    expect(container.textContent).toBe('')
  })
})
