# Messaging — nhật ký

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`messaging.md`](messaging.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-22)

- **Task tiếp:** Task 1c — Đẩy sự kiện qua WebSocket (dùng `/model opus`, `/clear` trước) · Giao diện: Không
- Task 1a, 1b đã nhận (2026-11-22).
- Spec chốt 2026-11-22 sau 2 vòng Codex phản biện; lịch sử ở `messaging.review.md`.
- Nhánh `feature/messaging` (tách từ `main` sau PR #14).

## Quyết định người dùng chưa có trong spec

- **2026-11-22 — Nhắn tin trước khi mua (thay M2 A):** người học đăng nhập được nhắn cho tác giả của một khóa **kể cả khi chưa đăng ký/mua**, để hỏi khóa có phù hợp không. Đã đưa vào thân spec 2026-11-22.

- **2026-11-22 — Thời gian thực: REST + WebSocket kết hợp (thay M3 B):** REST giữ nguyên cho gửi tin, chặn, báo cáo, đánh dấu đã đọc và tải tin (`beforeSeq`/`afterSeq`). Thêm WebSocket chỉ để server đẩy **sự kiện** (“cuộc X có tin mới, seq=N”, “số chưa đọc đổi”, đổi trạng thái chặn/khóa) — **không chở nội dung tin**; trình duyệt nhận sự kiện rồi gọi REST lấy tin. Rớt socket: tự kết nối lại + lấy bù bằng `afterSeq`; polling giữ làm dự phòng, giãn ~30 giây. (Chi tiết kỹ thuật STOMP ban đầu đã đổi sang WebSocket thô + vé một lần, xem nhật ký 2026-11-22; spec Task 1c.) Thứ tự: Task 1a (REST) trước, task WebSocket riêng sau; thiếu thời gian thì dừng ở polling. “Đang gõ”, “đã xem”, online vẫn ngoài phạm vi.

- **2026-11-22 — Chi tiết nhắn trước khi mua (đồng ý cả 4 khuyến nghị):** (1) chống spam: trước khi tác giả trả lời lần đầu, người học gửi tối đa 3 tin; mỗi người mở tối đa 10 cuộc trò chuyện mới/ngày; chỉ mở từ khóa đang công khai; (2) lưu khóa mà người học bấm “Nhắn tác giả” gần nhất, tác giả thấy “Hỏi về: <tên khóa>” và “Đã đăng ký / Chưa đăng ký”; (3) khách bấm “Nhắn tác giả” → đăng nhập rồi quay lại trang khóa; (4) không có nút tắt nhận tin từ người chưa đăng ký, tác giả dùng “Chặn”.

- **2026-11-22 — Bỏ giới hạn 10 cuộc trò chuyện mới/ngày:** sau khi nghe giải thích (chặn rải spam tới nhiều tác giả), người dùng chọn bỏ hẳn; chống spam còn: 3 tin trước khi tác giả trả lời, nhịp 20 tin/phút và 5 lần mở/phút, Chặn, Báo cáo. Đã sửa thân spec.

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-22 — Task 1b — Kết quả (đã nhận 2026-11-22)
- Code: `ConversationService` (block, moderatorMessages, lock, locked, moderated), `ReportService` (rẽ nhánh FORUM_POST/CONVERSATION ở tạo, hàng đợi, xử lý; `actionAllowed`), `ModeratorConversationController` (mới), `ReportRequest/Response` (`Item.targetType`, `Item.conversation`, `ModeratedConversation`), `ConversationRequest` (Block, Lock, Locked), repo, `ErrorCode` (+`REPORT_TARGET_EMPTY`, `CONVERSATION_STATE_INVALID`), `SecurityConfiguration`. Test: tách `ConversationIntegrationTestBase` dùng chung.
- Test (`./gradlew test --tests messaging.* + ReportIntegrationTest, ReportControllerTest, ForumPostRulesTest, ForumReportsMigrationTest`): ModerationIntegration 4/4, Integration 4/4, Rules 11/11, Controller 6/6, ModeratorController 5/5, Migration 1/1; Report 6/6, 4/4, ForumPostRules 12/12, ForumReportsMigration 1/1 — 0 lỗi. ModerationIntegration đỏ trước (4/4 lỗi) rồi mới code.
- Lệch khác spec: (1) cổng “đã có báo cáo” của Moderator là truy vấn `findReported` riêng trong cùng transaction readOnly trước khi đọc tin (báo cáo không bị xóa nên tương đương); (2) mở khóa ghi `note` (có thể null) vào `lock_note`, xóa `locked_by/at`; (3) `blocked`/`locked` sai kiểu JSON (chuỗi) → 400 `MALFORMED_REQUEST` theo xử lý chung; (4) sai loại hành động (`HIDE_CONTENT` cho cuộc trò chuyện…) → 400 `VALIDATION_ERROR` xét sau khi tìm báo cáo (thiếu báo cáo → 404 trước); (5) hàng đợi có tham số `targetType` (`FORUM_POST` mặc định | `CONVERSATION`) để giao diện hiện tại không gặp mục cuộc trò chuyện; Task 2b gọi `targetType=CONVERSATION`; mọi mục có thêm `targetType`, `conversation` (null cho bài diễn đàn).
- Review vòng 1 (`adversarial-review`): (high) hàng đợi trả mục cuộc trò chuyện làm `ModeratorReportsPage.tsx:463` (`item.post.type`) lỗi — chấp nhận, sửa bằng (5). Sau sửa: ModerationIntegration 4/4, ReportIntegration 6/6, ReportController 4/4 đạt.
- Review vòng 2 (`adversarial-review`, chỉ phần sửa): approve, không có phát hiện.
- Chưa kiểm: full backend (CI).
### 2026-11-22 — Task 1a — Kết quả (đã nhận 2026-11-22)
- Code: `V23__messaging.sql`, `Conversation`/`Message`, `ConversationRepository`/`MessageRepository`, `ConversationRequest`/`ConversationResponse`, `ConversationService`, `ConversationController`, `ErrorCode` (+9 mã), `SecurityConfiguration`.
- Test (`./gradlew test --tests messaging.* + ForumReportsMigrationTest, ReportIntegrationTest, DatabaseBootstrapIntegrationTest`): Migration 1/1, Rules 9/9, Controller 5/5, Integration 4/4, regression 1/1, 6/6, 2/2 — 0 lỗi. Migration + Integration đỏ trước (bảng chưa có; route `denyAll` 403); Rules/Controller viết sau code.
- Lệch khác spec: (1) tác giả không thấy cuộc trò chuyện chưa có tin nào trong danh sách (người học thấy); (2) mở từ khóa mà tác giả mang role ADMIN/MODERATOR → 403 `CONVERSATION_NOT_ALLOWED`; (3) `PUT /read` trả chi tiết cuộc trò chuyện; (4) `seq` vượt 64 bit trong body JSON → 400 `MALFORMED_REQUEST` (xử lý chung), ở query → `VALIDATION_ERROR`; (5) mở dùng một câu `INSERT … ON CONFLICT DO UPDATE` thay cho bắt lỗi UNIQUE rồi đọc lại.
- Chưa kiểm: full backend (CI).
- Review vòng 1 (`adversarial-review`): (high) deadlock khi hai tác giả mở chéo — **từ chối**: Hibernate 7.4 khóa user bằng `for no key update` (xem SQL log), không xung đột `FOR KEY SHARE` của kiểm FK; vẫn thêm ca đua mở chéo 5 lần (xanh). (medium) thiếu ca gửi đồng thời cùng `clientId` — chấp nhận, thêm ca (201 + 200, một dòng).
- Sau sửa: `ConversationIntegrationTest.racesKeepOne…` 1/1 đạt.
- Review vòng 2 (`adversarial-review`, chỉ phần sửa): approve, không có phát hiện; Codex chấp nhận phản biện deadlock.
### 2026-11-22 — Chốt spec
- Người dùng chốt spec (1a, 1b, 1c, cổng wireframe, 2a, 2b). Chuyển 4 mục phản hồi/trả lời sang `messaging.review.md`, giữ kết luận ngắn ở “Quyết định của người dùng”.
### 2026-11-22 — Sửa spec theo quyết định mới
- Vòng 2: Codex 7 điểm, Claude chấp nhận cả 7: bỏ dòng hiện trạng giới hạn ngày; từ chối bắt tay/không đẩy khi `exp` đã qua; `RUNBOOK.md` vào đường dẫn; kết nối lại tải lại chi tiết + danh sách, chỉ áp response mới nhất; test rollback thật + unit khóa đã xóa; cổng wireframe sau 1c (hoặc sau 1b nếu bỏ 1c), bỏ giả định vé 404.
- Đối chiếu code thật (V22, lớp `Report*` của forum-reports, `viewer.canStart`, `findActive`, CORS/`webUrl`, chưa có starter WebSocket) rồi sửa `messaging.md`: Hiện trạng, Đường dẫn, Ngoài phạm vi, Ràng buộc (mở không cần mua, khóa đang hỏi, chống spam, thời gian thực), Task 1a (cột ngữ cảnh khóa, `author_replied`, 2 mã lỗi mới, kế hoạch theo luật “Ít class”), Task 1b (tên lớp báo cáo thật), Task 1c mới (vé một lần + WebSocket chỉ đẩy sự kiện, người nhận do server chọn), Task 2a (nút cho người chưa mua, “Hỏi về”, giới hạn chờ trả lời, socket + dự phòng 30 giây).
- Lệch kỹ thuật so với ghi chú trước: chọn WebSocket thô (`TextWebSocketHandler`) + vé một lần thay cho STOMP — không cần thư viện frontend, không có bề mặt đăng ký kênh cần phân quyền.
- Spec ~49 KB, vượt mục tiêu ~30 KB.
- Vòng 1: Codex 9 điểm; Claude chấp nhận 1,2,3,5,6,7,8, một phần 4,9 (từ chối test log vé, tách nhịp Redis khỏi unit, cắt lớn kích thước). Sửa thân spec: giới hạn ngày đếm DB dưới khóa người, vé gắn `sid`+`exp` và kiểm phiên trước mỗi lần đẩy, `GETDEL`, sự kiện chỉ là tín hiệu (`unread` không số), `contextCourse.available`, nhánh 2a không có 1c (5/30 giây).
