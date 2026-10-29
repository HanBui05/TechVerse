import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, BookOpen, GraduationCap, Link2 } from 'lucide-react'
import { applyAuthorProfile, getMyAuthorProfile, resubmitAuthorProfile, type AuthorProfile } from '../../services/profileService'

const specialties = ['Phát triển Frontend', 'Phát triển Backend', 'Phát triển Full-stack', 'Phát triển ứng dụng di động', 'Kỹ thuật phần mềm', 'Trí tuệ nhân tạo và Machine Learning', 'Khoa học dữ liệu', 'Kỹ thuật dữ liệu', 'Phân tích dữ liệu', 'An toàn thông tin', 'Điện toán đám mây', 'DevOps và Site Reliability Engineering', 'Quản trị hệ thống và mạng', 'Cơ sở dữ liệu', 'Kiểm thử phần mềm và QA', 'Thiết kế UX/UI', 'Phát triển game', 'Internet of Things (IoT)', 'Hệ thống nhúng', 'Blockchain', 'Kiến trúc phần mềm', 'Quản lý sản phẩm công nghệ']

export function AuthorApplyPage() {
  const [form, setForm] = useState({ bio: '', expertise: '', portfolioUrl: '' })
  const [application, setApplication] = useState<AuthorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const load = async () => {
    setLoading(true); setError('')
    try {
      const result = await getMyAuthorProfile()
      setApplication(result)
      if (result.profile) setForm({ bio: result.profile.bio, expertise: result.profile.expertise, portfolioUrl: result.profile.portfolioUrl || '' })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải hồ sơ Author.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSuccess('')
    const bio = form.bio.trim(); const expertise = form.expertise.trim(); const portfolioUrl = form.portfolioUrl.trim()
    if (bio.length < 50 || bio.length > 2000 || expertise.length < 3 || expertise.length > 255) { setError('Giới thiệu cần từ 50–2000 ký tự và chuyên môn cần từ 3–255 ký tự.'); return }
    if (portfolioUrl) { try { const url = new URL(portfolioUrl); if (!['http:', 'https:'].includes(url.protocol)) throw new Error() } catch { setError('Đường dẫn portfolio phải bắt đầu bằng http:// hoặc https://.'); return } }
    setSaving(true)
    try {
      const data = { bio, expertise, portfolioUrl: portfolioUrl || undefined }
      if (application?.applicationStatus === 'REJECTED' && application.profile) await resubmitAuthorProfile({ ...data, expectedVersion: application.profile.version })
      else await applyAuthorProfile(data)
      await load(); setSuccess('Hồ sơ đã được gửi và đang chờ xét duyệt.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể gửi hồ sơ.') }
    finally { setSaving(false) }
  }
  const editable = application?.applicationStatus === 'NOT_APPLIED' || application?.applicationStatus === 'REJECTED'
  const labels: Record<string, string> = { PENDING: 'Đang chờ duyệt', APPROVED: 'Đã được duyệt', REJECTED: 'Đã bị từ chối', SUSPENDED: 'Đang tạm ngưng' }
  return <main className="page-content author-apply-page"><div className="author-apply-illustration"><div className="author-illustration-orbit"><GraduationCap size={92} /></div><BookOpen size={42} /><Link2 size={34} /></div><section className="author-apply-card"><span className="section-kicker">TechVerse Author</span><h1>Trở thành Author</h1><p className="author-intro">Chia sẻ kiến thức và đồng hành cùng cộng đồng học lập trình.</p>
    {loading && <p role="status">Đang tải hồ sơ...</p>}
    {error && <p className="author-apply-error" role="alert">{error}</p>}
    {success && <p className="author-form-status" role="status">{success}</p>}
    {!loading && !application && <button className="button button-outline" type="button" onClick={() => void load()}>Thử lại</button>}
    {!loading && application && application.applicationStatus !== 'NOT_APPLIED' && <p className="author-application-status"><strong>Trạng thái:</strong> {labels[application.applicationStatus] || application.applicationStatus}</p>}
    {application?.applicationStatus === 'REJECTED' && application.profile?.reviewNote && <p className="author-application-status"><strong>Ghi chú của người duyệt:</strong> {application.profile.reviewNote}</p>}
    {!loading && editable && <form onSubmit={submit}><label><span>Giới thiệu bản thân và kinh nghiệm *</span><textarea required minLength={50} maxLength={2000} rows={6} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Giới thiệu kinh nghiệm, bằng cấp hoặc chứng chỉ liên quan nếu có (tối thiểu 50 ký tự)." /><small>{form.bio.trim().length}/2000 ký tự · tối thiểu 50</small></label><label><span>Chuyên môn / lĩnh vực giảng dạy *</span><select required value={form.expertise} onChange={e => setForm({ ...form, expertise: e.target.value })}><option value="">Chọn chuyên ngành IT</option>{form.expertise && !specialties.includes(form.expertise) && <option value={form.expertise}>{form.expertise} (đã lưu)</option>}{specialties.map(specialty => <option key={specialty} value={specialty}>{specialty}</option>)}</select></label><label><span>Đường dẫn portfolio hoặc thư viện giảng dạy (không bắt buộc)</span><input type="url" maxLength={500} value={form.portfolioUrl} onChange={e => setForm({ ...form, portfolioUrl: e.target.value })} placeholder="https://youtube.com/@your-channel" /></label><p className="author-upload-note">Bạn có thể nêu bằng cấp, chứng chỉ và kinh nghiệm trong phần giới thiệu.</p><button className="button button-primary full-width" type="submit" disabled={saving}>{saving ? 'Đang gửi...' : application?.applicationStatus === 'REJECTED' ? 'Gửi lại hồ sơ' : 'Gửi hồ sơ'} <ArrowRight size={17} /></button></form>}
  </section></main>
}
