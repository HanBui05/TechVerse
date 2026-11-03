import { CircleHelp, ArrowRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { navItems } from '../data/navigation'
import type { Translation } from '../data/i18n'
import type { Language } from '../types/preferences'

export function PlaceholderPage({ t, language }: { t: Translation; language: Language }) { const location = useLocation(); const item = navItems.find(item => item.path === location.pathname); const pageName = item?.label[language] || (language === 'vi' ? 'Trang' : 'Page'); return <main className="tw-page flex min-h-svh flex-col items-center justify-center gap-4 p-10 text-center">
    <div className="flex size-13 items-center justify-center rounded-xl border border-tone-sky-border bg-tone-sky-bg text-accent-text" aria-hidden="true"><CircleHelp size={28} /></div>
    <span className="text-xs font-extrabold tracking-wider text-accent-text uppercase">{t.workspace}</span>
    <h1 className="text-3xl font-bold sm:text-4xl">{pageName}</h1>
    <p className="max-w-lg leading-relaxed text-muted-foreground">{t.developing}</p>
    <Button asChild className="mt-2"><Link to="/">{t.backHome} <ArrowRight /></Link></Button>
  </main> }
