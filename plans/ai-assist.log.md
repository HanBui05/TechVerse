# AI assist — Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`ai-assist.md`](ai-assist.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-05)

- **Task 1a đã nhận (2026-11-05)**, đã commit WIP. Spike Groq đạt; `POST /api/v1/author/ai/outlines` + quota Redis + validator + mapper; Codex review approve. Tiếp: **Task 1b** (session mới). Task: 1a → 1b → 1c → wireframe → 2a → 2b.
- Bài học cho 1b (chi tiết ở “Task 1a → Lệch khác spec”): option runtime phải dựng từ `getDefaultOptions().mutate()` (`AiPromptFactory.options`); `include_reasoning` đặt trong code, không YAML; `spring.ai.retry.*` không có tác dụng.
- Rủi ro: TPM Groq tài khoản 8000 < trần MEDIUM/LONG; có thể gặp 429 khi viết bài dài.
- Chưa kiểm: lớp tích hợp khác sau đổi `ASYNC/ERROR` permitAll (CI chạy full khi mở PR).
- Nền sẵn có từ `article-flow`: editor `/author/blogs/new`, `/author/blogs/:id/edit`; API Author create/save/submit (`Idempotency-Key`), `imageIssues`, validator Markdown (cấm raw HTML/link nguy hiểm, ≤1 MiB), rate-limit Redis, Moderator duyệt version. Spring Boot 4.1.1, Postgres `postgres:16-alpine` (chưa có pgvector), Redis 7.

## Quyết định người dùng chưa có trong spec

- (không có)

## Câu hỏi mở cho người dùng

- (không có — Q3/Q4 hoãn sang module RAG theo Q1=A)

## Nhật ký phiên
### 2026-11-05 — Claude làm Task 1a
- Spike Groq đạt (strict schema, stream không lẫn reasoning, header TPM 8000). Phát hiện: option runtime thay toàn bộ default; `include_reasoning` YAML bị bind thành chuỗi.
- Code outline + quota + validator + mapper + security/CORS; 93 test đạt, `bootJar` đạt. Codex vòng 1: 2 P2 (header quota khi lỗi, deadline chung cho repair) đã sửa; vòng 2 approve.
- Task 1a đã nhận (2026-11-05): đánh dấu `[x]` trong spec, commit WIP, nhờ Codex đồng bộ spec theo log.

### 2026-11-05 — Codex trả lời vòng 2 và đồng bộ spec đã chốt
- Codex chấp nhận đề xuất vòng 2; đã đưa spike tương thích Groq thành bước đầu và tiêu chí “Xong khi” của Task 1a: outline strict JSON Schema + stream ngắn qua runtime thật, kiểm `include_reasoning`/content, ghi `x-ratelimit-*`; không commit khóa/output, không thêm test mạng.
- Đã đưa quyết định chốt ngày 2026-11-05 vào thân spec, xóa dòng khỏi bảng quyết định chờ và rút gọn phần phản biện sau khi chốt. Nếu spike không đạt thì dừng hỏi; thiếu khóa/kết nối thì ghi “Chưa kiểm” và người dùng quyết định.
- Đã cập nhật `PLAN.md`: spec ở trạng thái Đã chốt, tiếp Task 1a.

### 2026-11-04 — Claude phản biện vòng 2
- Soát phần sửa vòng 1: đạt. Một điểm thiếu: kiểm tương thích Groq (`include_reasoning`, strict schema, reasoning trong stream, TPM cho LONG) đang ở smoke cuối module → đề xuất spike gọi thật một lần ở đầu Task 1a, cần `AI_API_KEY` Groq của người dùng.
- Quyết định người dùng mới: Q6 đổi từ dialog sang trang riêng sau khi so sánh (đã ghi ở bản quyết định, Codex đã đưa vào spec).

### 2026-11-04 — Codex trả lời vòng 1 và đồng bộ quyết định
- Codex đã đưa Q1–Q7 và ngôn ngữ đầu ra vào thân spec; xóa toàn bộ dòng tương ứng khỏi “Quyết định người dùng chưa có trong spec”.
- Xác minh Groq bằng tài liệu chính thức: base URL Spring AI có `/openai/v1`, model `openai/gpt-oss-120b`, stream/JSON Schema/tool/reasoning/token/error/rate-limit; phần reasoning theo từng chunk chưa có tài liệu đủ rõ nên giữ câu hỏi kỹ thuật + smoke gate.
- Thu phạm vi về bản 1; rút thiết kế bản 2/3 thành định hướng ngắn. Thêm Task 1c/2b cho V11 `ai_assisted`, handoff `aiGenerationId` đã xác thực, DTO Author/Moderator và badge Moderator; Reader không hiển thị.
- Đã trả lời từng điểm Sai 1–2, Thiếu 1–9, Thừa 1–2 và ba đề xuất ngoài spec trong `ai-assist.md`.

### 2026-11-04 — Claude phản biện vòng 1 + chốt Groq
- Ghi “Phản hồi vòng 1” vào spec: 2 sai (retry hai lớp `spring.ai.retry.max-attempts` mặc định 10; token reasoning cần `max-completion-tokens`), 9 thiếu (security matcher `/api/v1/author/ai/**` ở 1a + dispatch ASYNC, cách cài SSE, context cache test, heading khớp dàn ý, hoàn quota khi lỗi server, hợp nhất tag, ngôn ngữ đầu ra, SHA-256, deadline theo độ dài), 2 thừa, 3 đề xuất ngoài spec.
- Người dùng chốt Q2 = Groq. Tiếp: Codex trả lời vòng 1 + cập nhật spec; người dùng chốt Q1, Q3–Q7.

### 2026-11-04 — Codex viết spec AI assist
- Codex đã đưa toàn bộ quyết định người dùng vào `ai-assist.md`; mục quyết định chờ đồng bộ đã được dọn.
- Spec chốt nền Spring AI 2.0.2/Boot 4.1.1, contract outline/SSE/cancel/rewrite, prompt, validation, quota, ChatMemory, tool và thiết kế RAG có điều kiện.
- Chia chi tiết Task Backend → cổng wireframe → UI, test theo ngân sách; không sửa code ứng dụng.
- Còn chờ người dùng chốt Q1–Q7 và Claude phản biện vòng 1.

### 2026-11-04 — Mở module
- Tạo nhánh `feature/ai-assist` từ `main`, log này, dòng module trong `PLAN.md`. Ghi quyết định ý tưởng/luồng/công nghệ của người dùng. Tiếp: Codex viết spec chi tiết; Claude phản biện vòng 1.

## Task 1a — Backend nền Spring AI + outline

### Spike Groq (2026-11-05) — Đạt

- Provider/model: Groq `openai/gpt-oss-120b`, Spring AI 2.0.2 (`OpenAiChatAutoConfiguration` thật, `openai-java-core` 4.80.0), đi qua proxy ghi nhận cục bộ để xem request trên dây. Runner/proxy/output đã xóa, không commit.
- Outline strict JSON Schema (`BeanOutputConverter`, `strict=true`, `max_completion_tokens=2048`): 200, `finish=stop`, parse được, topicId giữ đúng. Groq chấp nhận schema sinh từ converter (có `$schema`, `additionalProperties`, `required`).
- Stream ngắn: 200, delta trên dây chỉ có `role`/`content` (không có field reasoning), content không có `<think>`. Request có `include_reasoning=false` (boolean), `reasoning_effort=low`, không có `max_tokens`.
- Header: `x-ratelimit-limit-requests=1000`, `x-ratelimit-limit-tokens=8000` (TPM), `remaining-requests≈994–999`, `remaining-tokens≈6900–7360`, `reset-requests≈1–9 phút`, `reset-tokens≈5–8s`. Request có `max_completion_tokens=16384` (> TPM) vẫn 200.

### Lệch khác spec

- **Option runtime thay thế toàn bộ default**: `OpenAiChatModel` bỏ qua cấu hình `spring.ai.openai.chat.*` khi prompt mang `OpenAiChatOptions` (spike thấy model rơi về `gpt-5-mini`). Code dựng option runtime bằng `((OpenAiChatOptions) chatModel.getDefaultOptions()).mutate()`.
- **`extra-body.include_reasoning` không đặt trong YAML**: Spring bind `Map<String,Object>` thành chuỗi `"false"`, Groq trả 400 “value must be a boolean”. Code đặt `extraBody(Map.of("include_reasoning", false))` ở option runtime.
- `spring.ai.retry.*` không có tác dụng: starter OpenAI 2.0.2 không kéo `spring-ai-retry`, `OpenAiChatModel` không dùng RetryTemplate. Vẫn giữ property theo spec; chặn retry thật là `spring.ai.openai.max-retries=0`.
- `api-key: ${AI_API_KEY:}` (có default rỗng) thay vì `${AI_API_KEY}`: key rỗng làm SDK chạy no-auth thay vì lỗi, nên kiểm thiếu key do `AiAssistConfiguration` làm.
- Thêm `spring.ai.model.{embedding,image,moderation,audio.speech,audio.transcription}=none`: starter bật mặc định các model này.

### Rủi ro cần người dùng biết

- TPM tài khoản 8000 < trần MEDIUM 8192/LONG 16384. Groq không chặn trước, nhưng một bài dài thật có thể chạm 429 giữa chừng → `AI_PROVIDER_RATE_LIMITED`. Không tự nới/hạ trong code theo spec; smoke cuối module sẽ cho số liệu thật.

### Code + test (2026-11-05)

- Đã làm: BOM/starter, property `spring.ai.*` + `ai.assist.*`, `.env.example`/`compose.yaml`; `AiAssistConfiguration` (fail-fast `openai` thiếu key, async timeout > deadline LONG; bean `Clock`); `AiAssistProperties` (validate tên property); `AiRateLimitService` (Lua reserve/refund idempotent, Asia/Ho_Chi_Minh, fail-closed); `AiGeneratedContentValidator` (outline); `AiProviderExceptionMapper`; `AiPromptFactory`; `AiOutlineService` (transaction ngắn → reserve → strict schema → 1 repair → refund khi lỗi); `AuthorAiController` `POST /api/v1/author/ai/outlines` + header quota; security matcher + `ASYNC/ERROR` permitAll + CORS expose; `ErrorCode` AI_*.
- Lệnh: `./gradlew test` 6 lớp spec → Validator 9, Service 12, Mapper 20, RateLimit 9, Controller 6, `AuthorArticleIntegrationTest` 37 (3 ca mới): **93/93 đạt**. `./gradlew bootJar` đạt. `grep AI_API_KEY|spring.ai.openai.api-key app` không có kết quả.
- Lệch thêm: `length` trong request là chuỗi `@Pattern(SHORT|MEDIUM|LONG)` để giá trị lạ ra `VALIDATION_ERROR` theo bảng lỗi (enum thật trả `MALFORMED_REQUEST`). Prompt outline thêm `selectedTags` + `targetWords` và đổi dòng “tagIds chỉ chọn từ activeTags” thành “suggestedTagIds … không lặp selectedTags” cho khớp validator. Prompt chỉ liệt kê tối đa 100 tag active (`shortcut:` trong code). Vi phạm `suggestedTagIds` (ngoài allowlist/trùng tag đã chọn/quá 5) bị coi là lỗi output → repair, không lọc im lặng. CORS expose kiểm ở test tích hợp (cần filter chain thật), không ở `@WebMvcTest`. Kiểm `AiRateLimitServiceTest` dùng Redis Testcontainers không Spring để chạy Lua thật.
- Chưa kiểm: các lớp tích hợp khác dùng `SecurityConfiguration` (đổi `ERROR/ASYNC` permitAll) không chạy lại tại máy — CI chạy full khi mở PR. Ca `asyncDispatch` qua filter chain thuộc Task 1b (chưa có stream).

### Review Codex vòng 1 (2026-11-05) — 2 phát hiện P2, đã sửa

- [P2] Phản hồi lỗi outline sau khi giữ lượt không có header quota (trái “Header quota … sau debit/refund”). Sửa: `AuthorAiService.QuotaAwareException` mang quota sau refund; `AuthorAiController` có `@ExceptionHandler` riêng trả `ErrorResponse` chuẩn + `X-AI-Quota-*`. Refund lỗi Redis → `CustomException` thường, không header.
- [P2] Repair dùng lại trọn `outline-timeout` → request có thể ~2× deadline. Sửa: một deadline chung từ `Clock` (bean ở `AiAssistConfiguration`); repair chỉ nhận thời gian còn lại, hết hạn trước repair → `AI_TIMEOUT` + refund.
- Test sau sửa: `AiOutlineServiceTest` 15/15 (+3 ca), `AuthorAiControllerTest` 6/6 (ca lỗi có header), `AuthorArticleIntegrationTest` 37/37, `bootJar` đạt.
