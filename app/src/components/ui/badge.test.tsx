import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from './badge'

describe('Badge tone', () => {
  it('uses the tone tokens instead of the primary fill', () => {
    render(<Badge tone="purple">Java</Badge>)
    const badge = screen.getByText('Java')
    expect(badge.className).toContain('bg-tone-purple-bg')
    expect(badge.className).toContain('text-tone-purple-fg')
    expect(badge.className).toContain('border-tone-purple-border')
    expect(badge.className).not.toContain('bg-primary')
    expect(badge.getAttribute('data-tone')).toBe('purple')
  })

  it('keeps the default variant when no tone is given', () => {
    render(<Badge>Plain</Badge>)
    expect(screen.getByText('Plain').className).toContain('bg-primary')
  })
})
