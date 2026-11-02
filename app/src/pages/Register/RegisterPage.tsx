import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { Translation } from '../../data/i18n'
import { GoogleAuthButton } from '../../components/GoogleAuthButton'
import { alertFor, AUTH_ALERT_ID, fieldState, isEmail, type AuthAlert } from '../../components/auth/AuthLayout'

// Offer local registration or Google OAuth; new Google accounts are created by the backend.
export function RegisterPage({ t, onRegister }: { t: Translation; onRegister: (data: { fullName: string; email: string; password: string; confirmPassword: string }) => Promise<void> }) {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<AuthAlert>('')
  const [invalid, setInvalid] = useState<string[]>([])

  // Mirror the backend RegisterRequest limits so a request that must fail is never sent.
  const submit = async () => {
    const wrong = [
      (!fullName.trim() || fullName.length > 150) && 'name',
      !isEmail(email) && 'email',
      // UTF-8 bytes >= UTF-16 length, so the byte check also enforces the 72-character limit.
      (password.length < 8 || new TextEncoder().encode(password).length > 72) && 'password',
      (!confirmPassword || confirmPassword !== password) && 'confirm',
    ].filter(key => key !== false)
    setInvalid(wrong)
    if (wrong.length) { setAlert('info'); return }
    setLoading(true)
    setAlert('')
    try { await onRegister({ fullName, email, password, confirmPassword }); navigate('/login') }
    catch (cause) { setAlert(alertFor(cause)) }
    finally { setLoading(false) }
  }

  return <>
    <header className="auth-intro">
      <h1 className="auth-heading">{t.registerTitleLead} <span className="auth-title-accent">{t.registerTitleAccent}</span></h1>
      <p className="auth-subtitle">{t.registerSubtitle}</p>
    </header>
    <form className="auth-form" noValidate onSubmit={event => { event.preventDefault(); void submit() }}>
      <div className="auth-field">
        <label className="auth-field-label" htmlFor="register-name">{t.username}</label>
        <input className="login-input" id="register-name" placeholder={t.username} autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} {...fieldState(invalid, 'name')} />
      </div>
      <div className="auth-field">
        <label className="auth-field-label" htmlFor="register-email">{t.email}</label>
        <input className="login-input" id="register-email" type="email" placeholder={t.email} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} {...fieldState(invalid, 'email')} />
      </div>
      <div className="auth-field">
        <label className="auth-field-label" htmlFor="register-password">{t.password}</label>
        <div className="auth-password">
          <input className="login-input" id="register-password" type={showPassword ? 'text' : 'password'} placeholder={t.password} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} {...fieldState(invalid, 'password')} />
          <button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? t.hidePassword : t.showPassword}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
        </div>
      </div>
      <div className="auth-field">
        <label className="auth-field-label" htmlFor="register-confirm">{t.confirmPassword}</label>
        <input className="login-input" id="register-confirm" type="password" placeholder={t.confirmPassword} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} {...fieldState(invalid, 'confirm')} />
      </div>
      {alert && <p className="auth-alert" id={AUTH_ALERT_ID} role="alert">{alert === 'system' ? t.systemAlert : t.registerAlert}</p>}
      <button className="auth-submit" type="submit" disabled={loading}>{loading ? '...' : t.createAccount}</button>
    </form>
    <p className="auth-terms">{t.terms}</p>
    <div className="auth-divider"><span>{t.or}</span></div>
    <div className="social-login-grid"><GoogleAuthButton /></div>
    <p className="auth-switch">{t.haveAccount} <Link to="/login">{t.loginNow}</Link></p>
  </>
}
