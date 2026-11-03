import { useEffect, useState } from 'react'

// A brand icon from simple-icons: the slug is what the API stores (topics.icon).
export type BrandIcon = { slug: string; title: string; hex: string; path: string }
export type IconMap = Map<string, BrandIcon>

const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
// Brands removed from simple-icons (trademark requests) map to the closest logo that still exists.
const ALIASES: Record<string, string> = { java: 'openjdk' }

// Exact slug/title first, then prefixes, then partial matches; shorter titles win ties.
export function searchIcons(icons: BrandIcon[], query: string, limit = 48): BrandIcon[] {
  const q = norm(query)
  if (!q) return []
  const rank = (icon: BrandIcon) => {
    const title = norm(icon.title)
    if (ALIASES[q] === icon.slug || icon.slug === q || title === q) return 0
    if (icon.slug.startsWith(q) || title.startsWith(q)) return 1
    return icon.slug.includes(q) || title.includes(q) ? 2 : -1
  }
  return icons.map(icon => [rank(icon), icon] as const).filter(([r]) => r >= 0)
    .sort(([a, x], [b, y]) => a - b || x.title.length - y.title.length).slice(0, limit).map(([, icon]) => icon)
}

// Shown before anything is typed, so the picker is never empty. Only slugs that exist in simple-icons (no AWS/Azure/C#/OpenAI logos there).
export const POPULAR = ('javascript typescript python openjdk kotlin go rust cplusplus c dotnet php ruby swift dart scala elixir haskell lua r '
  + 'react vuedotjs angular svelte nextdotjs nuxt astro tailwindcss bootstrap html5 css sass vite webpack nodedotjs deno bun express nestjs '
  + 'spring springboot django flask fastapi laravel rubyonrails graphql postgresql mysql mariadb mongodb redis sqlite elasticsearch apachekafka rabbitmq '
  + 'docker kubernetes terraform ansible linux ubuntu git github gitlab githubactions jenkins nginx googlecloud cloudflare vercel firebase supabase '
  + 'android ios flutter tensorflow pytorch jupyter pandas numpy anthropic figma jest vitest selenium postman jira').split(' ')

// Typed query: search everything. Otherwise logos matching the topic name first, then the popular set.
export function suggestIcons(icons: IconMap, query: string, name: string, limit = 120): BrandIcon[] {
  if (query.trim()) return searchIcons([...icons.values()], query, limit)
  const popular = POPULAR.map(slug => icons.get(slug)).filter((icon): icon is BrandIcon => !!icon)
  return [...new Set([...searchIcons([...icons.values()], name, limit), ...popular])].slice(0, limit)
}

// Brand colour unless it is near-black or near-white, which would vanish on one of the themes; then follow the text colour.
export function iconFill(hex: string): string {
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance < 0.05 || luminance > 0.85 ? 'currentColor' : `#${hex}`
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '').slice(0, 2)).toUpperCase()
}

// simple-icons is ~5 MB, so it is loaded once, lazily, only by pages that show topic icons.
let loading: Promise<IconMap> | null = null
const loadIcons = () => loading ??= import('simple-icons').then(module => new Map(Object.values(module as Record<string, unknown>)
  .filter((value: unknown): value is BrandIcon => typeof value === 'object' && value !== null && 'slug' in value && 'path' in value)
  .map(({ slug, title, hex, path }) => [slug, { slug, title, hex, path }])))

export function useBrandIcons(enabled = true): IconMap | null {
  const [icons, setIcons] = useState<IconMap | null>(null)
  useEffect(() => { if (enabled) void loadIcons().then(setIcons).catch(() => setIcons(new Map())) }, [enabled])
  return icons
}

// Brand logo on a neutral tile, or the topic's initials while icons load or when none is chosen.
export function TopicIcon({ icon, name, icons, className = 'size-11' }: { icon?: string | null; name: string; icons: IconMap | null; className?: string }) {
  const brand = icon ? icons?.get(icon) : undefined
  return <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground ${className}`}>
    {brand
      ? <svg viewBox="0 0 24 24" className="size-1/2" fill={iconFill(brand.hex)}><path d={brand.path} /></svg>
      : <span className="text-sm font-bold text-muted-foreground">{initials(name)}</span>}
  </span>
}
