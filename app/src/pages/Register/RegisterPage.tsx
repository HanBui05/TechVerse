import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Translation } from '../../data/i18n'
import { GoogleAuthButton } from '../../components/GoogleAuthButton'
import { alertFor, AUTH_ALERT_ID, AuthAlertText, AuthDivider, AuthField, AuthInput, AuthIntro, AuthSubmit, AuthSwitch, fieldState, isEmail, PasswordInput, type AuthAlert } from '../../components/auth/AuthLayout'

// Offer local registration or Google OAuth; new Google accounts are created by the backend.
export function RegisterPage({ t, onRegister }: { t: Translation; onRegister: (data: { fullName: string; email: string; password: string; confirmPassword: string }) => Promise<void> }) {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
    <AuthIntro lead={t.registerTitleLead} accent={t.registerTitleAccent} subtitle={t.registerSubtitle} />
    <form className="flex flex-col gap-4" noValidate onSubmit={event => { event.preventDefault(); void submit() }}>
      <AuthField id="register-name" label={t.username}>
        <AuthInput id="register-name" placeholder={t.username} autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} {...fieldState(invalid, 'name')} />
      </AuthField>
      <AuthField id="register-email" label={t.email}>
        <AuthInput id="register-email" type="email" placeholder={t.email} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} {...fieldState(invalid, 'email')} />
      </AuthField>
      <AuthField id="register-password" label={t.password}>
        <PasswordInput id="register-password" showLabel={t.showPassword} hideLabel={t.hidePassword} placeholder={t.password} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} {...fieldState(invalid, 'password')} />
      </AuthField>
      <AuthField id="register-confirm" label={t.confirmPassword}>
        <AuthInput id="register-confirm" type="password" placeholder={t.confirmPassword} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} {...fieldState(invalid, 'confirm')} />
      </AuthField>
      {alert && <AuthAlertText id={AUTH_ALERT_ID}>{alert === 'system' ? t.systemAlert : t.registerAlert}</AuthAlertText>}
      <AuthSubmit type="submit" disabled={loading}>{loading ? '...' : t.createAccount}</AuthSubmit>
    </form>
    <p className="text-center text-xs text-muted-foreground">{t.terms}</p>
    <AuthDivider label={t.or} />
    <GoogleAuthButton />
    <AuthSwitch text={t.haveAccount} to="/login" label={t.loginNow} />
  </>
}
