import { Link } from 'react-router-dom'
import type { UserProfile } from '../../services/profileService'
import { UserAvatar } from '../UserAvatar'

// Dùng chung danh tính từ /users/me cho sidebar của mọi role, không dùng dữ liệu demo.
export function AccountIdentity({ profile }: { profile: UserProfile | null }) {
  return <Link className="account-identity" to="/profile" aria-label={profile ? `Tài khoản: ${profile.fullName}` : 'Đang tải hồ sơ'} title={profile ? `${profile.fullName} · ${profile.email}` : undefined}>
    <UserAvatar name={profile?.fullName} url={profile?.avatarUrl} />
    <span className="account-identity-copy"><strong>{profile?.fullName || 'Đang tải hồ sơ...'}</strong>{profile?.email && <small>{profile.email}</small>}</span>
  </Link>
}
