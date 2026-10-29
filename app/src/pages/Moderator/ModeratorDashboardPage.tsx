import { ClipboardList, FileText, MessageSquare, ShieldCheck } from 'lucide-react'
import type { Language } from '../../types/preferences'

export function ModeratorDashboardPage({ language }: { language: Language }) {
  const vi = language === 'vi'
  const cards = [
    { icon: ClipboardList, label: vi ? 'Nội dung chờ kiểm duyệt' : 'Content awaiting review' },
    { icon: MessageSquare, label: vi ? 'Bình luận cần xem xét' : 'Comments for review' },
    { icon: ShieldCheck, label: vi ? 'Báo cáo cần xử lý' : 'Reports to review' },
  ]
  return <main className="page-content moderator-page"><div className="moderator-content">
    <header className="moderator-heading"><div><span className="section-kicker">TechVerse Moderator</span><h1>{vi ? 'Không gian kiểm duyệt' : 'Moderation workspace'}</h1><p>{vi ? 'Theo dõi nội dung và hoạt động của cộng đồng.' : 'Follow community content and activity.'}</p></div><div className="moderator-heading-icon"><ShieldCheck size={28} /></div></header>
    <div className="moderator-stats">{cards.map(({ icon: Icon, label }) => <section className="moderator-card" key={label}><div className="moderator-card-icon"><Icon size={20} /></div><span>{label}</span><strong>—</strong></section>)}</div>
    <section className="moderator-queue"><div className="moderator-queue-heading"><div><h2>{vi ? 'Hàng đợi kiểm duyệt' : 'Moderation queue'}</h2><p>{vi ? 'Nội dung cần xem xét sẽ xuất hiện tại đây.' : 'Content for review will appear here.'}</p></div><span>{vi ? 'Chưa có dữ liệu' : 'No data'}</span></div><div className="moderator-empty"><FileText size={28} /><strong>{vi ? 'Chưa có nội dung để hiển thị' : 'No content to display'}</strong><p>{vi ? 'Thông tin sẽ được cập nhật khi tính năng kiểm duyệt sẵn sàng.' : 'Information will appear when moderation is available.'}</p></div></section>
  </div></main>
}
