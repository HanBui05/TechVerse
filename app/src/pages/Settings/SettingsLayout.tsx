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
    className={cn('relative flex cursor-pointer items-center gap-4 rounded-2xl border border-border/85 bg-card p-5 text-left text-card-foreground shadow-sm transition-all duration-200 outline-none hover:-translate-y-0.5 hover:border-accent-text/40 hover:bg-accent/50 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring pointer-coarse:min-h-11',
      selected && 'border-primary bg-primary/5 ring-1 ring-primary/30')}>
    <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted text-xl transition-colors', selected && 'border-primary/40 bg-primary/15 text-accent-text')} aria-hidden="true">{icon}</span>
    <span className="flex min-w-0 flex-col gap-1"><strong className="text-sm font-semibold">{title}</strong><small className="text-xs text-muted-foreground">{description}</small></span>
    {selected && <span className="absolute top-3.5 right-3.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs" aria-hidden="true"><Check size={12} /></span>}
  </button>
}
