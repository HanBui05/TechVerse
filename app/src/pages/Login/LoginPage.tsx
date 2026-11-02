import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { Translation } from '../../data/i18n'
import { GoogleAuthButton } from '../../components/GoogleAuthButton'
import { alertFor, AUTH_ALERT_ID, fieldState, type AuthAlert } from '../../components/auth/AuthLayout'

// Present password login and the shared browser-based Google signup/login entry point.
export function LoginPage({ t, onLogin }: { t: Translation; onLogin: (email: string, password: string) => Promise<string> }) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<AuthAlert>('')
  const [invalid, setInvalid] = useState<string[]>([])
  const navigate = useNavigate()

  // Validate locally, then submit and route by the authenticated user's role.
  const submit = async () => {
    // Login only checks presence/length: the backend @Email accepts Unicode addresses that isEmail rejects.
    const wrong = [(!email || email.length > 254) && 'email', !password && 'password'].filter(key => key !== false)
    setInvalid(wrong)
    if (wrong.length) { setAlert('info'); return }
    setLoading(true)
    setAlert('')
    try { navigate(await onLogin(email, password)) }
    catch (cause) { setAlert(alertFor(cause)) }
    finally { setLoading(false) }
  }

  return <>
    <header className="auth-intro">
      <h1 className="auth-heading">{t.loginTitleLead} <span className="auth-title-accent">{t.loginTitleAccent}</span></h1>
      <p className="auth-subtitle">{t.loginSubtitle}</p>
    </header>
    <form className="auth-form" noValidate onSubmit={event => { event.preventDefault(); void submit() }}>
      <div className="auth-field">
        <label className="auth-field-label" htmlFor="login-email">{t.email}</label>
        <input className="login-input" id="login-email" type="email" placeholder={t.email} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} {...fieldState(invalid, 'email')} />
      </div>
      <div className="auth-field">
        <label className="auth-field-label" htmlFor="login-password">{t.password}</label>
        <div className="auth-password">
          <input className="login-input" id="login-password" type={showPassword ? 'text' : 'password'} placeholder={t.password} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} {...fieldState(invalid, 'password')} />
          <button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? t.hidePassword : t.showPassword}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
        </div>
      </div>
      <Link className="auth-forgot" to="/forgot-password">{t.forgotPassword}</Link>
      {alert && <p className="auth-alert" id={AUTH_ALERT_ID} role="alert">{alert === 'system' ? t.systemAlert : t.loginAlert}</p>}
      <button className="auth-submit" type="submit" disabled={loading}>{loading ? '...' : t.login}</button>
    </form>
    <div className="auth-divider"><span>{t.or}</span></div>
    <div className="social-login-grid"><GoogleAuthButton /></div>
    <p className="auth-switch">{t.noAccount} <Link to="/register">{t.registerNow}</Link></p>
  </>
}
