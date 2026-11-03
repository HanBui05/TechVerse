import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { CalendarDays, KeyRound, LogOut, MonitorSmartphone, PencilLine, UserRound } from 'lucide-react'
import { enUS, vi as viLocale } from 'date-fns/locale'
import { cn } from 'cn'
import type { Language } from '../../types/preferences'
import { profileCopy, type ProfileTranslation } from '../../data/profile'
import { updateMyProfile, type UpdateProfile, type UserProfile } from '../../services/profileService'
import { ApiError } from '../../services/api/client'
import { AvatarUpload } from './AvatarUpload'
import { ChangePasswordPanel } from './ChangePasswordPanel'
import { UserAvatar } from '../../components/UserAvatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

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
// Birth date is typed as dd/mm/yyyy; the API uses yyyy-mm-dd.
const toShown = (iso: string | null) => iso ? iso.split('-').reverse().join('/') : ''
const toIso = (shown: string) => shown.split('/').reverse().join('-')
const localDate = (iso: string) => { const [year, month, day] = iso.split('-').map(Number); return new Date(year, month - 1, day) }
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

const fieldLabel = 'text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground'
const Notice =({ ok, text }: { ok: boolean; text: string }) =>
  <p className={cn('text-sm', ok ? 'text-success' : 'text-danger')} role={ok ? 'status' : 'alert'}>{text}</p>

type Props = { language: Language; profile: UserProfile; onLogout: () => void; onLogoutAll: () => Promise<void>; onProfileChange: (profile: UserProfile) => void }

export function ProfilePage({ language, profile, onLogout, onLogoutAll, onProfileChange }: Props) {
  const t = profileCopy[language]
  const [panel, setPanel] = useState<'personal' | 'password'>('personal')
  const canChangePassword = profile.hasLocalPassword === true
  const active = canChangePassword ? panel : 'personal'
  const navItem = (value: typeof panel, icon: ReactNode, label: string) =>
    <Button type="button" variant="ghost" className={cn('w-full justify-start', active === value && 'bg-accent text-accent-foreground')}
      aria-current={active === value ? 'page' : undefined} onClick={() => setPanel(value)}>{icon}{label}</Button>

  return <main className="tw-page mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:px-8">
    <header className="flex flex-col gap-1"><h1 className="text-2xl font-bold">{t.title}</h1><p className="text-sm text-muted-foreground">{t.subtitle}</p></header>
    <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="gap-4 rounded-2xl p-5">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar className="size-17 text-xl" name={profile.fullName} url={profile.avatarUrl} />
          <div className="flex min-w-0 flex-col"><strong className="truncate text-base">{profile.fullName}</strong><span className="truncate text-xs text-muted-foreground">{profile.email}</span></div>
        </div>
        {canChangePassword && <nav className="flex flex-col gap-1" aria-label={t.navLabel}>
          {navItem('personal', <UserRound aria-hidden="true" />, t.personal)}
          {navItem('password', <KeyRound aria-hidden="true" />, t.password)}
        </nav>}
        <Separator />
        <SessionActions t={t} onLogout={onLogout} onLogoutAll={onLogoutAll} />
      </Card>
      <Card className="gap-0 rounded-2xl py-0" aria-labelledby="profile-panel-title" role="region">
        {active === 'personal'
          ? <PersonalForm t={t} language={language} profile={profile} onProfileChange={onProfileChange} avatar={<AvatarUpload profile={profile} onProfileChange={onProfileChange} language={language} />} />
          : <><PanelHeader icon={<KeyRound />} title={t.password} description={t.passwordDesc} /><div className="p-5"><ChangePasswordPanel language={language} /></div></>}
      </Card>
    </div>
  </main>
}

function PanelHeader({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-text [&_svg]:size-4" aria-hidden="true">{icon}</span>
      <div className="min-w-0"><h2 id="profile-panel-title" className="text-sm font-semibold">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div>
    </div>
    {action}
  </header>
}

function PersonalForm({ t, language, profile, onProfileChange, avatar }: { t: ProfileTranslation; language: Language; profile: UserProfile; onProfileChange: (profile: UserProfile) => void; avatar: ReactNode }) {
  const [form, setForm] = useState(() => ({ baseline: valuesOf(profile), values: valuesOf(profile) }))
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  // Read-only until the user chooses to edit; Cancel restores the saved values.
  const [editing, setEditing] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

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
      setEditing(false)
      setNotice({ ok: true, text: t.saved })
    } catch (error) {
      setNotice({ ok: false, text: error instanceof ApiError && error.status === 400 ? t.checkInfo : t.systemError })
    } finally {
      setSaving(false)
    }
  }

  const startEditing = () => { setNotice(null); setEditing(true) }
  const cancel = () => { setForm(current => ({ ...current, values: current.baseline })); setErrors({}); setEditing(false) }

  const header = <PanelHeader icon={<UserRound />} title={t.personal} description={t.personalDesc}
    action={!editing && <Button type="button" variant="outline" size="sm" onClick={startEditing}><PencilLine aria-hidden="true" />{t.edit}</Button>} />

  // Same field grid in both modes (read-only until Edit) so switching modes never shifts the layout.
  const field = (key: Field, label: string, props: { type?: string; maxLength?: number; autoComplete?: string; inputMode?: 'numeric' | 'tel'; placeholder?: string }, format = (value: string) => value, extra?: ReactNode) => <div className="flex flex-col gap-2">
    <Label htmlFor={`profile-${key}`} className={fieldLabel}>{label}</Label>
    <div className="relative">
      <Input id={`profile-${key}`} {...props} className={cn('read-only:bg-muted pointer-coarse:h-11', extra && editing && 'pr-11')} placeholder={editing ? props.placeholder : t.notSet} value={form.values[key]} readOnly={!editing} disabled={saving}
        onChange={event => set(key, format(event.target.value))}
        aria-invalid={errors[key] ? true : undefined} aria-describedby={errors[key] ? `profile-${key}-error` : undefined} />
      {editing && extra}
    </div>
    {errors[key] && <p className="text-xs text-danger" id={`profile-${key}-error`}>{errors[key]}</p>}
  </div>

  const latest = localDate(latestBirthDate())
  const selected = isRealDate(form.values.dateOfBirth) ? localDate(toIso(form.values.dateOfBirth)) : undefined
  // The calendar only fills the field; the dd/mm/yyyy text stays the source of truth.
  const datePicker = <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="ghost" size="icon-sm" className="absolute top-1/2 right-1 -translate-y-1/2" aria-label={t.pickDate} disabled={saving}><CalendarDays aria-hidden="true" /></Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="end">
      <Calendar mode="single" locale={language === 'vi' ? viLocale : enUS} captionLayout="dropdown"
        selected={selected} defaultMonth={selected ?? latest} startMonth={new Date(1900, 0)} endMonth={latest} disabled={{ after: latest }}
        onSelect={date => { if (date) set('dateOfBirth', toShown(isoDate(date))); setPickerOpen(false) }} />
    </PopoverContent>
  </Popover>

  return <>{header}<div className="flex flex-col gap-6 p-5">
    {avatar}
    <form className="flex flex-col gap-4" noValidate onSubmit={event => void save(event)}>
      <h3 className="text-sm font-semibold">{t.basicInfo}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {field('fullName', t.name, { maxLength: 150, autoComplete: 'name' })}
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-email" className={fieldLabel}>{t.email}</Label>
          <Input id="profile-email" type="email" className="read-only:bg-muted pointer-coarse:h-11" value={profile.email} readOnly />
        </div>
        {field('phoneNumber', t.phone, { type: 'tel', maxLength: 20, autoComplete: 'tel' })}
        {field('dateOfBirth', t.dob, { inputMode: 'numeric', maxLength: 10, placeholder: 'dd/mm/yyyy', autoComplete: 'bday' }, maskDate, datePicker)}
      </div>
      {notice && <Notice {...notice} />}
      {editing && <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={saving} onClick={cancel}>{t.cancel}</Button>
        <Button type="submit" disabled={saving || !dirty.length}>{saving ? t.saving : t.save}</Button>
      </div>}
    </form>
  </div></>
}

function SessionActions({ t, onLogout, onLogoutAll }: { t: ProfileTranslation; onLogout: () => void; onLogoutAll: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  // While the request is pending, Escape/Cancel cannot close the dialog.
  const change = (next: boolean) => { if (pending) return; if (next) setFailed(false); setOpen(next) }
  const confirm = async () => {
    if (pending) return
    setPending(true)
    setFailed(false)
    try { await onLogoutAll() } // On success App clears the session and leaves this page.
    catch { setFailed(true); setPending(false) }
  }

  return <div className="flex flex-col gap-1">
    <Button type="button" variant="ghost" className="w-full justify-start" onClick={onLogout}><LogOut aria-hidden="true" />{t.logout}</Button>
    <AlertDialog open={open} onOpenChange={change}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" className="w-full justify-start text-danger hover:text-danger"><MonitorSmartphone aria-hidden="true" />{t.logoutAll}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.logoutAllTitle}</AlertDialogTitle>
          <AlertDialogDescription>{t.logoutAllBody}</AlertDialogDescription>
        </AlertDialogHeader>
        {failed && <Notice ok={false} text={t.logoutAllError} />}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t.cancel}</AlertDialogCancel>
          {/* Plain button, not AlertDialogAction: the dialog must stay open while pending and on error. */}
          <Button type="button" variant="destructive" disabled={pending} onClick={() => void confirm()}>{pending ? t.loggingOut : t.confirmLogoutAll}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
}
