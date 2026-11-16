# Author payout — nhật ký

## Bắt đầu từ đây (cập nhật 2026-11-16)

- **Task tiếp:** Task 1a — tài khoản nhận tiền và số dư của tác giả (Backend, rủi ro cao: Opus, review vòng 1 `adversarial-review`) · Giao diện: Không
- Spec chốt 2026-11-16: 1a → 1b → 1c → 1d → cổng wireframe (người dùng duyệt) → 2a → 2b → 2c. Chưa code task nào.
- Sau module này: Task 1e (PayOS) của `course-payment`, các quyết định 2026-11-16 nằm ở [`course-payment.log.md`](course-payment.log.md) (embedded checkout, webhook qua ngrok).
- Bẫy kế thừa: `TRUNCATE users CASCADE` trong test xóa luôn `commission_policies` và hai bảng mới; test cần policy phải tự `INSERT ... (rate_bps) VALUES (2000)`.
- Chưa kiểm: V17 có trùng số migration với module khác không (kiểm đầu Task 1a).

## Quyết định người dùng chưa có trong spec

- (không có; các quyết định 2026-11-16 đã nằm trong spec)

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên

### 2026-11-16 — Viết và chốt spec
- Claude viết spec, Codex phản biện một vòng (2 sai, 7 thiếu), Claude sửa thân spec; người dùng chốt, bỏ vòng 2.
- Chưa code, chưa chạy test.
