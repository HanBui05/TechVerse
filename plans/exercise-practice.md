# Exercise practice — bài tập trắc nghiệm và flashcard, có AI hỗ trợ tác giả

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Claude viết (D-030); Codex chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Tác giả đã duyệt soạn bộ bài tập (trắc nghiệm hoặc flashcard), có thể nhờ AI sinh câu hỏi rồi sửa; Moderator duyệt trước khi công khai; người học làm bài ở khu “Luyện tập”, xem điểm, đáp án, giải thích và lịch sử các lần làm.
**Làn:** Đầy đủ · **Rủi ro:** thường. Review vòng 1 dùng `review`.
**Thứ tự:** 1a → 1b → 1c (Backend) → cổng wireframe → 2a → 2b → 2c (Giao diện). Chỉ mở Giao diện sau khi toàn bộ Backend xong và đã review.
**Nguồn quyết định:** câu B1–B10 trong [`roadmap.questions.md`](roadmap.questions.md) (người dùng trả lời 2026-11-14).

## Hiện trạng đã đối chiếu (2026-11-14)

- V1 có sẵn `exercise_sets` (tác giả, chủ đề, tiêu đề, mô tả, `exercise_type` gồm `MULTIPLE_CHOICE`/`FLASHCARD`/`CODE_BUG_FINDING`/`DEBUG_SCENARIO`, `difficulty` EASY/MEDIUM/HARD, `time_limit_seconds`, `status` DRAFT/PENDING/PUBLISHED/CHANGES_REQUESTED/HIDDEN/REMOVED, `moderation_note`, `reviewed_by/at`, `published_at`); `exercise_questions` (`content`, `code_snippet`, `code_language`, `options` jsonb mảng, `answer` không rỗng, `explanation` NOT NULL, `position` duy nhất trong bộ); `exercise_attempts` (`attempt_snapshot` jsonb object, `correct_count`/`total_count`, `duration_seconds`, `completed_at`).
- Trigger `prevent_exercise_set_delete_with_attempts`: bộ đã có lượt làm không xóa cứng được. Index sẵn: `exercise_sets(topic_id, status)`, `exercise_attempts(user_id, completed_at DESC)`.
- Loại bài gắn **cho cả bộ**, không theo từng câu. Chưa có entity, API hay trang nào cho bài tập. Bộ bài tập **không có cơ chế phiên bản** như bài viết/khóa học.
- Dùng lại được: mẫu service/controller Author–Moderator của bài viết; `AiOutlineService` (gọi model trả JSON theo schema, có sửa lỗi định dạng, không stream); `AiRateLimitService`; `ReaderRoute`/`RoleRoute` và khung trang Author/Moderator ở frontend.

## Đường dẫn thuộc module

- `server/src/main/resources/db/migration/V<n>__exercise_practice.sql` (tạo; `<n>` là số kế tiếp lúc code, V14 nếu V13 của `course-payment` đã có).
- `server/src/main/java/com/techverse/server/{controller,entity,enums,dto,repository,service}/**/*Exercise*.java` (tạo); `configuration/SecurityConfiguration.java`, `exception/ErrorCode.java`.
- `server/src/main/java/com/techverse/server/service/impl/{AiPromptFactory,AiRateLimitService}.java`, `properties/AiAssistProperties.java`, `server/src/main/resources/application*.yaml`, `.env.example` (Task 1c).
- `server/src/test/java/com/techverse/server/exercise/**` (tạo) và test trực tiếp của file dùng chung bị sửa (`ai/**`).
- `plans/exercise-practice.wireframe.md` (tạo ở cổng wireframe).
- `app/src/pages/{Practice,Author/Exercises,Moderator/Exercises}/**` và test (tạo); `app/src/{types/exercises.ts,services/exerciseService.ts,data/exerciseI18n.ts}` và test (tạo).
- `app/src/{App.tsx,App.*.test.tsx}`, `app/src/data/{navigation,managementI18n}.ts`, `app/src/components/layout/{Sidebar,ModeratorSidebar}.tsx` và test trực tiếp; `app/src/components/ui/{sidebar,labels,focus}*.test.*` khi sửa shell.

## Ngoài phạm vi

- Loại `CODE_BUG_FINDING`, `DEBUG_SCENARIO` (giữ trong schema, API từ chối); câu tự luận; chấm bằng AI; AI giải thích cho người học (mỗi câu trắc nghiệm đã có giải thích bắt buộc).
- Tính giờ, giới hạn số lần làm, bảng xếp hạng, thống kê điểm mạnh/yếu theo chủ đề, lặp lại ngắt quãng cho flashcard.
- Gắn bài tập vào bài học của khóa; bài tập trả phí; bình luận, báo cáo vi phạm, lưu bộ bài tập.
- Phiên bản hóa bộ bài tập, lịch sử kiểm duyệt nhiều dòng (chỉ lưu lần duyệt gần nhất như schema hiện có), ảnh trong câu hỏi, nhập từ file.
- Thông báo cho tác giả khi được duyệt/trả về; số liệu dashboard.

## Ràng buộc chung

- Được đổi API: Có. Được đổi DB: Có, chỉ bằng một migration mới; không sửa V1–V13. Giữ `ApiResponse`/`ErrorResponse`.
- Mỗi bộ một loại: `MULTIPLE_CHOICE` hoặc `FLASHCARD`; không đổi loại sau khi tạo. `time_limit_seconds` luôn NULL và không xuất hiện trong API.
- **Bộ đã công khai không sửa nội dung** (không có phiên bản; lượt làm cũ đã chụp nội dung lúc làm). Muốn sửa: tác giả “Tạo bản sao” thành bản nháp mới, gửi duyệt lại, rồi tự ẩn bộ cũ.
- Đáp án và giải thích của bộ trắc nghiệm **không bao giờ** rời server trước khi người học nộp bài; server chấm, client không tự chấm.
- Mỗi lượt làm lưu `attempt_snapshot` gồm đủ câu hỏi, lựa chọn, đáp án đúng, giải thích và câu trả lời của người học tại thời điểm nộp, để xem lại được kể cả khi bộ bị ẩn/gỡ.
- Vai trò: Guest xem danh sách và trang giới thiệu bộ. Tài khoản đã đăng nhập không mang role ADMIN/MODERATOR được làm bài (kể cả tác giả làm bộ của người khác). Chủ bộ không làm bộ của chính mình (xem trước trong trình soạn). ADMIN/MODERATOR không làm bài (cùng luật không học khóa); ADMIN chỉ duyệt nếu đồng thời có role MODERATOR.
- Tác giả bị đình chỉ (`author_profiles.status = SUSPENDED`) hoặc tài khoản bị khóa: không tạo/sửa/gửi duyệt; bộ đã công khai của họ không hiện ở khu Luyện tập (cùng luật hiển thị bài viết). Vẫn xem và xóa được bộ của mình.
- Chủ đề phải đang hoạt động khi lưu, gửi duyệt và khi Moderator duyệt.
- Markdown trong `content`/`explanation`/mặt flashcard dùng cùng bộ kiểm của bài viết (cấm HTML thô, link nguy hiểm, NUL); không hỗ trợ ảnh.
- Mọi thao tác đổi trạng thái khóa dòng bộ bài tập trong transaction; hai request đồng thời chỉ một request thắng, request kia nhận lỗi trạng thái.

### Trạng thái bộ bài tập

`DRAFT` → (gửi duyệt) `PENDING` → (duyệt) `PUBLISHED` hoặc (yêu cầu sửa) `CHANGES_REQUESTED` → (gửi lại) `PENDING`. Tác giả rút `PENDING` → `DRAFT`. Từ `PUBLISHED`: tác giả ẩn → `AUTHOR_HIDDEN` (giá trị mới) và hiện lại; Moderator ẩn → `HIDDEN` (nhớ trạng thái trước đó) và khôi phục về đúng trạng thái trước; Moderator gỡ → `REMOVED` (cuối cùng). Chỉ `PUBLISHED` hiện ở khu Luyện tập.

## Task 1a — Schema, API tác giả và vòng đời

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- Migration: thêm `AUTHOR_HIDDEN` vào CHECK `status`; cột `hidden_from_status` (NULL trừ khi `HIDDEN`), `ai_assisted boolean NOT NULL DEFAULT false`, `version integer NOT NULL DEFAULT 0` (khóa lạc quan + review token); CHECK `time_limit_seconds IS NULL`; dừng nếu bảng đã có dữ liệu (không backfill, D-022).
- `POST /api/v1/author/exercise-sets` (tạo DRAFT: `title`, `description`, `topicId`, `type`, `difficulty`), `GET /api/v1/author/exercise-sets` (của mình, lọc `status`, `type`, `keyword`, phân trang), `GET …/{id}` (kèm toàn bộ câu hỏi và đáp án), `PATCH …/{id}` (metadata, không đổi `type`), `PUT …/{id}/questions` (thay **toàn bộ** danh sách câu theo thứ tự gửi lên, một transaction), `POST …/{id}/submit`, `POST …/{id}/withdraw`, `PATCH …/{id}/visibility {action: HIDE|UNHIDE}`, `POST …/{id}/copy` (tạo DRAFT mới cùng nội dung, tiêu đề thêm “(bản sao)” cắt ở 255 ký tự, `ai_assisted` giữ nguyên), `DELETE …/{id}`, `GET /api/v1/author/exercise-sets/options` (chủ đề đang hoạt động).
- Sửa metadata/câu hỏi chỉ khi `DRAFT` hoặc `CHANGES_REQUESTED`. Xóa: xóa cứng khi chưa từng công khai (`published_at IS NULL`) và không ở `PENDING`; bộ từng công khai không xóa (tác giả dùng ẩn).
- Câu trắc nghiệm: `content`, `codeSnippet`/`codeLanguage` tùy chọn, `options` 2–6 chuỗi, `correctIndex`, `explanation` bắt buộc. Lưu `answer` = chỉ số đáp án đúng dạng chuỗi. Thẻ flashcard: `front` (→ `content`), `back` (→ `answer`), `explanation` tùy chọn (rỗng lưu `""`), `options` NULL.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| `title` | Sau trim 5–255 ký tự | 400 `VALIDATION_ERROR` | Tiêu đề từ 5 đến 255 ký tự. |
| `description` | 0–2.000 ký tự; mặc định `""` | 400 `VALIDATION_ERROR` | Mô tả tối đa 2.000 ký tự. |
| `topicId` | Bắt buộc; tồn tại và đang hoạt động | 400 `VALIDATION_ERROR` / 409 `EXERCISE_TOPIC_INACTIVE` | Hãy chọn chủ đề. / Chủ đề đã ngừng hoạt động. |
| `type` | `MULTIPLE_CHOICE` hoặc `FLASHCARD`; giá trị khác (kể cả hai loại chưa hỗ trợ) bị từ chối; không đổi khi PATCH | 400 `VALIDATION_ERROR` | Loại bài tập không hợp lệ. |
| `difficulty` | EASY/MEDIUM/HARD | 400 `VALIDATION_ERROR` | Hãy chọn độ khó. |
| Số câu khi lưu | 0–50 câu; quá 50 bị từ chối cả request | 400 `EXERCISE_QUESTIONS_INVALID` | Mỗi bộ tối đa 50 câu. |
| Câu trắc nghiệm | `content` 1–2.000; `options` 2–6, mỗi lựa chọn sau trim 1–500 và không trùng nhau; `correctIndex` nằm trong danh sách; `explanation` 1–2.000; `codeSnippet` ≤ 5.000, có snippet thì `codeLanguage` 1–50 | 400 `EXERCISE_QUESTIONS_INVALID` (`fieldErrors` theo `questions[i].<trường>`) | Câu {n}: thông tin chưa hợp lệ. |
| Thẻ flashcard | `front`, `back` sau trim 1–1.000; `explanation` ≤ 2.000; không nhận `options`/`correctIndex` | 400 `EXERCISE_QUESTIONS_INVALID` | Thẻ {n}: thông tin chưa hợp lệ. |
| Nội dung Markdown | HTML thô, link nguy hiểm, ký tự NUL | 400 `EXERCISE_CONTENT_INVALID` | Nội dung chứa định dạng không được hỗ trợ. |
| Chưa đăng nhập / token sai | — | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` | Đăng nhập để tiếp tục. |
| Không có role AUTHOR, hồ sơ tác giả không `APPROVED`, tài khoản bị khóa (thao tác ghi) | Đọc và xóa bộ của mình vẫn được khi bị đình chỉ | 403 `ACCESS_DENIED` | Bạn không có quyền. |
| Bộ không tồn tại hoặc của người khác | Không lộ sự tồn tại | 404 `EXERCISE_SET_NOT_FOUND` | Không tìm thấy bộ bài tập. |
| Sửa khi không ở DRAFT/CHANGES_REQUESTED | — | 409 `EXERCISE_NOT_EDITABLE` | Bộ bài tập đang ở trạng thái không sửa được. |
| Gửi duyệt khi chưa đủ | Trắc nghiệm ≥ 3 câu, flashcard ≥ 5 thẻ; mọi câu hợp lệ; chủ đề còn hoạt động | 409 `EXERCISE_NOT_READY` | Bộ bài tập chưa đủ điều kiện gửi duyệt. |
| Gửi duyệt sai trạng thái (kể cả gửi hai lần đồng thời) | Chỉ từ DRAFT/CHANGES_REQUESTED | 409 `EXERCISE_STATE_INVALID` | Không thực hiện được ở trạng thái hiện tại. |
| Rút khi không `PENDING` | Kể cả Moderator vừa duyệt xong | 409 `EXERCISE_STATE_INVALID` | Không thực hiện được ở trạng thái hiện tại. |
| Ẩn/hiện của tác giả | HIDE chỉ từ `PUBLISHED`; UNHIDE chỉ từ `AUTHOR_HIDDEN`; bộ do Moderator ẩn/gỡ thì không | 409 `EXERCISE_STATE_INVALID` | Không thực hiện được ở trạng thái hiện tại. |
| Xóa bộ từng công khai hoặc đang `PENDING` | — | 409 `EXERCISE_NOT_DELETABLE` | Không xóa được bộ đã công khai hoặc đang chờ duyệt. |
| Hai request sửa cùng lúc | Khóa dòng; request sau áp lên dữ liệu mới nhất, không mất câu | 200 | — |
| Tạo quá nhanh | Tối đa 10 lần tạo/sao chép mỗi phút mỗi người | 429 `EXERCISE_RATE_LIMITED` | Bạn thao tác quá nhanh, hãy thử lại sau. |

### Kế hoạch thực thi

- **File cần đụng:** migration; entity `ExerciseSet`, `ExerciseQuestion`; enum loại/độ khó/trạng thái; `AuthorExerciseController` + service + repository; `ExerciseQuestionValidator` (logic thuần); `ExerciseAccessService` (khóa dòng + kiểm chủ sở hữu/trạng thái tác giả); `SecurityConfiguration` thêm `/api/v1/author/exercise-sets/**` authenticated; `ErrorCode`.
- **Phần dùng lại:** kiểm trạng thái tác giả như `CourseAccessService.lockWriter`; bộ kiểm Markdown của `ArticleContentService`; mẫu DTO partial của bài viết cho PATCH; mẫu rate limit Redis theo miền.
- **Bẫy đã biết:** `uq_exercise_questions_set_position` — thay danh sách phải xóa và `flush()` trước khi chèn lại; `options` là jsonb (map bằng `@JdbcTypeCode(SqlTypes.JSON)`); Hibernate `validate` cần kiểu cột khớp entity; `explanation` NOT NULL nên flashcard lưu `""`; trigger chặn xóa khi có lượt làm (không xảy ra với bộ chưa công khai, nhưng lỗi DB phải được ánh xạ thành `EXERCISE_NOT_DELETABLE`, không thành 500).

### Xong khi

- [ ] `ExercisePracticeMigrationTest` (Flyway thuần): CHECK trạng thái mới, ba cột mới, CHECK `time_limit_seconds`, dừng khi bảng có dữ liệu.
- [ ] `ExerciseQuestionValidatorTest` (unit): từng dòng của hai hàng “Câu trắc nghiệm”, “Thẻ flashcard” và các biên (2/6/7 lựa chọn, 50/51 câu, lựa chọn trùng, `correctIndex` ngoài khoảng, snippet thiếu ngôn ngữ).
- [ ] `AuthorExerciseControllerTest` (`@WebMvcTest`): validation metadata, 401, mapping mã lỗi.
- [ ] `AuthorExerciseIntegrationTest` (DB/security thật): tạo → lưu câu → gửi → rút → gửi lại; từng chuyển trạng thái sai; quyền (không phải tác giả, tác giả bị đình chỉ, bộ người khác → 404); sao chép; ẩn/hiện; xóa các ca; chủ đề ngừng hoạt động; hai request gửi duyệt song song chỉ một thành công.
- [ ] Chạy các lớp trên (cần Docker); full backend do CI chạy khi mở PR.

## Task 1b — Moderator duyệt, khu Luyện tập và lượt làm

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- Moderator: `GET /api/v1/moderator/exercise-sets` (mọi bộ trừ DRAFT chưa từng gửi; lọc `status`, `type`, `topicId`, `keyword`; mặc định chờ duyệt; có `authorEligible`, `aiAssisted`), `GET …/{id}` (đủ câu hỏi + đáp án + `reviewToken`), `PATCH …/{id}/review {decision: APPROVE|REQUEST_CHANGES, note, reviewToken}`, `PATCH …/{id}/publication {action: HIDE|RESTORE|REMOVE, reason, reviewToken}`.
- Duyệt kiểm lại: tác giả còn đủ điều kiện, chủ đề còn hoạt động, bộ vẫn đạt điều kiện gửi duyệt. `REQUEST_CHANGES`, `HIDE`, `REMOVE` bắt buộc ghi chú. Ghi `moderation_note`, `reviewed_by/at`; lần duyệt đầu đặt `published_at`.
- Công khai: `GET /api/v1/exercise-sets` (`permitAll`; chỉ `PUBLISHED` của tác giả còn hiển thị; lọc `topicId`, `difficulty`, `type`, `keyword`; sắp xếp mới nhất; phân trang; mỗi mục có số câu và, với người đã đăng nhập, kết quả lần làm gần nhất), `GET /api/v1/exercise-sets/options`, `GET /api/v1/exercise-sets/{id}` (`permitAll`; giới thiệu: tiêu đề, mô tả, chủ đề, độ khó, loại, số câu, tác giả, `viewer.canAttempt` + lý do; **không có câu hỏi**).
- Làm bài: `GET /api/v1/exercise-sets/{id}/questions` (đăng nhập, đủ quyền làm): trắc nghiệm trả câu + lựa chọn theo thứ tự tác giả, không có đáp án/giải thích; flashcard trả cả hai mặt + giải thích. `POST /api/v1/exercise-sets/{id}/attempts`: trắc nghiệm gửi `answers: [{questionId, selectedIndex|null}]` + `durationSeconds`, server chấm và trả kết quả đầy đủ; flashcard gửi `results: [{questionId, remembered}]` + `durationSeconds`, server lưu số “đã nhớ”/tổng.
- Lịch sử: `GET /api/v1/me/exercise-attempts` (phân trang, mới nhất trước, lọc `exerciseSetId`), `GET /api/v1/me/exercise-attempts/{id}` (chi tiết từ snapshot; xem được cả khi bộ đã ẩn/gỡ).
- Câu bỏ trống tính sai. Điểm hiển thị = số đúng/tổng và phần trăm làm tròn xuống.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| Không phải MODERATOR gọi API moderator | ADMIN không kèm MODERATOR cũng bị từ chối | 401 / 403 `ACCESS_DENIED` | Bạn không có quyền. |
| Bộ không tồn tại hoặc là DRAFT chưa từng gửi | — | 404 `EXERCISE_SET_NOT_FOUND` | Không tìm thấy bộ bài tập. |
| `note`/`reason` | Bắt buộc 1–1.000 ký tự cho REQUEST_CHANGES/HIDE/REMOVE; tùy chọn ≤ 1.000 cho APPROVE/RESTORE | 400 `VALIDATION_ERROR` | Hãy ghi lý do (tối đa 1.000 ký tự). |
| `reviewToken` lệch (bộ đã đổi từ lúc mở) | Không áp dụng quyết định | 409 `EXERCISE_REVIEW_STALE` | Bộ bài tập đã thay đổi. Hãy tải lại trước khi duyệt. |
| Review khi không `PENDING` (kể cả hai Moderator duyệt đồng thời) | Một người thắng | 409 `EXERCISE_STATE_INVALID` | Không thực hiện được ở trạng thái hiện tại. |
| Duyệt khi tác giả mất điều kiện / chủ đề ngừng / bộ không còn đạt | Không công khai | 409 `EXERCISE_AUTHOR_INELIGIBLE` / `EXERCISE_TOPIC_INACTIVE` / `EXERCISE_NOT_READY` | Tác giả không còn đủ điều kiện. / Chủ đề đã ngừng hoạt động. / Bộ bài tập chưa đủ điều kiện. |
| HIDE / RESTORE / REMOVE sai trạng thái | HIDE từ PUBLISHED hoặc AUTHOR_HIDDEN; RESTORE chỉ từ HIDDEN về trạng thái đã nhớ; REMOVE từ PUBLISHED/AUTHOR_HIDDEN/HIDDEN; REMOVED không đổi được nữa | 409 `EXERCISE_STATE_INVALID` | Không thực hiện được ở trạng thái hiện tại. |
| Bộ không công khai hoặc tác giả không còn hiển thị (API công khai, câu hỏi, nộp bài) | Kể cả bộ bị ẩn trong lúc đang làm | 404 `EXERCISE_SET_NOT_FOUND` | Bộ bài tập không còn khả dụng. |
| Lấy câu hỏi / nộp bài khi chưa đăng nhập | — | 401 `AUTH_ACCESS_TOKEN_REQUIRED` | Đăng nhập để làm bài. |
| ADMIN/MODERATOR hoặc chủ bộ lấy câu hỏi / nộp bài | — | 403 `ACCESS_DENIED` | Bạn không có quyền làm bộ bài tập này. |
| `answers`/`results` | Mỗi `questionId` thuộc bộ, không lặp; thiếu câu = bỏ trống (trắc nghiệm) hoặc “chưa nhớ” (flashcard); `selectedIndex` nằm trong số lựa chọn; gửi sai dạng so với loại bộ bị từ chối | 400 `EXERCISE_ATTEMPT_INVALID` | Bài làm không hợp lệ. Hãy tải lại và làm lại. |
| `durationSeconds` | Số nguyên 0–86.400; thiếu = 0 | 400 `EXERCISE_ATTEMPT_INVALID` | Bài làm không hợp lệ. |
| Nộp trùng (bấm hai lần, gửi lại do mạng) | Header `Idempotency-Key` (UUID) bắt buộc; cùng khóa trả lại đúng kết quả cũ, không tạo lượt mới; khóa dùng cho dữ liệu khác bị từ chối | 400 `VALIDATION_ERROR` (thiếu khóa) / 409 `EXERCISE_ATTEMPT_KEY_CONFLICT` | — / Yêu cầu trùng. Hãy làm lại. |
| Nộp quá nhanh | Tối đa 20 lượt nộp mỗi phút mỗi người | 429 `EXERCISE_RATE_LIMITED` | Bạn thao tác quá nhanh, hãy thử lại sau. |
| Xem lượt làm của người khác / không tồn tại | — | 404 `EXERCISE_ATTEMPT_NOT_FOUND` | Không tìm thấy lượt làm. |
| Tham số lọc/phân trang sai | `page ≥ 0`, `size` 1–50, enum hợp lệ | 400 `VALIDATION_ERROR` | — |

### Kế hoạch thực thi

- **File cần đụng:** `ModeratorExerciseController`, `PublishedExerciseController`, service/repository tương ứng; `ExerciseGrader` (logic thuần: chấm, dựng snapshot); entity `ExerciseAttempt`; `SecurityConfiguration` (GET `/api/v1/exercise-sets`, `/options`, `/{id}` là `permitAll`; `/{id}/questions`, `/{id}/attempts`, `/api/v1/me/exercise-attempts/**` authenticated — khai đường cụ thể trước đường `permitAll` rộng; `/api/v1/moderator/exercise-sets/**` authenticated); `ErrorCode`.
- **Phần dùng lại:** điều kiện “tác giả còn hiển thị” của bài viết/khóa học công khai; cách chặn ADMIN/MODERATOR của `CourseAccessService.checkReader`; mẫu `reviewToken` của bài viết (dùng `version` mới); receipt idempotency trên Redis như tạo bài/khóa.
- **Bẫy đã biết:** matcher `permitAll` không được che `/questions`; DTO câu hỏi cho người làm phải là kiểu riêng không có trường đáp án (không dùng lại DTO tác giả rồi bỏ trường); `attempt_snapshot` phải là object (CHECK); `correct_count` và `total_count` cùng có hoặc cùng NULL; đọc và chấm trong cùng transaction với kiểm trạng thái bộ.

### Xong khi

- [ ] `ExerciseGraderTest` (unit): đúng/sai/bỏ trống, phần trăm làm tròn xuống, flashcard đếm “đã nhớ”, snapshot đủ trường, từng dòng `EXERCISE_ATTEMPT_INVALID`.
- [ ] `ExerciseContractTest` (unit, quét kiểu): DTO câu hỏi cho người làm trắc nghiệm không có trường `answer`/`correctIndex`/`explanation`.
- [ ] `ModeratorExerciseControllerTest`, `PublishedExerciseControllerTest` (`@WebMvcTest`): validation, 401/403, mapping mã lỗi, tham số lọc sai.
- [ ] `ModeratorExerciseIntegrationTest`: duyệt/yêu cầu sửa; token lệch; hai Moderator duyệt song song; từng dòng không đủ điều kiện; ẩn → khôi phục về đúng trạng thái trước (cả `PUBLISHED` và `AUTHOR_HIDDEN`); gỡ; ADMIN không kèm MODERATOR.
- [ ] `ExercisePracticeIntegrationTest`: Guest xem danh sách/giới thiệu và bị 401 ở câu hỏi; làm trắc nghiệm và flashcard; chủ bộ/ADMIN/MODERATOR bị 403; bộ bị ẩn giữa chừng → 404 khi nộp; nộp trùng cùng khóa → một lượt; lịch sử chỉ của mình và vẫn xem được sau khi bộ bị gỡ; tác giả bị đình chỉ → bộ biến mất khỏi danh sách.
- [ ] Chạy các lớp trên + `AuthorExerciseIntegrationTest`; full backend do CI.

## Task 1c — AI sinh câu hỏi cho tác giả

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- `POST /api/v1/author/exercise-sets/{id}/ai/questions` — body `{instruction, sourceText, count}`; trả danh sách câu **đề xuất** đúng dạng của loại bộ (trắc nghiệm: câu, 4 lựa chọn, chỉ số đúng, giải thích; flashcard: mặt trước, mặt sau). **Không lưu vào bộ**: tác giả xem, sửa, chọn rồi lưu bằng `PUT …/questions`. Không stream.
- Ngữ cảnh gửi model: tiêu đề, mô tả, chủ đề, độ khó, loại của bộ; các câu hiện có (để tránh trùng); `instruction`; `sourceText`. Tất cả là dữ liệu không tin cậy; system prompt cố định; trả lời tiếng Việt.
- Kết quả phải qua đúng `ExerciseQuestionValidator` của 1a; câu không đạt bị loại; không còn câu nào đạt → lỗi và hoàn lượt. Gọi thành công thì đặt `ai_assisted = true` cho bộ (một chiều; Tác giả và Moderator thấy, người học không thấy).
- Quota riêng `EXERCISE`: mặc định 10 lần/ngày/tác giả (`AI_EXERCISE_PER_DAY`), dùng chung `burst-per-minute`. `GET /api/v1/author/ai/quota` hiện có trả thêm quota này. Hoàn lượt khi lỗi nhà cung cấp, hết giờ, kết quả không dùng được.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| `instruction` | Tùy chọn, ≤ 500 ký tự | 400 `VALIDATION_ERROR` | Yêu cầu tối đa 500 ký tự. |
| `sourceText` | Tùy chọn, ≤ 8.000 ký tự | 400 `VALIDATION_ERROR` | Nội dung nguồn tối đa 8.000 ký tự. |
| `count` | Bắt buộc 1–10; cộng số câu hiện có không vượt 50 | 400 `VALIDATION_ERROR` / 409 `EXERCISE_QUESTIONS_INVALID` | Số câu từ 1 đến 10. / Mỗi bộ tối đa 50 câu. |
| Quyền và trạng thái | Như sửa câu hỏi ở 1a: chủ bộ, tác giả đủ điều kiện, bộ ở DRAFT/CHANGES_REQUESTED | 401 / 403 `ACCESS_DENIED` / 404 `EXERCISE_SET_NOT_FOUND` / 409 `EXERCISE_NOT_EDITABLE` | Như 1a. |
| Quá nhịp / hết lượt ngày | — | 429 `AI_RATE_LIMITED` / `AI_QUOTA_EXCEEDED` | Bạn thao tác quá nhanh. / Bạn đã dùng hết lượt AI hôm nay. |
| Model trả sai định dạng sau một lần sửa, hoặc không câu nào đạt | Hoàn lượt | 422 `AI_OUTPUT_INVALID` | AI trả về nội dung không dùng được. Hãy thử lại. |
| Bị cắt do giới hạn token | Hoàn lượt | 422 `AI_OUTPUT_TRUNCATED` | Kết quả bị cắt. Hãy giảm số câu. |
| Lỗi nhà cung cấp / hết giờ / chưa cấu hình / Redis lỗi | Hoàn lượt (trừ khi chưa giữ lượt) | `AI_PROVIDER_*` / `AI_TIMEOUT` / `AI_CONFIGURATION_INVALID` / `AI_STORAGE_UNAVAILABLE` | Dịch vụ AI đang gián đoạn. Hãy thử lại. |
| Trả ít câu hơn yêu cầu nhưng có câu đạt | Vẫn thành công, trừ một lượt, trả số câu thực có | 200 | AI tạo được {n}/{count} câu. |
| Hai request AI đồng thời của một tác giả | Request sau bị từ chối, không trừ lượt | 409 `AI_GENERATION_IN_PROGRESS` | AI đang xử lý yêu cầu trước. |

### Kế hoạch thực thi

- **File cần đụng:** `ExerciseAiService` + endpoint trong `AuthorExerciseController`; `AiPromptFactory` thêm prompt và schema JSON cho hai loại; `AiRateLimitService.Kind.EXERCISE`; `AiAssistProperties` thêm `exercisePerDay`, timeout và khóa token `EXERCISE`; YAML, `.env.example`.
- **Phần dùng lại:** luồng gọi model có schema + một lần sửa của `AiOutlineService`; `AiProviderExceptionMapper`; `AiPromptFactory.options(...)`.
- **Bẫy đã biết:** luật trong `backend-ai.md` (option runtime, `extra-body`, retry); `AiAssistProperties` kiểm danh sách khóa token cố định — thêm `EXERCISE` ở cả code và YAML; không giữ transaction DB khi gọi model; đặt `ai_assisted` trong transaction riêng sau khi có kết quả.

### Xong khi

- [ ] `ExerciseAiServiceTest` (unit, model giả): thành công hai loại; loại câu không đạt; không câu nào đạt → hoàn lượt; từng dòng lỗi nhà cung cấp/hết giờ/bị cắt; đặt `ai_assisted`; request đồng thời.
- [ ] `AiPromptFactoryTest`: prompt chứa đủ ngữ cảnh dạng dữ liệu và schema đúng loại.
- [ ] `AuthorExerciseIntegrationTest` thêm 3–4 ca: quyền/trạng thái, quota hết → 429, gọi thành công không tự lưu câu. Chạy thêm các lớp `Ai*` dùng `AiRateLimitService`/`AiAssistProperties`. Không test nào gọi model thật.

## Cổng wireframe

Sau Backend và trước Giao diện, tạo `plans/exercise-practice.wireframe.md`: trình soạn bộ (hai loại, panel AI), danh sách của tác giả, màn duyệt của Moderator, khu Luyện tập (danh sách, giới thiệu, làm trắc nghiệm, lật flashcard, kết quả, lịch sử); desktop/mobile và các trạng thái rỗng/lỗi. Người dùng duyệt trước khi code giao diện.

## Task 2a — Giao diện tác giả

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- `/author/exercises` (danh sách của tôi: lọc trạng thái/loại, badge trạng thái, ghi chú của Moderator khi bị trả về, nút Tạo/Sửa/Sao chép/Ẩn/Hiện/Xóa theo trạng thái), `/author/exercises/new`, `/author/exercises/:id/edit` (metadata + danh sách câu: thêm, sửa, xóa, đổi thứ tự; xem trước như người học; Gửi duyệt/Rút).
- Panel “Tạo câu hỏi bằng AI”: nhập yêu cầu, dán nội dung nguồn, chọn số câu; kết quả hiện thành danh sách đề xuất có ô chọn; “Thêm câu đã chọn” đưa vào danh sách đang soạn (chưa lưu cho tới khi bấm Lưu). Hiện lượt AI còn lại.
- Validation phía client dẫn chiếu bảng 1a và 1c; rời trang khi chưa lưu có cảnh báo; mục “Bài tập” thêm vào nhóm Tác giả ở sidebar.

### Kế hoạch thực thi

- **File cần đụng:** `pages/Author/Exercises/**`, `exerciseService.ts`, `types/exercises.ts`, `exerciseI18n.ts`, `App.tsx`, `Sidebar.tsx`, `navigation.ts`.
- **Phần dùng lại:** khung danh sách/trình soạn của `Author/Courses`; `AlertDialog` cho xóa/gửi; ánh xạ lỗi AI của `aiAssistI18n`; `statusTone` cho badge; `MarkdownContent` cho xem trước.
- **Bẫy đã biết:** `PUT questions` thay toàn bộ nên client luôn gửi đủ danh sách; khóa nút khi đang lưu; chuỗi dài trong test dùng `user.paste`; vùng chạm 44px.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Menu / tiêu đề | Bài tập của tôi | My exercises |
| Loại | Trắc nghiệm / Flashcard | Multiple choice / Flashcards |
| Độ khó | Dễ / Vừa / Khó | Easy / Medium / Hard |
| Trạng thái | Bản nháp / Chờ duyệt / Đang công khai / Cần sửa / Đã ẩn / Bị ẩn bởi kiểm duyệt / Đã gỡ | Draft / Pending / Published / Changes requested / Hidden / Hidden by moderator / Removed |
| Hành động | Tạo bộ bài tập / Lưu / Gửi duyệt / Rút lại / Tạo bản sao / Ẩn / Hiện lại / Xóa | New exercise set / Save / Submit / Withdraw / Duplicate / Hide / Unhide / Delete |
| Chưa đủ | Cần ít nhất 3 câu trắc nghiệm (hoặc 5 thẻ) để gửi duyệt. | At least 3 questions (or 5 cards) are needed to submit. |
| Không sửa được | Bộ đã công khai không sửa được. Hãy tạo bản sao để chỉnh sửa. | Published sets cannot be edited. Duplicate to make changes. |
| AI | Tạo câu hỏi bằng AI / Thêm câu đã chọn / AI tạo được {n}/{count} câu. Hãy kiểm tra trước khi dùng. | Generate with AI / Add selected / AI produced {n}/{count} questions. Review before using. |
| Chưa lưu | Bạn có thay đổi chưa lưu. Rời trang? | You have unsaved changes. Leave? |

Câu hiển thị cho từng mã lỗi lấy từ cột “Copy hiển thị” của bảng 1a/1c; bản tiếng Anh dịch tương ứng trong `exerciseI18n`.

### UI

- Theo wireframe đã duyệt và `UI_GUIDE.md`; primitive và token hiện có. Trạng thái: tải, rỗng, lỗi, đang lưu, chỉ đọc (bộ đã công khai/chờ duyệt). Desktop và mobile 390px không cuộn ngang.

### Xong khi

- [ ] Test unit validation theo bảng 1a (biên như test backend) và mapping mọi mã lỗi 1a/1c vi/en.
- [ ] `Author/Exercises/*.test.tsx`: tạo → thêm câu → lưu → gửi; bộ chỉ đọc; sao chép; panel AI thêm câu đã chọn và các lỗi AI; cảnh báo chưa lưu.
- [ ] `exerciseService.test.ts`, `exerciseI18n.test.ts`, `Sidebar.test.tsx`, test `App` bị sửa + `npm run build` trong `app/`.
- [ ] Kiểm bằng mắt các trang đổi: dark/light × desktop/mobile, một lượt; ghi log.

## Task 2b — Giao diện Moderator

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- `/moderator/exercises` (danh sách theo chuẩn màn duyệt bài viết: ô số liệu theo trạng thái, bộ lọc, mặc định “Chờ duyệt”, nhãn “Có dùng AI”, cảnh báo tác giả không còn đủ điều kiện), `/moderator/exercises/:id` (xem toàn bộ câu kèm đáp án đúng được đánh dấu; Duyệt / Yêu cầu sửa; Ẩn / Khôi phục / Gỡ với hộp thoại nhập lý do).
- Mapping lỗi theo bảng 1b; lỗi token lệch có nút tải lại. Thêm mục “Bài tập” vào sidebar Moderator.

### Kế hoạch thực thi

- **File cần đụng:** `pages/Moderator/Exercises/**`, `ModeratorSidebar.tsx`, `managementI18n.ts`, `App.tsx`, service/types.
- **Phần dùng lại:** bố cục và component của `Moderator/Courses`, `ArticleStats`, hộp thoại lý do hiện có.
- **Bẫy đã biết:** không tự retry thao tác duyệt; sau thành công tải lại từ server; lý do bắt buộc ở client khớp bảng 1b.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Menu | Bài tập | Exercises |
| Hành động | Duyệt / Yêu cầu sửa / Ẩn / Khôi phục / Gỡ | Approve / Request changes / Hide / Restore / Remove |
| Nhãn | Có dùng AI / Đáp án đúng / Tác giả không còn đủ điều kiện | AI-assisted / Correct answer / Author is no longer eligible |
| Lý do | Hãy ghi lý do (tối đa 1.000 ký tự). | Enter a reason (up to 1,000 characters). |
| Token lệch | Bộ bài tập đã thay đổi. Hãy tải lại trước khi duyệt. | This set has changed. Reload before reviewing. |

### UI

- Theo wireframe và chuẩn màn Moderator hiện có; đủ tải/rỗng/lỗi; desktop và mobile.

### Xong khi

- [ ] `Moderator/Exercises/*.test.tsx`: danh sách + lọc; duyệt; yêu cầu sửa thiếu lý do; ẩn/khôi phục/gỡ; token lệch; mapping mọi mã lỗi 1b liên quan vi/en.
- [ ] `ModeratorSidebar` test, test `App` bị sửa + `npm run build`.
- [ ] Kiểm bằng mắt: dark/light × desktop/mobile, một lượt; ghi log.

## Task 2c — Khu Luyện tập của người học

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- `/practice` (danh sách bộ: lọc chủ đề, độ khó, loại, từ khóa; thẻ hiện loại, độ khó, số câu, tác giả, kết quả lần gần nhất của tôi), `/practice/:id` (giới thiệu + nút Bắt đầu; Guest được dẫn sang đăng nhập rồi quay lại), `/practice/:id/attempt` (làm bài), `/me/practice` (lịch sử), `/me/practice/:attemptId` (xem lại một lượt).
- Trắc nghiệm: mỗi lần một câu, có thanh tiến độ, đi tới/lui, danh sách câu đã/chưa trả lời, nộp có xác nhận khi còn câu trống. Kết quả: điểm, phần trăm, từng câu với lựa chọn của tôi, đáp án đúng, giải thích; nút Làm lại.
- Flashcard: lật thẻ xem mặt sau, bấm “Đã nhớ”/“Chưa nhớ” để sang thẻ kế; cuối cùng hiện số đã nhớ/tổng và danh sách thẻ chưa nhớ; nút Ôn lại.
- Rời trang giữa chừng có cảnh báo; bài đang làm không lưu ở server (tải lại là làm lại từ đầu). Mỗi lần nộp tạo một `Idempotency-Key`, gửi lại khi lỗi mạng dùng cùng khóa.
- Thêm “Luyện tập” vào sidebar người đọc; trang nằm trong `ReaderRoute` (ADMIN/MODERATOR không vào).

### Kế hoạch thực thi

- **File cần đụng:** `pages/Practice/**`, `App.tsx`, `Sidebar.tsx`, `navigation.ts`, service/types/i18n.
- **Phần dùng lại:** bố cục danh sách + bộ lọc của `Courses`; `Pagination`; `MarkdownContent` (câu hỏi, giải thích, khối code); `returnTo`; `EmptyState`.
- **Bẫy đã biết:** không hiển thị đáp án trước khi server trả kết quả; bộ bị ẩn giữa chừng → thông báo và quay về danh sách; phím tắt (1–6 chọn đáp án, Space lật thẻ) không được chặn thao tác của trình đọc màn hình; vùng chạm 44px cho lựa chọn và nút thẻ.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Menu / tiêu đề | Luyện tập | Practice |
| Bắt đầu / Làm lại / Ôn lại | Bắt đầu / Làm lại / Ôn lại | Start / Try again / Review again |
| Tiến độ | Câu {n}/{total} | Question {n}/{total} |
| Nộp | Nộp bài / Còn {n} câu chưa trả lời. Vẫn nộp? | Submit / {n} questions unanswered. Submit anyway? |
| Kết quả | Bạn đúng {correct}/{total} câu ({percent}%) | You got {correct}/{total} correct ({percent}%) |
| Từng câu | Bạn chọn / Đáp án đúng / Giải thích / Bỏ trống | Your answer / Correct answer / Explanation / Unanswered |
| Flashcard | Lật thẻ / Đã nhớ / Chưa nhớ / Đã nhớ {n}/{total} thẻ | Flip / Got it / Not yet / Remembered {n}/{total} cards |
| Lịch sử | Lịch sử luyện tập / Chưa có lượt làm nào. | Practice history / No attempts yet. |
| Guest | Đăng nhập để làm bài | Sign in to practice |
| Không khả dụng | Bộ bài tập không còn khả dụng. | This exercise set is no longer available. |
| Không được làm | Bạn không thể làm bộ bài tập của chính mình. | You cannot attempt your own exercise set. |
| Rời trang | Bài làm chưa nộp sẽ bị mất. Rời trang? | Your unsubmitted answers will be lost. Leave? |

### UI

- Theo wireframe và `UI_GUIDE.md`. Đáp án đúng/sai phân biệt bằng **cả biểu tượng và chữ**, không chỉ bằng màu; dùng token trạng thái hiện có. Thẻ flashcard lật không dùng hiệu ứng khi người dùng bật giảm chuyển động.
- Trạng thái: tải, rỗng (không có bộ nào/không khớp bộ lọc), lỗi, đang nộp, kết quả. Desktop và mobile 390px.

### Xong khi

- [ ] Test unit: dựng payload nộp bài, tính câu chưa trả lời, mapping mọi mã lỗi 1b liên quan vi/en.
- [ ] `Practice/*.test.tsx`: danh sách + lọc; Guest → đăng nhập; làm trắc nghiệm đến kết quả; nộp khi còn câu trống; flashcard đến tổng kết; bộ bị ẩn giữa chừng; nộp lại sau lỗi mạng dùng cùng khóa; lịch sử và xem lại.
- [ ] `Sidebar.test.tsx`, test `App` bị sửa + `npm run build`.
- [ ] Kiểm bằng mắt: dark/light × desktop/mobile, một lượt; ghi log.

## Câu hỏi mở cần người dùng chốt

Mỗi câu đã có mặc định viết trong thân spec; không trả lời = giữ mặc định.

1. **Bộ đã công khai không sửa được, muốn sửa thì tạo bản sao và gửi duyệt lại** (vì bộ bài tập không có phiên bản). Giữ, hay cho sửa trực tiếp rồi duyệt lại (thêm khoảng một ngày công)?
2. **Tác giả tự ẩn/hiện bộ đã công khai của mình** (không cần Moderator). Giữ?
3. **Điều kiện gửi duyệt: ≥ 3 câu trắc nghiệm hoặc ≥ 5 thẻ; tối đa 50 câu mỗi bộ; trắc nghiệm 2–6 lựa chọn, một đáp án đúng.** Giữ, hay số khác?
4. **AI: 10 lần sinh câu hỏi mỗi ngày mỗi tác giả, mỗi lần tối đa 10 câu; bộ có dùng AI hiện nhãn cho Tác giả và Moderator.** Giữ?
5. **Tác giả không làm bộ của chính mình; Admin/Moderator không làm bài.** Giữ?
6. **Bài đang làm dở không lưu** (tải lại trang là làm lại). Giữ?

## Phản hồi vòng 1 (Codex)

Đúng / Sai / Thiếu / Thừa:

### Đề xuất ngoài spec (không chặn chốt)

## Trả lời vòng 1 (Claude)

## Phản hồi vòng 2 (Codex)

## Trả lời vòng 2 (Claude)

## Quyết định của người dùng

Chốt theo: (chưa chốt)
