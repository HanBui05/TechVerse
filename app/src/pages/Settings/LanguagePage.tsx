import type { Translation } from '../../data/i18n'
import type { Language } from '../../types/preferences'
import { PreferenceOption, SettingsLayout } from './SettingsLayout'

export function LanguagePage({ language, setLanguage, t }: { language: Language; setLanguage: (language: Language) => void; t: Translation }) {
  const options = [{ value: 'vi' as Language, flag: '🇻🇳', title: t.vietnamese, code: 'VI', desc: t.vietnameseDesc }, { value: 'en' as Language, flag: '🇺🇸', title: t.english, code: 'EN', desc: t.englishDesc }]
  return <SettingsLayout title={t.languageTitle} description={t.languageDescription}>
    {options.map(({ value, flag, title, code, desc }) => <PreferenceOption key={value} selected={language === value} onSelect={() => setLanguage(value)} icon={flag}
      title={<>{title} <em className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold not-italic text-muted-foreground">{code}</em></>} description={desc} />)}
  </SettingsLayout>
}
