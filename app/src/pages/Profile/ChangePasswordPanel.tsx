import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { profileCopy, type ProfileTranslation } from '../../data/profile'
import { changeMyPassword } from '../../services/profileService'
import { ApiError } from '../../services/api/client'
import type { Language } from '../../types/preferences'

type Key = 'currentPassword' | 'newPassword' | 'confirmPassword'
type Errors = Partial<Record<Key, string>>
const KEYS: Key[] = ['currentPassword', 'newPassword', 'confirmPassword']
const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' }

// Mirrors the backend rules so a remaining 400 can only mean a wrong current password.
export function validatePassword(values: Record<Key, string>, t: ProfileTranslation): Errors {
  const errors: Errors = {}
  for (const key of KEYS) if (values[key].trim() === '') errors[key] = t.passwordRequired
  const next = values.newPassword
  // UTF-8 bytes >= UTF-16 length, so the byte check also enforces the 72-character limit.
  if (!errors.newPassword && (next.length < 8 || new TextEncoder().encode(next).length > 72)) errors.newPassword = t.passwordLength
  else if (!errors.newPassword && next === values.currentPassword) errors.newPassword = t.passwordSame
  if (!errors.confirmPassword && values.confirmPassword !== next) errors.confirmPassword = t.passwordMismatch
  return errors
}

export function ChangePasswordPanel({ language }: { language: Language }) {
  const t = profileCopy[language]
  const [values, setValues] = useState(EMPTY)
  const [visible, setVisible] = useState<Record<Key, boolean>>({ currentPassword: false, newPassword: false, confirmPassword: false })
  const [errors, setErrors] = useState<Errors>({})
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validatePassword(values, t)
    setErrors(found)
    setResult(null)
    if (Object.keys(found).length) return
    setPending(true)
    try {
      await changeMyPassword(values)
      setValues(EMPTY)
      setResult({ ok: true, text: t.passwordChanged })
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0
      setResult({ ok: false, text: status === 400 ? t.currentIncorrect : status === 429 ? t.passwordRateLimited : t.systemError })
    } finally {
      setPending(false)
    }
  }

  return <form className="profile-form" noValidate onSubmit={event => void submit(event)}>
    <div className="profile-fields">
      {KEYS.map(key => <div className="profile-field" key={key}>
        <label htmlFor={`profile-${key}`}>{t[key]}</label>
        <div className="profile-password">
          <input id={`profile-${key}`} type={visible[key] ? 'text' : 'password'} autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'}
            value={values[key]} disabled={pending} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))}
            aria-invalid={errors[key] ? true : undefined} aria-describedby={errors[key] ? `profile-${key}-error` : undefined} />
          <button type="button" className="password-toggle" onClick={() => setVisible(current => ({ ...current, [key]: !current[key] }))} aria-label={visible[key] ? t.hidePassword : t.showPassword}>
            {visible[key] ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
        {errors[key] && <p className="profile-field-error" id={`profile-${key}-error`}>{errors[key]}</p>}
      </div>)}
    </div>
    {result && <p className={result.ok ? 'profile-notice is-success' : 'profile-notice is-error'} role={result.ok ? 'status' : 'alert'}>{result.text}</p>}
    <div className="profile-form-actions">
      <button className="button button-primary" type="submit" disabled={pending}>{pending ? t.changingPassword : t.changePassword}</button>
    </div>
  </form>
}
