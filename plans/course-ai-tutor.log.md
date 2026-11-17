# Course AI tutor — nhật ký

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`course-ai-tutor.md`](course-ai-tutor.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-17)

- **Task tiếp:** Task 1 (Backend hỏi AI theo bài) · Giao diện: Không
- Spec chốt lại 2026-11-17 sau phản biện vòng 1 (không chạy vòng 2); lịch sử ở `course-ai-tutor.review.md`.
- Nhánh: đang ở `docs/plan-status`; tạo `feature/course-ai-tutor` từ `main` khi bắt đầu Task 1.

## Quyết định người dùng chưa có trong spec

- (không có)

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-17 — Phản biện spec vòng 1
- Codex ghi “Phản hồi vòng 1”; Claude kiểm từng ý trên code và trả lời (chấp nhận phần lớn; từ chối API hủy và mã HTTP riêng cho lỗi nhà cung cấp).
- Sửa thân spec: `LESSON_PREVIEW_ONLY` thay `ACCESS_DENIED`, GET bài không tự enroll, chủ khóa/`USER_INACTIVE`/JSON hỏng/Redis hoàn lượt, slot registry theo loại, `contextTruncated` trong `metadata`, history 2.000 ký tự, token `TUTOR` 2.048, cổng wireframe Task 2, bớt ca tích hợp còn 5.
- Người dùng chốt (“ok”): không vòng 2; theo dõi chi phí AI tách module sau (ghi `PLAN.md`); chuyển tranh luận sang `course-ai-tutor.review.md`.
### 2026-11-17 — Mở module
- Chuyển `Module đang làm` sang `course-ai-tutor`; tạo log này.
