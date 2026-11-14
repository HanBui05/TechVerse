# Course payment — nhật ký

## Bắt đầu từ đây (cập nhật 2026-11-14)

- **Task tiếp:** Task 1a — Schema, giá và quyền xem (V13) · Giao diện: Không
- Spec chốt 2026-11-14: Task 1a → 1b → 1c → 1d → cổng wireframe → 2a → 2b → 2c; **Task 1e (PayOS) hoãn**, không làm. Rủi ro cao: code bằng Opus, review vòng 1 `adversarial-review`.
- Chặn trước khi code: PR #4 (`course-free`) đang mở, CI `test-server` fail (kiểm 2026-11-14), chưa biết lỗi ở lớp nào. Sửa và merge trước, vì 1a sửa tiếp code khóa học.
- Nhánh `feature/course-payment` (bằng `origin/main` + commit của `course-free`), hiện chỉ có thay đổi tài liệu.
- Module đi kèm: [`course-ai-tutor.md`](course-ai-tutor.md) (đã chốt 2026-11-14, chưa có log riêng) — Task 1 của nó làm sau Task 1a ở đây; giao diện làm cùng đợt 2a–2c.
- Người dùng cần chuẩn bị: thông tin tài khoản nhận tiền (ngân hàng/BIN, số tài khoản, tên) cho `.env` trước khi thử thật.

## Quyết định người dùng chưa có trong spec

- (không có — 7 quyết định ngày 2026-11-14 đã nằm trong thân spec, mục “Quyết định của người dùng”)

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-14 — Chốt spec module khóa học
- Người dùng chốt `course-payment` và `course-ai-tutor` (“chốt như vậy với module khóa học”). Lịch sử phản biện chuyển sang `course-payment.review.md`.
- Đổi vai khâu Plan (D-030): Claude viết spec, Codex phản biện. `course-ai-tutor` chốt trước khi Codex phản biện.
- Claude đưa vào thân spec thanh toán: khoảng giá, hạn đơn 24 giờ, thanh toán trùng, nút “Tôi đã chuyển khoản” (endpoint + 3 dòng lỗi + copy + bộ lọc Admin), PayOS hoãn. Phần nút báo chuyển khoản chưa qua Codex soát.
- Chưa kiểm: spec còn vài dòng nhắc PAYOS (hạn 15 phút, ghi chú audit) — không áp dụng vì 1e hoãn.
