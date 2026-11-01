import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Pagination } from './Pagination'

afterEach(cleanup)

// Catch reversed direction and off-by-one errors in the shared API page index.
it('moves to the adjacent zero-based page in both directions', () => {
  const onPageChange = vi.fn()
  render(<Pagination page={2} hasNext onPageChange={onPageChange} />)
  expect(screen.getByText('3')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }))
  expect(onPageChange).toHaveBeenLastCalledWith(1)
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(onPageChange).toHaveBeenLastCalledWith(3)
})

// Prevent duplicate page requests while an in-flight request is pending.
it('blocks both directions while loading', () => {
  const onPageChange = vi.fn()
  render(<Pagination page={1} hasNext loading onPageChange={onPageChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }))
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(onPageChange).not.toHaveBeenCalled()
})

it('does not request a page outside the first or last boundary', () => {
  const onPageChange = vi.fn()
  render(<Pagination page={0} hasNext={false} onPageChange={onPageChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }))
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(onPageChange).not.toHaveBeenCalled()
})
