import { useState, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Translation } from '../../data/i18n'
import { Brand } from '../../components/brand/Brand'
import { request } from '../../services/api/client'
import { alertFor } from '../../components/auth/AuthLayout'

export function ForgotPasswordPage({ t }: { t: Translation }) {
  const [step, setStep] = useState(0); const [email, setEmail] = useState(''); const [otp, setOtp] = useState(''); const [token, setToken] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const submit = async () => { setError(''); setLoading(true); try { if (step === 0) { await request('/api/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); setStep(1) } else if (step === 1) { const result = await request<{ resetToken: string }>('/api/v1/auth/verify-reset-otp', { method: 'POST', body: JSON.stringify({ email, otp }) }); setToken(result.resetToken); setStep(2) } else { await request('/api/v1/auth/reset-password', { method: 'POST', body: JSON.stringify({ resetToken: token, newPassword: password, confirmPassword: confirm }) }); setStep(3); setToken('') } } catch (e) { setError(alertFor(e) === 'info' ? t.requestFailed : t.systemAlert) } finally { setLoading(false) } }
  const field = (id: string, label: string, input: ReactNode) => <div className="auth-field"><label className="auth-field-label" htmlFor={id}>{label}</label>{input}</div>

  return <main className="auth-layout"><section className="auth-card">
    <Link className="auth-back" to="/login"><ArrowLeft size={16} /> {t.forgotBack}</Link>
    <div className="auth-brand"><Brand /><span>DEVELOPER LEARNING PLATFORM</span></div>
    <header className="auth-intro">
      <h1 className="auth-heading">{t.forgotTitleLead} <span className="auth-title-accent">{t.forgotTitleAccent}</span></h1>
      <p className="auth-subtitle">{t.forgotSteps[step]}</p>
    </header>
    {step === 3 ? <Link className="auth-submit" to="/login">{t.login}</Link> : <form className="auth-form" onSubmit={e => { e.preventDefault(); void submit() }}>
      {step === 0 && field('forgot-email', t.email, <input className="login-input" id="forgot-email" type="email" required placeholder="you@example.com" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />)}
      {step === 1 && field('forgot-otp', t.otp, <input className="login-input" id="forgot-otp" required inputMode="numeric" pattern="[0-9]{6}" placeholder={t.otpPlaceholder} autoComplete="one-time-code" value={otp} onChange={e => setOtp(e.target.value)} />)}
      {step === 2 && <>
        {field('forgot-password', t.newPassword, <input className="login-input" id="forgot-password" type="password" minLength={8} required placeholder={t.newPasswordPlaceholder} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />)}
        {field('forgot-confirm', t.confirmPassword, <input className="login-input" id="forgot-confirm" type="password" minLength={8} required placeholder={t.confirmNewPasswordPlaceholder} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />)}
      </>}
      {error && <p className="auth-alert" role="alert">{error}</p>}
      <button className="auth-submit" type="submit" disabled={loading}>{loading ? t.processing : t.continue}</button>
    </form>}
  </section></main>
}
