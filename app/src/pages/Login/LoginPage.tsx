import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Translation } from '../../data/i18n'
import { GoogleAuthButton } from '../../components/GoogleAuthButton'
import { alertFor, AUTH_ALERT_ID, AuthAlertText, AuthDivider, AuthField, AuthInput, AuthIntro, authLinkClass, AuthSubmit, AuthSwitch, fieldState, PasswordInput, type AuthAlert } from '../../components/auth/AuthLayout'

// Present password login and the shared browser-based Google signup/login entry point.
export function LoginPage({ t, onLogin }: { t: Translation; onLogin: (email: string, password: string) => Promise<string> }) {
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
    <AuthIntro lead={t.loginTitleLead} accent={t.loginTitleAccent} subtitle={t.loginSubtitle} />
    <form className="flex flex-col gap-4" noValidate onSubmit={event => { event.preventDefault(); void submit() }}>
      <AuthField id="login-email" label={t.email}>
        <AuthInput id="login-email" type="email" placeholder={t.email} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} {...fieldState(invalid, 'email')} />
      </AuthField>
      <AuthField id="login-password" label={t.password}>
        <PasswordInput id="login-password" showLabel={t.showPassword} hideLabel={t.hidePassword} placeholder={t.password} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} {...fieldState(invalid, 'password')} />
      </AuthField>
      <Link className={authLinkClass} to="/forgot-password">{t.forgotPassword}</Link>
      {alert && <AuthAlertText id={AUTH_ALERT_ID}>{alert === 'system' ? t.systemAlert : t.loginAlert}</AuthAlertText>}
      <AuthSubmit type="submit" disabled={loading}>{loading ? '...' : t.login}</AuthSubmit>
    </form>
    <AuthDivider label={t.or} />
    <GoogleAuthButton />
    <AuthSwitch text={t.noAccount} to="/register" label={t.registerNow} />
  </>
}
