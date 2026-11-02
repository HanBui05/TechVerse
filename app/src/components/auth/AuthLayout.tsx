import { ArrowLeft } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router-dom'
import type { Translation } from '../../data/i18n'
import { ApiError } from '../../services/api/client'
import { Brand } from '../brand/Brand'

export const AUTH_ALERT_ID = 'auth-alert'
export type AuthAlert = '' | 'info' | 'system'

// Rejected input (400/401/409) gets the per-form alert; network, 429, 5xx and anything unexpected are system problems.
export const alertFor = (cause: unknown): AuthAlert => cause instanceof ApiError && [400, 401, 409].includes(cause.status) ? 'info' : 'system'
// WHATWG domain rule plus Hibernate @Email local part: dot-separated atoms, at most 64 characters.
export const isEmail = (value: string) => value.length <= 254 && value.indexOf('@') <= 64 && /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(value)
// Point every invalid field at the single shared alert.
export const fieldState = (invalid: string[], key: string) => invalid.includes(key) ? { 'aria-invalid': true, 'aria-describedby': AUTH_ALERT_ID } : {}

// Parent route for /login and /register: stays mounted so the tab indicator can slide between them.
export function AuthLayout({ t }: { t: Translation }) {
  const { pathname } = useLocation()
  const onRegister = useMatch('/register') !== null
  return <main className="auth-layout"><section className="auth-card">
    <Link className="auth-back" to="/"><ArrowLeft size={16} /> {t.backHome}</Link>
    <div className="auth-brand"><Brand /><span>DEVELOPER LEARNING PLATFORM</span></div>
    <nav className="auth-tabs" aria-label={t.authTabs} data-active={onRegister ? 'register' : 'login'}>
      <span className="auth-tab-indicator" aria-hidden="true" />
      <NavLink className="auth-tab" to="/login" end>{t.login}</NavLink>
      <NavLink className="auth-tab" to="/register" end>{t.signup}</NavLink>
    </nav>
    <div className="auth-form-panel" key={pathname}><Outlet /></div>
  </section></main>
}
