import { describe, expect, it } from 'vitest'
import { statusTone, toneFor } from './utils'

describe('toneFor', () => {
  it('gives the same tone for the same name regardless of case and spacing', () => {
    expect(toneFor('  Spring Boot ')).toBe(toneFor('spring boot'))
    expect(toneFor('React')).toBe(toneFor('react'))
  })

  it('spreads names across colored tones and never returns the neutral slate', () => {
    const names = ['java', 'react', 'docker', 'spring', 'kotlin', 'go', 'rust', 'python', 'devops', 'ai', 'cloud', 'sql']
    const tones = new Set(names.map(toneFor))
    expect(tones.size).toBeGreaterThanOrEqual(4)
    expect(tones.has('slate')).toBe(false)
  })

  it('maps an empty name to the first colored tone', () => {
    expect(toneFor('')).toBe('blue')
  })
})

describe('statusTone', () => {
  it.each([
    ['PUBLISHED', 'green'], ['APPROVED', 'green'],
    ['PENDING', 'amber'], ['CHANGES_REQUESTED', 'sky'],
    ['REJECTED', 'rose'], ['REMOVED', 'rose'], ['SUSPENDED', 'rose'],
    ['DRAFT', 'slate'], ['HIDDEN', 'slate'], ['NOT_APPLIED', 'slate'],
  ] as const)('%s → %s', (status, tone) => {
    expect(statusTone(status)).toBe(tone)
  })

  it('falls back to slate for unknown statuses', () => {
    expect(statusTone('SOMETHING_NEW')).toBe('slate')
  })
})
