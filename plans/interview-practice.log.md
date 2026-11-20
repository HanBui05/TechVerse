# Interview practice — nhật ký

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`interview-practice.md`](interview-practice.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-20)

- **Task tiếp:** Hết task của module; còn đồng bộ spec một lần (skill `codex-workflow` mục 3) rồi PR khi người dùng yêu cầu · Giao diện: Không
- Task 1a, 1b, 1c đã nhận (2026-11-20); Task 2a, 2b (UI do Gemini làm, Claude review + sửa) đã nhận (2026-11-21).
- Chưa kiểm của 2a/2b: kiểm bằng mắt dark/light × desktop/mobile (người dùng tự xem trên localhost:3000).
- Chưa kiểm của 1c: prompt chưa thử với Groq thật.
- Nhánh `feature/interview-practice` (cắt từ `docs/exercise-practice-spec-sync`, gồm `main` sau PR #11 + commit đồng bộ spec bài tập). Mọi task đã commit cục bộ, chưa push.

## Quyết định người dùng chưa có trong spec

- 2026-11-20: bỏ cổng wireframe của module này; Gemini làm giao diện Task 2a + 2b theo `plans/interview-practice.gemini-prompt.md` (không sửa backend), Claude review sau.

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
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
