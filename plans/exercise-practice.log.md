# Exercise practice — nhật ký

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`exercise-practice.md`](exercise-practice.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-17)

- **Task tiếp:** Task 1a — Schema, API tác giả và vòng đời · Giao diện: Không
- Spec chốt 2026-11-15; `course-payment` và `course-ai-tutor` đã merge vào `main` nên đủ điều kiện bắt đầu. Migration lấy số kế tiếp lúc code (spec ghi V14 nếu V13 đã có) — kiểm `db/migration` trước.
- Nhánh: `feature/exercise-practice` (từ `main` sau PR #10).

## Quyết định người dùng chưa có trong spec

- (không có)

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-17 — Mở module
- Chuyển `Module đang làm` sang `exercise-practice`; tạo log này; ghi CI đạt/PR #10 đã merge vào `course-ai-tutor`.
