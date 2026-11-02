import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from './HomePage'
import { copy } from '../../data/i18n'

afterEach(cleanup)
const renderHome = (language: 'vi' | 'en' = 'vi') => render(<MemoryRouter><HomePage t={copy[language]} /></MemoryRouter>)

// The home page must not advertise features that do not exist yet.
it('has no placeholder cards, empty course section or community links', () => {
  const { container } = renderHome()
  for (const text of ['FEATURED CONTENT', 'TechVerse journal', 'Khóa học nổi bật', 'GitHub Community', 'Discord Community', 'Đang cập nhật']) {
    expect(screen.queryByText(new RegExp(text, 'i'))).toBeNull()
  }
  expect(container.querySelector('.hero-aside, .community-grid, .courses-section, .course-empty, .blog-card')).toBeNull()
  expect(screen.queryAllByRole('link').map(link => link.getAttribute('href'))).not.toContain('https://github.com/HanBui05/TechVerse')
})

it('keeps one hero with the title, a fuller description and both actions', () => {
  renderHome()
  const heading = screen.getByRole('heading', { level: 1 })
  expect(heading.textContent).toContain(copy.vi.heroTitle)
  expect(heading.querySelector('span')?.textContent).toBe('TechVerse')
  expect(screen.getByText(copy.vi.heroDescription)).not.toBeNull()
  expect(screen.getByRole('link', { name: new RegExp(copy.vi.explore) }).getAttribute('href')).toBe('/courses')
  expect(screen.getByRole('link', { name: new RegExp(copy.vi.interview) }).getAttribute('href')).toBe('/interview')
})

it.each(['vi', 'en'] as const)('has a longer %s hero description', language => {
  expect(copy[language].heroDescription.length).toBeGreaterThanOrEqual(150)
})

it('gives each technology tag its own tone', () => {
  const { container } = renderHome()
  const tags = [...container.querySelectorAll<HTMLElement>('.tech-tag')]
  expect(tags.map(tag => tag.textContent)).toEqual(['Git & GitHub', 'Spring Boot', 'Docker', 'Artificial Intelligence', 'Backend Development'])
  expect(tags.map(tag => tag.dataset.tone)).toEqual(['blue', 'green', 'violet', 'amber', 'rose'])
})
