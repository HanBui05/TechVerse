import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, BadgeCheck, BrainCircuit, CalendarClock, Check, Code2, ExternalLink, FileText, History, Hourglass, Lightbulb, Palette, PauseCircle, PenLine, RotateCcw, ServerCog, ShieldCheck, XCircle, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from 'cn'
import type { BadgeTone } from '@/components/ui/badge'
import { statusTone, toneFor } from '@/lib/utils'
import { statusLabel } from '../../data/managementI18n'
import { ApiError } from '../../services/api/client'
import { applyAuthorProfile, getMyAuthorProfile, resubmitAuthorProfile, type AuthorProfile } from '../../services/profileService'
import type { Language } from '../../types/preferences'

// Stored/sent values stay Vietnamese (existing data); English only translates the visible label.
// Grouped only for display; the 22 values are unchanged.
const specialtyGroups: { vi: string; en: string; icon: LucideIcon; tone: BadgeTone; items: [string, string][] }[] = [
  { vi: 'Phát triển phần mềm', en: 'Software development', icon: Code2, tone: 'blue', items: [
    ['Phát triển Frontend', 'Frontend development'], ['Phát triển Backend', 'Backend development'], ['Phát triển Full-stack', 'Full-stack development'],
    ['Phát triển ứng dụng di động', 'Mobile app development'], ['Phát triển game', 'Game development'], ['Kỹ thuật phần mềm', 'Software engineering'],
    ['Kiến trúc phần mềm', 'Software architecture'], ['Kiểm thử phần mềm và QA', 'Software testing and QA'],
  ] },
  { vi: 'Dữ liệu & AI', en: 'Data & AI', icon: BrainCircuit, tone: 'purple', items: [
    ['Trí tuệ nhân tạo và Machine Learning', 'AI and Machine Learning'], ['Khoa học dữ liệu', 'Data science'], ['Kỹ thuật dữ liệu', 'Data engineering'],
    ['Phân tích dữ liệu', 'Data analytics'], ['Cơ sở dữ liệu', 'Databases'],
  ] },
  { vi: 'Hạ tầng & bảo mật', en: 'Infrastructure & security', icon: ServerCog, tone: 'cyan', items: [
    ['Điện toán đám mây', 'Cloud computing'], ['DevOps và Site Reliability Engineering', 'DevOps and Site Reliability Engineering'], ['Quản trị hệ thống và mạng', 'System and network administration'],
    ['An toàn thông tin', 'Information security'], ['Internet of Things (IoT)', 'Internet of Things (IoT)'], ['Hệ thống nhúng', 'Embedded systems'], ['Blockchain', 'Blockchain'],
  ] },
  { vi: 'Thiết kế & sản phẩm', en: 'Design & product', icon: Palette, tone: 'amber', items: [
    ['Thiết kế UX/UI', 'UX/UI design'], ['Quản lý sản phẩm công nghệ', 'Technology product management'],
  ] },
]
const specialties = specialtyGroups.flatMap(group => group.items)
const englishSpecialty = new Map(specialties)
// Unknown/free-text values are shown verbatim, never translated.
const expertiseLabel = (value: string, vi: boolean) => vi ? value : englishSpecialty.get(value) ?? value

const copy = {
  vi: {
    kicker: 'Tác giả', title: 'Trở thành Tác giả TechVerse', intro: 'Chia sẻ kiến thức và đồng hành cùng cộng đồng học lập trình.',
    steps: [
      ['Gửi hồ sơ', 'Giới thiệu kinh nghiệm, chọn chuyên môn và thêm portfolio nếu có.'],
      ['Admin xét duyệt', 'Kết quả và ghi chú xét duyệt hiển thị ngay tại trang này.'],
      ['Bắt đầu viết bài', 'Khi được duyệt, mục Tác giả trong menu dẫn tới khu viết bài.'],
    ],
    stepsLabel: 'Quy trình đăng ký', tip: 'Bạn có thể nêu bằng cấp, chứng chỉ và kinh nghiệm trong phần giới thiệu.',
    loading: 'Đang tải hồ sơ...', loadError: 'Không tải được hồ sơ Tác giả.', retry: 'Thử lại',
    formTitle: 'Hồ sơ đăng ký', formNew: 'Điền ba thông tin dưới đây để gửi hồ sơ.', formAgain: 'Hồ sơ đã được điền sẵn, chỉnh sửa rồi gửi lại.',
    bio: 'Giới thiệu bản thân và kinh nghiệm', bioHint: 'Giới thiệu kinh nghiệm, bằng cấp hoặc chứng chỉ liên quan nếu có (tối thiểu 50 ký tự).',
    count: (n: number) => `${n}/2000 ký tự · tối thiểu 50`,
    expertise: 'Chuyên môn / lĩnh vực', pick: 'Chọn một lĩnh vực phù hợp nhất với bạn.', current: 'Đang chọn:', none: 'Chưa chọn', saved: 'đã lưu',
    portfolio: 'Đường dẫn portfolio', optional: 'không bắt buộc',
    submit: 'Gửi hồ sơ', resubmit: 'Gửi lại hồ sơ', sending: 'Đang gửi...',
    invalid: 'Giới thiệu cần từ 50–2000 ký tự và chuyên môn cần từ 3–255 ký tự.', invalidUrl: 'Đường dẫn portfolio phải bắt đầu bằng http:// hoặc https://.',
    sent: 'Hồ sơ đã được gửi và đang chờ xét duyệt.', changed: 'Hồ sơ đã thay đổi', sendError: 'Không gửi được hồ sơ. Vui lòng thử lại.',
    status: {
      PENDING: ['Hồ sơ đang chờ xét duyệt', 'Kết quả sẽ hiển thị tại đây khi Admin xét duyệt xong.'],
      APPROVED: ['Hồ sơ đã được duyệt', 'Bạn đã có quyền Tác giả trên TechVerse.'],
      REJECTED: ['Hồ sơ chưa được duyệt', 'Xem lý do bên dưới, chỉnh sửa hồ sơ rồi gửi lại.'],
      SUSPENDED: ['Quyền Tác giả đang tạm ngưng', 'Hồ sơ vẫn được lưu; lý do tạm ngưng ở bên dưới.'],
    } as Record<string, [string, string]>,
    submittedAt: 'Gửi lúc', reviewedAt: 'Xét duyệt lúc', suspendedAt: 'Tạm ngưng lúc', restoredAt: 'Khôi phục lúc',
    reason: 'Lý do', note: 'Ghi chú xét duyệt', restoration: 'Ghi chú khôi phục', summary: 'Hồ sơ đã gửi', openPortfolio: 'Mở portfolio',
    history: 'Lịch sử xét duyệt', version: 'Hồ sơ',
  },
  en: {
    kicker: 'Author', title: 'Become a TechVerse Author', intro: 'Share your knowledge and grow together with the programming community.',
    steps: [
      ['Submit your application', 'Describe your experience, pick your expertise and add a portfolio if you have one.'],
      ['Admin review', 'The decision and review notes appear right on this page.'],
      ['Start writing', 'Once approved, the Author menu entry opens your writing space.'],
    ],
    stepsLabel: 'How to apply', tip: 'You can mention degrees, certificates and experience in the About you field.',
    loading: 'Loading application...', loadError: 'Could not load your Author application.', retry: 'Try again',
    formTitle: 'Application', formNew: 'Fill in the three fields below to apply.', formAgain: 'Your application is prefilled; edit it and resubmit.',
    bio: 'About you and your experience', bioHint: 'Describe your experience and any relevant degrees or certificates (at least 50 characters).',
    count: (n: number) => `${n}/2000 characters · at least 50`,
    expertise: 'Expertise / field', pick: 'Pick the one field that fits you best.', current: 'Selected:', none: 'None yet', saved: 'saved',
    portfolio: 'Portfolio link', optional: 'optional',
    submit: 'Submit application', resubmit: 'Resubmit application', sending: 'Sending...',
    invalid: 'About you needs 50–2000 characters and expertise needs 3–255 characters.', invalidUrl: 'The portfolio link must start with http:// or https://.',
    sent: 'Your application was submitted and is awaiting review.', changed: 'The application has changed', sendError: 'Could not submit the application. Please try again.',
    status: {
      PENDING: ['Your application is awaiting review', 'The decision will appear here once an admin has reviewed it.'],
      APPROVED: ['Your application was approved', 'You now have Author access on TechVerse.'],
      REJECTED: ['Your application was not approved', 'See the reason below, edit your application and resubmit.'],
      SUSPENDED: ['Author access is suspended', 'Your application is kept; the suspension reason is below.'],
    } as Record<string, [string, string]>,
    submittedAt: 'Submitted', reviewedAt: 'Reviewed', suspendedAt: 'Suspended', restoredAt: 'Restored',
    reason: 'Reason', note: 'Review note', restoration: 'Restoration note', summary: 'Submitted application', openPortfolio: 'Open portfolio',
    history: 'Review history', version: 'Application',
  },
}
type Copy = typeof copy.vi

const statusIcon: Record<string, LucideIcon> = { PENDING: Hourglass, APPROVED: BadgeCheck, REJECTED: XCircle, SUSPENDED: PauseCircle }
const steps: [LucideIcon, BadgeTone][] = [[FileText, 'blue'], [ShieldCheck, 'amber'], [PenLine, 'green']]
const iconBox: Record<BadgeTone, string> = {
  blue: 'border-tone-blue-border bg-tone-blue-bg text-tone-blue-fg', green: 'border-tone-green-border bg-tone-green-bg text-tone-green-fg',
  purple: 'border-tone-purple-border bg-tone-purple-bg text-tone-purple-fg', amber: 'border-tone-amber-border bg-tone-amber-bg text-tone-amber-fg',
  rose: 'border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg', sky: 'border-tone-sky-border bg-tone-sky-bg text-tone-sky-fg',
  cyan: 'border-tone-cyan-border bg-tone-cyan-bg text-tone-cyan-fg', slate: 'border-tone-slate-border bg-tone-slate-bg text-tone-slate-fg',
}
const fieldLabel = 'text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground'
const control = 'pointer-coarse:h-11'
// Saved expertise is free text up to 255 chars (maybe without spaces): let its Badge wrap instead of overflowing.
const wrapBadge = 'max-w-full shrink whitespace-normal [overflow-wrap:anywhere]'
// Long lists/text scroll inside a bounded box instead of stretching the page (see skill ui-components).
const scrollArea = 'overflow-y-auto overscroll-contain [scrollbar-width:thin] outline-none focus-visible:ring-[3px] focus-visible:ring-ring'

export function AuthorApplyPage({ language = 'vi' }: { language?: Language }) {
  const vi = language === 'vi'
  const t = vi ? copy.vi : copy.en
  const [form, setForm] = useState({ bio: '', expertise: '', portfolioUrl: '' })
  const [application, setApplication] = useState<AuthorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const latest = useRef(0)
  const date = (value?: string | null) => value ? new Date(value).toLocaleString(vi ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : ''

  // Returns false when loading failed; a quiet reload keeps the current view instead of the skeleton.
  const load = async (quiet = false) => {
    const id = ++latest.current
    if (!quiet) { setLoading(true); setError('') }
    try {
      const result = await getMyAuthorProfile()
      if (id !== latest.current) return false
      setApplication(result)
      setForm(result.profile ? { bio: result.profile.bio, expertise: result.profile.expertise, portfolioUrl: result.profile.portfolioUrl || '' } : { bio: '', expertise: '', portfolioUrl: '' })
      return true
    } catch {
      if (id === latest.current) setError(t.loadError)
      return false
    } finally { if (id === latest.current) setLoading(false) }
  }
  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSuccess('')
    const bio = form.bio.trim(); const expertise = form.expertise.trim(); const portfolioUrl = form.portfolioUrl.trim()
    if (bio.length < 50 || bio.length > 2000 || expertise.length < 3 || expertise.length > 255) { setError(t.invalid); return }
    if (portfolioUrl) { try { const url = new URL(portfolioUrl); if (!['http:', 'https:'].includes(url.protocol)) throw new Error() } catch { setError(t.invalidUrl); return } }
    setSaving(true)
    try {
      const data = { bio, expertise, portfolioUrl: portfolioUrl || undefined }
      if (application?.applicationStatus === 'REJECTED' && application.profile) await resubmitAuthorProfile({ ...data, expectedVersion: application.profile.version })
      else await applyAuthorProfile(data)
      await load(true); setSuccess(t.sent)
    } catch (cause) {
      // 409: someone (e.g. another tab) changed the application — show the server's state instead of the stale form.
      // If that reload also fails, drop the stale form and offer a retry instead.
      if (cause instanceof ApiError && cause.status === 409) { if (!(await load(true))) setApplication(null); setError(t.changed) }
      else setError(t.sendError)
    } finally { setSaving(false) }
  }

  const status = application?.applicationStatus ?? ''
  const editable = status === 'NOT_APPLIED' || status === 'REJECTED'
  const profile = application?.profile
  const history = application?.reviewHistory ?? []

  return <main className="tw-page mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
      <section aria-labelledby="author-apply-title" className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-6 lg:p-8">
        <div className="flex flex-col gap-3">
          <Badge tone="purple" className="self-start gap-1.5"><PenLine aria-hidden className="size-3.5" />{t.kicker}</Badge>
          <h1 id="author-apply-title" className="text-3xl font-bold leading-tight lg:text-4xl">{t.title}</h1>
          <p className="text-base text-muted-foreground">{t.intro}</p>
        </div>
        <ol aria-label={t.stepsLabel} data-slot="author-steps" className="m-0 flex list-none flex-col p-0">
          {t.steps.map(([title, text], index) => {
            const [Icon, tone] = steps[index]
            return <li key={title} className="group relative flex gap-4 pb-6 last:pb-0">
              {index < t.steps.length - 1 && <span aria-hidden className="absolute top-11 bottom-1 left-5 w-px bg-border" />}
              <span aria-hidden className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0', iconBox[tone])}><Icon className="size-5" /></span>
              <div className="flex flex-col gap-1 pt-0.5">
                <span className="text-xs font-semibold text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                <h2 className="text-sm font-semibold">{title}</h2>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </li>
          })}
        </ol>
        <p className="flex items-start gap-2 rounded-xl border border-border bg-muted p-3 text-xs text-muted-foreground"><Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />{t.tip}</p>
      </section>

      <div className="flex min-w-0 flex-col gap-6">
        {error && <p role="alert" className="rounded-xl border border-tone-rose-border bg-tone-rose-bg px-4 py-3 text-sm text-tone-rose-fg">{error}</p>}
        {success && <p role="status" className="flex items-center gap-2 rounded-xl border border-tone-green-border bg-tone-green-bg px-4 py-3 text-sm text-tone-green-fg"><BadgeCheck aria-hidden className="size-4 shrink-0" />{success}</p>}

        {loading && <Card className="rounded-2xl" aria-busy="true" aria-label={t.loading}><CardContent className="flex flex-col gap-5">
          <div className="flex items-center gap-3"><Skeleton className="size-10 rounded-xl" /><div className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-64 max-w-full" /></div></div>
          <Skeleton className="h-28 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-40" />
        </CardContent></Card>}

        {!loading && !application && <Button variant="outline" className="self-start" onClick={() => void load()}><RotateCcw />{t.retry}</Button>}

        {!loading && application && status !== 'NOT_APPLIED' && <StatusCard status={status} language={language} t={t} icon={statusIcon[status] ?? Hourglass}>
          {status === 'REJECTED' && profile?.reviewNote && <Callout tone="rose" title={t.reason} meta={date(profile.reviewedAt) && `${t.reviewedAt} ${date(profile.reviewedAt)}`}>{profile.reviewNote}</Callout>}
          {status === 'SUSPENDED' && <Callout tone="rose" title={t.reason} meta={date(profile?.suspendedAt) && `${t.suspendedAt} ${date(profile?.suspendedAt)}`}>{profile?.suspensionReason}</Callout>}
          {status === 'APPROVED' && profile?.restoredAt && <Callout tone="green" title={t.restoration} meta={`${t.restoredAt} ${date(profile.restoredAt)}`}>{profile.restorationNote}</Callout>}
          {status === 'APPROVED' && !profile?.restoredAt && profile?.reviewNote && <Callout tone="green" title={t.note} meta={date(profile.reviewedAt) && `${t.reviewedAt} ${date(profile.reviewedAt)}`}>{profile.reviewNote}</Callout>}
          <dl className="m-0 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            {status === 'PENDING' && profile?.updatedAt && <div className="flex gap-1"><dt className="flex items-center gap-1"><CalendarClock aria-hidden className="size-3.5" />{t.submittedAt}</dt><dd className="m-0">{date(profile.updatedAt)}</dd></div>}
            {status === 'APPROVED' && profile?.reviewedAt && <div className="flex gap-1"><dt>{t.reviewedAt}</dt><dd className="m-0">{date(profile.reviewedAt)}</dd></div>}
          </dl>
        </StatusCard>}

        {!loading && profile && !editable && <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">{t.summary}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2"><span className={fieldLabel}>{t.expertise}</span><Badge tone={toneFor(profile.expertise)} className={cn('self-start', wrapBadge)}>{expertiseLabel(profile.expertise, vi)}</Badge></div>
            <div className="flex flex-col gap-2"><span className={fieldLabel}>{t.bio}</span><div role="region" aria-label={t.bio} tabIndex={0} className={cn(scrollArea, 'max-h-48 rounded-md border-l-2 border-border pr-2 pl-3')}><p className="text-sm whitespace-pre-line">{profile.bio}</p></div></div>
            {profile.portfolioUrl && <Button asChild variant="outline" className="self-start"><a href={profile.portfolioUrl} target="_blank" rel="noreferrer"><ExternalLink />{t.openPortfolio}</a></Button>}
          </CardContent>
        </Card>}

        {!loading && editable && <Card className="rounded-2xl"><CardHeader>
          <CardTitle className="text-base">{t.formTitle}</CardTitle>
          <CardDescription>{status === 'REJECTED' ? t.formAgain : t.formNew}</CardDescription>
        </CardHeader><CardContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="author-bio" className={fieldLabel}>{t.bio} *</Label>
              <Textarea id="author-bio" required minLength={50} maxLength={2000} rows={7} className="min-h-36 max-h-64 overflow-y-auto font-sans [scrollbar-width:thin]" aria-describedby="author-bio-count" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder={t.bioHint} />
              <small id="author-bio-count" className={cn('text-xs', form.bio.trim().length >= 50 ? 'text-success' : 'text-muted-foreground')}>{t.count(form.bio.trim().length)}</small>
            </div>
            <fieldset aria-describedby="author-expertise-hint" className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
              <legend className={cn(fieldLabel, 'mb-1 p-0')}>{t.expertise} *</legend>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p id="author-expertise-hint" className="text-xs text-muted-foreground">{t.pick}</p>
                <p data-slot="expertise-current" aria-live="polite" className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5 text-xs text-muted-foreground">{t.current} {form.expertise ? <Badge tone="slate" className={wrapBadge}>{expertiseLabel(form.expertise, vi)}</Badge> : <span>{t.none}</span>}</p>
              </div>
              <div role="region" aria-label={t.expertise} tabIndex={0} className={cn(scrollArea, 'flex max-h-80 flex-col gap-5 rounded-xl border border-border bg-background p-3 sm:p-4')}>
                {form.expertise && !englishSpecialty.has(form.expertise) && <div className="flex flex-wrap gap-2">
                  <ExpertiseChip value={form.expertise} label={`${form.expertise} (${t.saved})`} tone="slate" checked onChange={() => {}} />
                </div>}
                {specialtyGroups.map(({ vi: groupVi, en: groupEn, icon: Icon, tone, items }) => <fieldset key={groupVi} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                  <legend className="mb-2 flex items-center gap-2 p-0 text-sm font-semibold">
                    <span aria-hidden className={cn('flex size-7 items-center justify-center rounded-lg border', iconBox[tone])}><Icon className="size-4" /></span>
                    {vi ? groupVi : groupEn}
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {items.map(([value, en]) => <ExpertiseChip key={value} value={value} label={vi ? value : en} tone={tone} checked={form.expertise === value} onChange={() => setForm({ ...form, expertise: value })} />)}
                  </div>
                </fieldset>)}
              </div>
            </fieldset>
            <div className="flex flex-col gap-2">
              <Label htmlFor="author-portfolio" className={fieldLabel}>{t.portfolio} <span className="font-normal normal-case tracking-normal">({t.optional})</span></Label>
              <Input id="author-portfolio" type="url" maxLength={500} className={control} value={form.portfolioUrl} onChange={e => setForm({ ...form, portfolioUrl: e.target.value })} placeholder="https://youtube.com/@your-channel" />
            </div>
            <Button type="submit" size="lg" disabled={saving} className="w-full sm:self-end sm:w-auto">{saving ? t.sending : status === 'REJECTED' ? t.resubmit : t.submit}<ArrowRight /></Button>
          </form>
        </CardContent></Card>}

        {!loading && history.length > 0 && <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><History aria-hidden className="size-4 text-muted-foreground" />{t.history}</CardTitle></CardHeader>
          <CardContent>
            <div role="region" aria-label={t.history} tabIndex={0} className={cn(scrollArea, 'max-h-96 rounded-md pr-2 pl-1.5')}>
            <ol aria-label={t.history} data-slot="review-history" className="m-0 flex list-none flex-col gap-5 border-l border-border p-0 pl-5">
              {history.map((review, index) => <li key={`${review.applicationVersion}-${review.reviewedAt}-${index}`} className="relative flex flex-col gap-2">
                <span aria-hidden className={cn('absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-current', review.decision === 'APPROVED' ? 'text-tone-green-fg' : 'text-tone-rose-fg')} />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(review.decision)}>{statusLabel(review.decision, 'author', language)}</Badge>
                  <span className="text-xs text-muted-foreground">{t.version} v{review.applicationVersion} · {date(review.reviewedAt)}</span>
                </div>
                {review.reviewNote && <p className="text-sm whitespace-pre-line">{review.reviewNote}</p>}
                <Badge tone={toneFor(review.expertiseSnapshot)} className={cn('self-start', wrapBadge)}>{expertiseLabel(review.expertiseSnapshot, vi)}</Badge>
              </li>)}
            </ol>
            </div>
          </CardContent>
        </Card>}
      </div>
    </div>
  </main>
}

function StatusCard({ status, language, t, icon: Icon, children }: { status: string; language: Language; t: Copy; icon: LucideIcon; children: ReactNode }) {
  const tone = statusTone(status)
  const [title, text] = t.status[status] ?? [statusLabel(status, 'author', language), '']
  return <Card className="rounded-2xl"><CardContent className="flex flex-col gap-4">
    <div className="flex items-start gap-3">
      <span aria-hidden className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl border', iconBox[tone])}><Icon className="size-5" /></span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">{title}</h2><Badge tone={tone}>{statusLabel(status, 'author', language)}</Badge></div>
        {text && <p className="text-sm text-muted-foreground">{text}</p>}
      </div>
    </div>
    {children}
  </CardContent></Card>
}

function Callout({ tone, title, meta, children }: { tone: BadgeTone; title: string; meta?: string; children: ReactNode }) {
  if (!children) return null
  return <section className={cn('flex flex-col gap-1.5 rounded-xl border p-4', iconBox[tone])}>
    <h3 className="text-[11px] font-semibold uppercase tracking-[.05em]">{title}</h3>
    <p className="text-sm whitespace-pre-line">{children}</p>
    {meta && <span className="text-xs opacity-90">{meta}</span>}
  </section>
}

// Checked tone per group; literal classes so Tailwind can see them.
const chipOn: Record<BadgeTone, string> = {
  blue: 'has-checked:border-tone-blue-border has-checked:bg-tone-blue-bg has-checked:text-tone-blue-fg', green: 'has-checked:border-tone-green-border has-checked:bg-tone-green-bg has-checked:text-tone-green-fg',
  purple: 'has-checked:border-tone-purple-border has-checked:bg-tone-purple-bg has-checked:text-tone-purple-fg', amber: 'has-checked:border-tone-amber-border has-checked:bg-tone-amber-bg has-checked:text-tone-amber-fg',
  rose: 'has-checked:border-tone-rose-border has-checked:bg-tone-rose-bg has-checked:text-tone-rose-fg', sky: 'has-checked:border-tone-sky-border has-checked:bg-tone-sky-bg has-checked:text-tone-sky-fg',
  cyan: 'has-checked:border-tone-cyan-border has-checked:bg-tone-cyan-bg has-checked:text-tone-cyan-fg', slate: 'has-checked:border-tone-slate-border has-checked:bg-tone-slate-bg has-checked:text-tone-slate-fg',
}

// A native radio styled as a chip: keeps arrow-key navigation, form semantics and screen-reader names.
function ExpertiseChip({ value, label, tone, checked, onChange }: { value: string; label: string; tone: BadgeTone; checked: boolean; onChange: () => void }) {
  return <label className={cn('group/chip relative inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-full [overflow-wrap:anywhere] border border-border bg-card px-3 py-1.5 text-[13px] transition-colors sm:text-sm duration-150 hover:border-ring has-checked:font-medium has-focus-visible:ring-[3px] has-focus-visible:ring-ring pointer-coarse:min-h-11 motion-reduce:transition-none', chipOn[tone])}>
    <input type="radio" name="author-expertise" value={value} checked={checked} onChange={onChange} className="sr-only" />
    <Check aria-hidden className="hidden size-3.5 shrink-0 group-has-checked/chip:block" />
    {label}
  </label>
}
