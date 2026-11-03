import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { copy } from '../data/i18n'
import { PlaceholderPage } from './PlaceholderPage'

afterEach(cleanup)

const renderAt = (path: string, language: 'vi' | 'en') => render(
  <MemoryRouter initialEntries={[path]}><PlaceholderPage t={copy[language]} language={language} /></MemoryRouter>,
)

it('names an unknown route generically and links back home', () => {
  renderAt('/courses', 'vi')
  expect(screen.getByRole('main')).not.toBeNull()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Trang')
  expect(screen.getByText(copy.vi.developing)).not.toBeNull()
  expect(screen.getByRole('link', { name: copy.vi.backHome }).getAttribute('href')).toBe('/')
})

it('uses the menu label of a known route in the current language', () => {
  renderAt('/blogs', 'en')
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Articles')
  expect(screen.getByText(copy.en.workspace)).not.toBeNull()
})
