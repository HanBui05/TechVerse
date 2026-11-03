import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

  return <form className="flex max-w-md flex-col gap-4" noValidate onSubmit={event => void submit(event)}>
    {KEYS.map(key => <div className="flex flex-col gap-2" key={key}>
      <Label htmlFor={`profile-${key}`} className="text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">{t[key]}</Label>
      <div className="relative">
        <Input id={`profile-${key}`} className="pr-11 pointer-coarse:h-11" type={visible[key] ? 'text' : 'password'} autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'}
          value={values[key]} disabled={pending} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))}
          aria-invalid={errors[key] ? true : undefined} aria-describedby={errors[key] ? `profile-${key}-error` : undefined} />
        <Button type="button" variant="ghost" size="icon-sm" className="absolute top-1/2 right-1 -translate-y-1/2" onClick={() => setVisible(current => ({ ...current, [key]: !current[key] }))} aria-label={visible[key] ? t.hidePassword : t.showPassword}>
          {visible[key] ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      </div>
      {errors[key] && <p className="text-xs text-danger" id={`profile-${key}-error`}>{errors[key]}</p>}
    </div>)}
    {result && <p className={cn('text-sm', result.ok ? 'text-success' : 'text-danger')} role={result.ok ? 'status' : 'alert'}>{result.text}</p>}
    <div className="flex justify-end">
      <Button type="submit" disabled={pending}>{pending ? t.changingPassword : t.changePassword}</Button>
    </div>
  </form>
}
