import type { ComponentType, ReactNode } from 'react'
import { cn } from 'cn'

type EmptyStateProps = {
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

/** Presentational empty/zero-result block; callers pass all copy and the optional action. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return <div role="status" className={cn('flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center', className)}>
    {Icon && <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><Icon aria-hidden className="size-6" /></span>}
    <p data-slot="empty-state-title" className="text-base font-bold text-foreground">{title}</p>
    {description && <p data-slot="empty-state-description" className="max-w-md text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
}
