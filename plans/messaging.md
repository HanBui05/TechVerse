# Messaging — người học nhắn riêng với tác giả khóa học

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Claude viết (D-030); Codex chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Người học (đã mua hoặc chưa) mở cuộc trò chuyện riêng với tác giả của một khóa đang công khai để hỏi trước khi mua hoặc hỏi bài; hai bên nhắn chữ (Markdown, có khối code), tin mới hiện ngay nhờ server đẩy sự kiện qua WebSocket, thanh bên báo số cuộc trò chuyện chưa đọc. Mỗi bên chặn được cuộc trò chuyện và báo cáo cho Moderator; Moderator chỉ đọc được cuộc trò chuyện đã bị báo cáo.
**Làn:** Đầy đủ · **Rủi ro:** **cao** (tin nhắn riêng tư, ranh giới quyền đọc). Review vòng 1 dùng `adversarial-review`.
**Thứ tự:** 1a → 1b → 1c (Backend) → cổng wireframe → 2a → 2b (Giao diện). **Làm cuối cùng và là phần bị cắt đầu tiên** nếu thiếu thời gian (M1 A, T3 A). Bỏ 1c chỉ khi người dùng quyết (ghi log); khi đó cổng wireframe mở sau 1b và 2a chạy bằng nhánh tự làm mới đã mô tả trong 2a, không thêm việc backend. **Điều kiện bắt đầu:** `forum-reports` đã xong (PR #14 merge 2026-11-22).
**Nguồn quyết định:** câu M1–M7 trong [`roadmap.questions.md`](roadmap.questions.md) (người dùng trả lời 2026-11-14): M1 A, M2 A (người học với tác giả khóa đang học — **thay 2026-11-22**: cả người chưa mua), M3 B (tự làm mới vài giây/lần — **thay 2026-11-22**: REST + WebSocket đẩy sự kiện), M4 A (chỉ chữ, có khối code), M5 A (chặn + báo cáo), M6 A (Moderator chỉ đọc cuộc trò chuyện bị báo cáo), M7 A (số chưa đọc trên thanh bên).

## Hiện trạng đã đối chiếu (2026-11-22)

- Chưa có schema hay code nhắn tin. Migration mới nhất là V22 (`V22__forum_reactions.sql`).
- Khóa học: `GET /api/v1/courses/{id}` (`PublishedCourseServiceImpl.detail`) chỉ trả khóa thỏa `CourseSpecification.visibleCourse()`, có `author.id` và `viewer {enrolled, canStart}`; `canStart` là `true` với khách, `false` với chủ khóa và tài khoản quản trị (`viewer(...)`, dòng ~266). Quyền học: `CourseEnrollmentRepository.findActive(userId, courseId)` (`revoked_at IS NULL`). Không cần đổi API khóa học.
- Báo cáo (`forum-reports`): `ReportRequest.Create.targetType` chỉ nhận chuỗi `FORUM_POST`, `Resolve.action` nhận `HIDE_CONTENT|DISMISS`; `ReportService` gắn cứng `Report.FORUM_POST` ở tạo, hàng đợi, xử lý; `ReportResponse.Item` mang `post` (`ModeratedPost`); nhịp báo cáo dùng `ForumService.rateLimit(RateKind.REPORT)`. DB: CHECK `ck_reports_target_type` và hàm `validate_report_target` (V1 `:575`, `:1013`–`1038`) chưa có `CONVERSATION`.
- Giới hạn nhịp hiện có (`ForumService.COUNTER`) là cửa sổ 60 giây; module chỉ cần các nhịp theo phút.
- Chưa có `spring-boot-starter-websocket`. Frontend gọi API bằng `fetch` + header `Authorization` (token trong bộ nhớ), CORS chỉ cho `webUrl` (`SecurityConfiguration.corsConfigurationSource`).
- Frontend: `Sidebar.test.tsx:50` coi `/messages` là đường chết; ADMIN/MODERATOR bị `ReaderRoute` đẩy khỏi trang người đọc; trang khóa `app/src/pages/Courses/CourseOverviewPage.tsx` đọc `course.viewer`.

## Đường dẫn thuộc module

- `server/src/main/resources/db/migration/V<n>__messaging.sql` (tạo; `<n>` là số kế tiếp lúc code).
- `server/src/main/java/com/techverse/server/{controller,configuration,entity,enums,dto,repository,service}/**/*{Conversation,Message}*.java` (tạo, gồm cấu hình và handler WebSocket của Task 1c); `configuration/SecurityConfiguration.java`, `exception/ErrorCode.java`, `server/build.gradle` (thêm `spring-boot-starter-websocket`).
- Lớp báo cáo của `forum-reports`, chỉ để nhận loại đích `CONVERSATION` (Task 1b): `dto/request/ReportRequest.java`, `dto/response/ReportResponse.java`, `service/impl/ReportService.java`, `repository/ReportRepository.java`, `controller/ModeratorReportController.java`, `entity/Report.java`.
- `server/src/test/java/com/techverse/server/messaging/**` (tạo; mọi lớp test mới của module) và test báo cáo bị ảnh hưởng (`forum/Report*Test.java`).
- `plans/messaging.wireframe.md` (tạo ở cổng wireframe).
- `docs/RUNBOOK.md` (Task 1c: ghi yêu cầu proxy không ghi query của `/ws/messaging`).
- `app/src/pages/Messages/**` và test (tạo); `app/src/{types/messaging.ts,services/messagingService.ts,data/messagingI18n.ts}` và test (tạo).
- `app/src/pages/Courses/CourseOverviewPage.tsx` và test (nút “Nhắn tác giả”); `app/src/pages/Moderator/Reports/**`, `app/src/{types/forum.ts,services/forumService.ts,data/forumI18n.ts}` và test (báo cáo cuộc trò chuyện, Task 2b).
- `app/src/{App.tsx,App.*.test.tsx}`, `app/src/data/navigation.ts`, `app/src/components/layout/Sidebar.tsx` và test trực tiếp (gồm `Sidebar.test.tsx`: bỏ `messages` khỏi danh sách đường chết).

## Ngoài phạm vi

- Gửi tin hay chở nội dung tin qua WebSocket (socket chỉ đẩy sự kiện); “đang gõ”, “đã xem”, trạng thái online; email hay thông báo đẩy khi có tin; chạy nhiều server (broker ngoài).
- Tác giả tắt nhận tin từ người chưa mua (dùng “Chặn”).
- Nhắn giữa hai tài khoản bất kỳ, phòng chat của khóa, nhóm chat; Admin/Moderator nhắn tin.
- Ảnh, tệp đính kèm; sửa, xóa, thu hồi tin nhắn; tìm kiếm tin nhắn; xóa cuộc trò chuyện.
- Moderator đọc cuộc trò chuyện chưa bị báo cáo; Admin đọc mọi cuộc trò chuyện; cấm nhắn theo thời hạn.
- AI trong tin nhắn; số liệu dashboard.

## Ràng buộc chung

- Được đổi API: Có. Được đổi DB: Có, chỉ bằng một migration mới; không sửa migration đã có. Giữ `ApiResponse`/`ErrorResponse`. Giữ nguyên hành vi hiện tại của báo cáo diễn đàn: Có.
- **Một cuộc trò chuyện cho mỗi cặp (người học, tác giả)**, dùng chung cho mọi khóa của tác giả đó. Hai vai cố định theo cuộc trò chuyện: người mở là “người học”, bên kia là “tác giả”.
- Mở cuộc trò chuyện: tài khoản người đọc đang hoạt động, từ một khóa **đang công khai** (`visibleCourse`) mà tác giả không phải chính mình — **không cần đã mua/đang học** (quyết định 2026-11-22). Đã có cuộc với tác giả đó thì trả lại cuộc cũ. Sau khi đã mở, hai bên nhắn tiếp được kể cả khi khóa bị ẩn.
- **Khóa đang hỏi:** mỗi lần mở (kể cả mở lại) ghi khóa đó làm ngữ cảnh của cuộc trò chuyện. API trả `contextCourse {id, title, available}`: `title` là tên lưu lúc mở; `id` là `null` khi khóa đã bị xóa; `available` = khóa hiện còn công khai (tính lúc đọc, không suy từ việc `id` còn tồn tại). `contextEnrolled` = người học có đang học khóa đó (tính lúc đọc), `null` khi `id` là `null`.
- **Chống spam:** khi tác giả **chưa từng gửi tin** trong cuộc trò chuyện, người học gửi tối đa **3 tin**; tác giả trả lời một lần là hết giới hạn này. Không giới hạn số cuộc trò chuyện mới mỗi ngày (người dùng bỏ 2026-11-22); chỉ có nhịp mở 5 lần/phút ở bảng 1a.
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
- **Thời gian thực:** REST cho mọi thao tác và để tải tin; WebSocket (Task 1c) chỉ đẩy sự kiện không nội dung tới đúng hai người tham gia, trình duyệt nhận rồi gọi REST. Socket rớt thì kết nối lại và lấy bù bằng `afterSeq`; không có socket thì giao diện tự làm mới (cuộc đang mở 5 giây, danh sách và số chưa đọc 30 giây).
- Thứ tự xét lỗi: 401 → 400 → 403 tài khoản bị khóa/sai role → 404 không tồn tại hoặc không phải người tham gia → tra `clientId` đã dùng (gửi tin) → 409 trạng thái (chặn, khóa, chờ tác giả trả lời) → 429.

## Task 1a — Schema, cuộc trò chuyện và tin nhắn

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- Migration: bảng `conversations` (`learner_id`, `author_id` → users `ON DELETE RESTRICT`; `context_course_id` → courses `ON DELETE SET NULL` + `context_course_title` (tên lúc mở); `author_replied` boolean mặc định false; `last_message_seq`, `last_message_at`, `last_message_sender_id`; `learner_last_read_seq`, `author_last_read_seq` mặc định 0; `blocked_by` → users, `blocked_at`; `locked_by` → users, `locked_at`, `lock_note`; cột audit; UNIQUE `(learner_id, author_id)`; CHECK hai người khác nhau; index `(learner_id, last_message_at DESC)`, `(author_id, last_message_at DESC)`); bảng `messages` (`conversation_id` → conversations `ON DELETE RESTRICT`, `sender_id` → users, `content` không rỗng, `client_id uuid`, `seq bigint` tự tăng, `created_at`; UNIQUE `(sender_id, client_id)` trên toàn bảng, không theo từng cuộc trò chuyện; index `(conversation_id, seq)`). Cùng migration này thêm `CONVERSATION` vào CHECK `reports.target_type` và vào hàm `validate_report_target` (giữ nguyên các nhánh cũ), để Task 1b không phải sửa migration đã chạy.
- `POST /api/v1/conversations {courseId}` — mở hoặc lấy lại cuộc trò chuyện với tác giả của khóa, cập nhật `contextCourse`; trả cuộc trò chuyện (200 cho cả hai trường hợp).
- `GET /api/v1/conversations` — các cuộc trò chuyện của mình ở cả hai vai, mới có tin trước; phân trang; mỗi mục: người kia (tên, ảnh), vai của mình, `contextCourse {id, title, available}`, `contextEnrolled`, đoạn trích tin cuối (120 ký tự), thời điểm tin cuối, `unread`, `blockedByMe`, `blockedByOther`, `locked`.
- `GET /api/v1/conversations/{id}` — thông tin một cuộc trò chuyện như một mục danh sách, thêm `canSend` và `remainingBeforeReply` (số tin người học còn gửi được trước khi tác giả trả lời; `null` khi không áp dụng: mình là tác giả hoặc tác giả đã trả lời).
- `GET /api/v1/conversations/{id}/messages` — `size` 1–50 mặc định 30; luôn trả theo `seq` tăng dần kèm `hasMore`. Không tham số: `size` tin mới nhất. `beforeSeq`: `size` tin liền trước mốc đó (`hasMore` = còn tin cũ hơn). `afterSeq`: `size` tin **sớm nhất** sau mốc đó (`hasMore` = còn tin mới hơn chưa lấy), `afterSeq = 0` là từ đầu; giao diện gọi tiếp tới khi `hasMore = false` để không bỏ sót khi có nhiều hơn một trang tin mới.
- `POST /api/v1/conversations/{id}/messages {content, clientId}` — gửi tin (201); cập nhật tin cuối của cuộc trò chuyện trong cùng transaction. Gửi tin **không** tự nâng mốc đã đọc của người gửi.
- `PUT /api/v1/conversations/{id}/read {seq}` — đặt mốc đã đọc của mình (chỉ tăng, không lùi; lớn hơn tin cuối thì lấy tin cuối); giao diện chỉ gửi `seq` của tin thực sự đã tải và hiển thị liền mạch.
- `unread` của một cuộc trò chuyện = tin cuối do **người kia** gửi và có `seq` lớn hơn mốc đã đọc của mình. `GET /api/v1/conversations/unread-count` — số cuộc trò chuyện có `unread`.
- Gửi tin của tác giả đặt `author_replied = true` trong cùng transaction.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| Thiếu token / token sai (mọi endpoint) | — | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` | Đăng nhập để tiếp tục. |
| Tài khoản bị khóa; tài khoản mang role ADMIN/MODERATOR (kể cả đa vai) | Mọi endpoint của người dùng, xét trước `id` | 403 `ACCESS_DENIED` | Bạn không có quyền. |
| `id` trên đường dẫn không phải UUID; body thiếu hoặc sai kiểu | Theo xử lý chung | 400 `VALIDATION_ERROR` | — |
| `courseId` | Bắt buộc, UUID | 400 `VALIDATION_ERROR` | — |
| Mở từ khóa không tồn tại hoặc không công khai | Không lộ lý do; **không** đòi đang học | 403 `CONVERSATION_NOT_ALLOWED` | Không thể nhắn cho tác giả của khóa này. |
| Mở với tác giả là chính mình | — | 403 `CONVERSATION_NOT_ALLOWED` | Không thể nhắn cho tác giả của khóa này. |
| Hai request mở cùng lúc cho cùng cặp | UNIQUE; request thua đọc lại và trả cuộc trò chuyện đã có | 200 | — |
| Cuộc trò chuyện không tồn tại hoặc mình không phải người tham gia (đọc, gửi, đánh dấu đã đọc) | Không lộ sự tồn tại | 404 `CONVERSATION_NOT_FOUND` | Không tìm thấy cuộc trò chuyện. |
| `content` | Sau trim 1–2.000 ký tự | 400 `VALIDATION_ERROR` | Tin nhắn từ 1 đến 2.000 ký tự. |
| Nội dung Markdown | HTML thô, link nguy hiểm, NUL, ảnh | 400 `MESSAGE_CONTENT_INVALID` | Tin nhắn chứa định dạng không được hỗ trợ. |
| `clientId` | Bắt buộc, UUID do giao diện sinh cho mỗi tin | 400 `VALIDATION_ERROR` | — |
| Gửi lại cùng `clientId` (bấm hai lần, gửi lại do mạng; kể cả hai request song song) | Sau khi qua kiểm quyền và người tham gia, tra `(người gửi, clientId)` **trước** khi xét chặn/khóa và nhịp gửi. Đã có, cùng cuộc trò chuyện và cùng nội dung sau trim: trả lại tin đã lưu (kể cả khi cuộc trò chuyện vừa bị chặn/khóa hoặc đang quá nhịp), không tạo tin mới. Đã có nhưng khác cuộc trò chuyện hoặc khác nội dung: từ chối, không trả tin cũ. Lưu bằng `INSERT … ON CONFLICT DO NOTHING` rồi đọc lại, để request thua khi tranh nhau không làm hỏng transaction | 200 / 409 `MESSAGE_CLIENT_ID_CONFLICT` | — / Yêu cầu trùng. Hãy gửi lại. |
| Gửi tin mới thành công | — | 201 | — |
| Gửi khi cuộc trò chuyện bị chặn (bởi bên nào cũng vậy) | Không lưu tin | 409 `CONVERSATION_BLOCKED` | Cuộc trò chuyện đã bị chặn. |
| Gửi khi cuộc trò chuyện bị Moderator khóa | Không lưu tin | 409 `CONVERSATION_LOCKED` | Cuộc trò chuyện đã bị khóa bởi kiểm duyệt. |
| Người học gửi tin thứ 4 khi tác giả chưa từng trả lời (kể cả hai request song song: đếm dưới khóa cuộc trò chuyện) | Không lưu tin; gửi lại cùng `clientId` của tin đã lưu vẫn trả tin cũ | 409 `CONVERSATION_AWAITING_REPLY` | Hãy chờ tác giả trả lời trước khi gửi thêm. |
| Hai bên gửi cùng lúc | Khóa dòng cuộc trò chuyện; cả hai tin được lưu, `seq` khác nhau, tin cuối là tin có `seq` lớn hơn | 201 | — |
| `seq` khi đánh dấu đã đọc | Bắt buộc, số nguyên 0 tới giới hạn số nguyên 64 bit; sai → 400. Hợp lệ → 200: không làm lùi mốc, lớn hơn tin cuối thì lấy tin cuối, hai request song song giữ mốc lớn hơn | 400 `VALIDATION_ERROR` / 200 | — |
| `beforeSeq`, `afterSeq`, `size`, `page` | Số nguyên ≥ 0 trong giới hạn 64 bit; không gửi cả `beforeSeq` lẫn `afterSeq`; `size` 1–50; `page ≥ 0` | 400 `VALIDATION_ERROR` | — |
| Gửi quá nhanh | Mỗi người tối đa 20 tin/phút và 5 lần mở cuộc trò chuyện/phút | 429 `MESSAGE_RATE_LIMITED` | Bạn gửi quá nhanh, hãy thử lại sau. |
| Redis lỗi khi kiểm nhịp | Không cho qua | 503 `MESSAGE_STORAGE_UNAVAILABLE` | Dịch vụ đang gián đoạn. Hãy thử lại. |
| Người kia bị khóa tài khoản | Vẫn gửi được; họ đọc khi được mở khóa | 201 | — |

### Kế hoạch thực thi

- **File cần đụng:** migration; entity `Conversation`, `Message`; `ConversationController`, `ConversationService` (luật thuần public static: người tham gia, `unread`, `canSend`, `remainingBeforeReply`, mốc đọc, đoạn trích; kiểm nội dung và nhịp viết trong service theo luật “Ít class”), repository; `ConversationRequest`/`ConversationResponse`; `SecurityConfiguration`; `ErrorCode`.
- **Phần dùng lại:** `lockActiveUser`; `CourseSpecification.visibleCourse()` để tìm khóa; `CourseEnrollmentRepository.findActive` cho `contextEnrolled`; kiểm Markdown như `ForumService.checkContent`; mẫu đếm Redis như `ForumService.rateLimit` cho nhịp phút; `ArticleAuthorResponse` cho người kia; mẫu `INSERT … ON CONFLICT` như `ForumPostReactionRepository.upsert`.
- **Bẫy đã biết:** mọi truy vấn đọc tin kèm điều kiện người tham gia hoặc kiểm trước khi đọc — không có đường đọc tin chỉ bằng `id`; API mở không đi qua đường đọc bài học (đường đó tự enroll khóa miễn phí); `seq` có thể có khoảng trống, chỉ so lớn nhỏ; `last_message_*`, `author_replied` cập nhật cùng transaction với lưu tin; đếm 3 tin chờ trả lời dưới khóa dòng cuộc trò chuyện; tra `clientId` trước giới hạn 3 tin; không đưa `content` vào log; `unread-count` là một câu đếm; tác giả bị đình chỉ vẫn là tác giả của cuộc đã mở.

### Xong khi

- [ ] `MessagingMigrationTest` (Flyway thuần): hai bảng, UNIQUE cặp và `(sender_id, client_id)`, CHECK hai người khác nhau, `context_course_id` về NULL khi xóa khóa, các index; báo cáo `CONVERSATION` ghi được, loại cũ vẫn ghi được, đích không tồn tại bị trigger từ chối.
- [ ] `ConversationRulesTest` (unit, gọi thẳng hàm tĩnh và hàm kiểm của service): ma trận role × người tham gia ra 403/404 theo “Hợp đồng mã quyền”; `canSend` theo chặn/khóa/chờ trả lời; `remainingBeforeReply` (0–3, `null` cho tác giả hoặc sau khi tác giả trả lời); dựng `contextCourse` khi khóa đã xóa (`id = null`, `available = false`, `contextEnrolled = null`, giữ tên) và khi khóa bị ẩn; `unread`; mốc đọc không lùi; đoạn trích; ba kiểu phân trang và `hasMore`; idempotency theo `clientId`; nội dung hợp lệ/không; nhịp phút với Redis giả (như `ForumPostRulesTest.limiter`), Redis lỗi → 503.
- [ ] `ConversationControllerTest` (`@WebMvcTest`): validation từng trường theo biên, 401, mapping mã lỗi (gồm `CONVERSATION_AWAITING_REPLY`), gửi cả `beforeSeq` lẫn `afterSeq`.
- [ ] `ConversationIntegrationTest` (DB/security thật, gộp theo luồng): (1) người **chưa mua** mở từ khóa công khai, mở lại từ khóa khác của cùng tác giả trả cuộc cũ với `contextCourse` mới và `contextEnrolled` đúng; khóa ngữ cảnh bị ẩn sau đó → `available = false`; mở từ khóa ẩn/của mình → 403; (2) người học gửi 3 tin, tin thứ 4 → 409, tác giả trả lời → người học gửi tiếp được; nhắn qua lại, lấy hơn một trang tin mới bằng `afterSeq`, đánh dấu đã đọc, `unread-count` đúng từng bên; (3) **riêng tư: người thứ ba gọi mọi API với `id` thật → 404 và không thấy cuộc đó; ADMIN, MODERATOR, đa vai, tài khoản bị khóa → 403; không phản hồi lỗi nào chứa nội dung**; (4) đồng thời: hai request mở cùng cặp một dòng; gửi lại cùng `clientId` một tin, khác nội dung → 409; hai bên gửi song song đủ hai tin; hai tin thứ 3 và thứ 4 song song chỉ một được lưu.
- [ ] Chạy các lớp trên (cần Docker); full backend do CI.

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

- **File cần đụng:** `ConversationService` (chặn, đọc và khóa của Moderator); `ReportRequest` (pattern `targetType` thêm `CONVERSATION`, `action` thêm `LOCK_CONVERSATION`), `ReportService` (rẽ nhánh theo loại đích ở tạo, hàng đợi, xử lý thay cho `FORUM_POST` gắn cứng), `ReportResponse.Item` (thêm `conversation` — hai người tham gia, chặn/khóa — bên cạnh `post`; mục nào chỉ có một trong hai), `ReportRepository`; `ModeratorConversationController`; `SecurityConfiguration`; `ErrorCode`.
- **Phần dùng lại:** toàn bộ luồng báo cáo, xử lý, đồng thời và giới hạn nhịp của `forum-reports`; cách kiểm role MODERATOR; phân trang tin nhắn của 1a.
- **Bẫy đã biết:** test hồi quy báo cáo diễn đàn phải vẫn đạt; điều kiện “đã có báo cáo” kiểm trong cùng truy vấn với việc đọc tin (không kiểm ở giao diện); hàng đợi **không** trả nội dung tin nhắn — Moderator phải gọi API đọc riêng, để mọi lần đọc đều qua một cổng kiểm; thứ tự khóa: cuộc trò chuyện trước, báo cáo sau; `HIDE_CONTENT` gửi cho đích `CONVERSATION` phải bị từ chối chứ không lặng lẽ bỏ qua.

### Xong khi

- [ ] `ConversationRulesTest` thêm ma trận chặn/bỏ chặn (ai chặn, ai gọi) và hành động hợp lệ theo loại đích.
- [ ] `ModeratorConversationControllerTest` (`@WebMvcTest`) và test `@WebMvcTest` của báo cáo bị sửa: validation (`action` sai loại đích, `note` theo hành động), 401/403, mapping mã lỗi.
- [ ] `ConversationModerationIntegrationTest` (DB/security thật, gộp theo luồng): (1) chặn → cả hai không gửi được, bên kia không bỏ chặn được, người chặn bỏ chặn → gửi lại được; gửi lại tin cũ cùng `clientId` sau khi bị chặn vẫn trả tin đã lưu; (2) người tham gia báo cáo, người ngoài báo cáo → 404, báo cáo lần hai → 409, cuộc chưa có tin của bên kia → `REPORT_TARGET_EMPTY`; (3) **riêng tư: Moderator đọc cuộc trò chuyện chưa bị báo cáo bằng `id` thật → 404, sau khi có báo cáo → đọc được; ADMIN đơn vai → 403; hàng đợi và danh sách cuộc đang khóa không chứa nội dung, đoạn trích hay tin cuối**; (4) `LOCK_CONVERSATION` khóa và đóng mọi báo cáo `OPEN`, hai bên không gửi được, báo cáo mới bị từ chối, cuộc hiện trong danh sách đang khóa, mở khóa → gửi lại được; hai Moderator xử lý song song một thành công.
- [ ] Chạy các lớp trên + `ConversationIntegrationTest` + `ReportIntegrationTest`, `ReportControllerTest`, `ForumPostRulesTest` của `forum-reports`; full backend do CI.

## Task 1c — Đẩy sự kiện qua WebSocket

**Giai đoạn:** Backend · **Đổi giao diện:** Không · Bỏ được nếu thiếu thời gian (giao diện vẫn chạy bằng tự làm mới).

### Phạm vi

- `POST /api/v1/conversations/socket-ticket` (cùng hợp đồng quyền của API người dùng) → `{ticket, expiresAt}`: vé là 32 byte ngẫu nhiên (`SecureRandom`, base64url), dùng một lần, sống 30 giây, lưu Redis kèm người dùng, `sid` (phiên) và `exp` của access token đã dùng để xin vé. Lý do: `WebSocket` của trình duyệt không gửi được header `Authorization`, và không đặt JWT vào URL.
- `GET /ws/messaging?ticket=…` (nâng cấp WebSocket): kiểm `Origin` bằng `webUrl` **trước**, rồi tiêu thụ vé bằng một thao tác Redis nguyên tử (`GETDEL`), rồi kiểm phiên `sid` còn hiệu lực, tài khoản còn hoạt động và không phải ADMIN/MODERATOR; sai thì từ chối trước khi nâng cấp. `Origin` chỉ chặn trang web lạ, không thay xác thực — vé mới là xác thực. Mỗi người tối đa 5 kết nối (nhiều tab), quá thì đóng kết nối cũ nhất.
- **Vòng đời quyền:** từ chối nâng cấp nếu `exp` của access token đã xin vé đã qua (vé còn TTL vẫn bị từ chối); kết nối tự đóng khi tới `exp` (≤ 15 phút), giao diện xin vé mới; trước mỗi lần đẩy, server kiểm lại `exp` chưa qua (kể cả khi tác vụ đóng chạy trễ), phiên `sid` còn hiệu lực và tài khoản còn hoạt động, không phải ADMIN/MODERATOR — sai thì không gửi và đóng kết nối. Như vậy đăng xuất, đăng xuất mọi phiên, khóa tài khoản hay đổi role đều cắt sự kiện ngay ở lần đẩy kế tiếp, không dựa vào giao diện. Vé xin trước khi phiên bị thu hồi sẽ bị từ chối ở bước kiểm phiên.
- **Vé trong URL:** server không bật access log ghi query string cho `/ws/messaging`; giới hạn triển khai: proxy phía trước (nếu có) phải không ghi query của đường này — ghi vào `docs/RUNBOOK.md` khi triển khai. Vé sống 30 giây và dùng một lần nên lộ sau khi dùng không còn giá trị.
- Server giữ kết nối theo người dùng (bộ nhớ, một server) và tự chọn người nhận: chỉ hai người tham gia của cuộc trò chuyện. Trình duyệt **không** đăng ký kênh theo cuộc trò chuyện, nên không có đường nào nghe trộm cuộc của người khác. Tin trình duyệt gửi lên bị bỏ qua.
- Sự kiện là **tín hiệu để đọc lại REST**, không mang trạng thái để tin trực tiếp (nên đảo thứ tự không gây sai): JSON không có nội dung, đoạn trích, tên khóa hay số đếm, gửi **sau khi transaction commit** (giao dịch rollback không phát): `{"type":"message","conversationId","seq"}` cho cả hai bên khi có tin mới; `{"type":"unread"}` cho người có số chưa đọc vừa đổi (tin mới, đánh dấu đã đọc); `{"type":"state","conversationId"}` cho cả hai bên khi chặn/bỏ chặn/khóa/mở khóa và khi mở lại đổi khóa ngữ cảnh.
- Gửi tới một phiên thất bại → đóng phiên đó; giao diện tự kết nối lại và lấy bù bằng `afterSeq` + `unread-count`. Mất sự kiện (rớt mạng, server khởi động lại) không mất tin vì cùng cơ chế lấy bù.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| Xin vé: thiếu/sai token; tài khoản bị khóa hoặc ADMIN/MODERATOR | Như hợp đồng quyền chung | 401 / 403 `ACCESS_DENIED` | — (giao diện chuyển sang tự làm mới) |
| Xin vé quá nhanh | 10 vé/phút mỗi người | 429 `MESSAGE_RATE_LIMITED` | — |
| Redis lỗi khi cấp hoặc kiểm vé | Không cho qua | 503 `MESSAGE_STORAGE_UNAVAILABLE` / từ chối nâng cấp | — |
| Nâng cấp thiếu vé, vé sai, hết hạn hoặc đã dùng (kể cả hai kết nối song song cùng vé: một thành công) | Từ chối trước khi nâng cấp | 401 | — |
| Nâng cấp khi phiên `sid` đã bị thu hồi/hết hạn, hoặc `exp` của access token đã qua | Từ chối trước khi nâng cấp | 401 | — |
| Nâng cấp khi chủ vé đã bị khóa hoặc mang role ADMIN/MODERATOR | Từ chối trước khi nâng cấp | 403 | — |
| `Origin` khác `webUrl` | Kiểm trước khi tiêu thụ vé: vé vẫn còn dùng được | 403 | — |

### Kế hoạch thực thi

- **File cần đụng:** `server/build.gradle` (`spring-boot-starter-websocket`); `MessageSocketConfiguration` (đăng ký `/ws/messaging`, interceptor kiểm vé và `Origin`); `MessageSocketHandler` (giữ phiên theo người dùng, gửi sự kiện); `ConversationService` (cấp vé, phát sự kiện sau commit); `ConversationController` (vé); `SecurityConfiguration` (`/ws/messaging` `permitAll` vì đã kiểm vé); `ErrorCode` nếu cần; `docs/RUNBOOK.md` (giới hạn proxy).
- **Phần dùng lại:** mẫu Redis của `ForumService.rateLimit`; `webUrl` của cấu hình OAuth2/CORS; kiểm phiên như `JwtTokenService.isTokenActive` (phiên `sid` còn và chưa hết hạn); hợp đồng quyền của 1a.
- **Bẫy đã biết:** gửi trước commit thì trình duyệt gọi `afterSeq` không thấy tin → dùng `TransactionSynchronization.afterCommit`; gửi trên một phiên từ nhiều luồng không an toàn → bọc `ConcurrentWebSocketSessionDecorator`; chuỗi bộ lọc JWT sẽ trả 401 cho bắt tay không có header → mở đường riêng và tự kiểm vé; CORS không áp cho WebSocket → tự kiểm `Origin`; không ghi vé, query của bắt tay hay sự kiện vào log, kể cả log lỗi khi từ chối bắt tay (`GlobalExceptionHandler` chỉ dùng `getRequestURI()`, không có query — giữ nguyên); phiên chết phải được gỡ khỏi bảng phiên.

### Xong khi

- [ ] `ConversationRulesTest` thêm: chọn người nhận sự kiện (đúng hai người tham gia), payload sự kiện không có trường nội dung/đoạn trích/tên khóa/số đếm.
- [ ] `ConversationControllerTest` thêm: vé 401/403/429.
- [ ] `MessageSocketIntegrationTest` (`@SpringBootTest` cổng ngẫu nhiên, client WebSocket thật; một lớp vì tạo context riêng; 5 ca): (1) vé: hợp lệ kết nối được; dùng lại/hết hạn/không có → từ chối; hai bắt tay song song cùng vé chỉ một thành công; `Origin` lạ → từ chối và vé vẫn dùng được với `Origin` đúng; (2) A gửi tin → B nhận `message` đúng `seq`, không có nội dung; người thứ ba đang kết nối không nhận gì; (3) chỉ phát sau commit: gọi thao tác ghi trong một transaction của test rồi ép rollback sau khi sự kiện đã được đăng ký → không có sự kiện; cùng thao tác commit → có sự kiện; chặn → cả hai nhận `state`; đánh dấu đã đọc → nhận `unread`; (4) sau khi kết nối, khóa tài khoản B hoặc xóa phiên của B → sự kiện kế tiếp không tới B và kết nối bị đóng; vé xin trước khi xóa phiên bị từ chối; (5) kết nối đóng khi tới `exp`, không có sự kiện nào được đẩy sau `exp`, vé còn TTL nhưng access token đã hết hạn bị từ chối (đồng hồ giả hoặc `exp` ngắn trong test).
- [ ] Chạy các lớp trên + `ConversationIntegrationTest`; full backend do CI.

## Cổng wireframe

Sau khi 1a–1c xong và đã review (hoặc sau 1b nếu người dùng đã quyết bỏ 1c, ghi log): Claude viết `plans/messaging.wireframe.md` (bố cục chữ cho các màn của 2a, 2b ở desktop và mobile 390px, trạng thái tải/rỗng/lỗi/bị chặn/bị khóa). Người dùng duyệt rồi mới code giao diện.

## Task 2a — Giao diện nhắn tin

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- `/messages` (đăng nhập; bọc `AuthRoute` và `ReaderRoute`): danh sách cuộc trò chuyện (ảnh, tên, đoạn trích, thời điểm, dấu chưa đọc); desktop hai cột (danh sách + cuộc đang mở), mobile mỗi lúc một màn. `/messages/:id`: lịch sử tin (Markdown, khối code), nút “Tải tin cũ hơn”, ô nhập (đếm ký tự, Enter gửi, Shift+Enter xuống dòng), menu Chặn/Bỏ chặn và Báo cáo (hộp thoại lý do + mô tả như diễn đàn).
- Thời gian thực: tài khoản người đọc đã đăng nhập xin vé rồi mở một WebSocket dùng chung cho thanh bên và trang tin nhắn. Sự kiện chỉ là tín hiệu đọc lại: `message` → gọi `afterSeq` nếu là cuộc đang mở, tải lại chi tiết cuộc đó (`canSend`, `remainingBeforeReply`) và danh sách; `unread` → gọi `unread-count`; `state` → tải lại chi tiết và danh sách. Rớt kết nối hoặc kết nối tới `exp` thì kết nối lại với thời gian chờ tăng dần (1 → 30 giây, xin vé mới), xong thì gọi `afterSeq`, `unread-count`, tải lại chi tiết cuộc đang mở và danh sách (sự kiện có thể đã mất trong lúc rớt). Nhiều lần đọc REST chồng nhau: chỉ áp kết quả của lần gọi mới nhất (như `latestRequest` của `ModeratorReportsPage`). **Khi không có kết nối** (đang kết nối lại, hoặc xin vé/kết nối lỗi): tự làm mới cuộc đang mở 5 giây, danh sách và số chưa đọc 30 giây; tab ẩn thì dừng. Nếu người dùng đã quyết bỏ 1c (biết trước khi làm 2a), 2a không làm phần WebSocket và không gọi endpoint vé — chỉ có nhánh tự làm mới này. Tin mình gửi hiện ngay ở trạng thái “đang gửi”, lỗi thì hiện “Gửi lại” (dùng lại đúng `clientId`).
- Mở cuộc trò chuyện: đánh dấu đã đọc tới tin mới nhất đã tải; tin mới đến khi đang xem cũng được đánh dấu. Khi tự làm mới, gọi `afterSeq` lặp tới khi `hasMore = false` rồi mới nâng mốc; chỉ gửi mốc là `seq` lớn nhất của đoạn tin đã tải liền mạch (tin mình vừa gửi có `seq` cao hơn không được dùng để nhảy qua tin chưa tải).
- Hộp thoại báo cáo ghi rõ: “Khi bạn báo cáo, kiểm duyệt viên sẽ xem được toàn bộ tin nhắn trong cuộc trò chuyện này.”
- Thanh bên người dùng: mục “Tin nhắn” kèm số cuộc trò chuyện chưa đọc (theo sự kiện `unread`, hoặc tự làm mới 30 giây khi không có kết nối); chỉ hiện với tài khoản người đọc đã đăng nhập.
- Đầu cuộc trò chuyện: “Hỏi về: <tên khóa>” (liên kết tới trang khóa chỉ khi `available`) và nhãn “Đã đăng ký”/“Chưa đăng ký” theo `contextEnrolled` (không hiện nhãn khi `null`). Khi `remainingBeforeReply` không `null`: người học thấy “Bạn có thể gửi thêm {n} tin trước khi tác giả trả lời.”; về 0 thì ẩn ô nhập và hiện “Hãy chờ tác giả trả lời trước khi gửi thêm.”
- Trang giới thiệu khóa: nút “Nhắn tác giả” hiện khi `course.viewer.canStart` là true và `course.author.id` khác người đang đăng nhập — **kể cả người chưa mua**; chủ khóa và Admin/Moderator không thấy (`canStart = false`). Khách bấm thì chuyển tới đăng nhập (`returnTo` là trang khóa); đã đăng nhập thì mở hoặc tiếp tục cuộc trò chuyện rồi chuyển tới `/messages/:id`.
- Bị chặn hoặc bị khóa: ẩn ô nhập, hiện thông báo trạng thái; người chặn thấy nút “Bỏ chặn”.

### Kế hoạch thực thi

- **File cần đụng:** `pages/Messages/**`, `messagingService.ts` (REST + kết nối WebSocket dùng `WebSocket` có sẵn của trình duyệt, không thêm thư viện), `types/messaging.ts`, `messagingI18n.ts`, `CourseOverviewPage.tsx`, `App.tsx`, `navigation.ts`, `Sidebar.tsx`, `Sidebar.test.tsx`.
- **Phần dùng lại:** `MarkdownContent`; `UserAvatar`; `EmptyState`; `Textarea`, `Button`, `Dialog`, `AlertDialog`; hộp thoại báo cáo của diễn đàn (cùng lý do và quy tắc mô tả); cách dừng/tiếp tục theo `document.visibilityState`; `returnTo`.
- **Bẫy đã biết:** một kết nối WebSocket cho cả app, đóng khi đăng xuất; không tin nội dung từ socket (socket không có nội dung); hủy hẹn giờ làm mới khi rời trang hoặc đổi cuộc trò chuyện; lần làm mới trước chưa xong thì không gọi lần mới; gộp tin theo `seq` để không hiện trùng tin vừa gửi với tin lấy về; chỉ tự cuộn xuống khi người dùng đang ở cuối; test dùng đồng hồ giả, không chờ thật; chuỗi dài trong test dùng `user.paste`; vùng chạm 44px; không assert class Tailwind.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Menu / tiêu đề | Tin nhắn | Messages |
| Vai | Tác giả / Người học | Author / Learner |
| Nhập | Nhập tin nhắn… / Gửi / Đang gửi… / Gửi lại | Type a message… / Send / Sending… / Resend |
| Lịch sử | Tải tin cũ hơn / Chưa có tin nhắn. Hãy gửi lời chào. | Load older messages / No messages yet. Say hello. |
| Khóa học | Nhắn tác giả / Hỏi về: {title} / Đã đăng ký / Chưa đăng ký | Message the author / About: {title} / Enrolled / Not enrolled |
| Chờ trả lời | Bạn có thể gửi thêm {n} tin trước khi tác giả trả lời. / Hãy chờ tác giả trả lời trước khi gửi thêm. | You can send {n} more messages before the author replies. / Please wait for the author to reply before sending more. |
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
- [ ] `Messages/*.test.tsx` (luồng chính, `WebSocket` giả): danh sách và dấu chưa đọc; mở cuộc → đánh dấu đã đọc; gửi tin, lỗi → “Gửi lại” cùng `clientId`; sự kiện `message` → gọi `afterSeq` và tải lại chi tiết (tác giả trả lời → ô nhập của người học mở lại); `state` khi đổi ngữ cảnh → “Hỏi về” đổi; mất kết nối → kết nối lại và lấy bù; xin vé lỗi → chạy bằng tự làm mới 5/30 giây (đồng hồ giả); mất sự kiện `state` rồi kết nối lại → chi tiết và danh sách được tải lại; hai lần tải chi tiết chồng nhau trả về đảo thứ tự → giữ kết quả của lần gọi sau; “Hỏi về” và còn {n} tin / hết lượt chờ trả lời; tải tin cũ hơn; chặn/bỏ chặn; báo cáo; bị khóa.
- [ ] `CourseOverviewPage.test.tsx`: nút hiện với người chưa mua và người đang học, không hiện với chủ khóa; khách bấm → đăng nhập kèm `returnTo`; đã đăng nhập bấm → chuyển tới cuộc trò chuyện. Test `Sidebar` (số chưa đọc, không hiện với khách), `App` bị sửa (ADMIN/MODERATOR vào `/messages` bị chuyển về dashboard) + `npm run build` trong `app/`.
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

- Bảy câu hỏi mở giữ mặc định (hai điểm “chỉ người đang học mở được” và “tự làm mới 5 giây và 30 giây” đã thay ngày 2026-11-22, xem dòng cuối): một cuộc trò chuyện cho mỗi cặp người học – tác giả; chỉ người đang học mở được, sau đó nhắn tiếp được; chặn hai chiều, chỉ người chặn bỏ chặn; Moderator đọc và khóa được cuộc đã từng bị báo cáo; không sửa/xóa tin, 2.000 ký tự, 20 tin/phút; tự làm mới 5 giây và 30 giây; Admin/Moderator không dùng, `/messages` “Tin nhắn”.
- Làm cuối cùng, cắt đầu tiên nếu thiếu thời gian; chỉ bắt đầu khi `forum-reports` xong cả backend lẫn giao diện báo cáo.
- Phần Claude sửa thân spec sau vòng 1 chưa qua Codex soát vòng 2.
- **2026-11-22 — người dùng đổi hai điểm (log `messaging.log.md`):** (1) nhắn cả khi chưa mua: mở từ khóa công khai, giới hạn 3 tin trước khi tác giả trả lời (giới hạn 10 cuộc mới/ngày đã bỏ cùng ngày), “Hỏi về: <khóa>” + đã/chưa đăng ký, khách bấm → đăng nhập, không có nút tắt nhận tin; (2) REST + WebSocket đẩy sự kiện thay cho chỉ tự làm mới (Task 1c mới). Codex phản biện 2 vòng (vòng 1: 9 điểm, vòng 2: 7 điểm; kết luận chính: giới hạn ngày bỏ, vé gắn `sid`+`exp` và kiểm trước mỗi lần đẩy, sự kiện chỉ là tín hiệu, `contextCourse.available`, cổng wireframe sau 1c); lịch sử ở `messaging.review.md`.
- **Người dùng chốt spec 2026-11-22** (Task 1a, 1b, 1c, cổng wireframe, 2a, 2b). Điểm yếu đã biết: spec ~52 KB vượt mục tiêu; socket trong bộ nhớ chỉ một server; giới hạn proxy chưa có hạ tầng để kiểm.
