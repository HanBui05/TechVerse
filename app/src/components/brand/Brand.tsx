import { Link } from 'react-router-dom'

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link to="/" className={`brand ${compact ? 'brand-compact' : ''}`} aria-label="TechVerse home"><span className="brand-mark">T<span className="brand-spark">✦</span></span>{!compact && <span className="brand-name">Tech<span>Verse</span></span>}</Link>
}
