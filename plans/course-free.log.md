# Course free — Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`course-free.md`](course-free.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-06)

- Spec do Codex viết (33,8 KB, hơi vượt mục tiêu 30 KB); người dùng đã trả lời 6 câu hỏi mở (mục dưới). **Tiếp: Claude phản biện vòng 1** (skill `plan-review`) vào “Phản hồi vòng 1 (Claude)” của spec.
- Hướng gốc của người dùng: mục “Miền khóa học” trong “Câu hỏi mở” của `PLAN.md`; mẫu giao diện JavaBuilder, ảnh `.playwright-mcp/jb-course.png`, `.playwright-mcp/jb-lesson.png` (gitignore).
- Nhánh `feature/course-free` (tách từ `feature/ai-assist`, PR ai-assist chưa merge → rebase lên `main` sau khi merge).

## Quyết định người dùng chưa có trong spec

- 2026-11-06 — trả lời 6 câu “Câu hỏi mở cần người dùng chốt” theo khuyến nghị:
  1. Có `DELETE` bỏ hoàn thành (idempotent).
  2. Có `lessons.summary` tùy chọn ≤500; trống thì ẩn dòng.
  3. Xem bài học thử **không** tạo enrollment.
  4. Tác giả **không** học khóa của mình như Learner; chỉ xem trước trong editor.
  5. Khóa chưa từng được duyệt: xóa cứng như article-flow.
  6. Mô tả dài của khóa là Markdown, dùng validator chung.

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-06 — Codex viết spec, người dùng trả lời câu hỏi mở
- Claude gửi Codex hướng `course-free` (prompt từ mục “Miền khóa học” của `PLAN.md` + mẫu JavaBuilder). Codex tạo spec (3 task Backend, cổng wireframe, 3 task Giao diện), log, cập nhật `PLAN.md`.
- Người dùng chọn theo khuyến nghị cho 6 câu hỏi mở (xem mục quyết định).
