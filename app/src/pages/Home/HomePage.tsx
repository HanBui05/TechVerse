import { ArrowRight, BookOpen, CheckCircle2, Code2, Dumbbell, GraduationCap, Layers, Terminal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toneFor } from '@/lib/utils'
import type { Translation } from '../../data/i18n'

// Tones come from the shared toneFor so a tag has the same color here and on article pages.
const techTags = ['Git & GitHub', 'Spring Boot', 'Docker', 'Artificial Intelligence', 'Backend Development']

// Enter animation in steps, as before; motion-reduce turns it off.
const enter = 'animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-500 motion-reduce:animate-none'

export function HomePage({ t }: { t: Translation }) {
  const en = t.explore === 'Explore courses'
  return <main className="tw-page flex min-h-svh flex-col">
    <section className="relative overflow-hidden border-b border-border px-6 pt-16 pb-16 sm:px-10 sm:pt-24 sm:pb-24">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <span className={`${enter} inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3.5 py-1 text-xs font-medium text-muted-foreground`}>
          ✦ {t.welcome}
        </span>
        <h1 className={`${enter} delay-75 mt-6 mb-5 text-3xl font-bold tracking-tight sm:text-5xl lg:leading-[1.15]`}>
          {t.heroTitle} <span className="text-accent-text">TechVerse</span>
        </h1>
        <p className={`${enter} delay-150 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg`}>
          {t.heroDescription}
        </p>
        <div className={`${enter} delay-200 mt-8 flex w-full flex-wrap justify-center gap-3`}>
          <Button asChild size="lg" className="max-sm:w-full">
            <Link to="/courses">{t.explore} <ArrowRight /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="max-sm:w-full">
            <Link to="/interview">{t.interview} <ArrowRight /></Link>
          </Button>
        </div>

        <ul className={`${enter} delay-300 m-0 mt-8 flex list-none flex-wrap justify-center gap-2 p-0`}>
          {techTags.map(label => <li key={label}><Badge tone={toneFor(label)} className="gap-2 rounded-lg px-3 py-1.5 text-xs font-medium"><span aria-hidden className="size-1.5 rounded-full bg-current" />{label}</Badge></li>)}
        </ul>
      </div>
    </section>

    <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-5 md:grid-cols-3">
        <Link to="/courses" className="group flex rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
          <Card className="flex w-full flex-col justify-between gap-5 rounded-xl p-6 transition-colors hover:bg-muted/30">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-secondary/60 text-foreground">
                  <GraduationCap className="size-5" aria-hidden />
                </span>
                <span className="text-xs font-medium text-muted-foreground">{en ? 'Structured Path' : 'Lộ trình bài bản'}</span>
              </div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {en ? 'Interactive Courses & AI Tutor' : 'Khóa học & Trợ lý AI'}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {en
                  ? 'Learn step-by-step through curated chapters, track lesson completion, and ask the context-aware AI tutor.'
                  : 'Học theo chương bài mạch lạc, lưu tiến độ từng bài học và hỏi đáp trực tiếp cùng trợ lý AI theo ngữ cảnh bài.'}
              </p>
            </div>
            <div aria-hidden className="flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-3 text-xs">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5 text-foreground"><Layers className="size-3.5 text-muted-foreground" />Spring Security & JWT</span>
                <span className="text-muted-foreground">75%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-3/4 rounded-full bg-foreground/80" />
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/blogs" className="group flex rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
          <Card className="flex w-full flex-col justify-between gap-5 rounded-xl p-6 transition-colors hover:bg-muted/30">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-secondary/60 text-foreground">
                  <BookOpen className="size-5" aria-hidden />
                </span>
                <span className="text-xs font-medium text-muted-foreground">{en ? 'Engineering Deep-Dives' : 'Kiến thức chuyên sâu'}</span>
              </div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {en ? 'Technical Articles & Insights' : 'Bài viết Kỹ thuật chọn lọc'}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {en
                  ? 'Read peer-reviewed tutorials, system architecture analyses, and practical code patterns from authors.'
                  : 'Đọc bài phân tích kiến trúc, kinh nghiệm thực chiến và mẫu code chuẩn đã qua kiểm duyệt từ đội ngũ tác giả.'}
              </p>
            </div>
            <div aria-hidden className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 p-3 font-mono text-xs text-muted-foreground">
              <span className="flex items-center gap-2 truncate"><Terminal className="size-3.5 shrink-0" />@Transactional(readOnly = true)</span>
              <Code2 className="size-4 shrink-0" />
            </div>
          </Card>
        </Link>

        <Link to="/practice" className="group flex rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
          <Card className="flex w-full flex-col justify-between gap-5 rounded-xl p-6 transition-colors hover:bg-muted/30">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-secondary/60 text-foreground">
                  <Dumbbell className="size-5" aria-hidden />
                </span>
                <span className="text-xs font-medium text-muted-foreground">{en ? 'Active Recall' : 'Phản xạ & Ghi nhớ'}</span>
              </div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {en ? 'Quizzes & Flashcards' : 'Luyện tập Trắc nghiệm & Flashcard'}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {en
                  ? 'Test your mastery with instant server-graded quizzes, detailed explanations, and active-recall flashcards.'
                  : 'Kiểm tra năng lực với bộ đề trắc nghiệm chấm điểm tức thì, lời giải chi tiết và thẻ lật ghi nhớ kiến thức.'}
              </p>
            </div>
            <div aria-hidden className="flex items-center justify-between rounded-lg border border-border bg-background/50 p-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground"><CheckCircle2 className="size-3.5 text-muted-foreground" />{en ? 'Instant explanation' : 'Giải thích chi tiết'}</span>
              <span className="text-muted-foreground">100%</span>
            </div>
          </Card>
        </Link>
      </div>
    </section>
  </main>
}
