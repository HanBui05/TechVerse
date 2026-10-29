import { Award, Bell, BookMarked, BookOpen, BriefcaseBusiness, ChartNoAxesColumn, CheckSquare, ClipboardCheck, Clock3, FileText, GraduationCap, Heart, House, Info, Languages, Library, Lightbulb, MessageCircle, MessageSquare, Settings, ShieldCheck, Sun, Trophy, UserRound } from 'lucide-react'

export const navItems = [
  { label: { vi: 'Trang chủ', en: 'Home' }, path: '/', icon: House },
  { label: { vi: 'Thử thách', en: 'Challenges' }, path: '/challenges', icon: Trophy },
  { label: { vi: 'Bảng xếp hạng', en: 'Leaderboard' }, path: '/leaderboard', icon: ChartNoAxesColumn },
  { label: { vi: 'Khóa học', en: 'Courses' }, path: '/courses', icon: BookOpen },
  { label: { vi: 'Bài viết', en: 'Articles' }, path: '/blogs', icon: FileText },
  { label: { vi: 'Tài liệu & Sách', en: 'Resources & Books' }, path: '/resources', icon: Library },
  { label: { vi: 'Ôn tập phỏng vấn', en: 'Interview Prep' }, path: '/interview', icon: BriefcaseBusiness },
  { label: { vi: 'Hỏi đáp', en: 'Questions' }, path: '/questions', icon: MessageCircle },
  { label: { vi: 'Giới thiệu', en: 'About' }, path: '/about', icon: Info },
]

export const authenticatedItems = [
  { label: { vi: 'Nhắn tin', en: 'Messages' }, path: '/messages', icon: MessageSquare },
  { label: { vi: 'Thông báo', en: 'Notifications' }, path: '/notifications', icon: Bell },
]

export const learningItems = [
  { label: { vi: 'Khóa học của tôi', en: 'My courses' }, path: '/learning/courses', icon: GraduationCap },
  { label: { vi: 'Chứng chỉ của tôi', en: 'My certificates' }, path: '/learning/certificates', icon: Award },
  { label: { vi: 'Xác thực chứng chỉ', en: 'Verify certificate' }, path: '/learning/verify', icon: ShieldCheck },
  { label: { vi: 'Bài tập', en: 'Exercises' }, path: '/learning/exercises', icon: ClipboardCheck },
  { label: { vi: 'Bài tập đã làm', en: 'Completed exercises' }, path: '/learning/completed', icon: CheckSquare },
  { label: { vi: 'Nhật ký học tập', en: 'Learning journal' }, path: '/learning/journal', icon: Clock3 },
  { label: { vi: 'Câu hỏi đóng góp', en: 'Contributed questions' }, path: '/learning/questions', icon: Lightbulb },
  { label: { vi: 'Nội dung yêu thích', en: 'Favorite content' }, path: '/learning/favorites', icon: Heart },
  { label: { vi: 'Bình luận của tôi', en: 'My comments' }, path: '/learning/comments', icon: MessageCircle },
]

export const premiumItems = [
  { label: { vi: 'Gói Premium', en: 'Premium plan' }, path: '/premium', icon: BookMarked },
  { label: { vi: 'Lịch sử thanh toán', en: 'Payment history' }, path: '/payments', icon: ClipboardCheck },
]

export const settingsItems = [
  { path: '/settings/theme', icon: Sun, key: 'appearance' },
  { path: '/settings/language', icon: Languages, key: 'language' },
]

export { Settings }
