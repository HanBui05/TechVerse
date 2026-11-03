// Shared helpers for the TechVerse context hooks: find the active module and read log sections.
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()

// PLAN.md carries one line "Module đang làm: [slug](slug.md)"; "—" means no active module.
export function activeModule() {
  const plan = join(root, 'plans', 'PLAN.md')
  if (!existsSync(plan)) return null
  const line = readFileSync(plan, 'utf8').split(/\r?\n/).find(l => l.startsWith('Module đang làm:'))
  const slug = line?.match(/\(([a-z0-9-]+)\.md\)/)?.[1]
  if (!slug) return null
  const log = join(root, 'plans', `${slug}.log.md`)
  return { slug, spec: `plans/${slug}.md`, log: existsSync(log) ? log : null, logRel: `plans/${slug}.log.md` }
}

// Text of a "## <title...>" section up to the next "## " heading (title matched by prefix).
export function section(markdown, titlePrefix) {
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex(l => l.startsWith(`## ${titlePrefix}`))
  if (start < 0) return ''
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '))
  return lines.slice(start, end < 0 ? undefined : end).join('\n').trim()
}

// First n "### " entries of a section (newest-first journal).
export function firstEntries(sectionText, n) {
  const parts = sectionText.split(/\n(?=### )/)
  return [parts[0].split('\n')[0], ...parts.slice(1, n + 1)].join('\n').trim()
}
