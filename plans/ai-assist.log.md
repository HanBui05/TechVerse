# AI assist — Log

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`ai-assist.md`](ai-assist.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-06)

- **Task 2a đã nhận (2026-11-06)** (gồm API `GET /api/v1/author/ai/quota`). **Task 2b đã nhận (2026-11-06).** Đã xong mọi task. **Tiếp: cuối module** — Codex đồng bộ spec một lần (skill `codex-workflow` mục 3) và smoke Groq thật (spec “Kiểm thật cuối module”, cần `AI_API_KEY`).
- Chưa kiểm 2a: kiểm mắt dark/light × desktop/mobile `/author/blogs/ai` + banner editor (backend/dev server không chạy lúc làm); stream Groq thật (smoke cuối module).
- Bài học (Spring AI/Spring 7): option runtime dựng từ `getDefaultOptions().mutate()` (`AiPromptFactory.options`); `include_reasoning` đặt trong code; **emitter đã đóng khi callback timeout chạy** → service tự áp deadline trên Flux, emitter dư 5 giây.
- Rủi ro: TPM Groq tài khoản 8000 < trần MEDIUM/LONG; có thể gặp 429 khi viết bài dài. Registry cancel chỉ một instance.
- Chưa kiểm: stream Groq thật (smoke cuối module); lớp tích hợp khác sau đổi `ASYNC/ERROR` permitAll (CI chạy full khi mở PR).
- Nền sẵn có từ `article-flow`: editor `/author/blogs/new`, `/author/blogs/:id/edit`; API Author create/save/submit (`Idempotency-Key`), `imageIssues`, validator Markdown (cấm raw HTML/link nguy hiểm, ≤1 MiB), rate-limit Redis, Moderator duyệt version. Spring Boot 4.1.1, Postgres `postgres:16-alpine` (chưa có pgvector), Redis 7.

## Quyết định người dùng chưa có trong spec

- 2026-11-06: làm ngay trong Task 2a API `GET /api/v1/author/ai/quota` → `ApiResponse<{outline:{limit,remaining}, draft:{limit,remaining}}>` (chỉ đọc, không trừ lượt; quyền như các endpoint AI khác) để trang AI hiện số lượt ngay khi mở, thay vì `—` tới lần dùng đầu. Thay quyết định wireframe “API quota tách module sau”.

## Câu hỏi mở cho người dùng

- (không có — Q3/Q4 hoãn sang module RAG theo Q1=A)

## Nhật ký phiên
### 2026-11-06 — Claude làm Task 2b
- Task 2b đã nhận (2026-11-06), commit cục bộ.
- Badge `AI hỗ trợ`/`AI-assisted` (tone blue, đứng đầu danh sách status) ở Moderator list/detail; copy `aiAssisted` trong `moderatorCopy`. Type đã có sẵn từ 2a (`ModeratorArticleDetail.article: AuthorArticle`), không sửa `types/articles.ts`.
- Lệch khác spec: badge đặt trong `components/articles/ArticleStatusBadges.tsx` (chỉ khi `moderator`) thay vì sửa hai trang — một chỗ, cùng `<ul>` status; Author không thấy badge. Thêm 1 ca ở `ArticleStatusBadges.test.tsx`.
- TDD: 3 ca mới đỏ vì thiếu badge → xanh. `npx vitest run` ModeratorArticlesPage, ModeratorArticleDetailPage, ArticleStatusBadges, AuthorBlogsPage, ArticleEditorPage: **41/41 đạt**; `npm run build` đạt. Kiểm tĩnh: `aiAssisted` không xuất hiện trong `pages/Blogs`, `pages/Home`, service public; `PublicArticle*` không có field.
- Review vòng 1 (Codex `review`): không phát hiện.
- Kiểm mắt (Playwright MCP, Moderator, `page.route` đặt `aiAssisted=true` trên response thật vì DB dev chưa có bài AI): list/detail × light/dark × desktop (2048, 1440) + mobile cảm ứng 390 — badge không tràn, không đè nhóm action, không cuộn ngang. Phát hiện: list mobile, hàng badge cùng dòng ép cột tiêu đề ~50px (có từ trước, badge làm nặng thêm) → `max-sm:basis-full` cho cột nội dung trong `ModeratorArticlesPage.tsx`; sau sửa tiêu đề 306px, badge xuống dòng; desktop giữ cùng dòng. Chạy lại 3 test Moderator/badge 20/20 đạt, build đạt.

### 2026-11-06 — Claude làm Task 2a
- Task 2a đã nhận (2026-11-06), commit cục bộ. Lỗi chèn ảnh khi chạy thử: người dùng tự xử lý.
- Trang `/author/blogs/ai` (form → dàn ý → stream SSE → handoff create SAVE + `aiGenerationId`), `AiOutlineEditor`, `aiAssistService` (parser SSE, SHA-256, cancel/keepalive), `requestRaw`/`readEnvelope` trong `api/client.ts`, i18n vi/en, nút “Tạo bằng AI”, banner AI ở editor.
- 8 file test liên quan 198/198 đạt, `npm run build` đạt. Kiểm mắt: Chưa kiểm. Review vòng 1: 2 P2 (CRLF tách chunk SSE; sửa form không vô hiệu completed/tag outline) đã sửa.

- 2026-11-06 — Codex: đã đưa quyết định duyệt wireframe 2a và phản hồi vòng 1 vào `ai-assist.wireframe.md`/Task 2a trong spec; mở Task 2a, API quota tách module sau.

### 2026-11-06 — Claude phản biện wireframe vòng 1
- Ghi “Phản hồi vòng 1 (Claude)” trong `plans/ai-assist.wireframe.md`: 3 sai (quota `—/10` đoán limit, nút Chọn lại taxonomy, khóa stream sau F5 tới deadline+5s), 4 thiếu (validation outline khớp `AiDraftRequest`, cách tính “Phần x/y”, map tên thẻ gợi ý, focus/aria mobile), 2 thừa, 3 đề xuất (DELETE keepalive khi rời trang; giữ bản completed qua F5 — cần người dùng chọn; API quota tách module sau).
- Chờ Codex trả lời vòng 1, rồi người dùng duyệt wireframe; Task 2a chưa mở.

- 2026-11-06 — Codex: đã viết `ai-assist.wireframe.md` cho cổng trước Task 2a (luồng, desktop/mobile, state/error, edge case và câu hỏi chốt); chưa code UI, chờ Claude phản biện và người dùng duyệt.
### 2026-11-06 — Giảm token toàn dự án (người dùng chốt)
- `CLAUDE.md` 12 KB → ~7 KB: bỏ skill `superpowers:*` (luật TDD/kiểm chứng/debug viết ngắn tại chỗ); review vòng 2 chỉ khi vòng 1 có phát hiện; nghiệm thu từng task không đánh `[x]` spec, không nhờ Codex đồng bộ — làm một lần cuối module.
- `ui-ux-pro-max` tắt ở `.claude/settings.json`, bật trong `settings.local.json` tới hết Task 2b; hook SessionStart nhắc khi plugin không khớp task. Stop hook chỉ theo dõi `app/`, `server/`.
- Nhờ Codex sửa `AGENTS.md`, `plans/_template.md`, `PLAN.md` cho khớp. Người dùng tự tắt plugin superpowers/anthropic-skills nếu muốn.

### 2026-11-06 — Claude kiểm lại Task 1b + 1c
- Chạy lại 8 lớp (DraftStream 26, Validator 16, Controller 15, Outline 15, AuthorArticleIntegration 42, Lifecycle 21, PublicationMigration 7, ModeratorArticleIntegration 19): **161/161 đạt**; `bootJar` đạt.
- Đọc diff 1c: fingerprint create khớp stream (title/summary `strip()` hai phía, content giữ nguyên, tag sort); claim Lua giữ TTL gốc; update/SUBMIT kèm marker → `AI_GENERATION_INVALID`. Không có blocker.
- Task 1c đã nhận (2026-11-06): đánh `[x]` 7/7 “Xong khi” 1c, commit cục bộ 1b + 1c, nhờ Codex đồng bộ spec.

### 2026-11-05 — Codex làm Task 1c, chờ Claude review
- Đã thêm Flyway `V11__add_article_ai_assisted.sql`, entity `Article.aiAssisted` mặc định `false` và method provenance chỉ chuyển sang `true`; đồng bộ `docs/technical/db/final.sql` + `docs/PROJECT_CONTEXT.md`.
- `ArticleWriteRequest` nhận optional `aiGenerationId`. Create chỉ nhận marker với `SAVE`; `AiCompletedGenerationRepository.claim` dùng Lua nguyên tử để đối chiếu actor/generation (qua Redis key), canonical fingerprint và bind đúng một `Idempotency-Key`. Retry cùng generation/key được replay; key/payload khác, receipt thiếu/hết hạn/foreign, marker trên update/SUBMIT trả `409 AI_GENERATION_INVALID`.
- Receipt Redis chỉ có `fingerprint` + `claimKey`, giữ TTL gốc 24 giờ; create có marker fail-closed khi Redis lỗi, create thủ công không gọi receipt AI. Cờ giữ qua edit/save/submit/approve/discard/publication.
- Author list/detail và Moderator list/detail/review trả `aiAssisted`; kiểm tĩnh khóa `PublishedArticle*`, `SavedArticle*`, `RelatedArticle*` không có field này.
- TDD: migration/entity đỏ vì thiếu method/cột; integration đỏ vì chưa có contract/claim; Moderator đỏ vì thiếu mapping. Lệnh nghiệm thu 4 lớp: **89/89 đạt**. `./gradlew bootJar`: **đạt**. `git diff --check`: đạt (chỉ có cảnh báo LF/CRLF của file Task 1b có sẵn).
- Chưa đánh `[x]` Task 1c và chưa nhận hoàn tất: chờ Claude review theo yêu cầu người dùng.

### 2026-11-05 — Chuyển focus sang Task 1c
- Người dùng cho chuyển sang Task 1c. Codex đối chiếu log Task 1b: 6/6 nhóm nghiệm thu có bằng chứng, 95/95 test mục tiêu + `bootJar` đạt, review vòng 2 không còn blocker; đã đánh `[x]` toàn bộ “Xong khi” Task 1b.
- Cập nhật `PLAN.md` sang “Đang thực hiện”, Task hiện tại 1c. Chưa sửa code Task 1c trong bước chuyển focus.

### 2026-11-05 — Claude làm Task 1b
- Draft SSE + cancel + registry + receipt + validator draft theo “Task 1b — Kế hoạch thực thi”; 109 test đạt (5 lớp), `bootJar` đạt.
- Phát hiện: Spring 7 đóng emitter trước callback timeout → không gửi được `AI_TIMEOUT` từ đó; service tự áp deadline (`Flux.timeout` tuyệt đối), emitter = deadline + 5s.
- Bỏ `spring.ai.retry` khỏi `application.yaml` theo spec đồng bộ. Ghi bẫy `SseEmitter` timeout vào `.claude/rules/backend.md`. Việc dở: Codex review vòng 1 (đang chạy).
- 2026-11-05 — Codex: đã đưa “Lệch khác spec” của Task 1a vào thân spec và giữ nguyên phạm vi/kế hoạch Task 1b.

### 2026-11-05 — Kế hoạch Task 1b + cập nhật rule/skill
- Người dùng yêu cầu lên kế hoạch kỹ cho 1b: ghi ở “Task 1b — Kế hoạch thực thi” (thứ tự TDD, phần dùng lại từ 1a, điều đã xác minh trong source: dispose → đóng stream Groq).
- Rule/skill mới: `backend.md` mục Spring AI + cách dùng khóa `.env`; `backend-test` mục “Bẫy đã gặp” + lệnh đếm test; `codex-workflow` review qua `run_in_background`, prompt đồng bộ có “Lệch khác spec”; `CLAUDE.md` chỗ ghi kế hoạch thực thi.
- Nhờ Codex đưa “Lệch khác spec” Task 1a vào thân spec.

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

## Task 1b — Kế hoạch thực thi (Claude, 2026-11-05)

Nguồn sự thật vẫn là spec mục “2. Viết draft dạng SSE” + “Task 1b”; đây là thứ tự làm và các lựa chọn kỹ thuật đã chốt sẵn để phiên sau không dò lại.

**Đã có từ 1a — dùng lại, không làm lại:** không spike/gọi Groq thật trong 1b. Dùng `AiPromptFactory.options(...)` (dựng từ default + `include_reasoning` boolean), `AiRateLimitService.reserve/refund(Kind.DRAFT)`, `AiProviderExceptionMapper`, `AuthorAiService.QuotaAwareException` + handler trong controller, bean `Clock`, `ASYNC/ERROR` permitAll + matcher `/api/v1/author/ai/**` đã có, `@MockitoBean ChatModel` ở `ArticleIntegrationTestBase`, mẫu `@WebMvcTest` của `AuthorAiControllerTest`.

**Đã xác minh trong source Spring AI 2.0.2 (khỏi đọc lại):** `OpenAiChatModel.internalStream` gắn `sink.onDispose(response::close)` → dispose subscription đóng HTTP stream tới Groq (Dừng ngắt provider thật). Chunk cuối có thể `getResult()==null` (chunk usage) → bỏ qua. Stream trên dây chỉ có `content`; metadata `reasoningContent` rỗng vẫn xuất hiện → không phát.

**Thứ tự (TDD, mỗi bước test đỏ → code → xanh):**
1. `AiGeneratedContentValidator.validateDraft(content, sections) → List<String>`: parser CommonMark riêng trong validator (không sửa `ArticleContentService`), rồi `validateContent`. Bổ sung ca vào `AiGeneratedContentValidatorTest` đúng bullet 3 của spec.
2. DTO: `AiDraftRequest` (cùng kiểu `AiOutlineRequest`: strip, `Nulls.FAIL`, field lạ → `MALFORMED_REQUEST`, `length` chuỗi `@Pattern`; `sections` 3–8 lồng `@Valid`, H3 ≤4, heading 5–120, trùng → `@AssertTrue`); `AiStreamEvent` (record lồng cho metadata/delta/completed/cancelled/error); `AiGenerationStatusResponse(generationId, status)`. Thêm `ErrorCode.AI_GENERATION_IN_PROGRESS` (409), `AI_GENERATION_NOT_FOUND` (404).
3. `AiGenerationRegistry` (unit, `Clock` giả): `start` → 409 nếu Author đang có stream; `cancel(actor,id)` → `CANCELLED`/`ALREADY_FINISHED`/404 (không lộ owner); `finish` idempotent; tombstone giữ timeout + 10 phút, dọn khi truy cập.
4. `AiCompletedGenerationRepository`: Redis `ai:completed:{authorId}:{generationId}`, TTL `completed-generation-ttl`, chỉ fingerprint SHA-256 canonical (title, summary, content, topicId, tagIds đã sort) + `claimKey=null`. 1b chỉ **lưu**; verify/claim là Task 1c.
5. `AiDraftStreamService`: preflight đồng bộ (transaction ngắn `lockWriter` + taxonomy → `ChatModel` có → registry 409 → reserve DRAFT) rồi mới tạo `SseEmitter(deadline theo length)`. Subscribe `model.stream(prompt)`, gửi event trên executor bounded riêng `aiSseTaskExecutor` (mẫu `AvatarConfiguration`). Mọi kết thúc đi qua một `terminate(outcome)` có `AtomicBoolean`: completed (validate → lưu receipt → `completed` có sha/bytes/quotaRemaining), error (refund → event `error` + quota sau refund), cancelled (DELETE/disconnect: dispose, **không** refund), timeout (`emitter.onTimeout` → dispose + refund + `AI_TIMEOUT`). `finishReason=LENGTH` → `AI_OUTPUT_TRUNCATED`; thiếu finish → `AI_PROVIDER_UNAVAILABLE`. Quick guard trong stream: NUL, vượt 1 MiB, `![`, HTML thô rõ ràng → `AI_OUTPUT_INVALID` sớm. Log chỉ generationId/actor/outcome/ms.
6. Controller: `POST /drafts:stream` (`text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`, header quota); `DELETE /generations/{id}` → `ApiResponse` “AI generation cancellation processed”.
7. Integration: 1 ca stream qua filter chain thật (`asyncStarted` → `asyncDispatch` → có `event:completed`, số row `articles` không đổi), stub `chatModel.stream` trả `Flux.just(...)`.
8. Việc nhỏ kéo từ đồng bộ spec 2026-11-05: spec giờ ghi “không khai báo `spring.ai.retry.*`” → xóa nhóm `spring.ai.retry` khỏi `application.yaml` và dòng assert `spring.ai.retry.max-attempts` trong `AiOutlineServiceTest.applicationYamlDefaultsTargetGroqWithoutRetries`.
9. Cuối task: lệnh spec + `AiOutlineServiceTest` (nếu sửa `AiPromptFactory`/validator dùng chung) + `bootJar`, chạy một lần.

**Lựa chọn kỹ thuật tự chốt (ghi vào “Lệch khác spec” khi code):** body >16 KiB → kiểm `Content-Length` đầu method, trả `400 VALIDATION_ERROR` field `body` (`shortcut:` chunked không có Content-Length thì chặn luôn). Draft không có repair (spec: invalid → error). Deadline = timeout của emitter = timeout request SDK theo length.

**Không thuộc 1b:** `aiGenerationId` trong `ArticleWriteRequest`, V11, DTO `aiAssisted` (Task 1c); UI (2a).

## Task 1b — Code + test (Claude, 2026-11-05)

- Đã làm: `AiGeneratedContentValidator.validateDraft` (CommonMark riêng + `validateContent`); `AiDraftRequest` (sections lồng, `distinctHeadings`), `AiStreamEvent`, `AiGenerationStatusResponse`; `ErrorCode.AI_GENERATION_IN_PROGRESS/NOT_FOUND`; `AiGenerationRegistry`; `AiCompletedGenerationRepository` (Lua `HSET fingerprint` + `EXPIRE`, chỉ SHA-256 canonical); `AiDraftStreamService` (`start` preflight → `stream` một `end()` duy nhất); prompt draft trong `AiPromptFactory`; bean `aiSseTaskExecutor` (8 luồng, hàng đợi 16) ở `AiAssistConfiguration`; controller 2 endpoint; tách `AiOutlineService.select` dùng chung taxonomy.
- Lệnh: `./gradlew test` 4 lớp spec + `AiOutlineServiceTest` → DraftStream 25, Validator 16, Controller 15, `AuthorArticleIntegrationTest` 38, Outline 15: **109/109 đạt**. `./gradlew bootJar` đạt. Thử đột biến: bỏ `Flux.timeout` → ca deadline đỏ.
- Chưa kiểm: Groq stream thật; ca tích hợp/controller viết sau code (không thấy đỏ trước), service test chạy xanh ngay lần đầu.

### Lệch khác spec

- **Deadline do service áp, emitter dư 5 giây** (`EMITTER_GRACE`): Spring 7 đánh dấu emitter hoàn tất trước khi chạy callback timeout (`send` ném `IllegalStateException`, đã chứng minh ở `AuthorAiControllerTest`), nên event `AI_TIMEOUT` phải phát từ `Flux.timeout(deadline)` trong service. Emitter = 95/125/185s (< async 195s). Callback timeout của emitter chỉ còn là dự phòng dọn dẹp + refund. `metadata.timeoutSeconds` vẫn là 90/120/180.
- Body >16 KiB: kiểm `Content-Length` sau khi bind → `400 VALIDATION_ERROR` `fieldErrors.body`; không có `Content-Length` (chunked) cũng bị chặn (`shortcut:` trong code).
- Quick guard chỉ xét dòng hoàn chỉnh ngoài code fence: NUL, >1 MiB, dòng bắt đầu `![` hoặc `<tag`. `List<String>` trong code fence không bị chặn.
- `finishReason` khác `stop`/`length` (vd. `content_filter`) → `AI_PROVIDER_UNAVAILABLE`. Draft không có repair call.
- Receipt chỉ lưu `fingerprint` (hash Redis); không có field `claimKey` nghĩa là chưa claim (Task 1c thêm claim). Cancel dùng `AiDraftStreamService.cancel` → registry; registry dọn mục hết hạn (kể cả mục running bị rò) khi truy cập.
- Headings trùng nhau (không phân biệt hoa thường, cả H2/H3) → `fieldErrors.distinctHeadings`.

## Task 1b — Review Codex vòng 1 (2026-11-05) — 1 phát hiện P2

- [P2] `AiDraftStreamService.Run.begin()` dùng `subscribeOn(Schedulers.fromExecutor(executor))`. `subscribeOn` chỉ chuyển thao tác đăng ký subscription; các signal do HTTP client/provider và timer phát vẫn có thể gọi `chunk`/`failed`/`ended`, rồi `SseEmitter.send`, ngay trên thread provider/Reactor. Điều này trái tiêu chí Task 1b yêu cầu chuyển việc ghi SSE sang executor bounded riêng và có thể chặn event-loop khi client đọc chậm. Cần chuyển toàn bộ signal/terminal callback sang `aiSseTaskExecutor` (ví dụ đặt ranh giới `publishOn` đúng phía để cả timeout error cũng đi qua executor) và thêm đúng một ca unit test cho provider phát từ thread khác, assert emitter được ghi trên executor AI.
- Đối chiếu “Xong khi”: 6/6 nhóm có code/test tương ứng; log ghi 109/109 test mục tiêu và `bootJar` đạt. Task chưa đạt review cho tới khi sửa P2 trên.
- Không chạy lại Gradle theo quy ước review Windows; kết luận test dựa trên kết quả Claude đã ghi trong log.

### Sửa review vòng 1 (Codex thay Claude theo yêu cầu người dùng, 2026-11-05)

- TDD đỏ: thêm `providerSignalsAreWrittenToTheEmitterOnTheAiExecutor`; với code cũ, cả 4 lần ghi `delta/completed` chạy trên `provider-test`, ca test thất bại đúng nguyên nhân.
- Sửa tối thiểu: giữ `subscribeOn` cho bước subscribe provider và thêm `publishOn(Schedulers.fromExecutor(executor))` sau `timeout`, nên signal thường lẫn timeout error đều đi qua `aiSseTaskExecutor` trước `chunk`/`failed`/`ended` và `SseEmitter.send`.
- TDD xanh: ca regression riêng đạt; toàn bộ `AiDraftStreamServiceTest` đạt 26/26.
- Kiểm cuối task theo spec: `AiDraftStreamServiceTest` 26, `AiGeneratedContentValidatorTest` 16, `AuthorAiControllerTest` 15, `AuthorArticleIntegrationTest` 38 — **95/95 đạt**; `./gradlew bootJar` đạt. Chờ review vòng 2, chỉ xem diff sửa từ vòng 1.

## Task 1b — Review Codex vòng 2 (2026-11-05) — Đạt

- Chỉ xem phần sửa vòng 1: `publishOn` được đặt sau `timeout`, nên provider signal và timeout error đều đi qua `aiSseTaskExecutor` trước `chunk`/`failed`/`ended` và thao tác ghi SSE.
- Test mới dùng provider thread và AI executor tách biệt, đã đỏ với code cũ và xanh sau sửa; log kiểm chứng ghi 95/95 test mục tiêu và `bootJar` đạt.
- Không còn phát hiện cao/trung trong phạm vi sửa vòng 1. Không chạy lại Gradle ở bước review theo quy ước Windows; dựa vào kết quả implementer vừa ghi.

## Task 1b — Đã triển khai (chờ Claude kiểm lại, chưa chốt hoàn tất)

- API `POST /api/v1/author/ai/drafts:stream` trả SSE typed events `metadata`, `delta`, `completed`, `cancelled`, `error`; không tạo article trong lúc stream.
- API `DELETE /api/v1/author/ai/generations/{generationId}` hỗ trợ cancel idempotent, owner isolation và trạng thái `CANCELLED`/`ALREADY_FINISHED`.
- `AiDraftRequest` và validation đầu vào: title/summary/idea/audience/length, topic/tag, 3–8 H2, tối đa 4 H3 mỗi mục, heading/tag không trùng, body tối đa 16 KiB.
- `AiDraftStreamService` gọi model theo dàn ý, chỉ phát assistant content, áp deadline theo SHORT/MEDIUM/LONG, dispose provider khi cancel/disconnect/timeout và xử lý refund quota theo contract.
- `AiGeneratedContentValidator` kiểm toàn văn Markdown: giới hạn 1 MiB UTF-8, không raw HTML/ảnh/link nguy hiểm, chỉ H2/H3 đúng thứ tự dàn ý, H3 không mồ côi và code fence có language.
- `AiGenerationRegistry` giới hạn một stream/Author, giữ tombstone để DELETE idempotent và dọn entry hết hạn.
- `AiCompletedGenerationRepository` lưu receipt Redis 24 giờ dưới dạng fingerprint SHA-256 canonical; receipt được lưu trước event `completed`, chưa verify/claim sang article vì phần đó thuộc Task 1c.
- Luồng provider signal và timeout error đi qua `aiSseTaskExecutor` trước khi ghi SSE; lỗi `subscribeOn` ở review vòng 1 đã sửa bằng `publishOn` và có test thread đỏ/xanh.
- Kiểm chứng gần nhất: 95/95 test mục tiêu đạt (`AiDraftStreamServiceTest` 26, validator 16, controller 15, integration 38) và `bootJar` đạt. Codex review vòng 2 không còn blocker cao/trung.
- **Chưa chốt hoàn tất:** các checkbox “Xong khi” của Task 1b trong spec vẫn để `[ ]`; chờ Claude đối chiếu lại code/test/log. Khi Claude xác nhận, cập nhật Task 1b rồi bắt đầu Task 1c.

## Task 2a — Code + test (Claude, 2026-11-06)

- Lệnh: `npx vitest run src/services/aiAssistService.test.ts src/components/articles/AiOutlineEditor.test.tsx src/pages/Author/AiArticlePage.test.tsx src/pages/Author/AuthorBlogsPage.test.tsx src/pages/Author/ArticleEditorPage.test.tsx src/App.author-session.test.tsx src/App.auth.test.tsx src/data/aiAssistI18n.test.ts` → 8 file, 198/198 đạt; `npm run build` đạt (cảnh báo chunk >500 kB có sẵn).
- Không chạy `Sidebar.test`/`StaffPreferences.test`: `App.tsx` chỉ thêm một route, không đụng shell.
- Chưa kiểm: kiểm mắt dark/light × desktop + mobile 390 (cổng 3000 và 8080 đều tắt, không tự bật backend AI); stream Groq thật.

### Lệch khác spec
- `aiAssisted?: boolean` (optional) trên `AuthorArticle`/`AuthorArticleSummary`/`ModeratorArticleSummary` để không sửa hàng loạt fixture test; backend luôn trả field.
- `streamDraft` báo quota preflight qua callback `onOpen` (UI hiện “Còn x/y lượt viết” ngay khi stream mở); session lưu cờ `streaming: true` khi đang stream (không lưu buffer) để F5 hiện copy “phiên trước bị gián đoạn”.
- Khung `max-w-5xl` thay `max-w-7xl` của wireframe (form một cột đọc dễ hơn); action bar một phần tử: sticky đáy trên mobile, inline từ `md`.
- Sau create lỗi: nút chính “Lưu nháp và mở trình soạn thảo” là retry cùng key; “Viết lại” bỏ bản completed + nạp lại options. `AI_GENERATION_INVALID`/taxonomy khóa retry.

## Task 2a — Review Codex vòng 1 (2026-11-06) — 2 phát hiện P2, đã sửa

- P2 `aiAssistService.ts`: `
- Chạy thử local: `.env` thiếu `AI_MODEL_CHAT` (mặc định `none` → `AI_CONFIGURATION_INVALID`); đã thêm `AI_MODEL_CHAT=openai`. IntelliJ báo "Command line is too long" → Shorten command line = @argfile.
` bị tách giữa hai chunk không được chuẩn hóa → chuẩn hóa sau khi ghép buffer; test parser thêm ca `` | `
`.
- P2 `AiArticlePage.tsx`: sửa form sau outline/completed giữ payload cũ → mọi thay đổi form xóa bản completed; đổi thẻ ở form đồng bộ vào `outline.tagIds` (giữ gợi ý đang bật, ≤10). Test mới trong `AiArticlePage.test.tsx`.
- Chạy lại: `npx vitest run src/services/aiAssistService.test.ts src/pages/Author/AiArticlePage.test.tsx src/components/articles/AiOutlineEditor.test.tsx` → 22/22 đạt; `npm run build` đạt.

## Task 2a — Review Codex vòng 2 (2026-11-06) — Đạt

- `adversarial-review` phần sửa (`parseSse`, `setField` + test): approve, không phát hiện. Kiểm mắt vẫn Chưa kiểm.

## Task 2a — API quota (quyết định người dùng 2026-11-06)

- Backend: `GET /api/v1/author/ai/quota` (`AuthorAiController.quota`) → `AiOutlineService.quota`: `lockWriter` trong transaction ngắn rồi `AiRateLimitService.peek` (GET key ngày, không đụng burst; Redis lỗi → `AI_STORAGE_UNAVAILABLE`). DTO `AiQuotaResponse(outline, draft)`.
- Frontend: `aiAssist.quota()`; `AiArticlePage` gọi khi mở trang, lỗi thì giữ `—`; số từ lần gọi AI trong trang được ưu tiên.
- Test: `./gradlew test --tests AiRateLimitServiceTest --tests AiOutlineServiceTest --tests AuthorAiControllerTest` → 45/45 đạt (6 ca mới). `npx vitest run src/services/aiAssistService.test.ts src/pages/Author/AiArticlePage.test.tsx src/App.author-session.test.tsx` → 26/26; `npm run build` đạt.
- Lệch khác spec: thêm endpoint ngoài contract bản 1 (spec/wireframe ghi tách module sau) — theo quyết định người dùng.
- Review Codex vòng 1: 1 P2 (quota 0 cũ khóa nút khi tab mở qua 00:00) → tải lại quota khi mở trang và mỗi lần tab nhận `focus`; test mới. Chạy lại 3 file FE 27/27, build đạt.
- Review vòng 2: 1 medium (GET quota trả chậm đè số mới từ lần gọi AI). Người dùng chọn sửa luôn (2026-11-06): `quotaRevision` — mỗi lần gọi AI báo quota thì tăng; refresh chỉ áp nếu revision chưa đổi. Test race mới; 3 file FE 28/28, build đạt. Không chạy thêm vòng review.
- Lỗi chèn ảnh “Kho ảnh tạm thời gián đoạn” (`ARTICLE_STORAGE_UNAVAILABLE`, article-flow) khi chạy thử: người dùng tự xử lý, không thuộc 2a.
