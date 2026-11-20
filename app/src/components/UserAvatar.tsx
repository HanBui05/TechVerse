import { useState } from 'react'
import { cn } from 'cn'

// Hiển thị avatar thật; dùng chữ cái tên trên nền trung tính sạch sẽ khi chưa có ảnh hoặc URL ảnh bị lỗi.
export function UserAvatar({ name, url, className }: { name?: string | null; url?: string | null; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const parts = name?.trim().split(/\s+/).filter(Boolean) || []
  const initials = parts.length ? `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase() : '?'
  return <span data-slot="user-avatar" className={cn('inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-xs font-semibold tracking-tight text-foreground', className)}>
    {url && url !== failedUrl
      ? <img className="block size-full object-cover" src={url} alt={`Ảnh đại diện ${name || ''}`.trim()} onError={() => setFailedUrl(url)} referrerPolicy="no-referrer" />
      : <span aria-hidden="true">{initials}</span>}
  </span>
}
