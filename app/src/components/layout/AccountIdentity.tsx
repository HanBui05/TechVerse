import { Link } from 'react-router-dom'
import type { UserProfile } from '../../services/profileService'
import { UserAvatar } from '../UserAvatar'

// Dùng chung danh tính từ /users/me cho sidebar của mọi role, không dùng dữ liệu demo.
export function AccountIdentity({ profile }: { profile: UserProfile | null }) {
  return <Link className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1 outline-hidden focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:p-0" to="/profile" aria-label={profile ? `Tài khoản: ${profile.fullName}` : 'Đang tải hồ sơ'} title={profile ? `${profile.fullName} · ${profile.email}` : undefined}>
    <UserAvatar name={profile?.fullName} url={profile?.avatarUrl} />
    <span className="grid min-w-0 gap-0.5 group-data-[collapsible=icon]:hidden"><strong className="truncate text-sm font-semibold text-foreground">{profile?.fullName || 'Đang tải hồ sơ...'}</strong>{profile?.email && <small className="truncate text-xs text-muted-foreground">{profile.email}</small>}</span>
  </Link>
}
