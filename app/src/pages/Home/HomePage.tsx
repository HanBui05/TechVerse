import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toneFor } from '@/lib/utils'
import type { Translation } from '../../data/i18n'

// Tones come from the shared toneFor so a tag has the same color here and on article pages.
const techTags = ['Git & GitHub', 'Spring Boot', 'Docker', 'Artificial Intelligence', 'Backend Development']

// Enter animation in steps, as before; motion-reduce turns it off.
const enter = 'animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-500 motion-reduce:animate-none'

export function HomePage({ t }: { t: Translation }) {
  return <main className="tw-page min-h-svh">
    <section className="bg-card px-6 py-16 text-center sm:px-12 sm:py-24 lg:py-32">
      <div className="mx-auto flex max-w-3xl flex-col items-center">
        <span className={`${enter} inline-flex items-center gap-2 rounded-full border border-accent-text/30 bg-accent-text/15 px-3 py-2 text-[13px] font-bold text-accent-text`}>✦ {t.welcome}</span>
        <h1 className={`${enter} delay-75 mt-6 mb-5 text-3xl font-bold sm:text-4xl lg:text-5xl`}>{t.heroTitle} <span className="text-accent-text">TechVerse</span></h1>
        <p className={`${enter} delay-150 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg`}>{t.heroDescription}</p>
        <div className={`${enter} delay-200 mt-8 flex w-full flex-wrap justify-center gap-3`}>
          <Button asChild size="lg" className="max-sm:w-full"><Link to="/courses">{t.explore} <ArrowRight /></Link></Button>
          <Button asChild size="lg" variant="outline" className="max-sm:w-full"><Link to="/interview">{t.interview} <ArrowRight /></Link></Button>
        </div>
        <ul className={`${enter} delay-300 m-0 mt-7 flex list-none flex-wrap justify-center gap-2.5 p-0`}>
          {techTags.map(label => <li key={label}><Badge tone={toneFor(label)} className="gap-2 px-3.5 py-2 text-[13px] font-semibold"><span aria-hidden className="size-1.5 rounded-full bg-current" />{label}</Badge></li>)}
        </ul>
      </div>
    </section>
  </main>
}
