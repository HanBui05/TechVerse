# Course payment — nhật ký

## Bắt đầu từ đây (cập nhật 2026-11-14)

- **Task tiếp:** Task 1a — Schema, giá và quyền xem (V13) · Giao diện: Không
- Spec chốt 2026-11-14: Task 1a → 1b → 1c → 1d → cổng wireframe → 2a → 2b → 2c; **Task 1e (PayOS) hoãn**, không làm. Rủi ro cao: code bằng Opus, review vòng 1 `adversarial-review`.
- Nhánh `feature/course-payment` = `main` (đã có PR #4 `course-free`, merge 2026-11-15) + commit tài liệu; chưa có code của module.
- Module đi kèm: [`course-ai-tutor.md`](course-ai-tutor.md) (đã chốt 2026-11-14, chưa có log riêng) — Task 1 của nó làm sau Task 1a ở đây; giao diện làm cùng đợt 2a–2c.
- Người dùng cần chuẩn bị: thông tin tài khoản nhận tiền (ngân hàng/BIN, số tài khoản, tên) cho `.env` trước khi thử thật.

## Quyết định người dùng chưa có trong spec

- (2026-11-15) Cho phép Claude push nhánh PR đang mở để gỡ CI; vẫn không push `main`, việc merge do người dùng làm.
- 7 quyết định ngày 2026-11-14 đã nằm trong thân spec, mục “Quyết định của người dùng”.

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-15 — Gỡ CI PR #4 (`course-free`)
- Lỗi: `AdminTopicIntegrationTest.inactivePreservesAllFourReferencingContentTypesWithoutChangingRows` chèn `courses.status`/`published_at` mà V12 đã xóa (`BadSqlGrammarException`, 589 test, 1 lỗi).
- Sửa: chèn khóa học DRAFT kèm `content_fingerprint`. `./gradlew test --tests 'AdminTopicIntegrationTest'`: 18/18 đạt.
- Commit `ffe2dc5` trên `feature/course-free`, push kèm 11 commit tài liệu chưa push (đều đã có trong nhánh này).
### 2026-11-14 — Chốt spec module khóa học
- Người dùng chốt `course-payment` và `course-ai-tutor` (“chốt như vậy với module khóa học”). Lịch sử phản biện chuyển sang `course-payment.review.md`.
- Đổi vai khâu Plan (D-030): Claude viết spec, Codex phản biện. `course-ai-tutor` chốt trước khi Codex phản biện.
- Claude đưa vào thân spec thanh toán: khoảng giá, hạn đơn 24 giờ, thanh toán trùng, nút “Tôi đã chuyển khoản” (endpoint + 3 dòng lỗi + copy + bộ lọc Admin), PayOS hoãn. Phần nút báo chuyển khoản chưa qua Codex soát.
- Chưa kiểm: spec còn vài dòng nhắc PAYOS (hạn 15 phút, ghi chú audit) — không áp dụng vì 1e hoãn.
