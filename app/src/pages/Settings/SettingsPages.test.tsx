import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { copy } from '../../data/i18n'
import { ThemePage } from './ThemePage'
import { LanguagePage } from './LanguagePage'

const t = copy.vi
afterEach(cleanup)

it('marks the current theme as pressed and switches on click', async () => {
  const setTheme = vi.fn()
  render(<ThemePage theme="dark" setTheme={setTheme} t={t} />)
  expect(screen.getByRole('heading', { level: 1, name: t.themeTitle })).toBeTruthy()
  expect(screen.getByRole('button', { name: new RegExp(`^${t.dark}`) }).getAttribute('aria-pressed')).toBe('true')
  const light = screen.getByRole('button', { name: new RegExp(`^${t.light}`) })
  expect(light.getAttribute('aria-pressed')).toBe('false')
  await userEvent.setup().click(light)
  expect(setTheme).toHaveBeenCalledWith('light')
})

it('marks the current language as pressed and switches on click', async () => {
  const setLanguage = vi.fn()
  render(<LanguagePage language="vi" setLanguage={setLanguage} t={t} />)
  expect(screen.getByRole('button', { name: new RegExp(`^${t.vietnamese} VI`) }).getAttribute('aria-pressed')).toBe('true')
  const english = screen.getByRole('button', { name: new RegExp(`^${t.english} EN`) })
  expect(english.getAttribute('aria-pressed')).toBe('false')
  await userEvent.setup().click(english)
  expect(setLanguage).toHaveBeenCalledWith('en')
})
