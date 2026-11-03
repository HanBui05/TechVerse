import { describe, expect, it } from 'vitest'

const sources = import.meta.glob<string>(['./*.tsx', '!./*.test.tsx'], { query: '?raw', import: 'default', eager: true })

// Translucent ring colors drop the focus indicator below 3:1 (WCAG 1.4.11); aria-invalid ring colors
// are emitted after focus-visible and would override --ring on an invalid, focused control.
const faintRing = /(?:^|[\s"'`])(?:[\w-]+:)*ring-(?:ring|destructive|primary|sidebar-ring)\/\d+/
const invalidRing = /aria-invalid:ring-/

describe('focus ring in components/ui', () => {
  it('scans the generated primitives', () => {
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(20)
  })

  it.each(Object.entries(sources))('%s keeps a solid --ring focus color', (_file, text) => {
    expect(text).not.toMatch(faintRing)
    expect(text).not.toMatch(invalidRing)
  })
})
