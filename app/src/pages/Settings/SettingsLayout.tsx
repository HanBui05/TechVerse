import type { ReactNode } from 'react'

export function SettingsLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <main className="page-content settings-page"><div className="settings-content"><span className="section-kicker">TechVerse preferences</span><h1>{title}</h1><p className="settings-description">{description}</p>{children}</div></main> }
