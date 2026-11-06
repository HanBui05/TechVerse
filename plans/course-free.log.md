# Course free — Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`course-free.md`](course-free.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-07)

- **Task 1a đã nhận (2026-11-07)** sau Codex review 2 vòng. Chưa kiểm, để 1b: lưu/đọc JPA thật nhiều version (thứ tự insert cascade, `flush()` trước `save()`/tham chiếu, ca publish v1 → bỏ lesson, publish v2 → xóa chapter → flush). **Tiếp: Task 1b (Opus)** — `/clear`, `/model opus`. Model: 1b, 1c **Opus** (rủi ro cao).
- **Spec đã chốt 2026-11-07** sau vòng 1 (không vòng 2); lịch sử phản biện ở `course-free.review.md`.
- Hướng gốc của người dùng: mục “Miền khóa học” trong “Câu hỏi mở” của `PLAN.md`; mẫu giao diện JavaBuilder, ảnh `.playwright-mcp/jb-course.png`, `.playwright-mcp/jb-lesson.png` (gitignore).
- Nhánh `feature/course-free` (tách từ `feature/ai-assist`, PR ai-assist chưa merge → rebase lên `main` sau khi merge).

## Quyết định người dùng chưa có trong spec

- (không có — 6 quyết định và 3 đề xuất ngày 2026-11-06 đã nằm trong spec đã chốt)

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-07 — Task 1a đã nhận
- Người dùng nhận Task 1a; commit cục bộ trên `feature/course-free`.
### 2026-11-07 — Task 1a: V12, domain Course, parser YouTube
- Thêm V12, entity `Course/CourseChapter/Lesson/CourseTag/CoursePublicationVersion(+Chapter/Lesson/Tag)/CourseModerationHistory`, `CourseLevel`, `LessonVideoParser`, 12 mã lỗi; tái dùng enum trạng thái/action của article. Tách `Article.digest` dùng chung (hành vi giữ nguyên).
- Test: `CourseLifecycleTest` 12, `LessonVideoParserTest` 29, `FreeCourseMigrationTest` 8, `ArticleLifecycleTest` 21, `ArticlePublicationMigrationTest` 7, `DatabaseBootstrapIntegrationTest` 2 (Hibernate validate với entity mới) — đạt hết.
- Review vòng 1 (Codex, 2 P2, đã sửa): fingerprint thêm `chapter.id`/`lesson.id`/`aiAssisted`; `removeChapter` xóa cứng lesson chưa publish. +3 ca test, `CourseLifecycleTest` 15 đạt, `ArticleLifecycleTest`/`LessonVideoParserTest` đạt. Lưu ý 1b: `flush()` trước `save()` để ID đã gán khi tính fingerprint.
- Review vòng 2 (1 medium, đã sửa): lesson đã archive (từng publish ở version cũ) không bao giờ bị hard delete khi `removeLesson`/`removeChapter`. +1 ca, `CourseLifecycleTest` 16 đạt. Không chạy vòng 3; ca persistence nhiều version + flush DB thật để 1b.
- Lệch khác spec: sửa `ArticlePublicationMigrationTest` (`max version == 11` → `>= 11`); hard delete vs archive suy từ snapshot mới nhất (không thêm cột); chưa có entity enrollment/progress (thuộc 1c); chỉ có approve/requestChanges/withdraw, hide/restore/remove để 1c.
### 2026-11-07 — Chốt spec
- Người dùng chốt spec sau vòng 1. Bốn mục phản hồi/trả lời chuyển sang `course-free.review.md`; spec giữ 3 dòng kết luận. Thân spec ~27,8 KB.
### 2026-11-06 — Đưa đề xuất ngoài spec vào spec
- Codex thêm `last_lesson_id`/`last_accessed_at` + `continueLesson` (1a/1c/2c) và `changeStatus` NEW/CHANGED/ARCHIVED/UNCHANGED + lọc mặc định (1c/2b); thời lượng ước tính → “Ngoài phạm vi”. Thân spec 30.547 byte.
### 2026-11-06 — Codex trả lời vòng 1
- Chấp nhận 3 Sai, 9 Thiếu (Thiếu 5 chỉ một phần: không thêm `last_accessed_at`, `/me/courses` sắp theo `max(completed_at)`/`granted_at`), 2 Thừa. Mã lỗi `COURSE_*` riêng, AI dùng lại `AI_*`; thân spec rút dưới 30 KB.
### 2026-11-06 — Claude phản biện vòng 1
- Đối chiếu V1/V10, `ErrorCode`, `ArticleImageService`/`ArticleImageCleanupService`, AI request/receipt, file FE. Nặng nhất: cleanup ảnh sẽ xóa nhầm ảnh course/lesson; mã lỗi không tồn tại (`IDEMPOTENCY_KEY_REUSED`, `AI_HANDOFF_INVALID`); contract AI LESSON và dữ liệu trang học còn để ngỏ.
### 2026-11-06 — Codex viết spec, người dùng trả lời câu hỏi mở
- Claude gửi Codex hướng `course-free` (prompt từ mục “Miền khóa học” của `PLAN.md` + mẫu JavaBuilder). Codex tạo spec (3 task Backend, cổng wireframe, 3 task Giao diện), log, cập nhật `PLAN.md`.
- Người dùng chọn theo khuyến nghị cho 6 câu hỏi mở (xem mục quyết định).
