import { GOOGLE_AUTH_URL } from '../services/authService'
import { Button } from '@/components/ui/button'

// OAuth must navigate the current browser to the backend, not call Google through fetch.
export function GoogleAuthButton() {
  return <Button asChild variant="outline" size="lg" className="h-11 w-full text-base font-semibold">
    <a href={GOOGLE_AUTH_URL}>
      <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background" aria-hidden="true">G</span>Google
    </a>
  </Button>
}
