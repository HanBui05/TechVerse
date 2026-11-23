import { vnd } from '../services/courseService'
import type { Language } from '../types/preferences'

export function formatCount(value: number | null | undefined, language: Language = 'vi'): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')
}

export function formatMoney(value: number | null | undefined, language: Language = 'vi'): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return vnd(value, language)
}

const COPY = {
  // Section & group headings
  overview: { vi: 'Số liệu', en: 'Overview' },
  groupUsers: { vi: 'Người dùng', en: 'Users' },
  groupAuthors: { vi: 'Tác giả', en: 'Authors' },
  groupContent: { vi: 'Nội dung đang công khai', en: 'Public content' },
  groupOrdersRevenue: { vi: 'Đơn hàng và doanh thu', en: 'Orders and revenue' },

  // Users
  totalUsers: { vi: 'Tổng người dùng', en: 'Total users' },
  activeUsers: { vi: 'Đang hoạt động', en: 'Active' },
  lockedUsers: { vi: 'Đã khóa', en: 'Locked' },
  newLast7Days: { vi: 'Mới trong 7 ngày', en: 'New in 7 days' },

  // Authors
  approvedAuthors: { vi: 'Tác giả đã duyệt', en: 'Approved authors' },
  suspendedAuthors: { vi: 'Tác giả bị đình chỉ', en: 'Suspended authors' },
  pendingApplications: { vi: 'Hồ sơ chờ duyệt', en: 'Pending applications' },

  // Public content
  articles: { vi: 'Bài viết', en: 'Articles' },
  courses: { vi: 'Khóa học', en: 'Courses' },
  exerciseSets: { vi: 'Bộ bài tập', en: 'Exercise sets' },
  interviewQuestions: { vi: 'Câu hỏi phỏng vấn', en: 'Interview questions' },
  forumQuestions: { vi: 'Câu hỏi diễn đàn', en: 'Forum questions' },

  // Orders
  awaitingConfirmation: { vi: 'Đơn chờ xác nhận', en: 'Orders awaiting confirmation' },
  needsReconciliation: { vi: 'Đơn cần đối chiếu', en: 'Orders to reconcile' },

  // Revenue
  revenue: { vi: 'Doanh thu', en: 'Revenue' },
  allTime: { vi: 'Toàn thời gian', en: 'All time' },
  last30Days: { vi: '30 ngày qua', en: 'Last 30 days' },
  paidOrders: { vi: 'Đơn đã thanh toán', en: 'Paid orders' },
  grossAmount: { vi: 'Tổng thu', en: 'Gross' },
  platformAmount: { vi: 'Nền tảng giữ', en: 'Platform share' },
  authorAmount: { vi: 'Tác giả nhận', en: 'Author share' },

  // Moderator queues
  articlesPending: { vi: 'Bài viết chờ duyệt', en: 'Articles pending' },
  coursesPending: { vi: 'Khóa học chờ duyệt', en: 'Courses pending' },
  exerciseSetsPending: { vi: 'Bộ bài tập chờ duyệt', en: 'Exercise sets pending' },
  interviewQuestionsPending: { vi: 'Câu hỏi phỏng vấn chờ duyệt', en: 'Interview questions pending' },
  openReports: { vi: 'Báo cáo chờ xử lý', en: 'Open reports' },
  hiddenContent: { vi: 'Nội dung đang ẩn', en: 'Hidden content' },

  // Actions & states
  refresh: { vi: 'Tải lại', en: 'Refresh' },
  retry: { vi: 'Thử lại', en: 'Retry' },
  loadError: { vi: 'Không tải được số liệu. Hãy thử lại.', en: 'Could not load the numbers. Try again.' },
} as const

export type DashboardCopyKey = keyof typeof COPY

export function dashboardText(language: Language = 'vi') {
  return (key: DashboardCopyKey): string => COPY[key][language]
}
