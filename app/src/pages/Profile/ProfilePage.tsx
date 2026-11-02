import { useEffect, useRef, useState, type FormEvent } from 'react'
import { KeyRound, LogOut, MonitorSmartphone, UserRound } from 'lucide-react'
import type { Language } from '../../types/preferences'
import { profileCopy, type ProfileTranslation } from '../../data/profile'
import { updateMyProfile, type UpdateProfile, type UserProfile } from '../../services/profileService'
import { ApiError } from '../../services/api/client'
import { AvatarUpload } from './AvatarUpload'
import { ChangePasswordPanel } from './ChangePasswordPanel'

type Field = 'fullName' | 'phoneNumber' | 'dateOfBirth'
type Values = Record<Field, string>
type Errors = Partial<Record<Field, string>>
const FIELDS: Field[] = ['fullName', 'phoneNumber', 'dateOfBirth']

const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
// Latest birth date the backend accepts (@Past + @MinimumAge(6)); clamp the day like Java minusYears (29 Feb -> 28 Feb).
export const latestBirthDate = () => {
  const today = new Date()
  const year = today.getFullYear() - 6
  const month = today.getMonth()
  return isoDate(new Date(year, month, Math.min(today.getDate(), new Date(year, month + 1, 0).getDate())))
}
// Birth date is typed as dd/mm/yyyy (native date inputs order segments by browser locale); the API uses yyyy-mm-dd.
const toShown = (iso: string | null) => iso ? iso.split('-').reverse().join('/') : ''
const toIso = (shown: string) => shown.split('/').reverse().join('-')
// Keep only digits (max 8) and insert slashes as the user types: 03032005 -> 03/03/2005.
const maskDate = (raw: string) => raw.replace(/\D/g, '').slice(0, 8).replace(/^(\d{2})(\d)/, '$1/$2').replace(/^(\d{2}\/\d{2})(\d)/, '$1/$2')
const isRealDate = (shown: string) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(shown)
  if (!match) return false
  const [day, month, year] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}
const valuesOf = (profile: UserProfile): Values => ({ fullName: profile.fullName, phoneNumber: profile.phoneNumber ?? '', dateOfBirth: toShown(profile.dateOfBirth) })
// Backend trims text, so whitespace-only edits are not changes.
const isDirty = (values: Values, baseline: Values, field: Field) => values[field].trim() !== baseline[field].trim()

// Mirrors the backend validation of PATCH /users/me.
export function validateProfile(values: Values, t: ProfileTranslation): Errors {
  const errors: Errors = {}
  const name = values.fullName.trim()
  if (!name) errors.fullName = t.nameRequired
  else if (values.fullName.length > 150) errors.fullName = t.nameTooLong
  const phone = values.phoneNumber.trim()
  if (phone && (values.phoneNumber.length > 20 || !/^\+?\d{10,20}$/.test(phone.replace(/[\s().-]/g, '')))) errors.phoneNumber = t.phoneInvalid
  if (values.dateOfBirth && !isRealDate(values.dateOfBirth)) errors.dateOfBirth = t.dobFormat
  else if (values.dateOfBirth && toIso(values.dateOfBirth) > latestBirthDate()) errors.dateOfBirth = t.dobInvalid
  return errors
}

type Props = { language: Language; profile: UserProfile; onLogout: () => void; onLogoutAll: () => Promise<void>; onProfileChange: (profile: UserProfile) => void }

export function ProfilePage({ language, profile, onLogout, onLogoutAll, onProfileChange }: Props) {
  const t = profileCopy[language]
  const [panel, setPanel] = useState<'personal' | 'password'>('personal')
  const canChangePassword = profile.hasLocalPassword === true
  const active = canChangePassword ? panel : 'personal'

  return <main className="page-content profile-page">
    <header className="profile-heading"><h1>{t.title}</h1><p>{t.subtitle}</p></header>
    <div className="profile-layout">
      <aside className="profile-card profile-sidebar">
        <AvatarUpload profile={profile} onProfileChange={onProfileChange} language={language} />
        <div className="profile-identity"><strong>{profile.fullName}</strong><span>{profile.email}</span></div>
        {canChangePassword && <nav className="profile-nav" aria-label={t.navLabel}>
          <button type="button" className={active === 'personal' ? 'is-active' : ''} aria-current={active === 'personal' ? 'page' : undefined} onClick={() => setPanel('personal')}><UserRound size={18} aria-hidden="true" />{t.personal}</button>
          <button type="button" className={active === 'password' ? 'is-active' : ''} aria-current={active === 'password' ? 'page' : undefined} onClick={() => setPanel('password')}><KeyRound size={18} aria-hidden="true" />{t.password}</button>
        </nav>}
        <SessionActions t={t} onLogout={onLogout} onLogoutAll={onLogoutAll} />
      </aside>
      <section className="profile-card profile-content" aria-labelledby="profile-panel-title">
        <header className="profile-content-header">
          <h2 id="profile-panel-title">{active === 'personal' ? t.personal : t.password}</h2>
          <p>{active === 'personal' ? t.personalDesc : t.passwordDesc}</p>
        </header>
        {active === 'personal' ? <PersonalForm t={t} profile={profile} onProfileChange={onProfileChange} /> : <ChangePasswordPanel language={language} />}
      </section>
    </div>
  </main>
}

function PersonalForm({ t, profile, onProfileChange }: { t: ProfileTranslation; profile: UserProfile; onProfileChange: (profile: UserProfile) => void }) {
  const [form, setForm] = useState(() => ({ baseline: valuesOf(profile), values: valuesOf(profile) }))
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  // A shared profile update (e.g. new avatar) refreshes only the fields the user has not touched.
  useEffect(() => {
    const next = valuesOf(profile)
    setForm(current => ({
      baseline: next,
      values: Object.fromEntries(FIELDS.map(field => [field, isDirty(current.values, current.baseline, field) ? current.values[field] : next[field]])) as Values,
    }))
  }, [profile])

  const dirty = FIELDS.filter(field => isDirty(form.values, form.baseline, field))
  const set = (field: Field, value: string) => setForm(current => ({ ...current, values: { ...current.values, [field]: value } }))

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const found = validateProfile(form.values, t)
    setErrors(found)
    setNotice(null)
    if (Object.keys(found).length || !dirty.length) return
    const payload = Object.fromEntries(dirty.map(key => [key, key === 'fullName' ? form.values.fullName : key === 'dateOfBirth' ? (form.values.dateOfBirth ? toIso(form.values.dateOfBirth) : null) : form.values[key] || null])) as UpdateProfile
    setSaving(true)
    try {
      const updated = await updateMyProfile(payload)
      setForm({ baseline: valuesOf(updated), values: valuesOf(updated) })
      onProfileChange(updated)
      setNotice({ ok: true, text: t.saved })
    } catch (error) {
      setNotice({ ok: false, text: error instanceof ApiError && error.status === 400 ? t.checkInfo : t.systemError })
    } finally {
      setSaving(false)
    }
  }

  const field = (key: Field, label: string, props: { type?: string; maxLength?: number; autoComplete?: string; inputMode?: 'numeric' | 'tel'; placeholder?: string }, format = (value: string) => value) => <div className="profile-field">
    <label htmlFor={`profile-${key}`}>{label}</label>
    <input id={`profile-${key}`} {...props} value={form.values[key]} disabled={saving} onChange={event => set(key, format(event.target.value))}
      aria-invalid={errors[key] ? true : undefined} aria-describedby={errors[key] ? `profile-${key}-error` : undefined} />
    {errors[key] && <p className="profile-field-error" id={`profile-${key}-error`}>{errors[key]}</p>}
  </div>

  return <form className="profile-form" noValidate onSubmit={event => void save(event)}>
    <div className="profile-fields two-columns">
      {field('fullName', t.name, { maxLength: 150, autoComplete: 'name' })}
      <div className="profile-field">
        <label htmlFor="profile-email">{t.email}</label>
        <input id="profile-email" type="email" value={profile.email} readOnly aria-describedby="profile-email-hint" />
        <p className="profile-field-hint" id="profile-email-hint">{t.emailHint}</p>
      </div>
      {field('phoneNumber', t.phone, { type: 'tel', maxLength: 20, autoComplete: 'tel' })}
      {field('dateOfBirth', t.dob, { inputMode: 'numeric', maxLength: 10, placeholder: 'dd/mm/yyyy', autoComplete: 'bday' }, maskDate)}
    </div>
    {notice && <p className={notice.ok ? 'profile-notice is-success' : 'profile-notice is-error'} role={notice.ok ? 'status' : 'alert'}>{notice.text}</p>}
    <div className="profile-form-actions">
      <button className="button button-primary" type="submit" disabled={saving || !dirty.length}>{saving ? t.saving : t.save}</button>
    </div>
  </form>
}

function SessionActions({ t, onLogout, onLogoutAll }: { t: ProfileTranslation; onLogout: () => void; onLogoutAll: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  const open = () => { setFailed(false); dialog.current?.showModal(); cancel.current?.focus() }
  // Return focus explicitly: browsers differ, and the dialog may close by Escape, Cancel or error recovery.
  const close = () => { dialog.current?.close(); opener.current?.focus() }
  const confirm = async () => {
    if (pending) return
    setPending(true)
    setFailed(false)
    try { await onLogoutAll() } // On success App clears the session and leaves this page.
    catch { setFailed(true); setPending(false) }
  }

  return <div className="profile-session-actions">
    <button type="button" className="profile-action" onClick={onLogout}><LogOut size={18} aria-hidden="true" />{t.logout}</button>
    <button type="button" className="profile-action is-danger" ref={opener} onClick={open}><MonitorSmartphone size={18} aria-hidden="true" />{t.logoutAll}</button>
    <dialog className="profile-dialog" ref={dialog} aria-labelledby="logout-all-title" aria-describedby="logout-all-body"
      onCancel={event => { event.preventDefault(); if (!pending) close() }}>
      <h2 id="logout-all-title">{t.logoutAllTitle}</h2>
      <p id="logout-all-body">{t.logoutAllBody}</p>
      {failed && <p className="profile-notice is-error" role="alert">{t.logoutAllError}</p>}
      <div className="profile-dialog-actions">
        <button type="button" className="button button-outline" ref={cancel} disabled={pending} onClick={close}>{t.cancel}</button>
        <button type="button" className="button profile-danger-button" disabled={pending} onClick={() => void confirm()}>{pending ? t.loggingOut : t.confirmLogoutAll}</button>
      </div>
    </dialog>
  </div>
}
