# Exercise practice — nhật ký

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`exercise-practice.md`](exercise-practice.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-17)

- **Task tiếp:** Task 2a — giao diện tác giả, theo `plans/exercise-practice.wireframe.md` (đã duyệt 2026-11-17) · Giao diện: Có
- Spec chốt 2026-11-15; `course-payment` và `course-ai-tutor` đã merge vào `main` nên đủ điều kiện bắt đầu. Migration lấy số kế tiếp lúc code (spec ghi V14 nếu V13 đã có) — kiểm `db/migration` trước.
- Nhánh: `feature/exercise-practice` (từ `main` sau PR #10).

## Quyết định người dùng chưa có trong spec

- **2026-11-17:** body `POST …/ai/questions` thêm `version` bắt buộc (≥ 0); lệch version → 409 `EXERCISE_VERSION_CONFLICT`, hoàn lượt (không gọi model nếu lệch ngay từ đầu). Task 2a phải gửi `version` đang giữ và dùng `version` trả về cho lần `PUT questions` sau.

- **2026-11-17:** duyệt wireframe, cả 5 câu mục 9 theo khuyến nghị: một nút Lưu ghi cả thông tin + câu hỏi; sắp xếp bằng ↑↓; không lưu bài làm dở; giữ các chi tiết nhỏ ngoài spec (lọc câu sai, thẻ trước, copy mới); không ô số liệu Moderator.

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-17 — Cổng wireframe: viết xong, chờ duyệt
- Viết `plans/exercise-practice.wireframe.md`: danh sách + trình soạn tác giả (hai loại, panel AI, chỉ đọc, xung đột version), màn Moderator (không ô số liệu), khu Luyện tập (danh sách, giới thiệu, làm trắc nghiệm, flashcard, kết quả, lịch sử); desktop/mobile + rỗng/lỗi/chờ, bảng lỗi theo mã 1a–1c.
- Chi tiết ngoài spec ghi “(copy mới)” hoặc nêu ở mục 9 để người dùng bỏ/giữ. Chỉ tài liệu, không có test/build.
### 2026-11-17 — Task 1c đã nhận: AI sinh câu hỏi
- Code: `ExerciseAiService` (+ `POST /author/exercise-sets/{id}/ai/questions` trong `AuthorExerciseController`), `AuthorExerciseService.aiContext/markAiAssisted/aiUsable`, `AiPromptFactory.exercise*`, `Kind.EXERCISE`, `AiAssistProperties` (+`exercisePerDay`, `exerciseTimeout`, token `EXERCISE`), `AiQuotaResponse.exercise`, YAML + `.env.example`; handler `QuotaAwareException` chuyển từ `AuthorAiController` sang `GlobalExceptionHandler` để dùng chung header quota.
- Test: `./gradlew test --tests 'exercise.*' --tests 'ai.*'` — 204 ca, 0 lỗi (`ExerciseAiServiceTest` 11 ca mới, `AiPromptFactoryTest`, `AuthorExerciseControllerTest`, 3 ca mới ở `AuthorExerciseIntegrationTest`; 1 ca đỏ do tôi viết sai 409 đã sửa, chạy lại đạt).
- Lệch khác spec: spec ghi 409 cho `EXERCISE_QUESTIONS_INVALID` (vượt 50 câu) nhưng mã này đã là 400 từ 1a → giữ 400; theo luật “ít class” không tạo `ExerciseQuestionValidator` riêng (dùng `normalize` + `checkContent`); phản hồi thêm `version` mới; chỉ sửa lại (repair) khi JSON sai schema, câu không đạt kiểm lưu thì bị loại; chưa viết test đỏ-trước (code viết trước test).
- Review vòng 1 (2 phát hiện, đúng): version trả về có thể che thay đổi đồng thời; chấp nhận câu không đủ 4 lựa chọn. Đã sửa: `AiContext.version` + `markAiAssisted(..., expectedVersion)` dùng `ensureVersion` dưới khóa (lệch → `EXERCISE_VERSION_CONFLICT`, hoàn lượt); `aiUsable` loại câu trắc nghiệm không đúng 4 lựa chọn (thêm ca 2 và 5 lựa chọn, ca version lệch). `exercise.*` + `ai.*` — 204 ca, 0 lỗi.
- Review vòng 2 (1 phát hiện cao, đúng; người dùng đồng ý 2026-11-17, đã sửa: `AiQuestions.version`, `aiContext(..., clientVersion)` kiểm dưới khóa, thêm ca tab cũ ở `AuthorExerciseIntegrationTest`; `exercise.*` + `ai.*` — 205 ca, 0 lỗi): `version` trả về vẫn cho tab A giữ bản cũ gọi AI sau khi tab B lưu, rồi PUT đè. Khuyến nghị: thêm `version` bắt buộc vào body AI, kiểm dưới khóa lúc lấy ngữ cảnh và lúc đặt cờ (lệch → 409 `EXERCISE_VERSION_CONFLICT`, hoàn lượt). 
- Chưa kiểm: gọi model thật; hai request AI đồng thời chỉ kiểm bằng unit test (registry trong bộ nhớ).

### 2026-11-17 — Task 1b đã nhận: duyệt, khu Luyện tập, lượt làm
- Code: `ModeratorExerciseService/Controller`, `PublishedExerciseService/Controller` (chấm điểm là `static grade` trong service), entity `ExerciseAttempt` + repo, `ExercisePracticeResponse` (DTO câu hỏi người làm tách kiểu, không có đáp án), 5 mã lỗi mới, `SecurityConfiguration`; `AuthorExerciseService.rateLimit(key, limit)` thành package-private để dùng chung.
- Test: `./gradlew test --tests 'com.techverse.server.exercise.*'` — 48+ ca, 0 lỗi (grader/contract trong `ExerciseLifecycleTest`; `ExercisePracticeControllerTest` mới; ca moderator + practice thêm vào `AuthorExerciseIntegrationTest`).
- Lệch khác spec: theo luật “ít class” không tạo `ExerciseGrader`, `ExerciseContractTest`, 2 lớp controller test, 2 lớp integration riêng; nộp trùng dùng `pg_advisory_xact_lock` theo (user, key) thay vì bắt UNIQUE; nộp lỗi (404/400) vẫn tính vào nhịp 20/phút; `/options` công khai trả mọi chủ đề đang hoạt động; thành công trả 200 (kể cả trả lại lượt cũ); enum sai trong body → `MALFORMED_REQUEST` (hành vi chung).
- Review vòng 1 (2 phát hiện P2, đúng): NUL trong `note`/`reason` gây lỗi DB; `submit` chưa khóa dòng user khi kiểm tài khoản. Đã sửa (`note()` chặn NUL → `VALIDATION_ERROR`; `submit` dùng `findByIdForAuthentication` + `refresh`), thêm ca NUL; `exercise.*` đạt, 0 lỗi. Vòng 2 (adversarial, chỉ phần sửa): approve, không phát hiện.
- Chưa làm: TDD đỏ-trước chỉ giữ cho grader (code viết trước test integration).

### 2026-11-17 — Task 1a đã nhận: schema + API tác giả
- Migration `V19__exercise_practice.sql` (V13–V18 đã dùng). Code: `ExerciseSet/ExerciseQuestion`, `AuthorExerciseService` (validator `normalize` static, rate limit Redis, khóa dòng), `AuthorExerciseController`, `ExerciseSetRequest/Response`; `CustomException` có `fieldErrors`.
- Test: `ExercisePracticeMigrationTest`, `ExerciseLifecycleTest` (cả validator), `AuthorExerciseControllerTest`, `AuthorExerciseIntegrationTest` + `AuthorAiControllerTest`, `DatabaseBootstrapIntegrationTest` — 51 ca, 0 lỗi.
- Lệch khác spec: theo luật “ít class” không tạo `ExerciseAccessService`/`ExerciseQuestionValidator` riêng (private/static trong service); `version` sai kiểu JSON → `MALFORMED_REQUEST` (hành vi chung), thiếu/âm → `VALIDATION_ERROR`; submit khi chủ đề ngừng → `EXERCISE_NOT_READY`; rate limit để trong service tác giả — 1b chuyển ra nếu cần dùng chung.
- Review vòng 1 (2 phát hiện P2, đúng): PATCH/PUT chưa kiểm chủ đề đang giữ; NUL trong snippet/ngôn ngữ/lựa chọn/title/description gây lỗi DB. Đã sửa + thêm ca test `savesRecheckTheKeptTopicAndRejectNulCharacters`; 3 lớp test liên quan đạt. Vòng 2 (adversarial, chỉ phần sửa): approve, không phát hiện.
- Chưa làm: entity chuyển Moderator đã có sẵn (`approve/moderatorHide/...`) cho 1b.

### 2026-11-17 — Mở module
- Chuyển `Module đang làm` sang `exercise-practice`; tạo log này; ghi CI đạt/PR #10 đã merge vào `course-ai-tutor`.
