import { Moon, Sun } from 'lucide-react'
import type { Translation } from '../../data/i18n'
import type { Theme } from '../../types/preferences'
import { PreferenceOption, SettingsLayout } from './SettingsLayout'

export function ThemePage({ theme, setTheme, t }: { theme: Theme; setTheme: (theme: Theme) => void; t: Translation }) {
  const options = [{ value: 'light' as Theme, icon: Sun, title: t.light, desc: t.lightDesc }, { value: 'dark' as Theme, icon: Moon, title: t.dark, desc: t.darkDesc }]
  return <SettingsLayout title={t.themeTitle} description={t.themeDescription}>
    {options.map(({ value, icon: Icon, title, desc }) => <PreferenceOption key={value} selected={theme === value} onSelect={() => setTheme(value)} icon={<Icon size={22} />} title={title} description={desc} />)}
  </SettingsLayout>
}
