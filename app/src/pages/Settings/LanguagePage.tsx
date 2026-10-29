import { Check } from 'lucide-react'
import type { Translation } from '../../data/i18n'
import type { Language } from '../../types/preferences'
import { SettingsLayout } from './SettingsLayout'

export function LanguagePage({ language, setLanguage, t }: { language: Language; setLanguage: (language: Language) => void; t: Translation }) { const options = [{ value: 'vi' as Language, flag: '🇻🇳', title: t.vietnamese, code: 'VI', desc: t.vietnameseDesc }, { value: 'en' as Language, flag: '🇺🇸', title: t.english, code: 'EN', desc: t.englishDesc }]; return <SettingsLayout title={t.languageTitle} description={t.languageDescription}><div className="preference-grid language-grid">{options.map(({ value, flag, title, code, desc }) => <button key={value} className={`preference-card language-card ${language === value ? 'is-selected' : ''}`} onClick={() => setLanguage(value)}><span className="flag-icon">{flag}</span><span className="preference-copy"><strong>{title} <em>{code}</em></strong><small>{desc}</small></span>{language === value && <span className="selected-check"><Check size={14} /></span>}</button>)}</div></SettingsLayout> }
