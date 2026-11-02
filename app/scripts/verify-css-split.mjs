// Usage (from app/): node scripts/verify-css-split.mjs capture|compare src/styles.css
// capture: save the CSS inventory to the OS temp dir. compare: re-read the entry (local @imports are
// expanded in place) and require the same multiset of (at-rule context, selector, declaration) plus the
// same relative order of rules that share a context + selector. Uses postcss from Vite's dependency tree.
import postcss from 'postcss'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const snapshot = join(tmpdir(), 'techverse-css-split-inventory.json')
const norm = text => text.replace(/\s+/g, ' ').trim()

function splitSelectors(selector) {
  const parts = []
  let depth = 0
  let start = 0
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i]
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === ',' && depth === 0) { parts.push(selector.slice(start, i)); start = i + 1 }
  }
  parts.push(selector.slice(start))
  return parts.map(norm).filter(Boolean)
}

function inventory(entryFile) {
  const counts = new Map()
  const order = new Map()
  const bump = (map, key, value) => map.set(key, (map.get(key) ?? 0) + value)

  const record = (ctx, selectors, decls) => {
    const signature = decls.join(';')
    for (const selector of selectors) {
      for (const decl of decls) bump(counts, `${ctx}||${selector}||${decl}`, 1)
      const key = `${ctx}||${selector}`
      order.set(key, [...(order.get(key) ?? []), signature])
    }
  }

  const walk = (file, ctx) => {
    const root = postcss.parse(readFileSync(file, 'utf8'), { from: file })
    const visit = (parent, context) => parent.each(node => {
      if (node.type === 'atrule' && node.name === 'import') {
        const target = norm(node.params)
        const quoted = target.match(/^["'](.+)["']$/)
        if (quoted) walk(resolve(dirname(file), quoted[1]), context)
        else bump(counts, `${context}||@import||${target}`, 1)
      } else if (node.type === 'atrule') {
        const nested = `${context} @${node.name} ${norm(node.params)}`.trim()
        const decls = (node.nodes ?? []).filter(child => child.type === 'decl').map(declText)
        if (decls.length) record(nested, [''], decls)
        visit(node, nested)
      } else if (node.type === 'rule') {
        record(context, splitSelectors(node.selector), (node.nodes ?? []).filter(child => child.type === 'decl').map(declText))
      }
    })
    visit(root, ctx)
  }
  const declText = d => `${d.prop.toLowerCase()}:${norm(d.value)}${d.important ? ' !important' : ''}`
  walk(resolve(entryFile), '')
  return { counts: Object.fromEntries(counts), order: Object.fromEntries(order) }
}

const [mode, entry] = process.argv.slice(2)
if (!['capture', 'compare'].includes(mode) || !entry) {
  console.error('usage: node scripts/verify-css-split.mjs capture|compare <entry.css>')
  process.exit(2)
}
const current = inventory(entry)
if (mode === 'capture') {
  writeFileSync(snapshot, JSON.stringify(current))
  console.log(`captured ${Object.keys(current.counts).length} distinct declarations, ${Object.keys(current.order).length} selector contexts -> ${snapshot}`)
  process.exit(0)
}

const base = JSON.parse(readFileSync(snapshot, 'utf8'))
const countDiffs = []
for (const key of new Set([...Object.keys(base.counts), ...Object.keys(current.counts)])) {
  const before = base.counts[key] ?? 0
  const after = current.counts[key] ?? 0
  if (before !== after) countDiffs.push(`${before} -> ${after}  ${key}`)
}
const orderDiffs = []
for (const key of new Set([...Object.keys(base.order), ...Object.keys(current.order)])) {
  if (JSON.stringify(base.order[key] ?? []) !== JSON.stringify(current.order[key] ?? [])) orderDiffs.push(key)
}
console.log(`declaration multiset differences: ${countDiffs.length}`)
console.log(`relative-order differences: ${orderDiffs.length}`)
for (const line of [...countDiffs, ...orderDiffs].slice(0, 20)) console.log(`  ${line}`)
process.exit(countDiffs.length || orderDiffs.length ? 1 : 0)
