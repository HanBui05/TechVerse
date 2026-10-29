import { ArrowRight } from 'lucide-react'

export function CommunityCard({ name, description, icon, href }: { name: string; description: string; icon: string; href?: string }) { const content = <><span className="community-icon">{icon}</span><div><strong>{name}</strong><small>{description}</small></div><ArrowRight className="community-arrow" size={16} /></>; return href ? <a className="community-card" href={href} target="_blank" rel="noreferrer noopener">{content}</a> : <div className="community-card">{content}</div> }
