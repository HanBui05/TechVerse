import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Pagination } from './Pagination'

afterEach(cleanup)

// Catch reversed direction and off-by-one errors in the shared zero-based API page index.
it('moves to adjacent and numbered zero-based pages and marks the current one', () => {
  const onPageChange = vi.fn()
  render(<Pagination page={2} totalPages={7} onPageChange={onPageChange} />)
  expect(screen.getByRole('button', { name: 'Trang 3' }).getAttribute('aria-current')).toBe('page')
  fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }))
  expect(onPageChange).toHaveBeenLastCalledWith(1)
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(onPageChange).toHaveBeenLastCalledWith(3)
  fireEvent.click(screen.getByRole('button', { name: 'Trang 7' }))
  expect(onPageChange).toHaveBeenLastCalledWith(6)
  expect(screen.getByText('Các trang khác')).not.toBeNull()
})

// Prevent duplicate page requests while an in-flight request is pending.
it('blocks every page while loading', () => {
  const onPageChange = vi.fn()
  render(<Pagination page={1} totalPages={3} loading onPageChange={onPageChange} language="en" />)
  for (const name of ['Previous page', 'Next page', 'Page 1', 'Page 3']) fireEvent.click(screen.getByRole('button', { name }))
  expect(onPageChange).not.toHaveBeenCalled()
})

it('does not request a page outside the bounds and hides itself for a single page', () => {
  const onPageChange = vi.fn()
  const { rerender } = render(<Pagination page={0} totalPages={2} onPageChange={onPageChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }))
  rerender(<Pagination page={1} totalPages={2} onPageChange={onPageChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(onPageChange).not.toHaveBeenCalled()
  rerender(<Pagination page={0} totalPages={1} onPageChange={onPageChange} />)
  expect(screen.queryByRole('navigation')).toBeNull()
})
