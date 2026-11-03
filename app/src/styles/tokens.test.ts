import { describe, expect, it } from 'vitest'
import css from './tokens.css?raw'

const cssFiles = import.meta.glob<string>(['./**/*.css', '../styles.css'], { query: '?raw', import: 'default', eager: true })

function block(selector: string) {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`missing ${selector}`)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start))
  return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}

const dark = block(':root')
const light = { ...dark, ...block(":root[data-theme='light']") }

function resolve(vars: Record<string, string>, name: string, depth = 0): string {
  const value = vars[name]
  if (value === undefined) throw new Error(`undefined token ${name}`)
  const ref = /^var\((--[\w-]+)\)$/.exec(value)
  return ref && depth < 10 ? resolve(vars, ref[1], depth + 1) : value
}

type Rgba = [number, number, number, number]
function rgba(hex: string): Rgba {
  const h = hex.replace('#', '')
  if (!/^([0-9a-f]{6}|[0-9a-f]{8})$/i.test(h)) throw new Error(`not a #rrggbb[aa] color: ${hex}`)
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16)
  return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1]
}
function over([r, g, b, a]: Rgba, [br, bg, bb]: Rgba): Rgba {
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1]
}
function luminance([r, g, b]: Rgba) {
  const c = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)
}
function contrast(fg: Rgba, bg: Rgba) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x)
  return (a + 0.05) / (b + 0.05)
}
/** fg on bg, where bg may be translucent over `base`. */
function ratio(vars: Record<string, string>, fg: string, bg: string, base = '--background') {
  const ground = rgba(resolve(vars, base))
  return contrast(over(rgba(resolve(vars, fg)), ground), over(rgba(resolve(vars, bg)), ground))
}

const themes = { dark, light } as const

describe('shadcn token values', () => {
  const expected: Record<string, [string, string]> = {
    '--background': ['#0f172a', '#ffffff'],
    '--foreground': ['#f1f5f9', '#111827'],
    '--card': ['#1e293b', '#f9fafb'],
    '--popover': ['#1e293b', '#f9fafb'],
    '--card-foreground': ['#f1f5f9', '#111827'],
    '--popover-foreground': ['#f1f5f9', '#111827'],
    '--secondary': ['#334155', '#f3f4f6'],
    '--muted': ['#334155', '#f3f4f6'],
    '--accent': ['#334155', '#f3f4f6'],
    '--secondary-foreground': ['#f1f5f9', '#111827'],
    '--accent-foreground': ['#f1f5f9', '#111827'],
    '--muted-foreground': ['#a8b4c8', '#4b5563'],
    '--border': ['#334155', '#e5e7eb'],
    '--input': ['#334155', '#e5e7eb'],
    '--primary': ['#0056d2', '#0056d2'],
    '--primary-foreground': ['#ffffff', '#ffffff'],
    '--ring': ['#38bdf8', '#0056d2'],
    '--destructive': ['#b91c1c', '#b91c1c'],
    '--destructive-foreground': ['#ffffff', '#ffffff'],
  }
  it.each(Object.entries(expected))('%s matches the spec in dark and light', (token, [d, l]) => {
    expect(resolve(dark, token).toLowerCase()).toBe(d)
    expect(resolve(light, token).toLowerCase()).toBe(l)
  })

  it('keeps the radius and Inter font', () => {
    expect(dark['--radius']).toBe('0.625rem')
    expect(dark['--font-sans']).toMatch(/^'Inter'/)
  })
})

const pairs: [string, string][] = [
  ['--foreground', '--background'],
  ['--card-foreground', '--card'],
  ['--popover-foreground', '--popover'],
  ['--secondary-foreground', '--secondary'],
  ['--accent-foreground', '--accent'],
  ['--muted-foreground', '--background'],
  ['--muted-foreground', '--card'],
  ['--muted-foreground', '--muted'],
  ['--primary-foreground', '--primary'],
  ['--destructive-foreground', '--destructive'],
  ['--ring', '--background'],
]

describe.each(Object.entries(themes))('%s text pairs reach WCAG AA', (_theme, vars) => {
  it.each(pairs.map(([fg, bg]) => [`${fg} / ${bg} = ${ratio(vars, fg, bg).toFixed(2)}:1`, fg, bg]))('%s', (_name, fg, bg) => {
    expect(ratio(vars, fg, bg)).toBeGreaterThanOrEqual(4.5)
  })
})

const tones = ['blue', 'green', 'purple', 'amber', 'rose', 'sky', 'cyan', 'slate']

describe.each(Object.entries(themes))('%s badge tones reach WCAG AA on every surface', (_theme, vars) => {
  // Translucent dark tone fills sit on background, card or surface-2; take the worst case.
  const worst = (tone: string) => Math.min(...['--background', '--card', '--secondary'].map((base) =>
    ratio(vars, `--tone-${tone}-fg`, `--tone-${tone}-bg`, base)))
  it.each(tones.map((tone) => [`${tone} = ${worst(tone).toFixed(2)}:1`, tone]))('%s', (_name, tone) => {
    expect(resolve(vars, `--tone-${tone}-border`)).toMatch(/^#/)
    expect(worst(tone)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('theme selector', () => {
  it('uses data-theme only, never a .dark class', () => {
    expect(Object.keys(cssFiles)).toContain('../styles.css')
    for (const [file, text] of Object.entries(cssFiles)) expect(text, file).not.toMatch(/\.dark\b/)
  })
})
