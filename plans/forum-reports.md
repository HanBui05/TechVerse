# Forum & reports — diễn đàn hỏi–đáp và báo cáo vi phạm

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Claude viết (D-030); Codex chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Mọi tài khoản đã đăng nhập đặt câu hỏi theo chủ đề và trả lời bằng Markdown, hiện ngay không qua duyệt; người hỏi đánh dấu một câu trả lời là lời giải; khách chỉ đọc. Người dùng báo cáo bài vi phạm; Moderator xử lý hàng đợi báo cáo (ẩn nội dung hoặc bỏ qua kèm ghi chú) và ẩn/hiện trực tiếp bài bất kỳ. Người đăng nhập bày tỏ cảm xúc (👍 ❤️ 😂 😡) trên bài hỏi và câu trả lời; mọi người xem được số đếm và ai đã react (Task 1c, người dùng chốt 2026-11-21).
**Làn:** Đầy đủ · **Rủi ro:** thường. Review vòng 1 dùng `review`.
**Thứ tự:** 1a → 1b → 1c (Backend) → cổng wireframe → 2a → 2b (Giao diện). Chỉ mở Giao diện sau khi toàn bộ Backend xong và đã review.
**Nguồn quyết định:** câu F1–F11 trong [`roadmap.questions.md`](roadmap.questions.md) (người dùng trả lời 2026-11-14), tất cả chọn A: hỏi–đáp + báo cáo (bình luận dưới bài làm sau); đăng nhập mới đăng, khách đọc; không duyệt trước; gắn chủ đề + tìm từ khóa; người hỏi đánh dấu “đã giải quyết”; Markdown có khối code, chưa cho ảnh; sửa được, xóa bài đã có trả lời thì hiện “đã xóa”; Moderator có hàng đợi báo cáo và ẩn/hiện trực tiếp; Admin không thêm gì; không AI; Admin/Moderator được đăng và trả lời.

## Hiện trạng đã đối chiếu (2026-11-15)

- V1 có `forum_posts` (`user_id`, `parent_id` tự tham chiếu `ON DELETE RESTRICT`, `title` chỉ có ở bài hỏi, `content`, `status` VISIBLE/HIDDEN/DELETED; CHECK bài hỏi có tiêu đề, câu trả lời không; trigger chỉ cho trả lời trực tiếp bài gốc, một cấp) — `V1__initial_schema.sql:522`–`540`, `:954`–`974`. **Chưa có** cột chủ đề, lời giải, ghi chú kiểm duyệt.
- V1 có `reports` (`reporter_id`, `target_type` gồm `FORUM_POST`, `target_id` không có khóa ngoại, `reason` SPAM/INAPPROPRIATE/COPYRIGHT/MISLEADING/OTHER, `description`, `status` OPEN/ACTIONED/DISMISSED, `handled_by/at`, `resolution_note`, UNIQUE `(reporter_id, target_type, target_id)`); trigger chỉ kiểm đích tồn tại lúc tạo (`:560`–`579`, `:1013`–`1038`). Index sẵn: `forum_posts(parent_id, created_at)`, `reports(status, created_at)`.
- Chưa có entity, API hay trang nào cho diễn đàn và báo cáo. Migration mới nhất trong repo là V12.
- Frontend: `navItems` của sidebar người dùng có Trang chủ/Bài viết/Khóa học (`app/src/data/navigation.ts:4`–`8`); tài khoản ADMIN/MODERATOR dùng `AdminSidebar`/`ModeratorSidebar` và bị `ReaderRoute` đẩy khỏi trang người đọc (`app/src/App.tsx:54`–`61`), nên diễn đàn phải có lối vào riêng trong hai sidebar quản trị.
- `lockActiveUser` khóa dòng người dùng và từ chối tài khoản không hoạt động bằng `ACCESS_DENIED` (`ArticleAccessService.java:51`–`56`).

## Đường dẫn thuộc module

- `server/src/main/resources/db/migration/V<n>__forum_reports.sql` (tạo; `<n>` là số kế tiếp lúc code) và migration react riêng của Task 1c.
- `server/src/main/java/com/techverse/server/{controller,entity,enums,dto,repository,service}/**/*{Forum,Report}*.java` (tạo; mọi lớp mới mang `Forum` hoặc `Report` trong tên); `configuration/SecurityConfiguration.java`, `exception/ErrorCode.java`.
- `server/src/test/java/com/techverse/server/{forum,report}/**` (tạo). Validator và bộ kiểm nội dung nằm trong các lớp mang tên `Forum`/`Report` ở những gói trên, không tạo gói mới. Test hiện có của module khác chỉ chạy lại khi bị ảnh hưởng, không sửa.
- `plans/forum-reports.wireframe.md` (tạo ở cổng wireframe).
- `app/src/pages/{Forum,Moderator/Reports}/**` và test (tạo); `app/src/{types/forum.ts,services/forumService.ts,data/forumI18n.ts}` và test (tạo).
- `app/src/{App.tsx,App.*.test.tsx}`, `app/src/data/{navigation,managementI18n}.ts`, `app/src/components/layout/{Sidebar,ModeratorSidebar,AdminSidebar}.tsx` và test trực tiếp.

## Ngoài phạm vi

- Bình luận dưới bài viết/khóa học; báo cáo bài viết, khóa học, bình luận, tài liệu (API báo cáo nhận `targetType` để mở rộng sau, hiện chỉ chấp nhận `FORUM_POST`).
- Bình chọn lên/xuống (thay bằng react của Task 1c), loại react ngoài bốn loại của 1c, thẻ, ghim bài, khóa bài, cấm đăng theo thời hạn, theo dõi bài, thông báo (kể cả báo cho người đăng khi bài bị ẩn), nhắc tên, trả lời nhiều cấp.
- Ảnh và tệp đính kèm; AI; lịch sử chỉnh sửa; thống kê báo cáo theo người dùng; số liệu dashboard.
- Tìm kiếm toàn văn có chỉ mục (dùng so khớp chuỗi đơn giản).

## Ràng buộc chung

- Được đổi API: Có. Được đổi DB: Có, chỉ bằng migration mới (1a/1b một migration, 1c một migration riêng); không sửa migration đã có. Giữ `ApiResponse`/`ErrorResponse`. Giữ nguyên hành vi hiện tại của các module khác: Có.
- Vai trò: Guest đọc danh sách và chi tiết. Mọi tài khoản đã đăng nhập, đang hoạt động (kể cả ADMIN/MODERATOR) được hỏi, trả lời, báo cáo. Tài khoản bị khóa: mọi API ghi và API cần đăng nhập trả 403 `ACCESS_DENIED`; bài cũ của họ vẫn hiện. Chỉ MODERATOR dùng API kiểm duyệt (ADMIN không kèm MODERATOR bị từ chối).
- Thiếu token → 401 `AUTH_ACCESS_TOKEN_REQUIRED`; token sai/hết hạn → 401 `AUTH_INVALID_ACCESS_TOKEN`.
- Bài hiện ngay khi đăng (`VISIBLE`). Trạng thái: `VISIBLE` → người đăng xóa → `DELETED` (xóa mềm, không khôi phục); `VISIBLE` ⇄ `HIDDEN` do Moderator. Không xóa cứng.
- Ai thấy gì: bài `HIDDEN` chỉ Moderator thấy (qua API kiểm duyệt); với mọi người khác, kể cả người đăng, nó như không tồn tại (404, không đếm, không sửa/xóa được). Câu trả lời `DELETED` biến mất. Bài hỏi `DELETED`: còn câu trả lời `VISIBLE` thì trang chi tiết vẫn mở, tiêu đề/nội dung/người đăng thay bằng trạng thái “đã xóa”, không nhận câu trả lời mới, không hiện trong danh sách; không còn câu trả lời nào thì 404.
- “Đã giải quyết” = bài hỏi có `accepted_answer_id` trỏ tới câu trả lời đang `VISIBLE`. Câu trả lời được chọn bị ẩn/xóa thì bài tự thành chưa giải quyết, không cần xóa con trỏ; được hiện lại thì giải quyết trở lại.
- Nội dung là Markdown, dùng cùng bộ kiểm của bài viết (cấm HTML thô, link nguy hiểm, NUL) và từ chối mọi node ảnh (trực tiếp lẫn dạng tham chiếu).
- Bài con theo bài cha: câu trả lời có bài hỏi đang `HIDDEN` thì với người thường cũng như không tồn tại (sửa, xóa, báo cáo, chọn lời giải đều 404), dù bản thân nó `VISIBLE`. Câu trả lời của bài hỏi `DELETED` còn hiển thị thì vẫn sửa, xóa, báo cáo được; không chọn lời giải được nữa. Báo cáo `OPEN` của câu trả lời vẫn nằm trong hàng đợi và Moderator vẫn xử lý được khi bài hỏi bị ẩn/xóa.
- **Thứ tự khóa cố định cho mọi đường ghi** (người dùng lẫn Moderator): người thao tác (`lockActiveUser`) → chủ đề (khi gắn/đổi chủ đề, kiểm lại còn hoạt động sau khi khóa) → bài hỏi → câu trả lời (nếu thao tác trên câu trả lời) → các báo cáo theo thứ tự `id`. Thao tác trên câu trả lời đọc `parent_id` không khóa, khóa bài hỏi trước rồi mới khóa câu trả lời và kiểm lại trạng thái sau khi khóa; không khóa thêm người dùng nào khác sau khi đã khóa bài. Kết quả của hai thao tác tranh nhau là kết quả của việc chạy lần lượt theo thứ tự lấy được khóa.
- Thứ tự xét lỗi khi nhiều điều kiện cùng sai: 401 → 400 (định dạng) → 403 tài khoản bị khóa/thiếu role → 404 không tồn tại hoặc không được thấy → 403 không phải chủ bài → 409 trạng thái → 429.
- Lỗi định dạng chung (ID trên đường dẫn không phải UUID, JSON hỏng, thiếu body, sai kiểu) trả 400 `VALIDATION_ERROR` theo xử lý chung hiện có; giao diện hiện câu dự phòng “Yêu cầu không hợp lệ. Hãy tải lại trang.” cho mọi dòng bảng lỗi có copy là “—”.
- Phân trang mặc định `page = 0`, `size = 20`; sắp xếp trùng thời điểm thì theo `id` để ổn định.

## Task 1a — Schema và API hỏi–đáp

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- Migration trên `forum_posts`: `topic_id` → topics (`ON DELETE RESTRICT`; CHECK bài hỏi bắt buộc có, câu trả lời NULL), `accepted_answer_id` → forum_posts (`ON DELETE SET NULL`; chỉ bài hỏi), `edited_at`, `hidden_by` → users, `hidden_at`, `moderation_note`; index `(topic_id, created_at DESC) WHERE parent_id IS NULL`, `(user_id, created_at DESC)`; index `reports(target_type, target_id)`; dừng nếu `forum_posts` hoặc `reports` đã có dữ liệu (không backfill, D-022).
- Công khai (`permitAll`): `GET /api/v1/forum/questions` (bài hỏi `VISIBLE`; lọc `topicId`, `keyword` so khớp không phân biệt hoa thường trên tiêu đề và nội dung, `solved=true|false`, `mine=true`; mới nhất trước; phân trang; mỗi mục: tiêu đề, đoạn trích 200 ký tự, chủ đề, người đăng (tên, ảnh), số câu trả lời `VISIBLE`, `solved`, `createdAt`, `editedAt`), `GET /api/v1/forum/questions/{id}` (bài hỏi + mọi câu trả lời `VISIBLE`: lời giải đứng đầu, còn lại cũ trước; mỗi bài có `viewer {canEdit, canDelete, canReport}`, bài hỏi thêm `viewer.canAccept`, `viewer.canAnswer`), `GET /api/v1/forum/options` (chủ đề đang hoạt động). `keyword` rỗng hoặc toàn khoảng trắng và `mine=false` nghĩa là không lọc; `topicId` lọc không tồn tại trả danh sách rỗng; bài thuộc chủ đề đã ngừng vẫn hiện kèm tên chủ đề. Tài khoản bị khóa đọc API công khai như Guest (`viewer.*` đều false). `canReport` là false với bài của mình và bài mình đã báo cáo (tính bằng một truy vấn gộp cho cả trang; trước khi có 1b thì chỉ xét “bài của mình”).
- Cần đăng nhập: `POST /api/v1/forum/questions {title, content, topicId}`, `PATCH /api/v1/forum/questions/{id}` (các trường trên), `DELETE …/{id}`; `POST /api/v1/forum/questions/{id}/answers {content}`, `PATCH /api/v1/forum/answers/{id} {content}`, `DELETE /api/v1/forum/answers/{id}`; `PUT /api/v1/forum/questions/{id}/accepted-answer {answerId}` (`null` để bỏ chọn).
- Chỉ người đăng sửa/xóa bài của mình, và chỉ khi bài `VISIBLE`; sửa đặt `edited_at`. Người hỏi được chọn bất kỳ câu trả lời `VISIBLE` nào của bài (kể cả của chính mình), đổi hoặc bỏ chọn bất kỳ lúc nào. PATCH: trường không gửi thì giữ nguyên, gửi `null` thì 400. (Việc đóng báo cáo khi người đăng xóa bài thuộc Task 1b.)
- Kiểm nội dung qua một lớp chuyển tiếp của module gọi bộ kiểm bài viết và đổi mọi lỗi của nó thành `FORUM_CONTENT_INVALID` (mẫu `LessonContentService`), cộng thêm bước từ chối node ảnh; không sửa `ArticleContentService`.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| `title` | Sau trim 10–150 ký tự | 400 `VALIDATION_ERROR` | Tiêu đề từ 10 đến 150 ký tự. |
| `content` bài hỏi | Sau trim 20–10.000 ký tự | 400 `VALIDATION_ERROR` | Nội dung từ 20 đến 10.000 ký tự. |
| `content` câu trả lời | Sau trim 10–10.000 ký tự | 400 `VALIDATION_ERROR` | Câu trả lời từ 10 đến 10.000 ký tự. |
| `topicId` | Thiếu, sai định dạng hoặc không tồn tại → 400; đã ngừng → 409 (khi tạo, hoặc khi sửa có đổi sang chủ đề đó; giữ nguyên chủ đề cũ đã ngừng thì vẫn sửa được) | 400 `VALIDATION_ERROR` / 409 `FORUM_TOPIC_INACTIVE` | Hãy chọn chủ đề. / Chủ đề đã ngừng hoạt động. |
| Nội dung Markdown | HTML thô, link nguy hiểm, NUL, ảnh | 400 `FORUM_CONTENT_INVALID` | Nội dung chứa định dạng không được hỗ trợ. |
| Ghi khi chưa đăng nhập; `mine=true` khi là Guest | — | 401 `AUTH_ACCESS_TOKEN_REQUIRED` | Đăng nhập để tiếp tục. |
| Tài khoản bị khóa | Mọi API ghi và `mine=true` | 403 `ACCESS_DENIED` | Bạn không có quyền. |
| Sửa/xóa bài của người khác; chọn lời giải khi không phải người hỏi | Kể cả ADMIN/MODERATOR | 403 `ACCESS_DENIED` | Bạn không có quyền. |
| Bài không tồn tại, đang `HIDDEN`, hoặc `DELETED` không còn hiển thị (mọi thao tác, kể cả của người đăng) | Không lộ lý do | 404 `FORUM_POST_NOT_FOUND` | Không tìm thấy bài viết. |
| Trả lời hoặc sửa bài hỏi đã `DELETED` nhưng còn hiển thị | — | 409 `FORUM_QUESTION_CLOSED` | Bài hỏi đã bị xóa, không thể trả lời. |
| Dùng endpoint bài hỏi cho câu trả lời hoặc ngược lại | — | 404 `FORUM_POST_NOT_FOUND` | Không tìm thấy bài viết. |
| `answerId` khi chọn lời giải | Trường bắt buộc có mặt: UUID để chọn, `null` có chủ ý để bỏ chọn; thiếu trường hoặc sai định dạng → 400; phải là câu trả lời `VISIBLE` của đúng bài hỏi | 400 `VALIDATION_ERROR` / 409 `FORUM_ANSWER_INVALID` | — / Câu trả lời không còn khả dụng. |
| Tạo câu trả lời khi bài hỏi đã có 200 câu trả lời `VISIBLE` | Đếm sau khi khóa bài hỏi: câu thứ 200 được tạo, câu thứ 201 bị từ chối, hai người tạo song song không vượt. Chỉ áp khi **tạo**; Moderator khôi phục câu trả lời đang ẩn không bị chặn (có thể vượt 200) | 409 `FORUM_ANSWER_LIMIT` | Bài hỏi đã đạt giới hạn câu trả lời. |
| Gửi trùng (bấm hai lần, gửi lại do mạng) | Cùng người và giống hệt một bài `VISIBLE` của họ tạo trong 60 giây gần nhất: bài hỏi so cả tiêu đề lẫn nội dung, câu trả lời so bài cha và nội dung; kiểm sau khi khóa dòng người dùng nên hai request song song chỉ một thành công | 409 `FORUM_DUPLICATE_POST` | Bạn vừa gửi nội dung này. |
| Xóa đồng thời với sửa / hai lần xóa | Khóa dòng bài; request sau thấy bài đã `DELETED` | 404 `FORUM_POST_NOT_FOUND` | Không tìm thấy bài viết. |
| Chọn lời giải đồng thời với việc câu trả lời bị xóa/ẩn | Cả hai bên khóa bài hỏi trước; chọn chạy **sau** thì 409, chọn chạy trước thì thành công rồi bài tự thành chưa giải quyết khi câu trả lời mất | 409 `FORUM_ANSWER_INVALID` | Câu trả lời không còn khả dụng. |
| Thao tác trên câu trả lời có bài hỏi đang `HIDDEN` | Như không tồn tại | 404 `FORUM_POST_NOT_FOUND` | Không tìm thấy bài viết. |
| Đăng quá nhanh | Mỗi người tối đa 3 bài hỏi/phút, 10 câu trả lời/phút | 429 `FORUM_RATE_LIMITED` | Bạn thao tác quá nhanh, hãy thử lại sau. |
| Redis lỗi khi kiểm nhịp | Không cho qua | 503 `FORUM_STORAGE_UNAVAILABLE` | Dịch vụ đang gián đoạn. Hãy thử lại. |
| Tham số lọc/phân trang sai | `page ≥ 0`, `size` 1–50, `keyword` sau trim 2–100 ký tự (rỗng = không lọc), `topicId` là UUID, `solved`/`mine` là boolean | 400 `VALIDATION_ERROR` | — |

### Kế hoạch thực thi

- **File cần đụng:** migration; entity `ForumPost`; `ForumContentService` (chuyển mã lỗi + chặn ảnh); `ForumRateLimiter`; enum trạng thái; `ForumController` (công khai + ghi), `ForumService`, repository; `ForumPostRules` (logic thuần: ai thấy gì, `solved`, `viewer.*`, điều kiện sửa/xóa/trả lời); `SecurityConfiguration` (GET `/api/v1/forum/**` là `permitAll`; POST/PATCH/PUT/DELETE `/api/v1/forum/**` authenticated); `ErrorCode`.
- **Phần dùng lại:** `lockActiveUser`; bộ kiểm Markdown của `ArticleContentService` + chặn ảnh như module bài tập/phỏng vấn; mẫu rate limit Redis theo miền; DTO người đăng (tên, ảnh) của bài viết công khai.
- **Bẫy đã biết:** trigger V1 chỉ cho câu trả lời trỏ thẳng bài gốc và CHECK tiêu đề — lỗi DB phải thành lỗi nghiệp vụ, không thành 500; `accepted_answer_id` và `parent_id` cùng tự tham chiếu nên map một chiều, tránh vòng khi serialize; `mine=true` với Guest trả 401 chứ không trả rỗng; đếm câu trả lời chỉ tính `VISIBLE`; `keyword` phải escape `%` và `_`; `permitAll` cho GET không được mở cả phương thức ghi.

### Xong khi

- [ ] `ForumReportsMigrationTest` (Flyway thuần): các cột mới, CHECK chủ đề theo loại bài, ba index, dừng khi bảng có dữ liệu.
- [ ] `ForumPostRulesTest` (unit): ma trận ai thấy gì theo trạng thái × vai trò × bài hỏi/câu trả lời; `solved`; `viewer.*`; bài hỏi `DELETED` còn/không còn câu trả lời.
- [ ] `ForumContentTest` (unit): Markdown hợp lệ qua; HTML thô, link nguy hiểm, NUL, ảnh trực tiếp và ảnh tham chiếu đều ra `FORUM_CONTENT_INVALID`.
- [ ] `ForumRateLimiterTest` (unit, Redis giả): trong ngưỡng, vượt ngưỡng → 429, Redis lỗi → 503.
- [ ] `ForumControllerTest` (`@WebMvcTest`): validation từng trường theo biên trong bảng (gồm ID đường dẫn sai, body thiếu, `answerId` thiếu so với `null`, PATCH gửi `null`), 401 thiếu token/token sai, mapping mã lỗi, tham số lọc sai.
- [ ] `ForumIntegrationTest` (DB/security thật, gộp theo luồng): (1) Guest đọc được và bị 401 khi ghi; (2) hỏi → trả lời → chọn → bỏ chọn, kèm lọc `solved`/`mine`/từ khóa; (3) quyền: bài người khác → 403, tài khoản bị khóa → 403, ADMIN/MODERATOR đăng được; (4) xóa bài hỏi có trả lời → trang còn mở, không nhận trả lời, xóa lời giải → chưa giải quyết; (5) đồng thời: hai request gửi trùng chỉ một thành công, hai người tạo câu thứ 200 và 201 song song không vượt giới hạn. Ma trận còn lại nằm ở unit.
- [ ] Chạy các lớp trên (cần Docker); full backend do CI chạy khi mở PR.

## Task 1b — Báo cáo vi phạm và kiểm duyệt

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- Người dùng: `POST /api/v1/reports {targetType, targetId, reason, description}` (đăng nhập). Chỉ nhận `targetType = FORUM_POST`; đích phải là bài người báo cáo đang thấy được (`VISIBLE`, và bài hỏi cha không `HIDDEN`) và không phải của chính họ. Mỗi người một báo cáo cho một bài. Tạo báo cáo khóa bài đích theo thứ tự khóa chung và kiểm lại trạng thái sau khi khóa rồi mới ghi, để không sinh báo cáo `OPEN` cho bài vừa bị xóa/ẩn.
- Người đăng xóa bài (API của 1a): task này bổ sung bước chuyển mọi báo cáo `OPEN` của bài thành `DISMISSED` trong cùng transaction, ghi chú hệ thống “Người đăng đã xóa nội dung”, `handled_by` NULL.
- Moderator: `GET /api/v1/moderator/reports` (lọc `status` mặc định `OPEN`, `reason`; `OPEN` xếp cũ trước, còn lại mới trước; phân trang; mỗi mục: lý do, mô tả, người báo cáo, thời điểm, bài bị báo cáo gồm loại, tiêu đề bài hỏi liên quan, nội dung, người đăng, trạng thái hiện tại, `questionId`, cờ `publiclyVisible` (bài và bài hỏi cha đều đang công khai), và số báo cáo `OPEN` khác của cùng bài), `PATCH /api/v1/moderator/reports/{id}/resolve {action: HIDE_CONTENT|DISMISS, note}`.
- Xử lý một báo cáo áp cho **mọi báo cáo `OPEN` của cùng bài** trong một transaction: `HIDE_CONTENT` → bài thành `HIDDEN` (ghi `hidden_by/at`, `moderation_note`), các báo cáo thành `ACTIONED`; `DISMISS` → bài giữ nguyên, các báo cáo thành `DISMISSED`. Ghi `handled_by/at`, `resolution_note`.
- Ẩn/hiện trực tiếp: `PATCH /api/v1/moderator/forum/posts/{id}/visibility {action: HIDE|RESTORE, note}` (`HIDE` từ `VISIBLE`, đồng thời đóng mọi báo cáo `OPEN` của bài thành `ACTIONED`; `RESTORE` từ `HIDDEN` về `VISIBLE`, xóa `hidden_by/at`, báo cáo đã đóng giữ nguyên); `GET /api/v1/moderator/forum/posts?status=HIDDEN` (danh sách bài đang ẩn kèm đủ nội dung, tiêu đề bài hỏi liên quan, người đăng, ghi chú, người ẩn, thời điểm, `questionId`, `publiclyVisible`; phân trang, mới ẩn trước). Hai danh sách đã mang đủ nội dung nên không có API chi tiết riêng cho Moderator.
- Moderator được ẩn bài của bất kỳ ai, kể cả của Admin, Moderator khác và của chính mình. Ẩn bài hỏi làm cả trang (và các câu trả lời) không còn truy cập được với người thường; khôi phục thì hiện lại nguyên trạng.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| `targetType` | Bắt buộc; chỉ `FORUM_POST` (giá trị khác, kể cả loại schema có sẵn, bị từ chối) | 400 `VALIDATION_ERROR` | — |
| `targetId` | Bắt buộc, UUID | 400 `VALIDATION_ERROR` | — |
| `reason` | SPAM / INAPPROPRIATE / COPYRIGHT / MISLEADING / OTHER | 400 `VALIDATION_ERROR` | Hãy chọn lý do. |
| `description` | ≤ 1.000 ký tự; bắt buộc (sau trim ≥ 10) khi `reason = OTHER`; rỗng lưu NULL | 400 `VALIDATION_ERROR` | Hãy mô tả vi phạm (10–1.000 ký tự). |
| Báo cáo khi chưa đăng nhập / tài khoản bị khóa | — | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / 403 `ACCESS_DENIED` | Đăng nhập để báo cáo. / Bạn không có quyền. |
| Đích không tồn tại, không `VISIBLE`, hoặc là câu trả lời của bài hỏi đang ẩn (kể cả bị xóa/ẩn đúng lúc đang gửi báo cáo) | Không lộ lý do; không tạo báo cáo | 404 `REPORT_TARGET_NOT_FOUND` | Nội dung không còn khả dụng. |
| Báo cáo bài của chính mình | — | 409 `REPORT_OWN_CONTENT` | Bạn không thể báo cáo bài của chính mình. |
| Đã báo cáo bài này (kể cả hai request song song; báo cáo cũ đã đóng vẫn tính) | Ràng buộc UNIQUE; lỗi DB thành lỗi nghiệp vụ | 409 `REPORT_ALREADY_SUBMITTED` | Bạn đã báo cáo nội dung này. |
| Báo cáo quá nhanh | Mỗi người tối đa 10 báo cáo/phút | 429 `FORUM_RATE_LIMITED` | Bạn thao tác quá nhanh, hãy thử lại sau. |
| Redis lỗi khi kiểm nhịp | Không cho qua | 503 `FORUM_STORAGE_UNAVAILABLE` | Dịch vụ đang gián đoạn. Hãy thử lại. |
| Gọi API kiểm duyệt khi thiếu token / token sai | — | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` | Đăng nhập để tiếp tục. |
| Đã đăng nhập nhưng không có role MODERATOR (kể cả ADMIN không kèm MODERATOR), hoặc tài khoản bị khóa | — | 403 `ACCESS_DENIED` | Bạn không có quyền. |
| `action` (`resolve`, `visibility`) | Bắt buộc, enum hợp lệ | 400 `VALIDATION_ERROR` | — |
| `note` | Bắt buộc 1–1.000 ký tự cho `HIDE_CONTENT`, `HIDE`; tùy chọn ≤ 1.000 cho `DISMISS`, `RESTORE` | 400 `VALIDATION_ERROR` | Hãy ghi lý do (tối đa 1.000 ký tự). |
| Báo cáo không tồn tại | — | 404 `REPORT_NOT_FOUND` | Không tìm thấy báo cáo. |
| Báo cáo đã được xử lý (kể cả hai Moderator xử lý đồng thời, hoặc người đăng vừa xóa bài) | Khóa theo thứ tự chung (bài hỏi → câu trả lời → báo cáo); một người thắng | 409 `REPORT_ALREADY_HANDLED` | Báo cáo đã được xử lý. Hãy tải lại. |
| `HIDE_CONTENT` khi bài đã `DELETED` | Không xảy ra với báo cáo `OPEN` (xóa bài đã đóng báo cáo); nếu gặp thì từ chối | 409 `REPORT_ALREADY_HANDLED` | Báo cáo đã được xử lý. Hãy tải lại. |
| Bài không tồn tại (API bài của Moderator) | — | 404 `FORUM_POST_NOT_FOUND` | Không tìm thấy bài viết. |
| `HIDE` khi bài không `VISIBLE`; `RESTORE` khi bài không `HIDDEN` (kể cả hai Moderator đồng thời) | — | 409 `FORUM_STATE_INVALID` | Không thực hiện được ở trạng thái hiện tại. |
| Tham số lọc/phân trang sai | `page ≥ 0`, `size` 1–50, enum hợp lệ | 400 `VALIDATION_ERROR` | — |

### Kế hoạch thực thi

- **File cần đụng:** entity `Report`; enum lý do/trạng thái/loại đích; `ReportController` (người dùng), `ModeratorReportController`, `ModeratorForumController`, service/repository; `SecurityConfiguration` (`/api/v1/reports` và `/api/v1/moderator/{reports,forum}/**` authenticated); `ErrorCode`; `ForumService` thêm bước đóng báo cáo khi người đăng xóa bài và `canReport` xét cả “đã báo cáo”.
- **Phần dùng lại:** cách kiểm role MODERATOR của API duyệt bài viết/khóa học; `lockActiveUser`; `ForumPostRules` của 1a.
- **Bẫy đã biết:** `reports.target_id` không có khóa ngoại — luôn kiểm đích bằng truy vấn trước khi ghi, trigger V1 chỉ là lưới cuối và lỗi của nó không được thành 500; mọi đường ghi theo đúng thứ tự khóa ở “Ràng buộc chung” (xử lý báo cáo, ẩn trực tiếp, tạo báo cáo, người đăng xóa bài), nếu không sẽ khóa chết; `RESTORE` không kiểm giới hạn 200; số “báo cáo `OPEN` khác” tính bằng một truy vấn gộp, không truy vấn từng dòng; nội dung bài trong hàng đợi lấy trạng thái hiện tại, không chụp lúc báo cáo.

### Xong khi

- [ ] `ReportControllerTest`, `ModeratorReportControllerTest` (`@WebMvcTest`): validation từng trường (gồm `targetType` khác `FORUM_POST`, `description` khi `OTHER`, `note` theo `action`), 401/403, mapping mã lỗi, tham số lọc sai.
- [ ] `ReportRulesTest` (unit): ma trận đích báo cáo được/không (trạng thái bài × trạng thái bài hỏi cha × chủ bài), `note` theo `action`, chuyển trạng thái ẩn/hiện.
- [ ] `ReportIntegrationTest` (DB/security thật, gộp theo luồng): (1) báo cáo bài hỏi và câu trả lời, bài của mình → 409, lần hai → 409, đích đã ẩn → 404, câu trả lời của bài hỏi đang ẩn → 404; (2) người đăng xóa bài → báo cáo `OPEN` thành `DISMISSED`; (3) đồng thời: hai request báo cáo giống nhau chỉ một thành công, tạo báo cáo song song với xóa bài không để lại báo cáo `OPEN`.
- [ ] `ModeratorReportIntegrationTest` (gộp theo luồng): (1) `HIDE_CONTENT` ẩn bài, đóng mọi báo cáo `OPEN` cùng bài, trang chi tiết 404 với người thường, rồi khôi phục hiện lại; (2) `DISMISS` giữ bài; ẩn trực tiếp lời giải → bài thành chưa giải quyết và báo cáo được đóng; (3) hai Moderator xử lý song song (một thành công, một `REPORT_ALREADY_HANDLED`); (4) ADMIN không kèm MODERATOR → 403.
- [ ] Chạy các lớp trên + `ForumIntegrationTest`; full backend do CI.

## Task 1c — React bài diễn đàn

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- Migration riêng (số kế tiếp): bảng `forum_post_reactions` (`id uuid` khóa chính, `user_id` → users `ON DELETE CASCADE`, `post_id` → forum_posts `ON DELETE CASCADE`, `type` CHECK `LIKE`/`LOVE`/`HAHA`/`ANGRY`, `created_at`, `updated_at`, UNIQUE `(user_id, post_id)`), index `(post_id, type, updated_at DESC, id DESC)`. Bảng mới nên không cần chặn dữ liệu cũ.
- Mỗi người một react trên một bài (bài hỏi hoặc câu trả lời, kể cả bài của mình). `PUT /api/v1/forum/posts/{id}/reaction {type}`: chưa có thì tạo, khác loại thì đổi loại và cập nhật `updated_at`, cùng loại thì không đổi gì (giữ `updated_at`, không lỗi). `DELETE /api/v1/forum/posts/{id}/reaction`: bỏ react; chưa có react vẫn 200. Cả hai trả `{counts, mine}` mới nhất của bài. “Bấm lại cùng loại thì bỏ” là việc của giao diện (gọi `DELETE`), API giữ idempotent.
- `GET /api/v1/forum/posts/{id}/reactions` (công khai): `PageResponse` như các danh sách khác; lọc `type` (thiếu hoặc rỗng = mọi loại); sắp `updated_at DESC, id DESC`; mặc định `page = 0`, `size = 20`; mỗi mục: người dùng (id, tên, ảnh), `type`, `reactedAt` (= `updated_at`, thời điểm chọn loại hiện tại).
- API 1a bổ sung: mỗi bài trong `GET /questions/{id}` (bài hỏi và từng câu trả lời) có `reactions {counts: {LIKE, LOVE, HAHA, ANGRY}, mine}` (`counts` luôn đủ 4 khóa, loại chưa có = 0; `mine` là loại của người xem, luôn có mặt và bằng `null` khi chưa react, với Guest và tài khoản bị khóa) và `viewer.canReact`; mỗi mục của `GET /questions` có `reactionCount` (tổng). Đếm bằng hai truy vấn gộp cho cả trang: tổng theo `(post_id, type)` với `post_id IN (...)` và react của người xem với cùng tập id; không truy vấn từng bài. Bài hỏi `DELETED` còn hiển thị: vắng trường `reactions` (`viewer.canReact = false`).
- Ai được react / xem: theo luật “ai thấy gì” của module. Bài hỏi `DELETED` còn hiển thị: không react được, không xem danh sách; câu trả lời của nó vẫn react được. Bài bị ẩn/xóa: react giữ nguyên trong DB, không lộ ra; hiện lại thì số đếm còn nguyên. React của tài khoản sau đó bị khóa vẫn được đếm và vẫn hiện trong danh sách.

### Quy tắc nghiệp vụ và mã lỗi

Thứ tự xét lỗi và lỗi định dạng chung theo “Ràng buộc chung”; JSON hỏng hoặc thiếu body trả 400 `MALFORMED_REQUEST` như 1a (log “Lệch khác spec”).

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| `type` trong body | Bắt buộc; nhận dạng chuỗi theo mẫu `LIKE\|LOVE\|HAHA\|ANGRY` (không deserialize thẳng thành enum) để thiếu, `null`, sai giá trị đều là lỗi trường | 400 `VALIDATION_ERROR` | — |
| `type` lọc danh sách | Thiếu hoặc rỗng = mọi loại; giá trị khác 4 loại → 400 | 400 `VALIDATION_ERROR` | — |
| `id` đường dẫn, `page`, `size` | UUID; `page ≥ 0`; `size` 1–50 | 400 `VALIDATION_ERROR` | — |
| React/bỏ react khi chưa đăng nhập; token sai ở mọi route 1c (kể cả GET công khai) | — | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` | Đăng nhập để bày tỏ cảm xúc. |
| Tài khoản bị khóa | React/bỏ react (GET đọc như Guest) | 403 `ACCESS_DENIED` | Bạn không có quyền. |
| Bài không tồn tại; bài `HIDDEN`; câu trả lời `DELETED`; câu trả lời của bài hỏi `HIDDEN`; bài hỏi `DELETED` không còn câu trả lời `VISIBLE` (react, bỏ react, xem danh sách) | Không lộ lý do | 404 `FORUM_POST_NOT_FOUND` | Không tìm thấy bài viết. |
| React/bỏ react/xem danh sách trên bài hỏi `DELETED` còn câu trả lời `VISIBLE` | — | 409 `FORUM_QUESTION_CLOSED` | Bài hỏi đã bị xóa. (giao diện react dùng câu này thay câu của bảng 1a) |
| Hai request của cùng người song song (đổi loại liên tục, bấm hai lần, PUT tranh chấp DELETE) | Khóa dòng người dùng trước; kết quả cuối là request lấy khóa sau; luôn đúng một dòng hoặc không dòng nào; ghi bằng upsert nên không 500 | 200 | — |
| Bài bị ẩn/xóa, hoặc câu trả lời cuối của bài hỏi đã xóa bị ẩn/xóa, đúng lúc đang react | Khóa theo thứ tự chung (người → bài hỏi → câu trả lời), kiểm lại trạng thái sau khi khóa | 404 / 409 như hai dòng trên | — |
| React quá nhanh | Mỗi người tối đa 30 lần react/bỏ react mỗi phút | 429 `FORUM_RATE_LIMITED` | Bạn thao tác quá nhanh, hãy thử lại sau. |
| Redis lỗi khi kiểm nhịp | Không cho qua | 503 `FORUM_STORAGE_UNAVAILABLE` | Dịch vụ đang gián đoạn. Hãy thử lại. |

### Kế hoạch thực thi

- **File cần đụng:** migration mới; entity `ForumPostReaction`, enum `ForumReactionType`, `ForumPostReactionRepository`; `ForumService` (react, bỏ react, danh sách, đếm gộp truyền vào các hàm dựng DTO tĩnh, `canReact`, `RateKind.REACT`); `ForumController`; `ForumRequest`/`ForumResponse`; `SecurityConfiguration` không cần đổi (GET đã `permitAll`, ghi đã authenticated).
- **Phần dùng lại:** `lockActiveUser`; khóa bài hỏi/câu trả lời và luật đọc của 1a (`questionReadable`, `answerReadable`); `rateLimit`; `ArticleAuthorResponse`; `PageResponse`; mẫu upsert `ON CONFLICT` của `InterviewQuestionMarkRepository.upsert`; mẫu giữ khóa bằng kết nối riêng trong `ForumIntegrationTest`.
- **Bẫy đã biết:** upsert `ON CONFLICT (user_id, post_id) DO UPDATE ... WHERE type <> EXCLUDED.type` để cùng loại không đổi `updated_at`; `ForumResponse.Question` đang `NON_NULL` — `reactions` vắng ở bài hỏi đã xóa nhưng record `reactions` không được bỏ `mine: null`; bài nhiều người react cùng lúc xếp hàng trên khóa bài hỏi — chấp nhận ở quy mô hiện tại; thêm dữ liệu gộp không được đổi hành vi hay shape cũ của 1a/1b (chỉ thêm trường).

### Xong khi

- [ ] `ForumReportsMigrationTest`: bảng mới, CHECK `type`, UNIQUE `(user_id, post_id)`, xóa người dùng/bài thì react mất theo, index.
- [ ] `ForumPostRulesTest` (unit): `canReact` theo trạng thái bài × bài hỏi cha × Guest/khóa; nhịp `REACT` (30 qua, 31 → 429, Redis lỗi → 503) trong phần kiểm nhịp sẵn có.
- [ ] `ForumControllerTest`: `type` thiếu/`null`/sai, JSON hỏng, ID sai, `type`/`page`/`size` lọc sai và `type` rỗng hợp lệ, 401 khi ghi, mapping mã lỗi.
- [ ] `ForumIntegrationTest` luồng (1): react → PUT lặp cùng loại (giữ `reactedAt`) → đổi loại → bỏ → bỏ lần hai vẫn 200; bài chưa có react trả `counts` đủ 4 khóa bằng 0 và JSON có `mine: null`; `mine` ở PUT/DELETE, chi tiết và `reactionCount` ở danh sách; Guest và tài khoản bị khóa đọc thấy số đếm với `mine: null`, `canReact = false`; Guest 401 khi ghi, token sai 401 ở GET; danh sách người react lọc loại + phân trang ổn định.
- [ ] `ForumIntegrationTest` luồng (2): bài ẩn, câu trả lời đã xóa, câu trả lời của bài hỏi ẩn → 404; bài hỏi đã xóa còn câu trả lời → 409, JSON vắng `reactions`, câu trả lời của nó react được; xóa nốt câu trả lời đó → react/bỏ react/danh sách trên bài hỏi → 404; tài khoản bị khóa → 403 khi ghi, react cũ vẫn đếm/liệt kê; dữ liệu đặt lại `VISIBLE` bằng SQL thì số đếm còn nguyên.
- [ ] `ForumIntegrationTest` luồng (3): cùng người PUT và DELETE song song → đúng 0 hoặc 1 dòng, không 500; giữ khóa bài hỏi ở kết nối riêng rồi ẩn nó trước khi nhả → PUT đang chờ nhận 404; tương tự với bài hỏi đã xóa có câu trả lời cuối bị ẩn trong lúc giữ khóa → 404.
- [ ] Chạy các lớp trên + lớp test của 1b bị ảnh hưởng nếu 1c sửa phần dùng chung với 1b (xác định khi bắt đầu 1c); full backend do CI.

## Cổng wireframe

Sau khi 1a–1c xong và đã review: Claude viết `plans/forum-reports.wireframe.md` (bố cục chữ cho các màn của 2a, 2b — gồm thanh react và hộp thoại “ai đã react” — ở desktop và mobile 390px, trạng thái tải/rỗng/lỗi). Người dùng duyệt rồi mới code giao diện.

## Task 2a — Giao diện diễn đàn

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- `/forum` (công khai): danh sách bài hỏi; lọc chủ đề, từ khóa, “Chưa giải quyết” / “Đã giải quyết”, “Bài của tôi” (đã đăng nhập); bộ lọc nằm trên URL; phân trang; nút “Đặt câu hỏi”.
- `/forum/new`, `/forum/:id/edit` (đăng nhập): tiêu đề, chủ đề, nội dung Markdown có xem trước; cảnh báo khi rời trang chưa lưu.
- `/forum/:id` (công khai): bài hỏi, danh sách câu trả lời (lời giải đứng đầu, có nhãn), ô trả lời Markdown có xem trước; theo `viewer.*`: Sửa/Xóa bài của mình, “Chọn làm lời giải”/“Bỏ chọn” cho người hỏi, “Báo cáo” (hộp thoại chọn lý do + mô tả). Sửa câu trả lời ngay tại chỗ. Guest thấy lời mời đăng nhập (giữ `returnTo`) thay cho ô trả lời. Bài hỏi đã xóa nhưng còn câu trả lời hiện trạng thái “đã xóa” và không có ô trả lời.
- React (Task 1c): mỗi bài hỏi và câu trả lời có nút react chọn một trong 4 loại (bấm lại loại đang chọn thì bỏ, chọn loại khác thì đổi) và cụm số đếm; bấm cụm số đếm mở hộp thoại “ai đã react” có tab Tất cả + từng loại kèm số, danh sách ảnh/tên/biểu tượng, “Xem thêm” (mobile: tấm trượt từ dưới). Guest bấm react thấy lời mời đăng nhập. Bố cục chốt ở wireframe.
- Tài khoản MODERATOR thấy thêm nút “Ẩn” trên mỗi bài (hộp thoại nhập lý do, gọi API ẩn trực tiếp của 1b).
- Các route diễn đàn **không** bọc `ReaderRoute` (Admin/Moderator dùng được); thêm mục “Hỏi đáp” vào sidebar người dùng, `ModeratorSidebar` và `AdminSidebar`.

### Kế hoạch thực thi

- **File cần đụng:** `pages/Forum/**`, `forumService.ts`, `types/forum.ts`, `forumI18n.ts`, `App.tsx`, `navigation.ts`, `Sidebar.tsx`, `ModeratorSidebar.tsx`, `AdminSidebar.tsx`.
- **Phần dùng lại:** bố cục danh sách + bộ lọc trên URL của trang bài viết; `MarkdownContent`; trình soạn Markdown có xem trước của bài viết (không kèm tải ảnh); `UserAvatar`; `EmptyState`; `Pagination`; `AlertDialog` cho xóa; `Dialog` cho báo cáo và ẩn; `returnTo`; `Badge` tone hiện có cho “Đã giải quyết”.
- **Bẫy đã biết:** quyền hiển thị nút lấy từ `viewer.*` của server, không tự suy từ role; sau mỗi thao tác ghi tải lại chi tiết từ server; khóa nút khi đang gửi (server vẫn chặn gửi trùng); chuỗi dài trong test dùng `user.paste`; vùng chạm 44px; `/forum/new` phải khai trước `/forum/:id`; không assert class Tailwind.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Menu / tiêu đề | Hỏi đáp | Q&A |
| Bộ lọc | Chủ đề / Tìm câu hỏi / Tất cả / Chưa giải quyết / Đã giải quyết / Bài của tôi | Topic / Search questions / All / Unsolved / Solved / My posts |
| Hành động | Đặt câu hỏi / Đăng câu hỏi / Gửi câu trả lời / Sửa / Xóa / Lưu / Hủy | Ask a question / Post question / Post answer / Edit / Delete / Save / Cancel |
| Trường | Tiêu đề / Chủ đề / Nội dung / Câu trả lời của bạn | Title / Topic / Details / Your answer |
| Lời giải | Chọn làm lời giải / Bỏ chọn / Lời giải / Đã giải quyết | Mark as solution / Unmark / Solution / Solved |
| Số liệu | {n} câu trả lời / Đã sửa | {n} answers / Edited |
| Guest | Đăng nhập để đặt câu hỏi và trả lời. | Sign in to ask and answer. |
| Xóa | Xóa bài này? Không thể hoàn tác. | Delete this post? This cannot be undone. |
| Bài đã xóa | Bài hỏi đã bị người đăng xóa. | This question was deleted by its author. |
| Báo cáo | Báo cáo / Lý do / Mô tả thêm / Gửi báo cáo / Đã gửi báo cáo. Cảm ơn bạn. | Report / Reason / Details / Submit report / Report submitted. Thank you. |
| Lý do | Spam / Nội dung không phù hợp / Vi phạm bản quyền / Sai lệch, gây hiểu lầm / Khác | Spam / Inappropriate / Copyright / Misleading / Other |
| Moderator | Ẩn / Lý do ẩn / Đã ẩn bài. | Hide / Reason for hiding / Post hidden. |
| React | Thích / Yêu thích / Haha / Phẫn nộ / Bày tỏ cảm xúc / Người đã bày tỏ cảm xúc / Tất cả / Xem thêm / Chưa có ai bày tỏ cảm xúc. | Like / Love / Haha / Angry / React / Reactions / All / Show more / No reactions yet. |
| Rỗng | Chưa có câu hỏi phù hợp. / Chưa có câu trả lời. Hãy là người đầu tiên. | No matching questions. / No answers yet. Be the first. |
| Chưa lưu | Bạn có thay đổi chưa lưu. Rời trang? | You have unsaved changes. Leave? |

Câu hiển thị cho từng mã lỗi lấy từ cột “Copy hiển thị” của bảng 1a/1b/1c (thao tác react dùng câu của bảng 1c khi trùng mã); bản tiếng Anh dịch tương ứng trong `forumI18n`.

### UI

- Theo wireframe đã duyệt và `UI_GUIDE.md`; primitive và token hiện có, không thêm màu mới. Trạng thái: tải, rỗng, lỗi, Guest, đang gửi, bài đã xóa. Desktop và mobile 390px: khối code cuộn ngang trong khung của nó, trang không cuộn ngang.

### Xong khi

- [ ] Test unit: validation theo bảng 1a/1b (biên như test backend), mapping mọi mã lỗi 1a/1b/1c liên quan vi/en (gồm câu `FORUM_QUESTION_CLOSED` riêng của react) (gồm câu dự phòng), nút hiển thị theo từng tổ hợp `viewer.*`.
- [ ] `Forum/*.test.tsx` (luồng chính, khoảng 5 ca mỗi màn): danh sách + lọc trên URL; Guest thấy lời mời đăng nhập; đặt câu hỏi; trả lời và sửa tại chỗ; xóa có xác nhận; chọn/bỏ lời giải; báo cáo lý do “Khác”; MODERATOR ẩn bài; bài hỏi đã xóa; react/đổi/bỏ react và hộp thoại “ai đã react”.
- [ ] Test `Sidebar`, `ModeratorSidebar`, `AdminSidebar`, `App` bị sửa (gồm ADMIN/MODERATOR vào được `/forum`) + `npm run build` trong `app/` (không chạy full `npm test`).
- [ ] Kiểm bằng mắt: dark/light × desktop/mobile, một lượt; ghi log.

## Task 2b — Giao diện Moderator: báo cáo vi phạm

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- `/moderator/reports` với ba tab trên URL: “Chờ xử lý” (mặc định), “Đã xử lý” (lọc Đã ẩn nội dung / Đã bỏ qua), “Nội dung đang ẩn”.
- Mỗi báo cáo: lý do, mô tả, người báo cáo, thời điểm, số báo cáo khác cùng bài, nội dung bài bị báo cáo (Markdown, thu gọn khi dài, lấy từ API Moderator nên xem được cả khi bài đã ẩn), người đăng; liên kết “Mở trong diễn đàn” chỉ hiện khi `publiclyVisible`, ngược lại hiện nhãn “Không còn công khai”; nút “Ẩn nội dung” và “Bỏ qua” mở hộp thoại ghi chú (bắt buộc khi ẩn).
- Tab “Nội dung đang ẩn”: bài, lý do ẩn, người ẩn, thời điểm; nút “Hiện lại” có xác nhận.
- Route dùng `RoleRoute` với `allowed={['MODERATOR']}`. Thêm mục “Báo cáo vi phạm” vào `ModeratorSidebar`; tài khoản vừa ADMIN vừa MODERATOR vào qua mục “Kiểm duyệt bài viết” sẵn có của `AdminSidebar` (dẫn tới `/moderator/articles`, khu `/moderator` hiện `ModeratorSidebar` có mục mới).
- Validation và mọi trạng thái lỗi của màn này dẫn chiếu bảng “Quy tắc nghiệp vụ và mã lỗi” của Task 1b.

### Kế hoạch thực thi

- **File cần đụng:** `pages/Moderator/Reports/**`, `forumService.ts`, `types/forum.ts`, `forumI18n.ts`, `managementI18n.ts`, `ModeratorSidebar.tsx`, `App.tsx`.
- **Phần dùng lại:** bố cục, bộ lọc và hộp thoại lý do của màn duyệt bài viết/khóa học; `MarkdownContent`; `Pagination`; `EmptyState`; `Badge` tone hiện có cho lý do và trạng thái.
- **Bẫy đã biết:** không tự retry thao tác xử lý; sau thành công tải lại danh sách (các báo cáo cùng bài cũng biến khỏi “Chờ xử lý”); `REPORT_ALREADY_HANDLED` hiện thông báo kèm nút tải lại; ghi chú bắt buộc ở client khớp bảng 1b.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Menu / tiêu đề | Báo cáo vi phạm | Reports |
| Tab | Chờ xử lý / Đã xử lý / Nội dung đang ẩn | Open / Handled / Hidden content |
| Trạng thái | Chờ xử lý / Đã ẩn nội dung / Đã bỏ qua | Open / Content hidden / Dismissed |
| Hành động | Ẩn nội dung / Bỏ qua / Hiện lại / Mở trong diễn đàn | Hide content / Dismiss / Restore / Open in forum |
| Nhãn | Bài hỏi / Câu trả lời / Người báo cáo / Người đăng / +{n} báo cáo khác / Không còn công khai | Question / Answer / Reporter / Author / +{n} more reports / No longer public |
| Ghi chú | Hãy ghi lý do (tối đa 1.000 ký tự). | Enter a reason (up to 1,000 characters). |
| Đã xử lý | Báo cáo đã được xử lý. Hãy tải lại. | This report was already handled. Reload. |
| Rỗng | Không có báo cáo nào chờ xử lý. / Không có nội dung nào đang ẩn. | No open reports. / No hidden content. |

### UI

- Theo wireframe và chuẩn màn Moderator hiện có; đủ tải/rỗng/lỗi; desktop và mobile 390px không cuộn ngang.

### Xong khi

- [ ] `Moderator/Reports/*.test.tsx`: ba tab theo URL; ẩn nội dung thiếu ghi chú; ẩn và bỏ qua thành công rồi tải lại; `REPORT_ALREADY_HANDLED`; hiện lại bài đang ẩn; bài không còn công khai hiện nhãn thay cho liên kết; mapping mã lỗi 1b liên quan vi/en (unit).
- [ ] Test `ModeratorSidebar`, `App` bị sửa + `npm run build` trong `app/`.
- [ ] Kiểm bằng mắt: dark/light × desktop/mobile, một lượt; ghi log.

## Câu hỏi mở cần người dùng chốt

- (không có — bảy câu hỏi mở đã chốt giữ mặc định, xem mục dưới)

## Quyết định của người dùng

**Người dùng chốt spec 2026-11-15** (Task 1a–1b, cổng wireframe, 2a–2b). Lịch sử phản biện: [`forum-reports.review.md`](forum-reports.review.md).

- Bảy câu hỏi mở giữ mặc định: báo cáo chỉ áp cho bài diễn đàn; bài bị ẩn thì người đăng không thấy và không được báo; xóa mềm, bài hỏi đã xóa không nhận trả lời mới; các giới hạn độ dài, 200 câu trả lời và nhịp đăng như bảng; người hỏi được chọn câu trả lời của mình, đổi/bỏ chọn tự do; không tự báo cáo, một người một lần, “Khác” phải có mô tả; `/forum` “Hỏi đáp”, `/moderator/reports` “Báo cáo vi phạm”.
- Hai đề xuất ngoài spec (thông báo khi bài bị ẩn; báo cáo bài viết/khóa học) để sau hạn, ghi ở “Câu hỏi mở” của `PLAN.md`.
- Phần Claude sửa thân spec sau vòng 1 chưa qua Codex soát vòng 2.
- **2026-11-21 — thêm Task 1c (react):** người dùng chốt bộ 4 loại, áp cho cả bài hỏi lẫn câu trả lời, có danh sách “ai đã react” (giao diện chốt ở wireframe). Người dùng chốt Task 1c và các dòng sửa kèm ngày 2026-11-21 sau hai vòng Codex phản biện (lịch sử trong `forum-reports.review.md`).
