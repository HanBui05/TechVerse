import { useState, type ComponentProps, type ReactNode } from 'react'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router-dom'
import { cn } from 'cn'
import type { Translation } from '../../data/i18n'
import { ApiError } from '../../services/api/client'
import { Brand } from '../brand/Brand'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const AUTH_ALERT_ID = 'auth-alert'
export type AuthAlert = '' | 'info' | 'system'

// Rejected input (400/401/409) gets the per-form alert; network, 429, 5xx and anything unexpected are system problems.
export const alertFor = (cause: unknown): AuthAlert => cause instanceof ApiError && [400, 401, 409].includes(cause.status) ? 'info' : 'system'
// WHATWG domain rule plus Hibernate @Email local part: dot-separated atoms, at most 64 characters.
export const isEmail = (value: string) => value.length <= 254 && value.indexOf('@') <= 64 && /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(value)
// Point every invalid field at the single shared alert.
export const fieldState = (invalid: string[], key: string) => invalid.includes(key) ? { 'aria-invalid': true, 'aria-describedby': AUTH_ALERT_ID } : {}

const linkFocus = 'rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring'

// Centered auth card shared by login/register, forgot password and the Google callback.
export function AuthShell({ back, tagline, compactBrand, children }: { back?: { to: string; label: string }; tagline: string; compactBrand?: boolean; children: ReactNode }) {
  return <main className="tw-page flex min-h-svh items-center justify-center bg-background px-5 py-8">
    <Card className="w-full max-w-[480px] gap-5 rounded-2xl px-5 py-6 shadow-lg sm:px-8 sm:pt-7 sm:pb-8">
      {back && <Link className={cn('inline-flex items-center gap-2 self-start text-sm text-muted-foreground transition-colors hover:text-foreground pointer-coarse:min-h-11', linkFocus)} to={back.to}><ArrowLeft size={16} aria-hidden="true" />{back.label}</Link>}
      <div className="flex flex-col items-center gap-2 text-center"><Brand compact={compactBrand} /><span className="text-[11px] font-bold tracking-[.05em] text-muted-foreground">{tagline}</span></div>
      {children}
    </Card>
  </main>
}

export function AuthIntro({ lead, accent, subtitle }: { lead: string; accent?: string; subtitle: string }) {
  return <header className="flex flex-col gap-2 text-center">
    <h1 className="text-3xl leading-tight font-bold">{lead}{accent && <> <span className="text-accent-text">{accent}</span></>}</h1>
    <p className="text-base text-muted-foreground">{subtitle}</p>
  </header>
}

export function AuthField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="flex flex-col gap-2">
    <Label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">{label}</Label>
    {children}
  </div>
}

export const AuthInput = ({ className, ...props }: ComponentProps<typeof Input>) => <Input className={cn('h-10 pointer-coarse:h-11', className)} {...props} />

// The eye toggle changes only this field's visibility.
export function PasswordInput({ showLabel, hideLabel, className, ...props }: Omit<ComponentProps<typeof Input>, 'type'> & { showLabel: string; hideLabel: string }) {
  const [visible, setVisible] = useState(false)
  return <div className="relative">
    <AuthInput {...props} type={visible ? 'text' : 'password'} className={cn('pr-11', className)} />
    <Button type="button" variant="ghost" size="icon-sm" className="absolute top-1/2 right-1 -translate-y-1/2" onClick={() => setVisible(value => !value)} aria-label={visible ? hideLabel : showLabel}>
      {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
    </Button>
  </div>
}

export function AuthAlertText({ id, children }: { id?: string; children: ReactNode }) {
  return <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger" id={id} role="alert">{children}</p>
}

export const AuthSubmit = (props: ComponentProps<typeof Button>) => <Button size="lg" className="h-11 w-full text-base font-bold" {...props} />

export function AuthDivider({ label }: { label: string }) {
  return <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /><span>{label}</span><span className="h-px flex-1 bg-border" /></div>
}

export function AuthSwitch({ text, to, label }: { text: string; to: string; label: string }) {
  return <p className="text-center text-sm text-muted-foreground">{text} <Link className={authInlineLink} to={to}>{label}</Link></p>
}

const tabClass = ({ isActive }: { isActive: boolean }) => cn('relative flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring outline-none motion-reduce:transition-none', isActive && 'text-foreground')

// Parent route for /login and /register: stays mounted so the tab indicator can slide between them.
export function AuthLayout({ t }: { t: Translation }) {
  const { pathname } = useLocation()
  const onRegister = useMatch('/register') !== null
  return <AuthShell back={{ to: '/', label: t.backHome }} tagline="DEVELOPER LEARNING PLATFORM">
    <nav className="relative grid grid-cols-2 rounded-xl border border-border bg-muted p-1" aria-label={t.authTabs}>
      <span className={cn('absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg border border-border bg-card transition-transform duration-200 motion-reduce:transition-none', onRegister && 'translate-x-full')} aria-hidden="true" />
      <NavLink className={tabClass} to="/login" end>{t.login}</NavLink>
      <NavLink className={tabClass} to="/register" end>{t.signup}</NavLink>
    </nav>
    <div className="flex flex-col gap-5 duration-200 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none" key={pathname}><Outlet /></div>
  </AuthShell>
}

// inline-flex + min-h-11: 44px touch target on coarse pointers (QĐ 1A).
export const authLinkClass = cn('inline-flex items-center self-end text-sm font-medium text-accent-text pointer-coarse:min-h-11', linkFocus)
export const authInlineLink = cn('inline-flex items-center font-bold text-accent-text pointer-coarse:min-h-11', linkFocus)
