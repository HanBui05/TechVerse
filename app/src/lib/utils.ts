import type { BadgeTone } from '@/components/ui/badge'

// Slate is reserved for neutral statuses, so names only hash into the colored tones.
const NAME_TONES: BadgeTone[] = ['blue', 'green', 'purple', 'amber', 'rose', 'sky', 'cyan']

/** Stable tone for a category/topic/tag name: same name, same tone on every page and language. */
export function toneFor(name: string): BadgeTone {
  let hash = 0
  for (const char of name.trim().toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return NAME_TONES[hash % NAME_TONES.length]
}

const STATUS_TONES: Record<string, BadgeTone> = {
  PUBLISHED: 'green',
  APPROVED: 'green',
  PENDING: 'amber',
  CHANGES_REQUESTED: 'sky',
  REJECTED: 'rose',
  REMOVED: 'rose',
  SUSPENDED: 'rose',
  DRAFT: 'slate',
  HIDDEN: 'slate',
  NOT_APPLIED: 'slate',
}

/** Semantic tone for an article/author status code. */
export function statusTone(status: string): BadgeTone {
  return STATUS_TONES[status] ?? 'slate'
}
