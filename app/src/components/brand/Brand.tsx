import { Link } from 'react-router-dom'

// Icon-only crop of the Cloudinary master (techverse/brand/logo); the text mark stays in HTML.
const LOGO_URL = 'https://res.cloudinary.com/baxlqjtt/image/upload/c_crop,x_545,y_490,w_960,h_960/c_scale,w_128/f_auto,q_auto/v1793638005/techverse/brand/logo.png'

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link to="/" aria-label="TechVerse home" className="inline-flex min-w-0 items-center gap-2.5 rounded-md outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
    <img src={LOGO_URL} alt="" width={32} height={32} className="block size-8 shrink-0 rounded-lg" />
    {!compact && <span className="truncate text-lg font-bold tracking-tight text-foreground">Tech<span className="text-accent-text">Verse</span></span>}
  </Link>
}
