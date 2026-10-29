import { Check, Moon, Sun } from 'lucide-react'
import type { Translation } from '../../data/i18n'
import type { Theme } from '../../types/preferences'
import { SettingsLayout } from './SettingsLayout'

export function ThemePage({ theme, setTheme, t }: { theme: Theme; setTheme: (theme: Theme) => void; t: Translation }) { const options = [{ value: 'light' as Theme, icon: Sun, title: t.light, desc: t.lightDesc }, { value: 'dark' as Theme, icon: Moon, title: t.dark, desc: t.darkDesc }]; return <SettingsLayout title={t.themeTitle} description={t.themeDescription}><div className="preference-grid theme-grid">{options.map(({ value, icon: Icon, title, desc }) => <button key={value} className={`preference-card theme-card theme-${value} ${theme === value ? 'is-selected' : ''}`} onClick={() => setTheme(value)}><span className="preference-icon"><Icon size={27} /></span><span className="preference-copy"><strong>{title}</strong><small>{desc}</small></span>{theme === value && <span className="selected-check"><Check size={14} /></span>}<span className="preference-preview" /></button>)}</div></SettingsLayout> }
