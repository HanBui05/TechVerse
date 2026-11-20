# Interview practice — nhật ký

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`interview-practice.md`](interview-practice.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-21)

- **Task tiếp:** Chờ CI + người dùng merge PR #13 (Create a merge commit) · Giao diện: Không
- Task 1a–1c (2026-11-20), 2a–2b (2026-11-21) đã nhận; spec đồng bộ 2026-11-21 (Codex).
- Chưa kiểm: desktop dark, mobile light, hộp thoại AI tác giả trên trình duyệt; prompt mới qua app sau khi khởi động lại backend (đã thử bằng script gọi thẳng Groq).
- Nhánh `feature/interview-practice` đã push, PR #13 → `main` (đã merge `origin/main` sau PR #12). 3 câu `[Dev]` trong DB dev đã xóa.

## Quyết định người dùng chưa có trong spec

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
- 2026-11-21 — Codex: đã đưa quyết định bỏ cổng wireframe và quy trình Gemini/Claude, siết AI phỏng vấn và thay đổi AI bài tập vào spec.
### 2026-11-21 — Bài tập: bước AI kiểm chéo
- Người dùng chọn phương án 1. `ExerciseAiService.verified`: gọi lần hai temperature 0 với `EXERCISE_VERIFY_SYSTEM` (thẩm định, nghi ngờ thì `ok=false`), chỉ giữ index được xác nhận, sót index = loại, đọc lỗi/không còn câu → `AI_OUTPUT_INVALID` + hoàn lượt; cùng một lượt và một deadline. `exercise-timeout` mặc định 60s → 90s (YAML + `.env.example`).
- TDD (đỏ biên dịch → xanh): ExerciseAi 16, AuthorExerciseController 7, AiPromptFactory 8, AiRateLimit 13, InterviewAi 15 đều đạt.
- Chạy thật: 11 câu sinh mới giữ 10 (loại đúng câu EASY hai đáp án đúng), kiểm thêm 1,4–8s. Bộ 3 câu biết trước, 3 lần: luôn loại câu sai về phantom ở PostgreSQL, luôn giữ câu đúng; vẫn cho qua câu `LOWER(name)` có hai đáp án cùng đúng. `reasoning_effort=high` không bắt thêm được mà chậm 6–21s → không dùng.
### 2026-11-21 — Siết AI tạo bài tập
- `ExerciseAiService`: temperature 0.4; xáo 4 đáp án rồi tính lại `correctIndex`; bỏ câu trùng nhau/trùng câu có sẵn (bỏ hoa/thường, khoảng trắng, so 200 ký tự đầu; flashcard so `front`). `EXERCISE_SYSTEM`: độ khó quyết định đáp án nhiễu (HARD gần giống đáp án đúng, dạng mệnh đề), câu không cụt, cấm “Tất cả các đáp án trên”, explanation khớp `correctIndex`, tự soát đáp án nhiễu, hành vi theo hệ cụ thể, sourceText, code, flashcard.
- TDD (đỏ 4 → xanh): ExerciseAi 14, AiPromptFactory 7, InterviewAi 15 đều đạt.
- Chạy thật 3 lượt (script scratchpad, Groq): AI tự đặt đáp án đúng ở [0,0,0,3] → xáo là cần. Cấu trúc, độ dài, đáp án nhiễu theo độ khó, flashcard đạt. Còn: câu HARD về hành vi riêng của PostgreSQL/MySQL và một câu deadlock vẫn sai kiến thức; một câu EASY có nhiều đáp án đúng. Giới hạn của model, prompt không chặn hết; đang chờ người dùng chọn cách xử lý.
### 2026-11-21 — Siết AI sinh câu và nhận xét
- `InterviewAiService`: temperature 0.2 (nhận xét) / 0.5 (sinh câu); bỏ câu sinh ra trùng nhau hoặc trùng câu cũ của tác giả (bỏ qua hoa/thường, khoảng trắng). `AiPromptFactory`: nhận xét chỉ chấm theo ý trong đáp án mẫu, không trừ ý đúng ngoài đáp án, ca “không biết”/lạc đề, verdict khớp danh sách, ví dụ 3 mức; sinh câu: định nghĩa EASY/MEDIUM/HARD, một yêu cầu/câu, có sourceText thì chỉ dùng sourceText, đáp án 3–6 ý chính xác, hint không lộ đáp án.
- TDD (temperature, lọc trùng, luật prompt: đỏ 4 ca → xanh): InterviewAiService 15, AiPromptFactory 6, ExerciseAi 12 đều đạt.
- Chạy thật (script gọi Groq trực tiếp với prompt mới, ở scratchpad): nhận xét 6 ca × 3 lần ổn định, đúng mức (đủ ý GOOD, ý ngoài đáp án không bị trừ, 2 ý PARTIAL, sai/không biết/chèn lệnh OFF_TRACK). Sinh câu: bám sourceText, bỏ instruction lạc đề; còn sót 1 câu nối “và”, 1 hint liệt kê tên lệnh.
- Backend của người dùng chưa khởi động lại nên app chạy prompt cũ tới khi Stop → Run.
### 2026-11-21 — Kiểm bằng mắt UI 2a + 2b
- Playwright MCP, Vite của người dùng (cổng 3000), backend 8080 của người dùng. Dữ liệu: tạo 3 câu `[Dev]` qua API (bao.author), moderator duyệt 2, 1 chờ duyệt.
- Desktop light 1440: `/interview` (ảnh) + chi tiết (gợi ý/đáp án tách, `/answer` 1 lần, không cuộn ngang). AI nhận xét thật (Groq) chạy đủ, lượt 20 → 19.
- Mobile cảm ứng 390 dark: `/interview`, chi tiết (ảnh), `/author/interview-questions`, `/new`, moderator danh sách + chi tiết: không cuộn ngang, không chữ tràn nút. Sửa 2 link thiếu vùng chạm (20px → 44px). Sửa copy kết quả AI, lưu ý AI, `CHANGES_REQUESTED` theo bảng 2a/2b.
- Test 4 file 21/21 đạt, `npm run build` đạt. Chưa kiểm: desktop dark, mobile light, hộp thoại AI của tác giả trên trình duyệt; danh sách hiện Markdown thô (backtick) trong thẻ — nhỏ, chưa sửa.
### 2026-11-20 — Review UI 2a + 2b do Gemini làm
- Phạm vi: `git diff -- server/` rỗng (không đụng backend). 3 thư mục trang + `interview{Service,I18n}`, `types/interview.ts`, sửa `App.tsx`, 2 sidebar, `navigation`, `managementI18n`, `aiAssist*`.
- `npm run build` đạt. `npx vitest run` 3 thư mục trang + `interviewService`/`interviewI18n`/`aiAssistService`/`Sidebar` test: 7 file, 65/65 đạt. Lần đầu chạy kèm cả `App*.test` song song với build thì 15 ca timeout 5s (cả `App.practice.test` không liên quan) do máy quá tải; chạy riêng thì đạt. Chưa kiểm bằng mắt.
- Lỗi phải sửa: (1) `requestWithQuota` dùng `fetch` thô, bỏ qua refresh token khi 401 → hết hạn token thì AI báo phải đăng nhập; dùng `requestRaw` + `quotaOf`. (2) `returnTo.ts` chỉ nhận đường dẫn khóa học → đăng nhập từ `/interview/:id` về trang chủ. (3) `onCreated` của hộp thoại AI gọi `load()` cũ cùng lúc với effect tải lại → có thể hiện danh sách theo bộ lọc cũ.
- Nhỏ: copy lỗi AI lệch cột “Copy hiển thị”; `quota.limit ?? 15`; trang chi tiết không tải lại khi `authenticated` đổi.
- Đã sửa cả 6 (TDD: ca `returnTo` `/interview` + ca refresh token đỏ → xanh): `requestWithQuota` qua `requestRaw`/`readEnvelope`/`quotaOf`; regex `returnTo` thêm `interview(/id)?`; `reloadTick` thay `load()`; copy AI theo bảng 1c. 8 file test 69/69 đạt, `npm run build` đạt. Chưa kiểm bằng mắt.
### 2026-11-20 — Task 1c: AI sinh câu hỏi và nhận xét câu trả lời
- Code: `InterviewAiService` (hai luồng, chỗ giữ `Kind.DRAFT` dùng chung, hoàn lượt một lần), `AuthorInterviewService.aiContext/aiUsable/saveAiDrafts`, `PublishedInterviewService.feedbackContext` (+ `reader` public cho quota), `InterviewQuestion.markAiAssisted`, `AiPromptFactory` hai prompt, `Kind.INTERVIEW_DRAFT/FEEDBACK`, `AiQuotaResponse.interviewDraft`, `AiAssistProperties` (+2 giới hạn ngày, `interview-timeout`, khóa token `INTERVIEW_DRAFT` 8192/`INTERVIEW_FEEDBACK` 2048), YAML, `.env.example`, `SecurityConfiguration`; `PublishedInterviewController` đổi gốc sang `/api/v1` để chứa `/me/interview-feedback/quota`.
- Lệch khác spec: `count` là `BigDecimal` + `@Digits` (1.5 → 400, như `version` ở 1a); cả sai định dạng lẫn “không câu nào đạt”/nhận xét sai luật đều được sửa một lần rồi mới 422; lấy `count` câu đầu rồi mới kiểm.
- Test (TDD, đỏ do thiếu lớp/hàm → xanh): `./gradlew test --tests 'com.techverse.server.interview.*' --tests 'com.techverse.server.ai.*' --tests '…ExerciseAiServiceTest'` đều đạt: interview 52 (AiService 14 mới, AuthorIntegration 9, PracticeIntegration 10), ai 142, ExerciseAi 12. Ca tích hợp mới viết cùng lúc với unit nên lần đỏ là lỗi biên dịch, không thấy riêng 403/404. Full backend để CI.
- Codex `review` vòng 1: 1 P2 (đúng) — OSIV giữ `Topic` nạp ở `aiContext`, nên lần kiểm lại trước khi lưu đọc trạng thái cũ. Sửa: `activeTopic` gọi `em.refresh` sau khi khóa; thêm ca tích hợp ngừng chủ đề trong lúc model chạy (đỏ 200 → xanh 409, hoàn lượt). `interview.*` 53/53 đạt.
- Codex `adversarial-review` vòng 2 (chỉ phần sửa): approve, không có phát hiện. Người dùng nhận Task 1c (2026-11-20), commit cục bộ.
### 2026-11-20 — Task 1b: Moderator duyệt, trang công khai, đánh dấu
- Code: `ModeratorInterviewService`/`Controller`, `PublishedInterviewService`/`Controller`, `InterviewQuestionMarkRepository` (upsert một câu `ON CONFLICT`), DTO `Review`/`Publication`/`Mark`/`PublicFilter` + `Moderated`/`Published`/`Viewer`/`Answer`, `INTERVIEW_REVIEW_STALE`/`INTERVIEW_AUTHOR_INELIGIBLE`, `SecurityConfiguration`; `findAll` nạp thêm `author`.
- Test (TDD, đỏ 403 do route chưa có → xanh): `./gradlew test --tests 'com.techverse.server.interview.*'` 36/36 đạt (PracticeController 4, PracticeIntegration 9, AuthorIntegration 8, AuthorController 6, Lifecycle 6, Content 2, Migration 1). Full backend để CI.
- Codex `review` vòng 1: 1 P2 — muốn so `reviewToken` trước khi trả 404 cho câu đã rút về `DRAFT`. Từ chối: spec ghi `DRAFT` → 404, token tính được nên trả STALE sẽ lộ bản nháp; giống module bài tập. Không chạy vòng 2. Người dùng nhận Task 1b (2026-11-20), commit cục bộ.
### 2026-11-20 — Task 1a: schema, API tác giả, vòng đời
- Code: `V20__interview_practice.sql`, `InterviewQuestion`(+vòng đời)/`InterviewQuestionMark`, `InterviewStatus`/`InterviewLevel`, `InterviewQuestionRepository`, `InterviewQuestionRequest`/`Response`, `AuthorInterviewService`/`Controller`, 9 mã `INTERVIEW_*`, `SecurityConfiguration`.
- Test (TDD, đỏ do thiếu lớp → xanh): `./gradlew test --tests 'com.techverse.server.interview.*'` 23/23 đạt (Migration 1, Lifecycle 6, Content 2, Controller 6, Integration 8); hồi quy `AdminTopicIntegrationTest` 18/18 đạt. Full backend để CI.
- Codex `review` vòng 1: 1 phát hiện P2 — `version` thập phân (`0.9`) bị Jackson cắt thành `0` rồi ghi. Sửa: `Update.version` là `BigDecimal` + `@Digits(fraction=0)` + `@Min(0)`/`@Max(int)`, service dùng `intValueExact()`; thêm ca `0.9`/`1e20` vào controller test (đỏ → xanh). Chạy lại Controller 6/6 + Integration 8/8 đạt. Ngoài phạm vi: `ExerciseSetRequest` có cùng lỗi (`Integer version`), chưa sửa.
- Codex `adversarial-review` vòng 2 (chỉ phần sửa version): approve, không có phát hiện. Người dùng nhận Task 1a (2026-11-20), commit cục bộ.

## Task 1b — Lệch khác spec
- Gộp test: một `InterviewPracticeControllerTest` (thay `ModeratorInterviewControllerTest` + `PublishedInterviewControllerTest`) và một `InterviewPracticeIntegrationTest` (gồm ca của `ModeratorInterviewIntegrationTest`) theo luật “ít class”, giống bài tập.
- `decision`/`action` là chuỗi + `@Pattern` để giá trị sai ra 400 `VALIDATION_ERROR` (enum sẽ ra `MALFORMED_REQUEST`). `reviewed`/`saved` không phải boolean (vd. `"abc"`) ra 400 body lỗi của handler chung, không phải `VALIDATION_ERROR`.
- Danh sách moderator dùng lại `InterviewQuestionRequest.Filter` của tác giả. `hasHint` có ở cả mục danh sách công khai (không chỉ chi tiết).
- Tài khoản bị khóa gửi token tới mọi API công khai (cả danh sách/chi tiết không lọc `mark`) → 403 `ACCESS_DENIED`, giống trang bài tập.
- Ca khách ở route `permitAll` chỉ kiểm ở test tích hợp (`@WebMvcTest` không nạp `SecurityConfiguration`).

## Task 1a — Lệch khác spec
- Không tạo lớp `InterviewLifecycle`: vòng đời nằm trong entity `InterviewQuestion` (luật “ít class”, giống `ExerciseSet`); `InterviewLifecycleTest` gọi thẳng entity.
- `topicId` nhận chuỗi + `@Pattern` UUID để UUID sai định dạng ra 400 `VALIDATION_ERROR` (UUID trong JSON sẽ ra `MALFORMED_REQUEST`).
- NUL trong `question`/`sampleAnswer`/`hint` → 400 `INTERVIEW_CONTENT_INVALID` (theo dòng “Nội dung Markdown” của bảng).
- Rút/ẩn/xóa: tài khoản hoạt động + có hồ sơ tác giả (mọi trạng thái), để tác giả bị đình chỉ vẫn làm được, còn người không phải tác giả nhận 403 thay vì 404. Hiện lại, tạo, sửa, gửi, sao chép, options dùng `lockWriter`.
- Mã 401 (`AUTH_ACCESS_TOKEN_REQUIRED`/`AUTH_INVALID_ACCESS_TOKEN`) kiểm ở test tích hợp (`@WebMvcTest` không nạp entry point tùy biến, chỉ kiểm status).
- Rate limit dùng hằng Lua nội tuyến (bản sao bộ đếm của bài tập, khóa `interview:rate:create:<user>`), không thêm file script Redis; không sửa file của module bài tập.
