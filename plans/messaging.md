# Messaging — người học nhắn riêng với tác giả khóa đang học

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Claude viết (D-030); Codex chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Người học đang học một khóa mở cuộc trò chuyện riêng với tác giả của khóa đó để hỏi bài; hai bên nhắn chữ (Markdown, có khối code), tin mới tự hiện sau vài giây, thanh bên báo số cuộc trò chuyện chưa đọc. Mỗi bên chặn được cuộc trò chuyện và báo cáo cho Moderator; Moderator chỉ đọc được cuộc trò chuyện đã bị báo cáo.
**Làn:** Đầy đủ · **Rủi ro:** **cao** (tin nhắn riêng tư, ranh giới quyền đọc). Review vòng 1 dùng `adversarial-review`.
**Thứ tự:** 1a → 1b (Backend) → cổng wireframe → 2a → 2b (Giao diện). **Làm cuối cùng và là phần bị cắt đầu tiên** nếu thiếu thời gian (M1 A, T3 A). **Điều kiện bắt đầu:** `forum-reports` đã xong cả backend lẫn giao diện báo cáo; API báo cáo nêu trong spec này là API sẽ có của module đó, chưa tồn tại lúc viết spec.
**Nguồn quyết định:** câu M1–M7 trong [`roadmap.questions.md`](roadmap.questions.md) (người dùng trả lời 2026-11-14): M1 A, M2 A (người học với tác giả khóa đang học), M3 B (tự làm mới vài giây/lần, không kết nối trực tiếp), M4 A (chỉ chữ, có khối code), M5 A (chặn + báo cáo), M6 A (Moderator chỉ đọc cuộc trò chuyện bị báo cáo), M7 A (số chưa đọc trên thanh bên).

## Hiện trạng đã đối chiếu (2026-11-15)

- Schema và code **chưa có gì** cho nhắn tin (không có bảng cuộc trò chuyện hay tin nhắn trong V1–V12).
- Quyền học nằm ở `course_enrollments` (`user_id`, `course_id`, `revoked_at`; đang học = `revoked_at IS NULL`). API chi tiết khóa công khai trả `author` (có `id`) và `viewer.enrolled` (`PublishedCourseDetailResponse.java:16`–`32`); trang giới thiệu khóa đang đọc `course.viewer.enrolled` (`CourseOverviewPage.tsx:35`). Không cần thêm trường nào vào API khóa học.
- `reports.target_type` chỉ nhận ARTICLE/DOCUMENT/COURSE/COMMENT/FORUM_POST (CHECK) và trigger `validate_report_target` dùng `CASE` không có nhánh mặc định (`V1__initial_schema.sql:575`, `:1013`–`1033`): thêm loại đích mới phải sửa cả CHECK lẫn hàm trigger. API báo cáo và hàng đợi Moderator do `forum-reports` tạo, hiện chỉ nhận `FORUM_POST`.
- Frontend: `Sidebar.test.tsx:50` đang coi `/messages` là đường chết; tài khoản ADMIN/MODERATOR bị `ReaderRoute` đẩy khỏi trang người đọc (`app/src/App.tsx:54`–`61`). Trang giới thiệu khóa là `app/src/pages/Courses/CourseOverviewPage.tsx`.

## Đường dẫn thuộc module

- `server/src/main/resources/db/migration/V<n>__messaging.sql` (tạo; `<n>` là số kế tiếp lúc code).
- `server/src/main/java/com/techverse/server/{controller,entity,enums,dto,repository,service}/**/*{Conversation,Message}*.java` (tạo); `configuration/SecurityConfiguration.java`, `exception/ErrorCode.java`.
- Các lớp báo cáo của `forum-reports` (controller người dùng, controller/service/repository/DTO của Moderator, enum loại đích và hành động) — chỉ để nhận thêm loại đích `CONVERSATION` (Task 1b). Tên file thật chỉ có sau khi `forum-reports` được code: đầu Task 1b rà lại và ghi danh sách file sẽ sửa vào log trước khi code.
- `server/src/test/java/com/techverse/server/messaging/**` (tạo; mọi lớp test mới của module nằm ở đây) và test trực tiếp của lớp báo cáo bị sửa (`report/**`).
- `plans/messaging.wireframe.md` (tạo ở cổng wireframe).
- `app/src/pages/Messages/**` và test (tạo); `app/src/{types/messaging.ts,services/messagingService.ts,data/messagingI18n.ts}` và test (tạo).
- `app/src/pages/Courses/CourseOverviewPage.tsx` và test (nút “Nhắn tác giả”); `app/src/pages/Moderator/Reports/**`, `app/src/{types/forum.ts,services/forumService.ts,data/forumI18n.ts}` và test (báo cáo cuộc trò chuyện, Task 2b).
- `app/src/{App.tsx,App.*.test.tsx}`, `app/src/data/navigation.ts`, `app/src/components/layout/Sidebar.tsx` và test trực tiếp (gồm `Sidebar.test.tsx`: bỏ `messages` khỏi danh sách đường chết).

## Ngoài phạm vi

- Kết nối trực tiếp (WebSocket/SSE), “đang gõ”, “đã xem”, trạng thái online; email hay thông báo đẩy khi có tin.
- Nhắn giữa hai tài khoản bất kỳ, phòng chat của khóa, nhóm chat; Admin/Moderator nhắn tin.
- Ảnh, tệp đính kèm; sửa, xóa, thu hồi tin nhắn; tìm kiếm tin nhắn; xóa cuộc trò chuyện.
- Moderator đọc cuộc trò chuyện chưa bị báo cáo; Admin đọc mọi cuộc trò chuyện; cấm nhắn theo thời hạn.
- AI trong tin nhắn; số liệu dashboard.

## Ràng buộc chung

- Được đổi API: Có. Được đổi DB: Có, chỉ bằng một migration mới; không sửa migration đã có. Giữ `ApiResponse`/`ErrorResponse`. Giữ nguyên hành vi hiện tại của báo cáo diễn đàn: Có.
- **Một cuộc trò chuyện cho mỗi cặp (người học, tác giả)**, dùng chung cho mọi khóa của tác giả đó. Hai vai cố định theo cuộc trò chuyện: người mở là “người học”, bên kia là “tác giả”.
- Mở cuộc trò chuyện: chỉ người học, từ một khóa mình đang học (`course_enrollments` còn hiệu lực) và tác giả khóa đó không phải chính mình. Đã có cuộc trò chuyện với tác giả đó thì trả lại cuộc cũ. Sau khi đã mở, hai bên nhắn tiếp được kể cả khi quyền học bị thu hồi hay khóa bị ẩn.
- Chỉ **hai người tham gia** đọc và gửi được. Ngoại lệ duy nhất: MODERATOR đọc được tin nhắn của cuộc trò chuyện **đã có ít nhất một báo cáo**, qua API riêng của Moderator, chỉ đọc.
- **Hợp đồng mã quyền, áp cho mọi endpoint** (danh sách, chi tiết, tin nhắn, số chưa đọc, đánh dấu đã đọc, chặn, báo cáo):
  - API người dùng (`/api/v1/conversations/**`, báo cáo cuộc trò chuyện): tài khoản bị khóa hoặc mang role ADMIN/MODERATOR (kể cả tài khoản đa vai) → **403 `ACCESS_DENIED`, xét trước khi nhìn tới `id`**; tài khoản người đọc không phải người tham gia, hoặc `id` không tồn tại → **404**, hai trường hợp không phân biệt được.
  - API Moderator (`/api/v1/moderator/conversations/**`): không có role MODERATOR (kể cả ADMIN đơn vai) → 403; có role MODERATOR nhưng cuộc trò chuyện chưa từng bị báo cáo hoặc không tồn tại → 404, không phân biệt được.
- Tài khoản ADMIN/MODERATOR không mở và không tham gia cuộc trò chuyện. Tác giả bị đình chỉ vẫn đọc và trả lời được.
- **Không rò nội dung qua đường phụ:** đoạn trích tin cuối chỉ có trong API của người tham gia; hàng đợi báo cáo và danh sách của Moderator không mang nội dung, đoạn trích hay tin cuối; không ghi nội dung, đoạn trích hay body request/response của module vào log và thông điệp lỗi. `description` của báo cáo và ghi chú của Moderator là dữ liệu do người dùng tự nhập, Moderator xem được; hệ thống không ngăn người báo cáo tự chép tin nhắn vào đó.
- Trạng thái chặn gửi: **bị chặn** (một trong hai bên bấm chặn; chỉ người chặn bỏ chặn được) hoặc **bị khóa** (Moderator khóa sau báo cáo; chỉ Moderator mở). Khi bị chặn hoặc bị khóa, cả hai bên vẫn đọc được lịch sử nhưng không ai gửi được.
- Tin nhắn là Markdown, dùng cùng bộ kiểm của bài viết (cấm HTML thô, link nguy hiểm, NUL) và từ chối mọi node ảnh; lỗi của bộ kiểm đổi thành mã lỗi của module. Không sửa, không xóa tin đã gửi.
- Thứ tự tin nhắn theo số thứ tự tăng dần do cơ sở dữ liệu cấp (`seq`), dùng làm con trỏ phân trang và mốc đã đọc; không dựa vào thời gian.
- Thứ tự khóa cố định cho mọi đường ghi: người thao tác (`lockActiveUser`) → dòng cuộc trò chuyện → báo cáo theo `id`; không khóa thêm người dùng nào khác sau khi đã khóa cuộc trò chuyện. Đường đi từ một báo cáo (xử lý báo cáo) đọc `target_id` không khóa, khóa cuộc trò chuyện trước rồi mới khóa báo cáo và kiểm lại trạng thái. Kết quả của hai thao tác tranh nhau là kết quả của việc chạy lần lượt theo thứ tự lấy được khóa: gửi tin chạy sau chặn/khóa thì 409, chạy trước thì tin được lưu.
- Điều kiện “đang học” chỉ kiểm một lần lúc mở cuộc trò chuyện bằng dữ liệu đã commit; không khóa dòng quyền học, nên quyền bị thu hồi đúng lúc đó vẫn có thể mở được (chấp nhận, vì sau khi mở vốn đã được nhắn tiếp).
- Thứ tự xét lỗi: 401 → 400 → 403 tài khoản bị khóa/sai role → 404 không tồn tại hoặc không phải người tham gia → tra `clientId` đã dùng (gửi tin) → 409 trạng thái → 429.

## Task 1a — Schema, cuộc trò chuyện và tin nhắn

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- Migration: bảng `conversations` (`learner_id`, `author_id` → users `ON DELETE RESTRICT`; `last_message_seq`, `last_message_at`, `last_message_sender_id`; `learner_last_read_seq`, `author_last_read_seq` mặc định 0; `blocked_by` → users, `blocked_at`; `locked_by` → users, `locked_at`, `lock_note`; cột audit; UNIQUE `(learner_id, author_id)`; CHECK hai người khác nhau; index `(learner_id, last_message_at DESC)`, `(author_id, last_message_at DESC)`); bảng `messages` (`conversation_id` → conversations `ON DELETE RESTRICT`, `sender_id` → users, `content` không rỗng, `client_id uuid`, `seq bigint` tự tăng, `created_at`; UNIQUE `(sender_id, client_id)` trên toàn bảng, không theo từng cuộc trò chuyện; index `(conversation_id, seq)`). Cùng migration này thêm `CONVERSATION` vào CHECK `reports.target_type` và vào hàm `validate_report_target` (giữ nguyên các nhánh cũ), để Task 1b không phải sửa migration đã chạy.
- `POST /api/v1/conversations {courseId}` — mở hoặc lấy lại cuộc trò chuyện với tác giả của khóa; trả cuộc trò chuyện (200 cho cả hai trường hợp).
- `GET /api/v1/conversations` — các cuộc trò chuyện của mình ở cả hai vai, mới có tin trước; phân trang; mỗi mục: người kia (tên, ảnh), vai của mình, đoạn trích tin cuối (120 ký tự), thời điểm tin cuối, `unread`, `blockedByMe`, `blockedByOther`, `locked`.
- `GET /api/v1/conversations/{id}` — thông tin một cuộc trò chuyện như một mục danh sách, thêm `canSend`.
- `GET /api/v1/conversations/{id}/messages` — `size` 1–50 mặc định 30; luôn trả theo `seq` tăng dần kèm `hasMore`. Không tham số: `size` tin mới nhất. `beforeSeq`: `size` tin liền trước mốc đó (`hasMore` = còn tin cũ hơn). `afterSeq`: `size` tin **sớm nhất** sau mốc đó (`hasMore` = còn tin mới hơn chưa lấy), `afterSeq = 0` là từ đầu; giao diện gọi tiếp tới khi `hasMore = false` để không bỏ sót khi có nhiều hơn một trang tin mới.
- `POST /api/v1/conversations/{id}/messages {content, clientId}` — gửi tin (201); cập nhật tin cuối của cuộc trò chuyện trong cùng transaction. Gửi tin **không** tự nâng mốc đã đọc của người gửi.
- `PUT /api/v1/conversations/{id}/read {seq}` — đặt mốc đã đọc của mình (chỉ tăng, không lùi; lớn hơn tin cuối thì lấy tin cuối); giao diện chỉ gửi `seq` của tin thực sự đã tải và hiển thị liền mạch.
- `unread` của một cuộc trò chuyện = tin cuối do **người kia** gửi và có `seq` lớn hơn mốc đã đọc của mình. `GET /api/v1/conversations/unread-count` — số cuộc trò chuyện có `unread`.
- Giao diện tự làm mới bằng `afterSeq` và `unread-count`; server không giữ kết nối.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| Thiếu token / token sai (mọi endpoint) | — | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` | Đăng nhập để tiếp tục. |
| Tài khoản bị khóa; tài khoản mang role ADMIN/MODERATOR (kể cả đa vai) | Mọi endpoint của người dùng, xét trước `id` | 403 `ACCESS_DENIED` | Bạn không có quyền. |
| `id` trên đường dẫn không phải UUID; body thiếu hoặc sai kiểu | Theo xử lý chung | 400 `VALIDATION_ERROR` | — |
| `courseId` | Bắt buộc, UUID | 400 `VALIDATION_ERROR` | — |
| Mở từ khóa không tồn tại, không công khai, hoặc mình không đang học | Không lộ lý do | 403 `CONVERSATION_NOT_ALLOWED` | Bạn cần đang học khóa này để nhắn cho tác giả. |
| Mở với tác giả là chính mình | — | 403 `CONVERSATION_NOT_ALLOWED` | Bạn cần đang học khóa này để nhắn cho tác giả. |
| Hai request mở cùng lúc cho cùng cặp | UNIQUE; request thua đọc lại và trả cuộc trò chuyện đã có | 200 | — |
| Cuộc trò chuyện không tồn tại hoặc mình không phải người tham gia (đọc, gửi, đánh dấu đã đọc) | Không lộ sự tồn tại | 404 `CONVERSATION_NOT_FOUND` | Không tìm thấy cuộc trò chuyện. |
| `content` | Sau trim 1–2.000 ký tự | 400 `VALIDATION_ERROR` | Tin nhắn từ 1 đến 2.000 ký tự. |
| Nội dung Markdown | HTML thô, link nguy hiểm, NUL, ảnh | 400 `MESSAGE_CONTENT_INVALID` | Tin nhắn chứa định dạng không được hỗ trợ. |
| `clientId` | Bắt buộc, UUID do giao diện sinh cho mỗi tin | 400 `VALIDATION_ERROR` | — |
| Gửi lại cùng `clientId` (bấm hai lần, gửi lại do mạng; kể cả hai request song song) | Sau khi qua kiểm quyền và người tham gia, tra `(người gửi, clientId)` **trước** khi xét chặn/khóa và nhịp gửi. Đã có, cùng cuộc trò chuyện và cùng nội dung sau trim: trả lại tin đã lưu (kể cả khi cuộc trò chuyện vừa bị chặn/khóa hoặc đang quá nhịp), không tạo tin mới. Đã có nhưng khác cuộc trò chuyện hoặc khác nội dung: từ chối, không trả tin cũ. Lưu bằng `INSERT … ON CONFLICT DO NOTHING` rồi đọc lại, để request thua khi tranh nhau không làm hỏng transaction | 200 / 409 `MESSAGE_CLIENT_ID_CONFLICT` | — / Yêu cầu trùng. Hãy gửi lại. |
| Gửi tin mới thành công | — | 201 | — |
| Gửi khi cuộc trò chuyện bị chặn (bởi bên nào cũng vậy) | Không lưu tin | 409 `CONVERSATION_BLOCKED` | Cuộc trò chuyện đã bị chặn. |
| Gửi khi cuộc trò chuyện bị Moderator khóa | Không lưu tin | 409 `CONVERSATION_LOCKED` | Cuộc trò chuyện đã bị khóa bởi kiểm duyệt. |
| Hai bên gửi cùng lúc | Khóa dòng cuộc trò chuyện; cả hai tin được lưu, `seq` khác nhau, tin cuối là tin có `seq` lớn hơn | 201 | — |
| `seq` khi đánh dấu đã đọc | Bắt buộc, số nguyên 0 tới giới hạn số nguyên 64 bit; sai → 400. Hợp lệ → 200: không làm lùi mốc, lớn hơn tin cuối thì lấy tin cuối, hai request song song giữ mốc lớn hơn | 400 `VALIDATION_ERROR` / 200 | — |
| `beforeSeq`, `afterSeq`, `size`, `page` | Số nguyên ≥ 0 trong giới hạn 64 bit; không gửi cả `beforeSeq` lẫn `afterSeq`; `size` 1–50; `page ≥ 0` | 400 `VALIDATION_ERROR` | — |
| Gửi quá nhanh | Mỗi người tối đa 20 tin/phút và 5 lần mở cuộc trò chuyện/phút | 429 `MESSAGE_RATE_LIMITED` | Bạn gửi quá nhanh, hãy thử lại sau. |
| Redis lỗi khi kiểm nhịp | Không cho qua | 503 `MESSAGE_STORAGE_UNAVAILABLE` | Dịch vụ đang gián đoạn. Hãy thử lại. |
| Người kia bị khóa tài khoản | Vẫn gửi được; họ đọc khi được mở khóa | 201 | — |

### Kế hoạch thực thi

- **File cần đụng:** migration; entity `Conversation`, `Message`; `ConversationController`, `ConversationService`, repository; `ConversationRules` (logic thuần: ai là người tham gia, `unread`, `canSend`, mốc đã đọc, đoạn trích); `MessageContentService` (chuyển mã lỗi + chặn ảnh); `MessageRateLimiter`; `SecurityConfiguration` (`/api/v1/conversations/**` authenticated); `ErrorCode`.
- **Phần dùng lại:** `lockActiveUser`; cách kiểm “đang học” của module khóa học (đọc `course_enrollments` còn hiệu lực, không tự enroll); bộ kiểm Markdown qua lớp chuyển tiếp như `LessonContentService`; mẫu rate limit Redis theo miền; DTO người dùng (tên, ảnh) của bài viết công khai.
- **Bẫy đã biết:** mọi truy vấn đọc tin phải kèm điều kiện người tham gia ngay trong câu truy vấn hoặc kiểm trước khi đọc — không có đường nào đọc tin chỉ bằng `id`; API mở cuộc trò chuyện không được gọi đường đọc bài học (đường đó tự enroll khóa miễn phí); `seq` do DB cấp có thể có khoảng trống, chỉ dùng để so lớn nhỏ; cập nhật `last_message_*` và mốc đã đọc trong cùng transaction với việc lưu tin; không đưa `content` vào log hay thông điệp lỗi; `unread-count` phải là một câu đếm, không tải danh sách.

### Xong khi

- [ ] `MessagingMigrationTest` (Flyway thuần): hai bảng, UNIQUE cặp và UNIQUE `(sender_id, client_id)`, CHECK hai người khác nhau, các index; báo cáo loại `CONVERSATION` ghi được, loại cũ vẫn ghi được, đích không tồn tại vẫn bị trigger từ chối.
- [ ] `ConversationRulesTest` (unit): ma trận role × người tham gia ra đúng 403/404 theo “Hợp đồng mã quyền”; `canSend` theo chặn/khóa; `unread` theo mốc đọc và người gửi tin cuối (gồm ca người kia gửi rồi mình gửi khi chưa đọc); mốc đọc không lùi; đoạn trích; ba kiểu phân trang tin và `hasMore`; quyết định idempotency (cùng/khác nội dung, cùng/khác cuộc trò chuyện).
- [ ] `MessageContentTest`, `MessageRateLimiterTest` (unit): nội dung hợp lệ/không hợp lệ ra đúng mã lỗi; trong ngưỡng, vượt ngưỡng → 429, Redis lỗi → 503.
- [ ] `ConversationControllerTest` (`@WebMvcTest`): validation từng trường theo biên trong bảng, 401, mapping mã lỗi, gửi cả `beforeSeq` lẫn `afterSeq`.
- [ ] `ConversationIntegrationTest` (DB/security thật, gộp theo luồng): (1) người đang học mở cuộc trò chuyện, mở lại trả cuộc cũ, chưa học/khóa của mình → 403; (2) hai bên nhắn qua lại, lấy hết hơn một trang tin mới bằng `afterSeq`, đánh dấu đã đọc, `unread-count` đổi đúng ở từng bên; (3) **riêng tư: người đọc thứ ba gọi danh sách/chi tiết/tin nhắn/đánh dấu/gửi với `id` thật → 404 và danh sách của họ không có cuộc đó; ADMIN, MODERATOR và tài khoản đa vai → 403; tài khoản bị khóa → 403; không phản hồi nào chứa nội dung hay đoạn trích**; (4) đồng thời và gửi lại: hai request mở cùng cặp chỉ một dòng; gửi lại cùng `clientId` chỉ một tin; cùng `clientId` khác nội dung → 409; hai bên gửi song song lưu đủ hai tin.
- [ ] Chạy các lớp trên (cần Docker); full backend do CI chạy khi mở PR.

## Task 1b — Chặn, báo cáo và quyền đọc của Moderator

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- `PUT /api/v1/conversations/{id}/block {blocked}` — người tham gia chặn (`true`) hoặc bỏ chặn (`false`). Đã bị bên kia chặn thì mình không chặn thêm và không bỏ chặn được.
- Task này không có migration (phần schema báo cáo đã nằm trong migration của 1a).
- Báo cáo: `POST /api/v1/reports` của `forum-reports` nhận thêm `targetType = CONVERSATION`, `targetId` là cuộc trò chuyện; chỉ người tham gia báo cáo được, khi cuộc trò chuyện chưa bị Moderator khóa; mỗi người một báo cáo cho một cuộc trò chuyện. Mọi quy tắc và mã lỗi khác của báo cáo (`targetId`, `reason`, `description`, nhịp báo cáo, Redis lỗi, 401/403) **thừa kế nguyên** bảng Task 1b của `forum-reports`; bảng dưới chỉ ghi phần khác đi theo loại đích.
- Hàng đợi Moderator của `forum-reports`: mục báo cáo cuộc trò chuyện hiện loại đích, hai người tham gia, trạng thái chặn/khóa, **không kèm nội dung tin nhắn, đoạn trích hay tin cuối**. Xử lý: `PATCH /api/v1/moderator/reports/{id}/resolve` nhận thêm `action = LOCK_CONVERSATION` cho loại đích này (`HIDE_CONTENT` không áp dụng); `DISMISS` giữ nguyên nghĩa. Như báo cáo diễn đàn, xử lý một báo cáo áp cho mọi báo cáo `OPEN` của cùng cuộc trò chuyện.
- `GET /api/v1/moderator/conversations/{id}/messages` — chỉ MODERATOR, chỉ khi cuộc trò chuyện có ít nhất một báo cáo (ở trạng thái bất kỳ); phân trang như API của người dùng; chỉ đọc, không đổi mốc đã đọc của ai.
- `PATCH /api/v1/moderator/conversations/{id}/lock {locked, note}` — khóa hoặc mở khóa trực tiếp một cuộc trò chuyện đã từng bị báo cáo; khóa đồng thời đóng mọi báo cáo `OPEN` của nó thành `ACTIONED`.
- `GET /api/v1/moderator/conversations?locked=true` — chỉ MODERATOR; các cuộc trò chuyện đang bị khóa (đều đã từng bị báo cáo): hai người tham gia, ghi chú khóa, người khóa, thời điểm; phân trang, mới khóa trước; không có nội dung tin nhắn. Tham số `locked` bắt buộc là `true`.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| `blocked` | Bắt buộc, boolean | 400 `VALIDATION_ERROR` | — |
| Chặn/bỏ chặn khi không phải người tham gia | — | 404 `CONVERSATION_NOT_FOUND` | Không tìm thấy cuộc trò chuyện. |
| Chặn khi mình đã chặn; bỏ chặn khi không bị chặn | Gọi lặp cho cùng kết quả | 200 | — |
| Chặn hoặc bỏ chặn khi **bên kia** đang chặn (kể cả hai bên bấm chặn cùng lúc: người sau) | Chỉ người chặn bỏ chặn được | 409 `CONVERSATION_BLOCKED` | Cuộc trò chuyện đã bị chặn. |
| Báo cáo cuộc trò chuyện khi không phải người tham gia hoặc không tồn tại | Không lộ sự tồn tại | 404 `REPORT_TARGET_NOT_FOUND` | Nội dung không còn khả dụng. |
| Báo cáo cuộc trò chuyện chưa có tin nhắn nào của bên kia | — | 409 `REPORT_TARGET_EMPTY` | Chưa có tin nhắn nào để báo cáo. |
| Báo cáo cuộc trò chuyện đang bị Moderator khóa (kể cả báo cáo đến ngay sau khi khóa) | Không tạo báo cáo | 409 `CONVERSATION_LOCKED` | Cuộc trò chuyện đã bị khóa bởi kiểm duyệt. |
| Chặn, bỏ chặn, báo cáo bằng tài khoản bị khóa hoặc mang role ADMIN/MODERATOR | Xét trước `id` | 403 `ACCESS_DENIED` | Bạn không có quyền. |
| Đã báo cáo cuộc trò chuyện này (kể cả hai request song song) | UNIQUE sẵn có | 409 `REPORT_ALREADY_SUBMITTED` | Bạn đã báo cáo nội dung này. |
| `action` khi xử lý báo cáo | `LOCK_CONVERSATION` chỉ cho đích `CONVERSATION`; `HIDE_CONTENT` chỉ cho đích `FORUM_POST`; dùng sai loại bị từ chối | 400 `VALIDATION_ERROR` | — |
| `note` | Bắt buộc 1–1.000 ký tự cho `LOCK_CONVERSATION` và khi khóa trực tiếp; tùy chọn ≤ 1.000 cho `DISMISS` và mở khóa | 400 `VALIDATION_ERROR` | Hãy ghi lý do (tối đa 1.000 ký tự). |
| Báo cáo đã được xử lý (kể cả hai Moderator đồng thời) | Như `forum-reports` | 409 `REPORT_ALREADY_HANDLED` | Báo cáo đã được xử lý. Hãy tải lại. |
| Gọi API Moderator khi thiếu token / token sai | — | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` | Đăng nhập để tiếp tục. |
| Gọi API Moderator khi không có role MODERATOR (kể cả ADMIN đơn vai) hoặc tài khoản bị khóa | — | 403 `ACCESS_DENIED` | Bạn không có quyền. |
| Moderator đọc hoặc khóa cuộc trò chuyện **chưa từng bị báo cáo**, hoặc không tồn tại (kể cả đoán đúng `id` thật) | Không phân biệt hai trường hợp | 404 `CONVERSATION_NOT_FOUND` | Không tìm thấy cuộc trò chuyện. |
| `LOCK_CONVERSATION` khi cuộc trò chuyện đã bị khóa | Không xảy ra với báo cáo `OPEN` (khóa đã đóng báo cáo, và cuộc đã khóa không nhận báo cáo mới); nếu gặp thì từ chối | 409 `REPORT_ALREADY_HANDLED` | Báo cáo đã được xử lý. Hãy tải lại. |
| Tham số danh sách cuộc đang khóa | `locked=true` bắt buộc; `page ≥ 0`, `size` 1–50 | 400 `VALIDATION_ERROR` | — |
| `locked` | Bắt buộc, boolean | 400 `VALIDATION_ERROR` | — |
| Khóa khi đã khóa; mở khi không khóa (kể cả hai Moderator đồng thời) | — | 409 `CONVERSATION_STATE_INVALID` | Không thực hiện được ở trạng thái hiện tại. |
| Báo cáo quá nhanh / Redis lỗi | Theo giới hạn báo cáo của `forum-reports` | 429 / 503 như `forum-reports` | Như `forum-reports`. |

### Kế hoạch thực thi

- **File cần đụng:** `ConversationService` (chặn); enum loại đích và các lớp `Report*` của `forum-reports` (nhận `CONVERSATION`, hành động `LOCK_CONVERSATION`, dữ liệu mục hàng đợi cho loại đích mới); `ModeratorConversationController` + service; `SecurityConfiguration` (`/api/v1/moderator/conversations/**` authenticated); `ErrorCode`.
- **Phần dùng lại:** toàn bộ luồng báo cáo, xử lý, đồng thời và giới hạn nhịp của `forum-reports`; cách kiểm role MODERATOR; phân trang tin nhắn của 1a.
- **Bẫy đã biết:** test hồi quy báo cáo diễn đàn phải vẫn đạt; điều kiện “đã có báo cáo” kiểm trong cùng truy vấn với việc đọc tin (không kiểm ở giao diện); hàng đợi **không** trả nội dung tin nhắn — Moderator phải gọi API đọc riêng, để mọi lần đọc đều qua một cổng kiểm; thứ tự khóa: cuộc trò chuyện trước, báo cáo sau; `HIDE_CONTENT` gửi cho đích `CONVERSATION` phải bị từ chối chứ không lặng lẽ bỏ qua.

### Xong khi

- [ ] `ConversationRulesTest` thêm ma trận chặn/bỏ chặn (ai chặn, ai gọi) và hành động hợp lệ theo loại đích.
- [ ] `ModeratorConversationControllerTest` (`@WebMvcTest`) và test `@WebMvcTest` của báo cáo bị sửa: validation (`action` sai loại đích, `note` theo hành động), 401/403, mapping mã lỗi.
- [ ] `ConversationModerationIntegrationTest` (DB/security thật, gộp theo luồng): (1) chặn → cả hai không gửi được, bên kia không bỏ chặn được, người chặn bỏ chặn → gửi lại được; gửi lại tin cũ cùng `clientId` sau khi bị chặn vẫn trả tin đã lưu; (2) người tham gia báo cáo, người ngoài báo cáo → 404, báo cáo lần hai → 409, cuộc chưa có tin của bên kia → `REPORT_TARGET_EMPTY`; (3) **riêng tư: Moderator đọc cuộc trò chuyện chưa bị báo cáo bằng `id` thật → 404, sau khi có báo cáo → đọc được; ADMIN đơn vai → 403; hàng đợi và danh sách cuộc đang khóa không chứa nội dung, đoạn trích hay tin cuối**; (4) `LOCK_CONVERSATION` khóa và đóng mọi báo cáo `OPEN`, hai bên không gửi được, báo cáo mới bị từ chối, cuộc hiện trong danh sách đang khóa, mở khóa → gửi lại được; hai Moderator xử lý song song một thành công.
- [ ] Chạy các lớp trên + `ConversationIntegrationTest` + lớp tích hợp báo cáo của `forum-reports`; full backend do CI.

## Cổng wireframe

Sau khi 1a–1b xong và đã review: Claude viết `plans/messaging.wireframe.md` (bố cục chữ cho các màn của 2a, 2b ở desktop và mobile 390px, trạng thái tải/rỗng/lỗi/bị chặn/bị khóa). Người dùng duyệt rồi mới code giao diện.

## Task 2a — Giao diện nhắn tin

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- `/messages` (đăng nhập; bọc `AuthRoute` và `ReaderRoute`): danh sách cuộc trò chuyện (ảnh, tên, đoạn trích, thời điểm, dấu chưa đọc); desktop hai cột (danh sách + cuộc đang mở), mobile mỗi lúc một màn. `/messages/:id`: lịch sử tin (Markdown, khối code), nút “Tải tin cũ hơn”, ô nhập (đếm ký tự, Enter gửi, Shift+Enter xuống dòng), menu Chặn/Bỏ chặn và Báo cáo (hộp thoại lý do + mô tả như diễn đàn).
- Tự làm mới: khi một cuộc trò chuyện đang mở và tab đang hiển thị, gọi `afterSeq` mỗi 5 giây; tab ẩn thì dừng, hiện lại thì gọi ngay. Tin mình gửi hiện ngay ở trạng thái “đang gửi”, lỗi thì hiện “Gửi lại” (dùng lại đúng `clientId`).
- Mở cuộc trò chuyện: đánh dấu đã đọc tới tin mới nhất đã tải; tin mới đến khi đang xem cũng được đánh dấu. Khi tự làm mới, gọi `afterSeq` lặp tới khi `hasMore = false` rồi mới nâng mốc; chỉ gửi mốc là `seq` lớn nhất của đoạn tin đã tải liền mạch (tin mình vừa gửi có `seq` cao hơn không được dùng để nhảy qua tin chưa tải).
- Hộp thoại báo cáo ghi rõ: “Khi bạn báo cáo, kiểm duyệt viên sẽ xem được toàn bộ tin nhắn trong cuộc trò chuyện này.”
- Thanh bên người dùng: mục “Tin nhắn” kèm số cuộc trò chuyện chưa đọc, làm mới mỗi 30 giây khi tab hiển thị; chỉ hiện với tài khoản người đọc đã đăng nhập.
- Trang giới thiệu khóa: nút “Nhắn tác giả” hiện khi `course.viewer.enrolled` là true và `course.author.id` khác người đang đăng nhập (khách và Admin/Moderator không tới được trạng thái này); bấm thì mở hoặc tiếp tục cuộc trò chuyện rồi chuyển tới `/messages/:id`.
- Bị chặn hoặc bị khóa: ẩn ô nhập, hiện thông báo trạng thái; người chặn thấy nút “Bỏ chặn”.

### Kế hoạch thực thi

- **File cần đụng:** `pages/Messages/**`, `messagingService.ts`, `types/messaging.ts`, `messagingI18n.ts`, `CourseOverviewPage.tsx`, `App.tsx`, `navigation.ts`, `Sidebar.tsx`, `Sidebar.test.tsx`.
- **Phần dùng lại:** `MarkdownContent`; `UserAvatar`; `EmptyState`; `Textarea`, `Button`, `Dialog`, `AlertDialog`; hộp thoại báo cáo của diễn đàn (cùng lý do và quy tắc mô tả); cách dừng/tiếp tục theo `document.visibilityState`; `returnTo`.
- **Bẫy đã biết:** hủy hẹn giờ làm mới khi rời trang hoặc đổi cuộc trò chuyện; lần làm mới trước chưa xong thì không gọi lần mới; gộp tin theo `seq` để không hiện trùng tin vừa gửi với tin lấy về; chỉ tự cuộn xuống khi người dùng đang ở cuối; test dùng đồng hồ giả, không chờ thật; chuỗi dài trong test dùng `user.paste`; vùng chạm 44px; không assert class Tailwind.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Menu / tiêu đề | Tin nhắn | Messages |
| Vai | Tác giả / Người học | Author / Learner |
| Nhập | Nhập tin nhắn… / Gửi / Đang gửi… / Gửi lại | Type a message… / Send / Sending… / Resend |
| Lịch sử | Tải tin cũ hơn / Chưa có tin nhắn. Hãy gửi lời chào. | Load older messages / No messages yet. Say hello. |
| Khóa học | Nhắn tác giả | Message the author |
| Hành động | Chặn / Bỏ chặn / Báo cáo | Block / Unblock / Report |
| Lưu ý khi báo cáo | Khi bạn báo cáo, kiểm duyệt viên sẽ xem được toàn bộ tin nhắn trong cuộc trò chuyện này. | When you report, moderators will be able to read every message in this conversation. |
| Xác nhận chặn | Chặn cuộc trò chuyện này? Cả hai bên sẽ không gửi được tin mới. | Block this conversation? Neither side will be able to send new messages. |
| Bị chặn | Bạn đã chặn cuộc trò chuyện này. / Cuộc trò chuyện đã bị chặn. | You blocked this conversation. / This conversation is blocked. |
| Bị khóa | Cuộc trò chuyện đã bị khóa bởi kiểm duyệt. | This conversation was locked by moderation. |
| Rỗng | Bạn chưa có cuộc trò chuyện nào. | You have no conversations yet. |
| Chưa đọc | {n} cuộc trò chuyện chưa đọc | {n} unread conversations |

Câu hiển thị cho từng mã lỗi lấy từ cột “Copy hiển thị” của bảng 1a/1b; bản tiếng Anh dịch tương ứng trong `messagingI18n`; dòng có copy “—” dùng câu dự phòng “Yêu cầu không hợp lệ. Hãy tải lại trang.”

### UI

- Theo wireframe đã duyệt và `UI_GUIDE.md`; primitive và token hiện có, không thêm màu mới. Trạng thái: tải, rỗng, lỗi, đang gửi, gửi lỗi, bị chặn, bị khóa. Mobile 390px: ô nhập dính đáy, khối code cuộn ngang trong khung của nó, trang không cuộn ngang.

### Xong khi

- [ ] Test unit: validation theo bảng 1a (biên như test backend), mapping mọi mã lỗi 1a/1b liên quan vi/en, gộp tin theo `seq` không trùng, `canSend` theo trạng thái.
- [ ] `Messages/*.test.tsx` (luồng chính): danh sách và dấu chưa đọc; mở cuộc trò chuyện → đánh dấu đã đọc; gửi tin, lỗi → “Gửi lại” cùng `clientId`; tự làm mới lấy tin mới và dừng khi tab ẩn (đồng hồ giả); tải tin cũ hơn; chặn/bỏ chặn; báo cáo; trạng thái bị khóa.
- [ ] `CourseOverviewPage.test.tsx`: nút chỉ hiện với người đang học; bấm thì chuyển tới cuộc trò chuyện. Test `Sidebar` (số chưa đọc, không hiện với khách), `App` bị sửa (ADMIN/MODERATOR vào `/messages` bị chuyển về dashboard) + `npm run build` trong `app/`.
- [ ] Kiểm bằng mắt: dark/light × desktop/mobile, một lượt; ghi log.

## Task 2b — Giao diện Moderator: báo cáo cuộc trò chuyện

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- Trang `/moderator/reports` của `forum-reports`: mục báo cáo loại “Cuộc trò chuyện” hiện hai người tham gia, lý do, mô tả, trạng thái chặn/khóa; nút “Xem tin nhắn” mở khung chỉ đọc gọi API đọc của Moderator (phân trang, tải tin cũ hơn); nút “Khóa cuộc trò chuyện” (bắt buộc ghi chú) và “Bỏ qua”.
- Tab “Nội dung đang ẩn” thêm danh sách các cuộc trò chuyện đang bị khóa (lấy từ `GET /api/v1/moderator/conversations?locked=true`) với nút “Xem tin nhắn” và “Mở khóa”.
- Validation và mọi trạng thái lỗi dẫn chiếu bảng 1b của spec này và bảng 1b của `forum-reports`.

### Kế hoạch thực thi

- **File cần đụng:** `pages/Moderator/Reports/**`, `forumService.ts`/`types/forum.ts`/`forumI18n.ts` (loại đích mới), `messagingService.ts` (API đọc và khóa của Moderator).
- **Phần dùng lại:** toàn bộ màn báo cáo của `forum-reports`; khung hiển thị tin nhắn của 2a ở chế độ chỉ đọc.
- **Bẫy đã biết:** không tự tải tin nhắn khi mở danh sách — chỉ tải khi Moderator bấm “Xem tin nhắn”; khung xem không có ô nhập và không gọi API đánh dấu đã đọc; sau khi xử lý tải lại danh sách.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Loại đích | Cuộc trò chuyện | Conversation |
| Hành động | Xem tin nhắn / Khóa cuộc trò chuyện / Mở khóa / Bỏ qua | View messages / Lock conversation / Unlock / Dismiss |
| Nhãn | Người tham gia / Đang bị chặn / Đang bị khóa | Participants / Blocked / Locked |
| Lưu ý | Bạn chỉ xem được vì cuộc trò chuyện này đã bị báo cáo. | You can view this only because the conversation was reported. |
| Ghi chú | Hãy ghi lý do (tối đa 1.000 ký tự). | Enter a reason (up to 1,000 characters). |

### UI

- Theo wireframe và chuẩn màn Moderator hiện có; đủ tải/rỗng/lỗi; desktop và mobile 390px không cuộn ngang.

### Xong khi

- [ ] `Moderator/Reports/*.test.tsx` thêm: mục báo cáo cuộc trò chuyện không gọi API tin nhắn khi chưa bấm; “Xem tin nhắn” hiện lịch sử chỉ đọc; khóa thiếu ghi chú; khóa và bỏ qua thành công; mở khóa ở tab đang ẩn; báo cáo diễn đàn vẫn hoạt động như cũ.
- [ ] `npm run build` trong `app/`.
- [ ] Kiểm bằng mắt: dark/light × desktop/mobile, một lượt; ghi log.

## Câu hỏi mở cần người dùng chốt

- (không có — bảy câu hỏi mở đã chốt giữ mặc định, xem mục dưới)

## Quyết định của người dùng

**Người dùng chốt spec 2026-11-15** (Task 1a–1b, cổng wireframe, 2a–2b). Lịch sử phản biện: [`messaging.review.md`](messaging.review.md).

- Bảy câu hỏi mở giữ mặc định: một cuộc trò chuyện cho mỗi cặp người học – tác giả; chỉ người đang học mở được, sau đó nhắn tiếp được; chặn hai chiều, chỉ người chặn bỏ chặn; Moderator đọc và khóa được cuộc đã từng bị báo cáo; không sửa/xóa tin, 2.000 ký tự, 20 tin/phút; tự làm mới 5 giây và 30 giây; Admin/Moderator không dùng, `/messages` “Tin nhắn”.
- Làm cuối cùng, cắt đầu tiên nếu thiếu thời gian; chỉ bắt đầu khi `forum-reports` xong cả backend lẫn giao diện báo cáo.
- Phần Claude sửa thân spec sau vòng 1 chưa qua Codex soát vòng 2.
