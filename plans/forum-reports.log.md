# Forum & reports — nhật ký

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`forum-reports.md`](forum-reports.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-21)

- **Task tiếp:** Task 1b — Báo cáo vi phạm và kiểm duyệt · Giao diện: Không
- Task 1a đã nhận (2026-11-21). Spec Task 1c (react) chốt 2026-11-21, làm sau 1b.
- Nhánh `feature/forum-reports` (tách từ `main` sau PR #13), commit cục bộ, chưa push.
- Chưa kiểm: full backend (CI khi mở PR).

## Quyết định người dùng chưa có trong spec

- **2026-11-21 — Giữ cách xóa bài hỏi của F7 A:** đã cân nhắc “xóa hết” và “cấm xóa khi đã có trả lời”; người dùng giữ A (bài hỏi có câu trả lời bị xóa thì trang còn, hiện “đã xóa”, câu trả lời giữ nguyên). Không đổi spec/code.

- **2026-11-21 — React bài diễn đàn (thay cho “bình chọn” đang ở Ngoài phạm vi):** thêm Task 1c (sau 1b, trước wireframe). Bộ 4 loại `LIKE` 👍, `LOVE` ❤️, `HAHA` 😂, `ANGRY` 😡; áp cho cả bài hỏi lẫn câu trả lời; mỗi người một react trên một bài (bấm loại khác = đổi, bấm lại = bỏ); lưu DB theo người. Có danh sách “ai đã react” (giao diện chốt ở wireframe). Đã viết vào spec Task 1c; người dùng chốt 2026-11-21 sau hai vòng Codex phản biện.

## Câu hỏi mở cho người dùng

- (không có)

## Lệch khác spec

- Task 1a — luật “Ít class” (`backend.md`) thắng tên lớp trong spec: không tạo `ForumContentService`/`ForumRateLimiter`/`ForumPostRules`; `checkContent`, `rateLimit(RateKind)` (gồm sẵn `REPORT` 10/phút cho 1b) và luật thuần (`questionReadable`, `answerReadable`, `solved`, `questionViewer`, `answerViewer`) là hàm public trong `ForumService`. Ba lớp test unit gộp thành `ForumPostRulesTest`.
- Task 1a — JSON hỏng/thiếu body vẫn trả 400 `MALFORMED_REQUEST` theo xử lý chung hiện có (spec ghi `VALIDATION_ERROR`). PATCH gửi `null`, thiếu `answerId`, `topicId` sai định dạng → 400 `VALIDATION_ERROR`. `topicId` không tồn tại → 400 `VALIDATION_ERROR` (field `topicId`).
- Task 1a — chọn lời giải trên bài hỏi `DELETED` còn hiển thị → 409 `FORUM_QUESTION_CLOSED` (bảng không ghi mã). PATCH `{}` hợp lệ, không đổi `editedAt`. `acceptedAnswerId` chỉ trả khi bài đang “đã giải quyết”; trường `null` bị bỏ khỏi JSON bài hỏi.
- Task 1a — `canReport` chưa xét “đã báo cáo” (chờ 1b, đúng spec).

## Nhật ký phiên
### 2026-11-21 — Task 1a: schema và API hỏi–đáp
- V21 `forum_reports.sql`; `ForumPost`, `ForumPostStatus`, `ForumPostRepository`, `ForumRequest`, `ForumResponse`, `ForumService`, `ForumController`; 9 mã `FORUM_*`; `SecurityConfiguration` GET `/api/v1/forum/**` permitAll, còn lại authenticated.
- TDD: migration đỏ (chưa có V21) → xanh; unit/controller/tích hợp đỏ biên dịch → xanh (sửa 3 lỗi trong test: GET khách ở `@WebMvcTest`, `findValuesAsString` lấy cả id lồng, MockMvc mã hóa lại `%` trong URL).
- Lần cuối: `ForumReportsMigrationTest` 1, `ForumPostRulesTest` 9, `ForumControllerTest` 6, `ForumIntegrationTest` 5 — 21/21 đạt.
- Chưa kiểm: full backend (CI khi mở PR).
- Review vòng 1: [P2] `accept` khóa bài `answerId` trước khi biết là câu trả lời của bài này → deadlock khi hai người chọn chéo ID bài hỏi. Sửa: đọc `parent_id` không khóa, lệch → 409 `FORUM_ANSWER_INVALID`, khớp mới khóa và kiểm lại. Test đỏ (giữ khóa bài kia ở kết nối riêng → request treo, Timeout) → xanh; Rules 9, Controller 6, Integration 5 đạt.
- Review vòng 2 (`adversarial-review`, phần sửa): approve, không phát hiện. Người dùng nhận Task 1a và chốt spec Task 1c (2026-11-21).
