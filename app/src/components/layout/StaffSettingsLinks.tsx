import { settingsItems } from '../../data/navigation'
import type { Language } from '../../types/preferences'
import { SettingsMenu } from './Sidebar'

// Giữ cài đặt chung luôn có thể truy cập từ cả workspace Admin và Moderator, cùng kiểu thu gọn với sidebar người dùng.
export function StaffSettingsLinks({ language }: { language: Language }) {
  const vi = language === 'vi'
  const labels: Record<string, string> = { appearance: vi ? 'Giao diện' : 'Appearance', language: vi ? 'Ngôn ngữ' : 'Language' }
  return <SettingsMenu className="mt-auto" label={vi ? 'Cài đặt' : 'Settings'} links={settingsItems.map(({ path, icon, tone, key }) => ({ path, icon, tone, label: labels[key] }))} />
}
