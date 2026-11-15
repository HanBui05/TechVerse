import { GOOGLE_AUTH_URL } from '../services/authService'
import { rememberReturnTo } from '../services/returnTo'
import { Button } from '@/components/ui/button'

// OAuth must navigate the current browser to the backend, not call Google through fetch.
// `keep` (callback retry) leaves the remembered destination alone; any other click replaces or clears it.
export function GoogleAuthButton({ returnTo, keep = false }: { returnTo?: unknown; keep?: boolean }) {
  return <Button asChild variant="outline" size="lg" className="h-11 w-full text-base font-semibold">
    <a href={GOOGLE_AUTH_URL} onClick={() => { if (!keep) rememberReturnTo(returnTo) }}>
      <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background" aria-hidden="true">G</span>Google
    </a>
  </Button>
}
