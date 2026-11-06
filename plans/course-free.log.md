# Course free — Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`course-free.md`](course-free.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-07)

- **Spec đã chốt 2026-11-07** sau vòng 1 (không vòng 2); lịch sử phản biện ở `course-free.review.md`. **Tiếp: Task 1a** (V12 schema, domain, lifecycle version) — `/clear` rồi bắt đầu.
- Hướng gốc của người dùng: mục “Miền khóa học” trong “Câu hỏi mở” của `PLAN.md`; mẫu giao diện JavaBuilder, ảnh `.playwright-mcp/jb-course.png`, `.playwright-mcp/jb-lesson.png` (gitignore).
- Nhánh `feature/course-free` (tách từ `feature/ai-assist`, PR ai-assist chưa merge → rebase lên `main` sau khi merge).

## Quyết định người dùng chưa có trong spec

- (không có — 6 quyết định và 3 đề xuất ngày 2026-11-06 đã nằm trong spec đã chốt)

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
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
