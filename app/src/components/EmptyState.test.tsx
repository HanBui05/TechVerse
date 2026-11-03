import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Inbox } from 'lucide-react'
import { EmptyState } from './EmptyState'

afterEach(cleanup)

it('announces the title and description as a status', () => {
  render(<EmptyState icon={Inbox} title="Nothing here" description="Try again later." />)
  const status = screen.getByRole('status')
  expect(status.textContent).toContain('Nothing here')
  expect(status.textContent).toContain('Try again later.')
  expect(status.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
})

it('renders only what it is given: no action, description or icon by default', () => {
  render(<EmptyState title="Empty" />)
  const status = screen.getByRole('status')
  expect(status.textContent).toBe('Empty')
  expect(status.querySelector('svg')).toBeNull()
  expect(screen.queryByRole('button')).toBeNull()
})

it('renders the optional action', () => {
  render(<EmptyState title="Empty" action={<button>Reset</button>} />)
  expect(screen.getByRole('button', { name: 'Reset' })).not.toBeNull()
})

it('merges className instead of replacing its own', () => {
  render(<EmptyState title="Empty" className="extra" />)
  const status = screen.getByRole('status')
  expect(status.classList.contains('extra')).toBe(true)
  expect(status.classList.length).toBeGreaterThan(1)
})
