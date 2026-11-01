import { Link } from 'react-router-dom'
import { managementText } from '../../data/managementI18n'
import type { Language } from '../../types/preferences'
import { Activity, BarChart3, BookOpen, CreditCard, Users } from 'lucide-react'

const stats = [
  { label: 'Tổng người dùng', icon: Users },
  { label: 'Người dùng mới hôm nay', icon: Users },
  { label: 'Khóa học hoạt động', icon: BookOpen },
  { label: 'Doanh thu tháng này', icon: CreditCard },
  { label: 'Học viên mới tháng này', icon: Users },
]

export function AdminDashboardPage({ language = 'vi' }: { language?: Language } = {}) {
  const t = (message: string) => managementText(message, language)
 return <main className="page-content admin-page"><header className="admin-topbar"><div><span className="section-kicker">{t("TechVerse administration")}</span><h1>{t("Trang chủ")}</h1></div><div className="admin-topbar-actions"><Link to="/settings/language">{language === 'vi' ? 'Tiếng Việt' : 'English'}</Link><Link to="/settings/theme">{language === 'vi' ? 'Giao diện' : 'Appearance'}</Link></div></header><div className="admin-content"><h2>{t("Chào mừng trở lại!")}</h2><p className="admin-subtitle">{t("Đây là tổng quan về hoạt động của hệ thống TechVerse hôm nay.")}</p><div className="admin-stat-grid">{stats.map(({ label, icon: Icon }) => <article className="admin-stat-card" key={label}><div className="admin-stat-icon"><Icon size={21} /></div><span>{t(label)}</span><strong>—</strong></article>)}</div><div className="admin-dashboard-grid"><section className="admin-activity-card"><header><div><h3><Activity size={17} />{t("Hoạt động gần đây")}</h3><p>{t("Các hoạt động mới nhất trên hệ thống")}</p></div><span className="empty-badge">{t("Chưa có dữ liệu")}</span></header><div className="admin-table"><div className="admin-table-head"><span>{t("KHÁCH HÀNG")}</span><span>{t("NỘI DUNG HOẠT ĐỘNG")}</span><span>{t("SỐ TIỀN")}</span><span>{t("THỜI GIAN")}</span><span>{t("TRẠNG THÁI")}</span></div><div className="admin-empty"><BarChart3 size={25} /><strong>{t("Chưa có hoạt động")}</strong><span>{t("Dữ liệu hoạt động sẽ xuất hiện khi hệ thống có giao dịch.")}</span></div></div></section><section className="admin-online-card"><header><div><h3><i />{t("Thành viên trực tuyến")}</h3><p>{t("Danh sách người dùng đang hoạt động thực tế")}</p></div><span className="empty-badge">{t("— online")}</span></header><div className="admin-empty"><Users size={25} /><strong>{t("Chưa có dữ liệu")}</strong><span>{t("Danh sách thành viên sẽ được cập nhật từ backend.")}</span></div></section></div></div></main> }
