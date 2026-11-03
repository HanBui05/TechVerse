import { useState } from 'react'
import { Camera } from 'lucide-react'
import { cn } from 'cn'
import { ApiError, request } from '../../services/api/client'
import type { UserProfile } from '../../services/profileService'
import type { Language } from '../../types/preferences'
import { profileCopy } from '../../data/profile'
import { UserAvatar } from '../../components/UserAvatar'

const TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

// The avatar itself is the file picker: a label wraps the image and a visually hidden, focusable input.
export function AvatarUpload({ profile, onProfileChange, language }: { profile: UserProfile; onProfileChange: (profile: UserProfile) => void; language: Language }) {
  const t = profileCopy[language]
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const upload = async (file: File) => {
    if (!TYPES.includes(file.type) || file.size > MAX_BYTES) { setNotice({ ok: false, text: t.avatarInvalid }); return }
    setBusy(true)
    setNotice(null)
    try {
      const body = new FormData()
      body.append('file', file)
      onProfileChange(await request<UserProfile>('/api/v1/users/me/avatar', { method: 'PATCH', body }))
      setNotice({ ok: true, text: t.avatarUpdated })
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0
      setNotice({ ok: false, text: status === 413 || status === 415 ? t.avatarInvalid : status === 429 ? t.avatarRateLimited : t.systemError })
    } finally {
      setBusy(false)
    }
  }

  return <div className="flex items-center gap-4">
    <label className={cn('relative shrink-0 cursor-pointer rounded-full has-focus-visible:ring-[3px] has-focus-visible:ring-ring', busy && 'cursor-wait opacity-60')}>
      <UserAvatar className="avatar-large" name={profile.fullName} url={profile.avatarUrl} />
      <span className="absolute right-0 bottom-0 flex size-6 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground" aria-hidden="true"><Camera size={12} /></span>
      <input className="sr-only" type="file" accept={TYPES.join(',')} aria-label={t.changeAvatar} disabled={busy}
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }} />
    </label>
    <div className="flex min-w-0 flex-col gap-1">
      <strong className="text-sm font-semibold">{t.avatarTitle}</strong>
      <p className="text-xs text-muted-foreground">{t.avatarHint}</p>
      {busy && <p className="text-xs text-muted-foreground" role="status">{t.avatarUploading}</p>}
      {notice && <p className={cn('text-xs', notice.ok ? 'text-success' : 'text-danger')} role={notice.ok ? 'status' : 'alert'}>{notice.text}</p>}
    </div>
  </div>
}
