import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BackToTopButton } from './BackToTopButton'

afterEach(() => { cleanup(); vi.restoreAllMocks(); Object.defineProperty(window, 'scrollY', { value: 0, configurable: true }) })

const scrollTo = (y: number) => act(() => { Object.defineProperty(window, 'scrollY', { value: y, configurable: true }); fireEvent.scroll(window) })

it('appears only after scrolling down and scrolls back to the top', () => {
  const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  render(<BackToTopButton label="Lên đầu trang" />)
  expect(screen.queryByRole('button', { name: 'Lên đầu trang' })).toBeNull()
  scrollTo(800)
  fireEvent.click(screen.getByRole('button', { name: 'Lên đầu trang' }))
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
  scrollTo(0)
  expect(screen.queryByRole('button', { name: 'Lên đầu trang' })).toBeNull()
})
