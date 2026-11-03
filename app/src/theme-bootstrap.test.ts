import { expect, it } from 'vitest'
import html from '../index.html?raw'

// index.html applies the saved theme before React renders, so light users do not see a dark flash.
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1])

function run(stored: string | null | 'throws') {
  const documentElement = { dataset: {} as Record<string, string> }
  const localStorage = { getItem: () => { if (stored === 'throws') throw new Error('blocked'); return stored } }
  new Function('localStorage', 'document', inline[0])(localStorage, { documentElement })
  return documentElement.dataset.theme
}

it('ships exactly one inline bootstrap script ahead of the React module', () => {
  expect(inline).toHaveLength(1)
  expect(html.indexOf(inline[0])).toBeLessThan(html.indexOf('type="module"'))
})

it.each([
  ['light', 'light'],
  ['dark', 'dark'],
  [null, 'dark'],
  ['blue', 'dark'],
  ['throws', 'dark'],
] as const)('stored %s applies %s', (stored, expected) => {
  expect(run(stored)).toBe(expected)
})

it('keeps the old hardcoded dark theme-color out of the document', () => {
  expect(html).not.toMatch(/theme-color/)
})
