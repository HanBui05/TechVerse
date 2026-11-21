# Interview practice — ngân hàng câu hỏi phỏng vấn, luyện trả lời có AI nhận xét

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Claude viết (D-030); đã đồng bộ theo log sau khi người dùng nhận các task.

**Mục tiêu:** Tác giả đã duyệt soạn câu hỏi phỏng vấn kèm đáp án mẫu và gợi ý (có thể nhờ AI sinh bản nháp), Moderator duyệt trước khi công khai; người học xem câu hỏi theo chủ đề và mức ở trang “Ôn phỏng vấn”, xem gợi ý/đáp án mẫu, gõ câu trả lời để AI nhận xét so với đáp án mẫu, đánh dấu “đã ôn” và “lưu lại”.
**Làn:** Đầy đủ · **Rủi ro:** thường. Review vòng 1 dùng `review`.
**Thứ tự:** 1a → 1b → 1c (Backend) → 2a → 2b (Giao diện). Chỉ mở Giao diện sau khi toàn bộ Backend xong và đã review. Làm sau `exercise-practice` (dùng lại mẫu của module đó).
**Nguồn quyết định:** câu I1–I6 trong [`roadmap.questions.md`](roadmap.questions.md) (người dùng trả lời 2026-11-14): I1 B, I2 A, I3 A, I4 A, I5 A, I6 A; 20 lượt AI nhận xét mỗi ngày mỗi người.

## Hiện trạng đã đối chiếu (2026-11-15)

- V1 có sẵn `interview_questions` (`author_id`, `topic_id`, `level` EASY/MEDIUM/HARD, `question` không rỗng, `sample_answer` NOT NULL, `hint` tùy chọn, `status` DRAFT/PENDING/PUBLISHED/CHANGES_REQUESTED/HIDDEN/REMOVED, `moderation_note`, `reviewed_by/at`, `published_at`; CHECK `PUBLISHED` phải có `published_at`) và index `(topic_id, level) WHERE status = 'PUBLISHED'` (`V1__initial_schema.sql:493`–`516`, `:1081`).
- Chưa có bảng lưu đánh dấu của người học, chưa có entity, API hay trang nào. Không có cơ chế phiên bản. Migration mới nhất trong repo là V12.
- Frontend: trang chủ đã có nút dẫn tới `/interview` (`app/src/pages/Home/HomePage.tsx:23`) nhưng route chưa tồn tại; `Sidebar.test.tsx:50`–`51` đang coi `/interview` và `/admin/interview-questions` là đường chết.
- AI hiện có: `AiRateLimitService.Kind` chỉ có `OUTLINE`, `DRAFT` và đếm theo người gọi, không gắn với vai trò tác giả (`AiRateLimitService.java:50`–`94`); `AiOutlineService` gọi model trả JSON theo schema, không stream; `AiGenerationRegistry` giữ một lượt đang chạy mỗi người nhưng hiện chỉ `AiDraftStreamService` dùng (dàn ý không qua đây) và là bộ nhớ của một tiến trình; `AiRateLimitService.refund` khi Redis lỗi chỉ ghi log, không hoàn được.
- Frontend coi tài khoản ADMIN/MODERATOR là tài khoản quản trị: `ReaderRoute` chuyển họ về dashboard ở mọi trang của người đọc (`app/src/App.tsx:54`–`61`), sidebar người dùng không dành cho họ.

## Đường dẫn thuộc module

- `server/src/main/resources/db/migration/V<n>__interview_practice.sql` (tạo; `<n>` là số kế tiếp lúc code).
- `server/src/main/java/com/techverse/server/{controller,entity,enums,dto,repository,service}/**/*Interview*.java` (tạo; mọi lớp mới của module đều mang `Interview` trong tên, không thêm script Redis mới); `configuration/SecurityConfiguration.java`, `exception/ErrorCode.java`.
- `server/src/main/java/com/techverse/server/service/impl/{AiPromptFactory,AiRateLimitService,AiOutlineService}.java`, `dto/response/AiQuotaResponse.java`, `properties/AiAssistProperties.java`, `server/src/main/resources/application*.yaml`, `.env.example` (Task 1c).
- `server/src/test/java/com/techverse/server/interview/**` (tạo) và test trực tiếp của file dùng chung bị sửa (`ai/**`).
- `plans/interview-practice.gemini-prompt.md` (hướng dẫn Gemini làm giao diện).
- `app/src/pages/{Interview,Author/InterviewQuestions,Moderator/InterviewQuestions}/**` và test (tạo); `app/src/{types/interview.ts,services/interviewService.ts,data/interviewI18n.ts}` và test (tạo); `app/src/services/aiAssistService.ts` và test (kiểu quota thêm `interviewDraft`).
- `app/src/{App.tsx,App.*.test.tsx}`, `app/src/data/{navigation,managementI18n}.ts`, `app/src/components/layout/{Sidebar,ModeratorSidebar}.tsx` và test trực tiếp (gồm `Sidebar.test.tsx`: bỏ `interview` khỏi danh sách đường chết của người dùng).

## Ngoài phạm vi

- Phỏng vấn thử nhiều câu liên tiếp có tổng kết (I1 C); nhóm câu hỏi theo vị trí tuyển dụng (I5 B); người dùng thường đóng góp câu hỏi (I2 C).
- Lưu câu trả lời đã gõ và nhận xét của AI (I4 B); chấm điểm bằng số; thống kê tiến độ ôn; bảng xếp hạng.
- Phiên bản hóa câu hỏi, lịch sử kiểm duyệt nhiều dòng, ảnh trong nội dung, nhập từ file, tag.
- Bình luận, báo cáo vi phạm, thông báo cho tác giả, số liệu dashboard, trang quản trị của Admin.
- Stream câu trả lời AI (nhận xét trả một lần dạng JSON).

## Ràng buộc chung

- Được đổi API: Có. Được đổi DB: Có, chỉ bằng một migration mới; không sửa migration đã có. Giữ `ApiResponse`/`ErrorResponse`. Giữ nguyên hành vi hiện tại của AI bài viết: Có (API quota chỉ thêm trường).
- **Câu đã công khai không sửa nội dung** (không có phiên bản). Muốn sửa: tác giả “Tạo bản sao” thành bản nháp mới, gửi duyệt lại, rồi tự ẩn câu cũ; đánh dấu của người học ở lại với câu cũ.
- Gợi ý và đáp án mẫu **không có** trong API danh sách và API chi tiết công khai; chỉ trả ở endpoint riêng cần đăng nhập.
- Vai trò: Guest xem danh sách và nội dung câu hỏi. Tài khoản người đọc đã đăng nhập, đang hoạt động (kể cả tác giả với câu của chính mình) được xem gợi ý/đáp án, đánh dấu và dùng AI nhận xét. **Tài khoản ADMIN/MODERATOR không dùng trang Ôn phỏng vấn**: `/interview` bọc `ReaderRoute` như mọi trang người đọc, không có mục trong sidebar quản trị; Moderator xem đáp án ở màn duyệt. API không chặn thêm theo role (chi phí AI đã chặn bằng quota). ADMIN chỉ duyệt nếu đồng thời có role MODERATOR.
- Tác giả bị đình chỉ (`author_profiles.status = SUSPENDED`): **không** tạo, sửa, gửi duyệt, sao chép, hiện lại, dùng AI sinh câu (kiểm bằng `lockWriter`); **vẫn** xem, xóa, rút khỏi hàng chờ và ẩn câu của mình (tài khoản hoạt động và có hồ sơ tác giả ở mọi trạng thái); câu đã công khai của họ không hiện ở trang công khai (cùng luật bài viết). Tài khoản bị khóa gửi token: mọi API của module, kể cả danh sách/chi tiết công khai không lọc `mark`, trả 403 `ACCESS_DENIED`.
- Mọi endpoint cần đăng nhập: thiếu token → 401 `AUTH_ACCESS_TOKEN_REQUIRED`; token sai/hết hạn → 401 `AUTH_INVALID_ACCESS_TOKEN` (kể cả endpoint `permitAll` khi có gửi token sai, theo hành vi bảo mật hiện có).
- Chủ đề phải đang hoạt động khi tạo, lưu, gửi duyệt và khi Moderator duyệt.
- `question`, `sampleAnswer`, `hint` là Markdown, dùng cùng bộ kiểm của bài viết (cấm HTML thô, link nguy hiểm, NUL) và **từ chối thêm mọi node ảnh** của parser (`![…](…)` lẫn ảnh dạng tham chiếu `![…][ref]`).
- Mọi thao tác đổi trạng thái khóa dòng câu hỏi trong transaction; hai request đồng thời chỉ một request thắng. Sửa nội dung dùng khóa lạc quan: client gửi `version` đã đọc, lệch thì 409 `INTERVIEW_VERSION_CONFLICT`. `version` tăng ở mọi thay đổi của câu hỏi.
- Dữ liệu gửi cho model (câu hỏi, đáp án mẫu, câu trả lời của người học, yêu cầu của tác giả) là dữ liệu không tin cậy; system prompt cố định; trả lời tiếng Việt. Không dùng RAG; test tự động không gọi model thật.

### Trạng thái câu hỏi

Giống `exercise-practice`: `DRAFT` → (gửi duyệt) `PENDING` → (duyệt) `PUBLISHED` hoặc (yêu cầu sửa) `CHANGES_REQUESTED` → (gửi lại) `PENDING`. Tác giả rút `PENDING` → `DRAFT`. Từ `PUBLISHED`: tác giả ẩn → `AUTHOR_HIDDEN` (giá trị mới) và hiện lại; Moderator ẩn → `HIDDEN` (nhớ trạng thái trước đó) và khôi phục về đúng trạng thái trước; Moderator gỡ → `REMOVED` (cuối cùng). Chỉ `PUBLISHED` hiện ở trang công khai.

## Task 1a — Schema, API tác giả và vòng đời

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- Migration: thêm `AUTHOR_HIDDEN` vào CHECK `status`; cột `hidden_from_status` (NULL trừ khi `HIDDEN`), `ai_assisted boolean NOT NULL DEFAULT false`, `version integer NOT NULL DEFAULT 0`; bảng mới `interview_question_marks` (`user_id` → users `ON DELETE CASCADE`, `question_id` → interview_questions `ON DELETE CASCADE`, `reviewed_at`, `saved_at` timestamptz NULL, các cột audit như bảng khác, UNIQUE `(user_id, question_id)`, index `(user_id, saved_at)`; không CHECK “ít nhất một mốc”, dòng có cả hai NULL là hợp lệ và nghĩa là chưa đánh dấu); dừng nếu `interview_questions` đã có dữ liệu (không backfill, D-022).
- `POST /api/v1/author/interview-questions` (tạo DRAFT: `topicId`, `level`, `question`, `sampleAnswer`, `hint`), `GET /api/v1/author/interview-questions` (của mình; lọc `status`, `level`, `topicId`, `keyword`; phân trang), `GET …/{id}` (đủ nội dung + `version`), `PATCH …/{id}` (các trường trên + `version`), `POST …/{id}/submit`, `POST …/{id}/withdraw`, `PATCH …/{id}/visibility {action: HIDE|UNHIDE}`, `POST …/{id}/copy` (DRAFT mới cùng nội dung, `ai_assisted` giữ nguyên), `DELETE …/{id}`, `GET /api/v1/author/interview-questions/options` (chủ đề đang hoạt động).
- Sửa chỉ khi `DRAFT` hoặc `CHANGES_REQUESTED`. Xóa cứng khi chưa từng công khai (`published_at IS NULL`) và không ở `PENDING`; câu từng công khai không xóa (tác giả dùng ẩn).

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| `topicId` | Thiếu, sai định dạng UUID hoặc không tồn tại → 400; tồn tại nhưng đã ngừng → 409 | 400 `VALIDATION_ERROR` / 409 `INTERVIEW_TOPIC_INACTIVE` | Hãy chọn chủ đề. / Chủ đề đã ngừng hoạt động. |
| `action` của `visibility` | Bắt buộc; `HIDE` hoặc `UNHIDE` | 400 `VALIDATION_ERROR` | — |
| `level` | EASY/MEDIUM/HARD | 400 `VALIDATION_ERROR` | Hãy chọn mức độ. |
| `question` | Sau trim 10–1.000 ký tự | 400 `VALIDATION_ERROR` | Câu hỏi từ 10 đến 1.000 ký tự. |
| `sampleAnswer` | Sau trim 20–5.000 ký tự | 400 `VALIDATION_ERROR` | Đáp án mẫu từ 20 đến 5.000 ký tự. |
| `hint` | Tùy chọn, ≤ 500 ký tự; rỗng lưu NULL | 400 `VALIDATION_ERROR` | Gợi ý tối đa 500 ký tự. |
| Nội dung Markdown | HTML thô, link nguy hiểm, NUL, cú pháp ảnh | 400 `INTERVIEW_CONTENT_INVALID` | Nội dung chứa định dạng không được hỗ trợ. |
| `version` khi PATCH | Bắt buộc, số nguyên từ 0 đến giới hạn `int`; kiểm bằng `BigDecimal` và `@Digits(fraction=0)` | 400 `VALIDATION_ERROR` | — |
| Sửa trên dữ liệu cũ / hai request sửa cùng lúc | Khóa dòng rồi so `version`; lệch thì không ghi | 409 `INTERVIEW_VERSION_CONFLICT` | Câu hỏi đã được sửa ở nơi khác. Hãy tải lại trước khi lưu. |
| Chưa đăng nhập / token sai | — | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` | Đăng nhập để tiếp tục. |
| Không có role AUTHOR; tài khoản bị khóa; tác giả bị đình chỉ gọi tạo/sửa/gửi/sao chép/hiện lại | Bị đình chỉ vẫn xem, xóa, rút, ẩn câu của mình (mục Ràng buộc chung) | 403 `ACCESS_DENIED` | Bạn không có quyền. |
| Câu không tồn tại hoặc của người khác | Không lộ sự tồn tại | 404 `INTERVIEW_QUESTION_NOT_FOUND` | Không tìm thấy câu hỏi. |
| Sửa khi không ở DRAFT/CHANGES_REQUESTED | — | 409 `INTERVIEW_NOT_EDITABLE` | Câu hỏi đang ở trạng thái không sửa được. |
| Gửi duyệt / rút / ẩn / hiện sai trạng thái (kể cả hai request đồng thời) | Gửi từ DRAFT/CHANGES_REQUESTED; rút từ PENDING; HIDE từ PUBLISHED; UNHIDE từ AUTHOR_HIDDEN | 409 `INTERVIEW_STATE_INVALID` | Không thực hiện được ở trạng thái hiện tại. |
| Gửi duyệt khi chủ đề đã ngừng | — | 409 `INTERVIEW_TOPIC_INACTIVE` | Chủ đề đã ngừng hoạt động. |
| Xóa câu từng công khai hoặc đang `PENDING` | — | 409 `INTERVIEW_NOT_DELETABLE` | Không xóa được câu đã công khai hoặc đang chờ duyệt. |
| Tạo quá nhanh | Tối đa 20 lần tạo/sao chép mỗi phút mỗi người | 429 `INTERVIEW_RATE_LIMITED` | Bạn thao tác quá nhanh, hãy thử lại sau. |
| Redis lỗi khi kiểm nhịp | Không cho qua | 503 `INTERVIEW_STORAGE_UNAVAILABLE` | Dịch vụ đang gián đoạn. Hãy thử lại. |
| Tham số lọc/phân trang sai | `page ≥ 0`, `size` 1–50, enum hợp lệ, `keyword` ≤ 100 | 400 `VALIDATION_ERROR` | — |

### Kế hoạch thực thi

Task đã được người dùng nhận; chi tiết thực hiện và review xem [log](interview-practice.log.md).

### Xong khi

- [x] `InterviewPracticeMigrationTest` (Flyway thuần): CHECK trạng thái mới, ba cột mới, bảng đánh dấu + UNIQUE, dừng khi bảng có dữ liệu.
- [x] `InterviewLifecycleTest` (unit): ma trận mọi chuyển trạng thái hợp lệ/sai của tác giả và Moderator, điều kiện xóa.
- [x] `InterviewContentTest` (unit): Markdown hợp lệ qua; HTML thô, link nguy hiểm, NUL, ảnh trực tiếp và ảnh dạng tham chiếu bị từ chối.
- [x] `AuthorInterviewControllerTest` (`@WebMvcTest`): validation từng trường theo biên trong bảng (gồm `topicId` sai định dạng, `action` thiếu/sai), status 401, mapping mã lỗi, tham số lọc sai.
- [x] `AuthorInterviewIntegrationTest` (DB/security thật): tạo → sửa → gửi → rút → gửi lại; quyền (không phải tác giả; tác giả bị đình chỉ: sửa bị 403 nhưng xóa/ẩn được; tài khoản bị khóa; câu người khác → 404); sao chép; ẩn/hiện; xóa bị từ chối; chủ đề ngừng hoạt động; PATCH `version` cũ → 409; hai request gửi duyệt song song chỉ một thành công. Ma trận trạng thái còn lại nằm ở unit.
- [x] Chạy các lớp trên (cần Docker); full backend do CI chạy khi mở PR.

## Task 1b — Moderator duyệt, trang công khai và đánh dấu

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- Moderator: `GET /api/v1/moderator/interview-questions` (mọi câu trừ `DRAFT`; lọc `status`, `level`, `topicId`, `keyword`; mặc định chờ duyệt; có `authorEligible`, `aiAssisted`), `GET …/{id}` (đủ nội dung + `reviewToken`), `PATCH …/{id}/review {decision: APPROVE|REQUEST_CHANGES, note, reviewToken}`, `PATCH …/{id}/publication {action: HIDE|RESTORE|REMOVE, reason, reviewToken}`.
- Duyệt kiểm lại: tác giả còn đủ điều kiện, chủ đề còn hoạt động. `REQUEST_CHANGES`, `HIDE`, `REMOVE` bắt buộc ghi chú. Ghi `moderation_note`, `reviewed_by/at`; lần duyệt đầu đặt `published_at`.
- Công khai: `GET /api/v1/interview-questions` (`permitAll`; chỉ `PUBLISHED` của tác giả còn hiển thị; lọc `topicId`, `level`, `keyword`, `mark=SAVED|REVIEWED`; sắp xếp mới nhất; phân trang; mỗi mục có nội dung câu hỏi, chủ đề, mức, tác giả và, với người đã đăng nhập, `viewer {reviewed, saved}`), `GET /api/v1/interview-questions/options`, `GET /api/v1/interview-questions/{id}` (`permitAll`; như một mục danh sách (đều có `hasHint`); **không có gợi ý và đáp án mẫu**).
- Cần đăng nhập: `GET /api/v1/interview-questions/{id}/answer` (trả `hint`, `sampleAnswer`); `PUT /api/v1/interview-questions/{id}/mark {reviewed?, saved?}` (đặt đúng giá trị gửi lên, trường thiếu thì giữ nguyên; gọi lặp cho cùng kết quả; `false` đặt mốc về NULL, không xóa dòng; trả `viewer` mới). Ghi bằng **một câu lệnh** `INSERT … ON CONFLICT (user_id, question_id) DO UPDATE` chỉ đụng cột có trong body, nên hai request song song (kể cả lần tạo đầu, kể cả một request đổi `saved` và một request đổi `reviewed`) không mất thay đổi của nhau; cùng một trường thì request commit sau thắng.
- Câu đã lưu/đã ôn mà sau đó bị ẩn/gỡ: dòng đánh dấu giữ nguyên nhưng câu không hiện trong danh sách; hiện lại khi câu công khai trở lại.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| Không phải MODERATOR gọi API moderator | ADMIN không kèm MODERATOR cũng bị từ chối | 401 / 403 `ACCESS_DENIED` | Bạn không có quyền. |
| Câu không tồn tại hoặc đang `DRAFT` (API moderator) | — | 404 `INTERVIEW_QUESTION_NOT_FOUND` | Không tìm thấy câu hỏi. |
| `decision` / `action` / `reviewToken` | Bắt buộc; `decision`/`action` là chuỗi kiểm bằng `@Pattern` với giá trị hợp lệ; token đúng định dạng | 400 `VALIDATION_ERROR` | — |
| `note`/`reason` | Bắt buộc 1–1.000 ký tự cho REQUEST_CHANGES/HIDE/REMOVE; tùy chọn ≤ 1.000 cho APPROVE/RESTORE | 400 `VALIDATION_ERROR` | Hãy ghi lý do (tối đa 1.000 ký tự). |
| `reviewToken` lệch (câu đã đổi từ lúc mở; kể cả hai Moderator đồng thời) | Câu `DRAFT` trả 404 trước khi so token; với câu hiển thị, khóa dòng, so token trước khi xét trạng thái; không áp dụng thay đổi | 409 `INTERVIEW_REVIEW_STALE` | Câu hỏi đã thay đổi. Hãy tải lại trước khi duyệt. |
| Review khi token khớp nhưng câu không `PENDING` | — | 409 `INTERVIEW_STATE_INVALID` | Không thực hiện được ở trạng thái hiện tại. |
| Duyệt khi tác giả mất điều kiện / chủ đề ngừng | Không công khai | 409 `INTERVIEW_AUTHOR_INELIGIBLE` / `INTERVIEW_TOPIC_INACTIVE` | Tác giả không còn đủ điều kiện. / Chủ đề đã ngừng hoạt động. |
| HIDE / RESTORE / REMOVE sai trạng thái | HIDE từ PUBLISHED hoặc AUTHOR_HIDDEN; RESTORE chỉ từ HIDDEN về trạng thái đã nhớ; REMOVE từ PUBLISHED/AUTHOR_HIDDEN/HIDDEN; REMOVED không đổi được nữa | 409 `INTERVIEW_STATE_INVALID` | Không thực hiện được ở trạng thái hiện tại. |
| Câu không công khai hoặc tác giả không còn hiển thị (chi tiết, đáp án, đánh dấu) | — | 404 `INTERVIEW_QUESTION_NOT_FOUND` | Câu hỏi không còn khả dụng. |
| Xem đáp án / đánh dấu / lọc `mark` khi chưa đăng nhập | — | 401 `AUTH_ACCESS_TOKEN_REQUIRED` | Đăng nhập để xem đáp án. |
| Tài khoản bị khóa xem đáp án / đánh dấu / lọc `mark` / gọi API moderator | — | 403 `ACCESS_DENIED` | Bạn không có quyền. |
| Body `mark` | Ít nhất một trong `reviewed`, `saved`; phải là boolean | 400 `VALIDATION_ERROR` khi thiếu cả hai; sai kiểu trả body lỗi 400 của handler chung | — |
| Hai request đánh dấu đồng thời cho cùng câu | Không tạo hai dòng, không trả 500; khác trường thì giữ cả hai thay đổi, cùng trường thì request commit sau thắng | 200 | — |
| Tham số lọc/phân trang sai | `page ≥ 0`, `size` 1–50, enum hợp lệ, `keyword` ≤ 100 | 400 `VALIDATION_ERROR` | — |

### Kế hoạch thực thi

Task đã được người dùng nhận; chi tiết thực hiện và review xem [log](interview-practice.log.md).

### Xong khi

- [x] `InterviewPracticeControllerTest` (`@WebMvcTest`, gộp test Moderator và công khai): validation, 401/403, mapping mã lỗi, tham số lọc sai.
- [x] `InterviewPracticeIntegrationTest` (gồm ca Moderator): duyệt/yêu cầu sửa; hai Moderator duyệt song song (một thành công, một `INTERVIEW_REVIEW_STALE`); `DRAFT` trả 404; tác giả mất điều kiện; ẩn → khôi phục về đúng trạng thái trước; ADMIN không kèm MODERATOR và tài khoản bị khóa → 403.
- [x] `InterviewPracticeIntegrationTest`: Guest xem danh sách/chi tiết và **JSON trả về không có khóa `hint`/`sampleAnswer`**, bị 401 ở `/answer`, `/mark`, `mark=SAVED`; đăng nhập xem đáp án; đánh dấu rồi bỏ, gọi lặp cùng kết quả; lọc `mark`; câu bị ẩn → 404 và biến khỏi danh sách đã lưu, khôi phục thì hiện lại; tác giả bị đình chỉ → câu biến mất; hai request song song lần đầu (một `saved`, một `reviewed`) → một dòng mang cả hai mốc.
- [x] Chạy các lớp trên + `AuthorInterviewIntegrationTest`; full backend do CI.

## Task 1c — AI: sinh câu hỏi cho tác giả và nhận xét câu trả lời

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- **Tác giả:** `POST /api/v1/author/interview-questions/ai/drafts` — body `{topicId, level, instruction, sourceText, count}`. Model sinh `count` câu (câu hỏi, đáp án mẫu, gợi ý); mỗi câu qua đúng validation của 1a, câu đạt được **lưu thành `DRAFT`** của tác giả với `ai_assisted = true` (cờ do server đặt, một chiều; Tác giả và Moderator thấy, người học không thấy); trả danh sách câu vừa tạo. Tác giả sửa rồi mới gửi duyệt như câu thường. Không stream.
- Ngữ cảnh gửi model: tên chủ đề, mức, `instruction`, `sourceText`, tối đa 20 câu hỏi gần nhất của chính tác giả trong chủ đề đó (để tránh trùng). Sau khi model trả kết quả: kiểm lại tác giả còn đủ điều kiện và chủ đề còn hoạt động rồi mới lưu, tất cả câu đạt lưu trong một transaction.
- **Người học:** `POST /api/v1/interview-questions/{id}/feedback` — body `{answer}`; model so câu trả lời với đáp án mẫu và trả JSON: `verdict` (`GOOD` / `PARTIAL` / `OFF_TRACK`), `strengths` (0–3 ý), `missing` (0–5 ý), `advice` (một đoạn 1–800 ký tự). **Không lưu** câu trả lời lẫn nhận xét, không trả lại đáp án mẫu. Không stream. Quyền và trạng thái câu chỉ kiểm trước khi gọi model; câu bị ẩn trong lúc chờ thì kết quả vẫn trả (không có gì được lưu).
- Kiểm kết quả model: sinh câu trả nhiều hơn `count` thì chỉ lấy `count` câu đầu; `strengths`/`missing` bỏ phần tử rỗng, quá 3/5 ý thì cắt lấy phần đầu, mỗi ý sau trim tối đa 300 ký tự; ý quá dài, `advice` rỗng hoặc quá 800, `verdict` lạ → coi là sai định dạng.
- Quota: `INTERVIEW_DRAFT` mặc định 10 lần/ngày/tác giả (`AI_INTERVIEW_DRAFT_PER_DAY`); `INTERVIEW_FEEDBACK` mặc định 20 lần/ngày/người (`AI_INTERVIEW_FEEDBACK_PER_DAY`); cả hai dùng chung `burst-per-minute`. Hoàn lượt khi lỗi nhà cung cấp, hết giờ, kết quả không dùng được; hoàn lượt là **cố gắng một lần** theo `AiRateLimitService.refund` hiện có: Redis lỗi đúng lúc hoàn thì lượt đó mất và chỉ ghi log, lỗi gốc vẫn trả cho người dùng.
- Quota hiển thị: `GET /api/v1/author/ai/quota` thêm trường `interviewDraft`; endpoint mới `GET /api/v1/me/interview-feedback/quota` (đăng nhập) trả `{limit, remaining}` chỉ đọc không trừ; phản hồi nhận xét mang header lượt còn lại như endpoint dàn ý. `/answer` của 1b **không đổi** ở task này.
- Sinh câu dùng temperature 0.5: định nghĩa ba mức EASY/MEDIUM/HARD, mỗi câu một yêu cầu; có `sourceText` thì chỉ dùng nguồn đó; đáp án 3–6 ý chính xác, hint không lộ đáp án. Lấy `count` câu đầu rồi kiểm, lọc câu trùng nhau hoặc trùng câu cũ của tác giả (bỏ qua hoa/thường, khoảng trắng).
- Nhận xét dùng temperature 0.2, chỉ chấm theo ý trong đáp án mẫu, không trừ ý đúng ngoài đáp án; xử lý không biết/lạc đề, verdict khớp danh sách và có ví dụ cho ba mức. Sai định dạng, không câu nào đạt hoặc nhận xét sai luật đều được sửa một lần trước khi trả 422.
- Mỗi người một lượt AI của module chạy cùng lúc, giữ chỗ bằng `AiGenerationRegistry` hiện có: dùng chung chỗ với các luồng đã đăng ký vào đó (hiện là stream bản nháp bài viết), **không** gồm dàn ý bài viết. Registry nằm trong bộ nhớ một tiến trình nên chỉ đúng khi chạy một instance backend (cách triển khai hiện tại).

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| `topicId`, `level` (sinh câu) | Như 1a | Như 1a | Như 1a |
| `instruction` | Tùy chọn, ≤ 500 ký tự | 400 `VALIDATION_ERROR` | Yêu cầu tối đa 500 ký tự. |
| `sourceText` | Tùy chọn, ≤ 8.000 ký tự | 400 `VALIDATION_ERROR` | Nội dung nguồn tối đa 8.000 ký tự. |
| `count` | Bắt buộc, số nguyên 1–5 (`BigDecimal` + `@Digits`) | 400 `VALIDATION_ERROR` | Số câu từ 1 đến 5. |
| Quyền sinh câu | Role AUTHOR, hồ sơ `APPROVED`, tài khoản hoạt động; kiểm trước khi gọi model và kiểm lại trước khi lưu (mất quyền trong lúc chờ → lỗi, hoàn lượt, không lưu câu nào) | 401 / 403 `ACCESS_DENIED` | Bạn không có quyền. |
| Chủ đề ngừng trong lúc chờ model | Hoàn lượt, không lưu | 409 `INTERVIEW_TOPIC_INACTIVE` | Chủ đề đã ngừng hoạt động. |
| Trả ít câu đạt hơn yêu cầu nhưng có câu đạt | Vẫn thành công, trừ một lượt, lưu các câu đạt | 200 | AI tạo được {n}/{count} câu. |
| `answer` (nhận xét) | Sau trim 1–4.000 ký tự | 400 `VALIDATION_ERROR` | Câu trả lời từ 1 đến 4.000 ký tự. |
| Nhận xét khi chưa đăng nhập / tài khoản bị khóa | — | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / 403 `ACCESS_DENIED` | Đăng nhập để luyện trả lời. / Bạn không có quyền. |
| Nhận xét câu không công khai hoặc tác giả không còn hiển thị | Không gọi model, không trừ lượt | 404 `INTERVIEW_QUESTION_NOT_FOUND` | Câu hỏi không còn khả dụng. |
| Quá nhịp / hết lượt ngày (cả hai endpoint) | — | 429 `AI_RATE_LIMITED` / `AI_QUOTA_EXCEEDED` | Bạn thao tác quá nhanh. / Bạn đã dùng hết lượt AI hôm nay. |
| Sau một lần sửa vẫn sai định dạng, không câu nào đạt hoặc nhận xét thiếu trường/sai `verdict` | Hoàn lượt | 422 `AI_OUTPUT_INVALID` | AI trả về nội dung không dùng được. Hãy thử lại. |
| Bị cắt do giới hạn token | Hoàn lượt | 422 `AI_OUTPUT_TRUNCATED` | Kết quả bị cắt. Hãy thử lại với nội dung ngắn hơn. |
| Đọc quota khi Redis lỗi (`…/interview-feedback/quota`) | Giao diện ẩn số lượt, nút nhận xét vẫn dùng được | 503 `AI_STORAGE_UNAVAILABLE` | — |
| Lỗi nhà cung cấp / hết giờ / chưa cấu hình / Redis lỗi | Hoàn lượt một lần (trừ khi chưa giữ lượt); hoàn thất bại thì chỉ ghi log | 502 `AI_PROVIDER_UNAVAILABLE`, `AI_PROVIDER_REQUEST_REJECTED` / 503 `AI_PROVIDER_AUTH_FAILED`, `AI_PROVIDER_RATE_LIMITED`, `AI_STORAGE_UNAVAILABLE` / 504 `AI_TIMEOUT` / `AI_CONFIGURATION_INVALID` (HTTP theo `ErrorCode` hiện có) | Dịch vụ AI đang gián đoạn. Hãy thử lại. |
| Đang có một lượt AI khác của chính người này | Giữ chỗ trước khi trừ lượt, nhả trong `finally`; request sau bị từ chối, không trừ lượt | 409 `AI_GENERATION_IN_PROGRESS` | AI đang xử lý yêu cầu trước. |

### Kế hoạch thực thi

Task đã được người dùng nhận; chi tiết thực hiện và review xem [log](interview-practice.log.md).

### Xong khi

- [x] `InterviewAiServiceTest` (unit, model giả): sinh câu thành công và lưu `DRAFT` có `ai_assisted`; loại câu không đạt; không câu nào đạt → hoàn lượt, không lưu; mất quyền/chủ đề ngừng trong lúc chờ → hoàn lượt, không lưu; nhận xét thành công trừ một lượt; model trả thừa câu → chỉ lấy `count`; nhận xét sai định dạng/`verdict` lạ/`advice` rỗng hoặc quá dài → hoàn lượt; thừa ý thì cắt; từng dòng lỗi nhà cung cấp/hết giờ/bị cắt; hoàn lượt thất bại vẫn trả lỗi gốc; lượt đồng thời bị chặn và chỗ giữ được nhả khi lỗi.
- [x] `AiPromptFactoryTest`: hai prompt chứa đủ ngữ cảnh dạng dữ liệu và schema đúng.
- [x] `AuthorInterviewIntegrationTest`, `InterviewPracticeIntegrationTest` thêm 4–5 ca: quyền sinh câu; quota hết → 429; Guest gọi nhận xét và đọc quota → 401; tài khoản hợp lệ gọi nhận xét thành công qua HTTP (model giả) và quota giảm một; câu bị ẩn → 404 không trừ lượt; API quota tác giả trả thêm `interviewDraft` và giữ nguyên trường cũ.
- [x] Chạy thêm các lớp `Ai*` dùng `AiRateLimitService`/`AiAssistProperties`. Test tự động không gọi model thật.
- [ ] Kiểm prompt mới qua ứng dụng với Groq thật sau khi khởi động lại backend (chưa kiểm — xem log); prompt mới đã được thử trực tiếp với Groq.

## Giao diện

Bỏ cổng wireframe cho module này theo quyết định 2026-11-20. Gemini thực hiện Task 2a và 2b theo `plans/interview-practice.gemini-prompt.md`, không sửa backend; Claude review và sửa.

## Task 2a — Giao diện Tác giả và Moderator

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- `/author/interview-questions` (danh sách của tôi: lọc trạng thái/mức/chủ đề, badge trạng thái, nhãn “Có dùng AI”, ghi chú của Moderator khi bị trả về, nút Tạo/Sửa/Sao chép/Ẩn/Hiện/Xóa theo trạng thái), `/author/interview-questions/new`, `/author/interview-questions/:id/edit` (chủ đề, mức, câu hỏi, đáp án mẫu, gợi ý; xem trước Markdown; Lưu / Gửi duyệt / Rút).
- Hộp thoại “Tạo câu hỏi bằng AI” ở trang danh sách: chọn chủ đề, mức, số câu, nhập yêu cầu, dán nội dung nguồn; thành công thì danh sách tải lại và các bản nháp mới được làm nổi bật; hiện lượt AI còn lại.
- `/moderator/interview-questions` (danh sách theo chuẩn màn duyệt hiện có, không có ô số liệu; bộ lọc; mặc định “Chờ duyệt”; nhãn “Có dùng AI”; cảnh báo tác giả không còn đủ điều kiện), `/moderator/interview-questions/:id` (xem câu hỏi, gợi ý, đáp án mẫu; Duyệt / Yêu cầu sửa; Ẩn / Khôi phục / Gỡ với hộp thoại nhập lý do).
- Validation phía client dẫn chiếu bảng 1a, 1b, 1c; rời trang soạn khi chưa lưu có cảnh báo; thêm mục vào nhóm Tác giả của sidebar và sidebar Moderator.

### Kế hoạch thực thi

Task đã được người dùng nhận; chi tiết thực hiện và review xem [log](interview-practice.log.md).

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Menu Tác giả / Moderator | Câu hỏi phỏng vấn | Interview questions |
| Mức | Dễ / Vừa / Khó | Easy / Medium / Hard |
| Trạng thái | Bản nháp / Chờ duyệt / Đang công khai / Cần sửa / Đã ẩn / Bị ẩn bởi kiểm duyệt / Đã gỡ | Draft / Pending / Published / Changes requested / Hidden / Hidden by moderator / Removed |
| Trường | Chủ đề / Mức độ / Câu hỏi / Đáp án mẫu / Gợi ý (không bắt buộc) | Topic / Level / Question / Sample answer / Hint (optional) |
| Hành động Tác giả | Tạo câu hỏi / Lưu / Gửi duyệt / Rút lại / Tạo bản sao / Ẩn / Hiện lại / Xóa | New question / Save / Submit / Withdraw / Duplicate / Hide / Unhide / Delete |
| Hành động Moderator | Duyệt / Yêu cầu sửa / Ẩn / Khôi phục / Gỡ | Approve / Request changes / Hide / Restore / Remove |
| Không sửa được | Câu đã công khai không sửa được. Hãy tạo bản sao để chỉnh sửa. | Published questions cannot be edited. Duplicate to make changes. |
| AI | Tạo câu hỏi bằng AI / AI tạo được {n}/{count} câu, đã lưu thành bản nháp. Hãy kiểm tra trước khi gửi duyệt. | Generate with AI / AI produced {n}/{count} questions, saved as drafts. Review before submitting. |
| Nhãn | Có dùng AI / Tác giả không còn đủ điều kiện | AI-assisted / Author is no longer eligible |
| Chưa lưu | Bạn có thay đổi chưa lưu. Rời trang? | You have unsaved changes. Leave? |

Câu hiển thị cho từng mã lỗi lấy từ cột “Copy hiển thị” của bảng 1a/1b/1c; bản tiếng Anh dịch tương ứng trong `interviewI18n`.

### UI

- Theo `plans/interview-practice.gemini-prompt.md` và `UI_GUIDE.md`; primitive và token hiện có, không thêm màu mới. Trạng thái: tải, rỗng, lỗi, đang lưu, chỉ đọc (câu đã công khai/chờ duyệt). Desktop và mobile 390px không cuộn ngang.

### Xong khi

- [x] Test unit validation theo bảng 1a/1c (biên như test backend) và mapping mọi mã lỗi 1a/1b/1c liên quan vi/en.
- [x] `Author/InterviewQuestions/*.test.tsx`: tạo → lưu → gửi; câu chỉ đọc; sao chép; ẩn/hiện; xóa; `version` lệch; hộp thoại AI thành công và các lỗi AI; cảnh báo chưa lưu.
- [x] `Moderator/InterviewQuestions/*.test.tsx`: danh sách + lọc; duyệt; yêu cầu sửa thiếu lý do; ẩn/khôi phục/gỡ; token lệch.
- [x] Test `Sidebar`, `ModeratorSidebar`, `App` bị sửa + `npm run build` trong `app/` (không chạy full `npm test`).
- [ ] Kiểm bằng mắt: dark/light × desktop/mobile; đã kiểm mobile dark, còn desktop light/dark, mobile light và hộp thoại AI tác giả trên trình duyệt (chưa kiểm — xem log).

## Task 2b — Trang “Ôn phỏng vấn” của người học

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- Cả hai route dưới bọc `ReaderRoute` (tài khoản ADMIN/MODERATOR bị chuyển về dashboard như các trang người đọc khác), không bọc `AuthRoute`.
- `/interview` (công khai): danh sách câu hỏi dạng thẻ; lọc chủ đề, mức, từ khóa; với người đã đăng nhập thêm bộ lọc “Đã lưu” / “Đã ôn” và nút lưu ngay trên thẻ; phân trang; bộ lọc nằm trên URL.
- `/interview/:id` (công khai): câu hỏi, chủ đề, mức, tác giả. Guest thấy lời mời đăng nhập (giữ `returnTo`) thay cho phần đáp án. Đã đăng nhập: nút “Xem gợi ý” (nếu có), “Xem đáp án mẫu”, “Đánh dấu đã ôn”, “Lưu lại”. Lần bấm đầu vào một trong hai nút xem mới gọi `/answer` (một lần, giữ trong bộ nhớ trang); bấm “Xem gợi ý” chỉ hiện gợi ý, đáp án vẫn ẩn tới khi bấm “Xem đáp án mẫu”.
- Khối “Luyện trả lời”: ô nhập câu trả lời (đếm ký tự, tối đa 4.000), nút “Nhận xét bằng AI”, lượt còn lại trong ngày; kết quả hiện nhãn mức đạt, các ý làm tốt, các ý còn thiếu, lời khuyên; nhận xét mất khi rời trang. Lỗi tạm thời có nút “Thử lại”. Lượt còn lại lấy từ endpoint quota khi người đã đăng nhập mở trang và cập nhật theo header của mỗi phản hồi nhận xét; đọc quota lỗi thì ẩn số, nút vẫn dùng được; còn 0 lượt hoặc nhận `AI_QUOTA_EXCEEDED` thì khóa nút và hiện thông báo hết lượt.
- Thêm mục “Ôn phỏng vấn” vào sidebar người dùng.

### Kế hoạch thực thi

Task đã được người dùng nhận; chi tiết thực hiện và review xem [log](interview-practice.log.md).

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Menu / tiêu đề | Ôn phỏng vấn | Interview prep |
| Bộ lọc | Chủ đề / Mức độ / Tìm câu hỏi / Đã lưu / Đã ôn | Topic / Level / Search questions / Saved / Reviewed |
| Hành động | Xem gợi ý / Xem đáp án mẫu / Đánh dấu đã ôn / Bỏ đánh dấu / Lưu lại / Bỏ lưu | Show hint / Show sample answer / Mark as reviewed / Unmark / Save / Unsave |
| Guest | Đăng nhập để xem đáp án mẫu và luyện trả lời. | Sign in to see the sample answer and practice. |
| Luyện trả lời | Luyện trả lời / Gõ câu trả lời của bạn… / Nhận xét bằng AI / Còn {n} lượt hôm nay | Practice / Type your answer… / Get AI feedback / {n} left today |
| Mức đạt | Trả lời tốt / Đúng một phần / Chưa đúng trọng tâm | Good answer / Partly correct / Off track |
| Kết quả | Bạn làm tốt / Còn thiếu / Lời khuyên | What you did well / What is missing / Advice |
| Lưu ý AI | Nhận xét do AI tạo, có thể chưa chính xác. Hãy đối chiếu với đáp án mẫu. | Feedback is AI-generated and may be inaccurate. Compare with the sample answer. |
| Rỗng | Chưa có câu hỏi phù hợp. | No matching questions. |
| Không còn | Câu hỏi không còn khả dụng. | This question is no longer available. |

Câu hiển thị cho từng mã lỗi lấy từ bảng 1b/1c; bản tiếng Anh trong `interviewI18n`.

### UI

- Theo `plans/interview-practice.gemini-prompt.md` và `UI_GUIDE.md`; primitive và token hiện có, không thêm màu mới. Trạng thái: tải, rỗng, lỗi, Guest, đang chờ AI, hết lượt. Mobile 390px: bộ lọc xếp dọc, không cuộn ngang, vùng chạm 44px.

### Xong khi

- [x] Test unit: validation câu trả lời biên 0/4.000/4.001 và mapping mọi mã lỗi 1b/1c liên quan vi/en.
- [x] `Interview/*.test.tsx` (luồng chính): danh sách + lọc trên URL; Guest thấy lời mời đăng nhập và không gọi `/answer`; bấm “Xem gợi ý” chỉ hiện gợi ý, bấm tiếp mới hiện đáp án, `/answer` gọi một lần; đánh dấu và hoàn lại khi lỗi; gửi câu trả lời → hiện nhận xét và lượt còn lại; một lỗi AI tạm thời có “Thử lại”; hết lượt khóa nút; câu không còn khả dụng.
- [x] Test `Sidebar`, `App` bị sửa (gồm ADMIN/MODERATOR vào `/interview` bị chuyển về dashboard) + `npm run build` trong `app/` (không chạy full `npm test`).
- [ ] Kiểm bằng mắt: dark/light × desktop/mobile; đã kiểm desktop light và mobile dark, còn desktop dark và mobile light (chưa kiểm — xem log).

## Chi tiết đồng bộ từ log

- Task 1a: vòng đời nằm trong entity `InterviewQuestion`; `InterviewLifecycleTest` gọi thẳng entity. `topicId` là chuỗi kiểm UUID bằng `@Pattern`, sai định dạng trả 400 `VALIDATION_ERROR`; NUL trong `question`/`sampleAnswer`/`hint` trả 400 `INTERVIEW_CONTENT_INVALID`. Rút/ẩn/xóa cần tài khoản hoạt động và hồ sơ tác giả ở mọi trạng thái; hiện lại, tạo, sửa, gửi, sao chép và options dùng `lockWriter`. Kiểm mã 401 cụ thể ở integration test; `@WebMvcTest` chỉ kiểm status. Rate limit dùng Lua nội tuyến, khóa `interview:rate:create:<user>`, không thêm script Redis hoặc sửa module bài tập.
- Task 1b: danh sách Moderator dùng lại `InterviewQuestionRequest.Filter`; `hasHint` có cả trong danh sách công khai. Ca Guest ở route `permitAll` kiểm bằng integration test vì `@WebMvcTest` không nạp `SecurityConfiguration`.

## Ghi chú thay đổi ngoài module: exercise-practice

- AI sinh bài tập dùng temperature 0.4; server xáo bốn đáp án và tính lại `correctIndex`, lọc câu trùng nhau hoặc trùng câu có sẵn (không phân biệt hoa/thường, khoảng trắng, so 200 ký tự đầu; flashcard so `front`). Prompt yêu cầu đáp án nhiễu gần đáp án đúng hơn khi độ khó tăng, câu và đáp án dài ngắn theo nội dung nhưng không cụt, không dùng “Tất cả các đáp án trên”, giải thích khớp đáp án đúng; có luật độ khó, hành vi theo hệ cụ thể, `sourceText`, code và flashcard.
- AI kiểm chéo lần hai temperature 0 trong cùng lượt và deadline: chỉ giữ index được xác nhận, thiếu index thì loại; đọc lỗi hoặc không còn câu trả `AI_OUTPUT_INVALID` và hoàn lượt. `exercise-timeout` mặc định 90 giây. Đã thử AI thật; kiểm chéo vẫn có thể bỏ sót câu nhiều đáp án đúng, xem log.

## Câu hỏi mở cần người dùng chốt

- (không có — sáu câu hỏi mở đã chốt giữ mặc định, xem mục dưới)

## Quyết định của người dùng

**Người dùng chốt spec 2026-11-15** (Task 1a–1c, 2a–2b; cổng wireframe sau đó được bỏ cho module này). Lịch sử phản biện: [`interview-practice.review.md`](interview-practice.review.md).

- Sáu câu hỏi mở giữ mặc định: câu đã công khai không sửa (tạo bản sao); AI của tác giả lưu thẳng thành bản nháp có nhãn, 5 câu/lần, 10 lần/ngày; AI nhận xét theo mức đạt + ý làm tốt + ý còn thiếu + lời khuyên, không điểm số, câu trả lời tối đa 4.000 ký tự; gợi ý cần đăng nhập; đường dẫn `/interview`, tên mục “Ôn phỏng vấn”.
- Câu 5: **Admin/Moderator không vào trang Ôn phỏng vấn** (bọc `ReaderRoute` như trang bài viết, khóa học); tài khoản người đọc đã đăng nhập, kể cả tác giả với câu của mình, dùng đủ tính năng.
- Phần Claude sửa thân spec sau vòng 1 chưa qua Codex soát vòng 2.
