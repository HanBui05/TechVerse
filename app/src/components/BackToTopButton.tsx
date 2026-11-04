import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Floating bottom-right “back to top”, shown once the page is scrolled past the first screen. `className` adjusts the offset (e.g. above a mobile action bar). */
export function BackToTopButton({ label, className = '' }: { label: string; className?: string }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const update = () => setShown(window.scrollY > 400)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  if (!shown) return null
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return <Button type="button" size="icon" aria-label={label} title={label} onClick={() => window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })}
    className={`fixed right-4 z-30 size-11 rounded-full shadow-lg sm:right-6 ${className || 'bottom-6'}`}><ArrowUp /></Button>
}
