import { useState } from 'react'

// Hiển thị avatar thật; dùng chữ cái tên khi chưa có ảnh hoặc URL ảnh bị lỗi.
export function UserAvatar({ name, url, className = '' }: { name?: string | null; url?: string | null; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const parts = name?.trim().split(/\s+/).filter(Boolean) || []
  const initials = parts.length ? `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase() : '?'
  return <span className={`user-avatar ${className}`}>
    {url && url !== failedUrl
      ? <img src={url} alt={`Ảnh đại diện ${name || ''}`.trim()} onError={() => setFailedUrl(url)} referrerPolicy="no-referrer" />
      : <span aria-hidden="true">{initials}</span>}
  </span>
}
