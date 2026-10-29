import { CircleHelp, ArrowRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { navItems } from '../data/navigation'
import type { Translation } from '../data/i18n'
import type { Language } from '../types/preferences'

export function PlaceholderPage({ t, language }: { t: Translation; language: Language }) { const location = useLocation(); const item = navItems.find(item => item.path === location.pathname); const pageName = item?.label[language] || (language === 'vi' ? 'Trang' : 'Page'); return <main className="page-content placeholder-page"><div className="placeholder-icon"><CircleHelp size={28} /></div><span className="section-kicker">{t.workspace}</span><h1>{pageName}</h1><p>{t.developing}</p><Link className="button button-primary" to="/">{t.backHome} <ArrowRight size={17} /></Link></main> }
