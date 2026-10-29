import { Activity, BarChart3, BookOpen, CreditCard, Users } from 'lucide-react'

const stats = [
  { label: 'Tổng người dùng', icon: Users },
  { label: 'Người dùng mới hôm nay', icon: Users },
  { label: 'Khóa học hoạt động', icon: BookOpen },
  { label: 'Doanh thu tháng này', icon: CreditCard },
  { label: 'Học viên mới tháng này', icon: Users },
]

export function AdminDashboardPage() { return <main className="page-content admin-page"><header className="admin-topbar"><div><span className="section-kicker">TechVerse administration</span><h1>Trang chủ</h1></div><div className="admin-topbar-actions"><span>🇻🇳 Tiếng Việt</span><span>◐</span><span>♧</span></div></header><div className="admin-content"><h2>Chào mừng trở lại!</h2><p className="admin-subtitle">Đây là tổng quan về hoạt động của hệ thống TechVerse hôm nay.</p><div className="admin-stat-grid">{stats.map(({ label, icon: Icon }) => <article className="admin-stat-card" key={label}><div className="admin-stat-icon"><Icon size={21} /></div><span>{label}</span><strong>—</strong></article>)}</div><div className="admin-dashboard-grid"><section className="admin-activity-card"><header><div><h3><Activity size={17} />Hoạt động gần đây</h3><p>Các hoạt động mới nhất trên hệ thống</p></div><span className="empty-badge">Chưa có dữ liệu</span></header><div className="admin-table"><div className="admin-table-head"><span>KHÁCH HÀNG</span><span>NỘI DUNG HOẠT ĐỘNG</span><span>SỐ TIỀN</span><span>THỜI GIAN</span><span>TRẠNG THÁI</span></div><div className="admin-empty"><BarChart3 size={25} /><strong>Chưa có hoạt động</strong><span>Dữ liệu hoạt động sẽ xuất hiện khi hệ thống có giao dịch.</span></div></div></section><section className="admin-online-card"><header><div><h3><i />Thành viên trực tuyến</h3><p>Danh sách người dùng đang hoạt động thực tế</p></div><span className="empty-badge">— online</span></header><div className="admin-empty"><Users size={25} /><strong>Chưa có dữ liệu</strong><span>Danh sách thành viên sẽ được cập nhật từ backend.</span></div></section></div></div></main> }
