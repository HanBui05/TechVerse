# Course AI tutor — nhật ký

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`course-ai-tutor.md`](course-ai-tutor.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-17)

- **Task tiếp:** Codex phản biện spec vòng 1 (ghi vào “Phản hồi vòng 1”), Claude trả lời từng ý (skill `plan-review`, `/model opus`), người dùng chốt; sau đó Task 1 (Backend) · Giao diện: Không
- Spec viết 2026-11-14, trước khi `course-payment`, `author-payout`, `payos-checkout` code xong (đều đã vào `main` 2026-11-17): khi phản biện phải đối chiếu luật quyền xem bài trả phí với code thật.
- Nhánh: chưa tạo; tạo `feature/course-ai-tutor` từ `main` khi bắt đầu Task 1.

## Quyết định người dùng chưa có trong spec

- (không có)

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-17 — Mở module
- Chuyển `Module đang làm` sang `course-ai-tutor`; tạo log này.
