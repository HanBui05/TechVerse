import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Translation } from '../../data/i18n'
import { request } from '../../services/api/client'
import { alertFor, AuthAlertText, AuthField, AuthInput, AuthIntro, AuthShell, AuthSubmit } from '../../components/auth/AuthLayout'

export function ForgotPasswordPage({ t }: { t: Translation }) {
  const [step, setStep] = useState(0); const [email, setEmail] = useState(''); const [otp, setOtp] = useState(''); const [token, setToken] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const submit = async () => { setError(''); setLoading(true); try { if (step === 0) { await request('/api/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); setStep(1) } else if (step === 1) { const result = await request<{ resetToken: string }>('/api/v1/auth/verify-reset-otp', { method: 'POST', body: JSON.stringify({ email, otp }) }); setToken(result.resetToken); setStep(2) } else { await request('/api/v1/auth/reset-password', { method: 'POST', body: JSON.stringify({ resetToken: token, newPassword: password, confirmPassword: confirm }) }); setStep(3); setToken('') } } catch (e) { setError(alertFor(e) === 'info' ? t.requestFailed : t.systemAlert) } finally { setLoading(false) } }

  return <AuthShell back={{ to: '/login', label: t.forgotBack }} tagline="DEVELOPER LEARNING PLATFORM">
    <AuthIntro lead={t.forgotTitleLead} accent={t.forgotTitleAccent} subtitle={t.forgotSteps[step]} />
    {step === 3 ? <AuthSubmit asChild><Link to="/login">{t.login}</Link></AuthSubmit> : <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); void submit() }}>
      {step === 0 && <AuthField id="forgot-email" label={t.email}><AuthInput id="forgot-email" type="email" required placeholder="you@example.com" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></AuthField>}
      {step === 1 && <AuthField id="forgot-otp" label={t.otp}><AuthInput id="forgot-otp" required inputMode="numeric" pattern="[0-9]{6}" placeholder={t.otpPlaceholder} autoComplete="one-time-code" value={otp} onChange={e => setOtp(e.target.value)} /></AuthField>}
      {step === 2 && <>
        <AuthField id="forgot-password" label={t.newPassword}><AuthInput id="forgot-password" type="password" minLength={8} required placeholder={t.newPasswordPlaceholder} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></AuthField>
        <AuthField id="forgot-confirm" label={t.confirmPassword}><AuthInput id="forgot-confirm" type="password" minLength={8} required placeholder={t.confirmNewPasswordPlaceholder} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></AuthField>
      </>}
      {error && <AuthAlertText>{error}</AuthAlertText>}
      <AuthSubmit type="submit" disabled={loading}>{loading ? t.processing : t.continue}</AuthSubmit>
    </form>}
  </AuthShell>
}
