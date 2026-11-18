# Exercise practice — nhật ký

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`exercise-practice.md`](exercise-practice.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-17)

- **Task tiếp:** Task 2c — khu Luyện tập của người học (wireframe mục 6–8) · Giao diện: Có. Task 2b đã nhận (2026-11-18); chưa kiểm cảm ứng 44px và thao tác ghi thật.
- Task 1a, 1b, 1c, 2a đã nhận (2026-11-18 cho 2a). Chưa kiểm 2a: vùng chạm 44px, AI thật thành công, gửi/rút/ẩn trên backend thật.
- Spec chốt 2026-11-15; `course-payment` và `course-ai-tutor` đã merge vào `main` nên đủ điều kiện bắt đầu. Migration lấy số kế tiếp lúc code (spec ghi V14 nếu V13 đã có) — kiểm `db/migration` trước.
- Nhánh: `feature/exercise-practice` (từ `main` sau PR #10).

## Quyết định người dùng chưa có trong spec

- **2026-11-17:** body `POST …/ai/questions` thêm `version` bắt buộc (≥ 0); lệch version → 409 `EXERCISE_VERSION_CONFLICT`, hoàn lượt (không gọi model nếu lệch ngay từ đầu). Task 2a phải gửi `version` đang giữ và dùng `version` trả về cho lần `PUT questions` sau.

- **2026-11-17:** duyệt wireframe, cả 5 câu mục 9 theo khuyến nghị: một nút Lưu ghi cả thông tin + câu hỏi; sắp xếp bằng ↑↓; không lưu bài làm dở; giữ các chi tiết nhỏ ngoài spec (lọc câu sai, thẻ trước, copy mới); không ô số liệu Moderator.

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-18 — Task 2b đã nhận (2026-11-18): giao diện Moderator
- Code: `pages/Moderator/Exercises/{ModeratorExercisesPage,ModeratorExerciseDetailPage}.tsx`, `moderatorExercises` + `moderatorExerciseActions` trong `exerciseService.ts`, copy/mã lỗi Moderator trong `exerciseI18n.ts`, 2 route `/moderator/exercises[/:id]`, mục “Kiểm duyệt bài tập” ở `ModeratorSidebar`.
- Test: `vitest run` Moderator/Exercises (17 ca) + Sidebar + exerciseService + data — 236 ca đạt; `npm run build` đạt. Test viết trước, đỏ vì thiếu module.
- Lệch khác spec/wireframe: spec/log ghi 2b gộp “khu Luyện tập” nhưng spec tách thành 2c → chỉ làm Moderator; token lệch đóng hộp thoại và hiện dải cảnh báo + Tải lại, khóa nút tới khi tải lại; lọc chủ đề lấy từ `/exercise-sets/options` công khai; hiện “Cập nhật lúc” (API không có “gửi lúc”); không có thanh `ArticleStats`; lỗi `EXERCISE_STATE_INVALID` cũng khóa + tải lại.
- Review vòng 1 (3 phát hiện P2): 404 khi duyệt bộ vừa bị rút → đúng, chuyển sang “Không tìm thấy” + Về danh sách; đoạn code chứa dòng ``` làm vỡ khối Markdown → đúng, rào dài hơn mọi chuỗi backtick (thêm 2 test); kiểm bằng mắt chưa làm → ghi nhận. Sau sửa: `vitest run src/pages/Moderator/Exercises` 19 ca đạt, `npm run build` đạt.
- Review vòng 2 (1 phát hiện trung, đúng): nhãn ngôn ngữ chèn thẳng vào dòng mở rào có thể phá fence → chỉ nhận nhãn khớp `[\w+#.-]{1,50}`, ngược lại bỏ nhãn (thêm 1 test). Sau sửa: Moderator/Exercises 20 ca đạt, build đạt. Không chạy vòng 3.
- Kiểm bằng mắt 2026-11-18 (Playwright MCP, backend thật, `moderator@techverse.test`, bộ mẫu chờ duyệt tạo bằng API bởi `bao.author`): light desktop `/moderator/exercises` (lọc, hàng, sidebar có mục mới) + `/:id` (3 câu, đáp án đúng có chữ + biểu tượng, khối code SQL); dark desktop `/:id` (token card/viền/đáp án đúng đúng); hộp thoại “Yêu cầu sửa” để trống → lỗi lý do, focus trong hộp; 390px danh sách + chi tiết: không cuộn ngang, thanh hành động cố định đáy, nút Duyệt/Yêu cầu sửa 44px. Không bấm Duyệt/Ẩn/Gỡ thật (giữ bộ mẫu).
- Lệch khác wireframe: thanh hành động nằm đầu trang desktop (wireframe ghi dính đáy), mobile dính đáy; mobile không có menu `⋯` khi chỉ có ≤ 2 nút.
- Chưa kiểm: vùng chạm 44px trên cảm ứng thật (Playwright MCP không bật `pointer: coarse`, chip trạng thái đo 32px ở chuột), danh sách nhiều trạng thái, thao tác ghi thật (duyệt/ẩn/gỡ), token lệch giữa hai Moderator. Bộ mẫu “Kiểm tra giao diện Moderator” còn ở DB dev (PENDING).
### 2026-11-18 — Task 2a đã nhận: giao diện tác giả
- Code: `types/exercises.ts`, `services/exerciseService.ts` (API + validation + ma trận nút), `data/exerciseI18n.ts`, `pages/Author/Exercises/{AuthorExercisesPage,ExerciseEditorPage}.tsx` (hộp soạn câu, xem trước, panel AI nằm cùng file trình soạn), 3 route trong `App.tsx`, mục “Bài tập” ở sidebar Tác giả; `aiAssist.quota` thêm `exercise`, export `unwrap`.
- Test: `vitest run` Exercises/* + `exerciseService` + `exerciseI18n` + `Sidebar` + `aiAssist*` — 94 ca (1 ca đỏ do assert sai của tôi, đã sửa); `App.auth.test.tsx` 125 ca đạt; `npm run build` đạt.
- Lệch khác spec/wireframe: thanh hành động dính ĐẦU trang cả mobile (wireframe ghi đáy); mobile không có menu `…` cho Xóa (nút xếp hàng, vẫn 44px); không có dải “tác giả bị đình chỉ” (list API không báo trạng thái; thao tác ghi bị 403 hiện “Bạn không có quyền.”); `fieldErrors` của server không ánh xạ theo câu (client đã chặn trước; lỗi server hiện chung); client chỉ chặn ảnh Markdown và NUL, HTML thô để server (`EXERCISE_CONTENT_INVALID`); copy mới tự đặt trong `exerciseI18n`; code viết trước test (chưa đỏ-trước).
- Review vòng 1 (4 phát hiện): P1 sửa trong lúc lưu bị ghi đè → đúng, khóa vùng soạn bằng `fieldset disabled={busy}`; P2 PATCH ok/PUT lỗi gây xung đột version giả → đúng, cập nhật version + metadata đã lưu ngay sau PATCH (thêm test); P2 AI tự lưu trước khi gọi → từ chối, đúng quyết định 2026-11-17/wireframe mục 3 (“đang có thay đổi chưa lưu thì lưu trước”); P2 kiểm bằng mắt chưa làm → ghi nhận, cần backend + đăng nhập tác giả. Sau sửa: Exercises 23 ca đạt, build đạt.
- Review vòng 2 (1 phát hiện cao, đúng): panel AI vẫn thêm câu trong lúc lưu → mất câu. Đã sửa: nút “Thêm câu đã chọn” khóa khi đang lưu (+ test trì hoãn PATCH). Exercises 24 ca đạt, build đạt.
- Kiểm bằng mắt 2026-11-18 (Playwright MCP, backend thật, `bao.author`): dark desktop `/author/exercises` rỗng, `/new` (tạo thật → `/edit`), hộp soạn câu (lỗi dưới ô), lưu `PUT` thật rồi tải lại còn nguyên 1 câu, xóa thật; light desktop `/edit` (card/viền đúng token, không cuộn ngang); 390px `/edit` + sheet AI + danh sách: không cuộn ngang, không tràn chữ. AI thật trả 502 `AI_PROVIDER_REQUEST_REJECTED` (cấu hình nhà cung cấp dev), UI hiện đúng câu lỗi, giữ lượt 10/10.
- Chưa kiểm: vùng chạm 44px (Playwright không bật cảm ứng, nút đo 32px ở chuột), AI sinh câu thành công với model thật, gửi duyệt/rút/ẩn/hiện trên backend thật, danh sách có nhiều trạng thái.
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
