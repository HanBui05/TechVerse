import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from 'cn'

export function SettingsLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="tw-page mx-auto flex min-h-svh w-full max-w-4xl flex-col gap-6 px-6 py-8 lg:px-8">
    <header className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[.05em] text-accent-text">TechVerse preferences</span>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </header>
    <div className="grid gap-4 sm:grid-cols-2">{children}</div>
  </main>
}

// Selectable option card shared by the theme and language pages; aria-pressed carries the selected state.
export function PreferenceOption({ selected, onSelect, icon, title, description }: { selected: boolean; onSelect: () => void; icon: ReactNode; title: ReactNode; description: string }) {
  return <button type="button" aria-pressed={selected} onClick={onSelect}
    className={cn('relative flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left text-card-foreground shadow-sm transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring pointer-coarse:min-h-11',
      selected && 'border-primary')}>
    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-xl" aria-hidden="true">{icon}</span>
    <span className="flex min-w-0 flex-col gap-1"><strong className="text-sm font-semibold">{title}</strong><small className="text-xs text-muted-foreground">{description}</small></span>
    {selected && <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true"><Check size={12} /></span>}
  </button>
}
